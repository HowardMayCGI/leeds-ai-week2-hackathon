import assert from "node:assert/strict";
import { test } from "node:test";
import * as pulumi from "@pulumi/pulumi";
import { cacheControl, contentType } from "./assets";
import { originHeader, requireStack, runtimeRoleBoundaryArn, runtimeRolePath } from "./settings";

interface Resource {
  type: string;
  inputs: Record<string, any>;
}
const resources: Resource[] = [];
let resolvePolicy!: (resource: Resource) => void;
const policyRegistered = new Promise<Resource>((resolve) => {
  resolvePolicy = resolve;
});
const stack = requireStack(process.env.TEST_STACK ?? "staging");
// Deliberately different values ensure deployments use stack config, not the local API environment.
process.env.OPENAI_API_KEY = "ignored-environment-key";
process.env.OPENAI_MODEL = "ignored-environment-model";
pulumi.runtime.setMocks(
  {
    newResource(args) {
      resources.push({ type: args.type, inputs: args.inputs });
      if (args.type === "aws:s3/bucketPolicy:BucketPolicy")
        resolvePolicy({ type: args.type, inputs: args.inputs });
      return {
        id: `${args.name}-id`,
        state: {
          ...args.inputs,
          arn: `arn:aws:mock:eu-west-2:322517362875:${args.name}`,
          name: args.inputs.name ?? args.name,
          bucketRegionalDomainName: `${args.name}.s3.eu-west-2.amazonaws.com`,
          apiEndpoint: "https://example.execute-api.eu-west-2.amazonaws.com",
          executionArn: "arn:aws:execute-api:eu-west-2:322517362875:example",
          domainName: "example.cloudfront.net",
          invokeArn: "arn:aws:apigateway:eu-west-2:lambda:path/functions/example/invocations",
          result: "mock-origin-secret",
        },
      };
    },
    call: (args) => args.inputs,
  },
  "leeds-ai-week2-hackathon",
  stack,
  true,
);
pulumi.runtime.setAllConfig(
  {
    "leeds-ai-week2-hackathon:openaiApiKey": "test-only-openai-key",
    "leeds-ai-week2-hackathon:openaiModel": "gpt-6-luna",
  },
  ["leeds-ai-week2-hackathon:openaiApiKey"],
);

test(
  `the ${stack} stack uses private S3, CloudFront-only API access and disabled API caching`,
  { timeout: 10_000 },
  async () => {
    const outputs = await import("../index");
    const website = await new Promise<string>((resolve) =>
      outputs.websiteUrl.apply((value) => {
        resolve(value);
        return value;
      }),
    );
    assert.equal(website, "https://example.cloudfront.net");
    const find = (type: string) => {
      const resource = resources.find((resource) => resource.type === type);
      assert.ok(resource, `Missing resource: ${type}`);
      return resource.inputs;
    };
    const distribution = find("aws:cloudfront/distribution:Distribution");
    assert.equal(distribution.viewerCertificate.cloudfrontDefaultCertificate, true);
    assert.equal(distribution.aliases, undefined);
    assert.equal(distribution.defaultCacheBehavior.targetOriginId, "web");
    assert.equal(distribution.orderedCacheBehaviors[0].pathPattern, "/api/*");
    assert.deepEqual(distribution.orderedCacheBehaviors[0].allowedMethods, [
      "GET",
      "HEAD",
      "OPTIONS",
      "PUT",
      "PATCH",
      "POST",
      "DELETE",
    ]);
    assert.deepEqual(distribution.orderedCacheBehaviors[0].cachedMethods, ["GET", "HEAD"]);
    assert.equal(
      distribution.orderedCacheBehaviors[0].cachePolicyId,
      "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    );
    const apiOrigin = distribution.origins.find((origin: any) => origin.originId === "api");
    assert.deepEqual(apiOrigin.customHeaders, [
      { name: originHeader, value: "mock-origin-secret" },
    ]);
    assert.equal(apiOrigin.customOriginConfig.originProtocolPolicy, "https-only");
    const lambda = find("aws:lambda/function:Function");
    assert.ok(pulumi.runtime.isRpcSecret(lambda.environment));
    const lambdaEnvironment = pulumi.runtime.unwrapRpcSecret(lambda.environment);
    assert.equal(lambda.runtime, "nodejs24.x");
    assert.equal(lambda.name, `leeds-random-${stack}`);
    assert.equal(lambdaEnvironment.variables.ORIGIN_SECRET, apiOrigin.customHeaders[0].value);
    assert.equal(lambdaEnvironment.variables.OPENAI_API_KEY, "test-only-openai-key");
    assert.equal(lambdaEnvironment.variables.OPENAI_MODEL, "gpt-6-luna");
    const executionRole = find("aws:iam/role:Role");
    assert.equal(executionRole.name, `leeds-random-${stack}-api`);
    assert.equal(executionRole.path, runtimeRolePath);
    assert.equal(executionRole.permissionsBoundary, runtimeRoleBoundaryArn);
    // Logging, and Claude inference for AI help. Nothing else.
    const runtimeActions = resources
      .filter((resource) => resource.type === "aws:iam/rolePolicy:RolePolicy")
      .flatMap((resource) => JSON.parse(resource.inputs.policy).Statement.map((statement: any) => statement.Action.join(" ")))
      .sort();
    assert.deepEqual(runtimeActions, [
      "bedrock-mantle:CreateInference",
      "logs:CreateLogStream logs:PutLogEvents",
    ]);
    assert.equal(lambda.timeout, 29);
    assert.equal(lambdaEnvironment.variables.AI_PROVIDER, "openai");
    assert.equal(lambdaEnvironment.variables.AI_MODEL_ID, "anthropic.claude-haiku-5-5");
    assert.equal(find("aws:lambda/permission:Permission").sourceAccount, "322517362875");
    assert.equal(
      find("aws:cloudfront/originAccessControl:OriginAccessControl").signingBehavior,
      "always",
    );
    const publicAccess = find("aws:s3/bucketPublicAccessBlock:BucketPublicAccessBlock");
    for (const key of [
      "blockPublicAcls",
      "blockPublicPolicy",
      "ignorePublicAcls",
      "restrictPublicBuckets",
    ])
      assert.equal(publicAccess[key], true);
    const policyResource = await policyRegistered;
    const policy = JSON.parse(policyResource.inputs.policy);
    assert.equal(policy.Statement[0].Principal.Service, "cloudfront.amazonaws.com");
    assert.ok(policy.Statement[0].Condition.StringEquals["AWS:SourceArn"]);
  },
);

test("static HTML is revalidated while fingerprinted assets can be cached", () => {
  assert.equal(contentType("index.html"), "text/html; charset=utf-8");
  assert.equal(contentType("_next/static/app.js"), "application/javascript; charset=utf-8");
  assert.equal(contentType("assets/images/icon.svg"), "image/svg+xml");
  assert.match(cacheControl("index.html"), /must-revalidate/);
  assert.match(cacheControl("_next/static/hashed.js"), /immutable/);
});

test("only the two agreed stacks are accepted", () => {
  assert.equal(requireStack("staging"), "staging");
  assert.equal(requireStack("prod"), "prod");
  for (const value of [undefined, "dev", "production", ""])
    assert.throws(() => requireStack(value));
});
