import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { cacheControl, contentType, listFiles } from "./src/assets";
import {
  accountId,
  originHeader,
  region,
  requireStack,
  runtimeRoleBoundaryArn,
  runtimeRolePath,
} from "./src/settings";

const stack = requireStack(pulumi.getStack());
const prefix = `leeds-random-${stack}`;
const tags = { Project: "leeds-ai-week2-hackathon", Environment: stack };
const config = new pulumi.Config();
const openAiApiKey = config.getSecret("openaiApiKey");
const openAiModel = config.get("openaiModel")?.trim();
const webDirectory = path.resolve(__dirname, "../apps/web/out");
const apiDirectory = path.resolve(__dirname, "../dist/apps/api");
if (
  !existsSync(path.join(webDirectory, "index.html")) ||
  !existsSync(path.join(apiDirectory, "index.js"))
) {
  throw new Error("Build web and api first, or use the Nx infra preview/deploy targets.");
}

const bucket = new aws.s3.Bucket("web", { tags });
const publicAccess = new aws.s3.BucketPublicAccessBlock("web", {
  bucket: bucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});
new aws.s3.BucketOwnershipControls("web", {
  bucket: bucket.id,
  rule: { objectOwnership: "BucketOwnerEnforced" },
});
new aws.s3.BucketServerSideEncryptionConfiguration("web", {
  bucket: bucket.id,
  rules: [{ applyServerSideEncryptionByDefault: { sseAlgorithm: "AES256" } }],
});

const originSecret = new random.RandomPassword("origin-secret", { length: 48, special: false });
const role = new aws.iam.Role("api", {
  name: `${prefix}-api`,
  path: runtimeRolePath,
  permissionsBoundary: runtimeRoleBoundaryArn,
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      { Effect: "Allow", Principal: { Service: "lambda.amazonaws.com" }, Action: "sts:AssumeRole" },
    ],
  }),
  tags,
});
const logs = new aws.cloudwatch.LogGroup("api", {
  name: `/aws/lambda/${prefix}`,
  retentionInDays: 14,
  tags,
});
const logging = new aws.iam.RolePolicy("api-logging", {
  role: role.id,
  policy: logs.arn.apply((arn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
          Resource: `${arn}:*`,
        },
      ],
    }),
  ),
});
// AI help calls Claude in Amazon Bedrock (the bedrock-mantle endpoint) in this
// stack's region. Inference only; the model must also be enabled in Bedrock
// model access. `pulumi config set aiProvider off` turns AI help off.
const aiProvider = config.get("aiProvider") ?? "bedrock";
const aiModelId = config.get("aiModelId") ?? "anthropic.claude-haiku-5-5";
const bedrock = new aws.iam.RolePolicy("api-bedrock", {
  role: role.id,
  policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: ["bedrock-mantle:CreateInference"], Resource: "*" }],
  }),
});
const lambda = new aws.lambda.Function(
  "api",
  {
    name: prefix,
    runtime: "nodejs24.x",
    handler: "index.handler",
    role: role.arn,
    code: new pulumi.asset.FileArchive(apiDirectory),
    // AI answers take a few seconds and photos are read in memory. API Gateway waits up to 30 seconds.
    memorySize: 512,
    timeout: 29,
    environment: {
      variables: {
        ORIGIN_SECRET: originSecret.result,
        NODE_OPTIONS: "--enable-source-maps",
        ...(openAiApiKey ? { OPENAI_API_KEY: openAiApiKey } : {}),
        ...(openAiModel ? { OPENAI_MODEL: openAiModel } : {}),
        AI_PROVIDER: aiProvider,
        AI_MODEL_ID: aiModelId,
      },
    },
    loggingConfig: { logFormat: "JSON", logGroup: logs.name },
    tags,
  },
  { dependsOn: [logging, bedrock] },
);

const api = new aws.apigatewayv2.Api("api", { protocolType: "HTTP", tags });
const integration = new aws.apigatewayv2.Integration("api", {
  apiId: api.id,
  integrationType: "AWS_PROXY",
  integrationUri: lambda.invokeArn,
  payloadFormatVersion: "2.0",
});
const permission = new aws.lambda.Permission("api-gateway", {
  action: "lambda:InvokeFunction",
  function: lambda.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
  sourceAccount: accountId,
});
const route = new aws.apigatewayv2.Route("api", {
  apiId: api.id,
  routeKey: "$default",
  target: pulumi.interpolate`integrations/${integration.id}`,
});
const accessLogs = new aws.cloudwatch.LogGroup("api-access", { retentionInDays: 14, tags });
const stage = new aws.apigatewayv2.Stage(
  "api",
  {
    apiId: api.id,
    name: "$default",
    autoDeploy: true,
    defaultRouteSettings: { throttlingBurstLimit: 20, throttlingRateLimit: 10 },
    accessLogSettings: {
      destinationArn: accessLogs.arn,
      format: JSON.stringify({
        requestId: "$context.requestId",
        method: "$context.httpMethod",
        path: "$context.path",
        status: "$context.status",
      }),
    },
    tags,
  },
  { dependsOn: [route, permission] },
);

const originAccess = new aws.cloudfront.OriginAccessControl("web", {
  name: `${prefix}-web`,
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});
const staticCache = new aws.cloudfront.CachePolicy("static", {
  name: `${prefix}-static`,
  minTtl: 0,
  defaultTtl: 0,
  maxTtl: 31536000,
  parametersInCacheKeyAndForwardedToOrigin: {
    enableAcceptEncodingBrotli: true,
    enableAcceptEncodingGzip: true,
    cookiesConfig: { cookieBehavior: "none" },
    headersConfig: { headerBehavior: "none" },
    queryStringsConfig: { queryStringBehavior: "none" },
  },
});
const securityHeaders = new aws.cloudfront.ResponseHeadersPolicy("security", {
  name: `${prefix}-security`,
  securityHeadersConfig: {
    contentTypeOptions: { override: true },
    frameOptions: { frameOption: "DENY", override: true },
    referrerPolicy: { referrerPolicy: "strict-origin-when-cross-origin", override: true },
    strictTransportSecurity: { accessControlMaxAgeSec: 31536000, override: true },
    contentSecurityPolicy: {
      contentSecurityPolicy:
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      override: true,
    },
  },
});
const distribution = new aws.cloudfront.Distribution(
  "site",
  {
    enabled: true,
    defaultRootObject: "index.html",
    priceClass: "PriceClass_100",
    origins: [
      {
        originId: "web",
        domainName: bucket.bucketRegionalDomainName,
        originAccessControlId: originAccess.id,
        s3OriginConfig: { originAccessIdentity: "" },
      },
      {
        originId: "api",
        domainName: api.apiEndpoint.apply((endpoint) => new URL(endpoint).hostname),
        customOriginConfig: {
          originProtocolPolicy: "https-only",
          httpPort: 80,
          httpsPort: 443,
          originSslProtocols: ["TLSv1.2"],
        },
        customHeaders: [{ name: originHeader, value: originSecret.result }],
      },
    ],
    defaultCacheBehavior: {
      targetOriginId: "web",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],
      cachePolicyId: staticCache.id,
      responseHeadersPolicyId: securityHeaders.id,
      compress: true,
    },
    orderedCacheBehaviors: [
      {
        pathPattern: "/api/*",
        targetOriginId: "api",
        viewerProtocolPolicy: "redirect-to-https",
        // CloudFront requires the seven-method option to forward POST. The handler restricts each route.
        allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
        cachedMethods: ["GET", "HEAD"],
        cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", // AWS managed CachingDisabled
        originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac", // AllViewerExceptHostHeader
        responseHeadersPolicyId: securityHeaders.id,
      },
    ],
    viewerCertificate: { cloudfrontDefaultCertificate: true },
    restrictions: { geoRestriction: { restrictionType: "none" } },
    tags,
  },
  { dependsOn: [stage] },
);

new aws.s3.BucketPolicy(
  "web",
  {
    bucket: bucket.id,
    policy: pulumi.all([bucket.arn, distribution.arn]).apply(([bucketArn, distributionArn]) =>
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Action: "s3:GetObject",
            Resource: `${bucketArn}/*`,
            Condition: { StringEquals: { "AWS:SourceArn": distributionArn } },
          },
        ],
      }),
    ),
  },
  { dependsOn: [publicAccess] },
);

for (const file of listFiles(webDirectory)) {
  const name = createHash("sha256").update(file).digest("hex").slice(0, 20);
  new aws.s3.BucketObjectv2(`asset-${name}`, {
    bucket: bucket.id,
    key: file,
    source: new pulumi.asset.FileAsset(path.join(webDirectory, file)),
    contentType: contentType(file),
    cacheControl: cacheControl(file),
  });
}

export const websiteUrl = pulumi.interpolate`https://${distribution.domainName}`;
export const apiUrl = pulumi.interpolate`https://${distribution.domainName}/api/random`;
export const distributionId = distribution.id;
export const bucketName = bucket.id;
export const awsRegion = region;
