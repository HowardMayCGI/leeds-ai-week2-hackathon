import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { accountId, profile, region, requireStack, stateBackend, stateBucket } from './settings';

const environment: NodeJS.ProcessEnv = { ...process.env, AWS_PROFILE: profile, AWS_REGION: region, AWS_DEFAULT_REGION: region, AWS_SDK_LOAD_CONFIG: '1', AWS_PAGER: '' };
const infrastructureDirectory = path.resolve(__dirname, '..');

function run(command: string, args: string[], capture = false): string {
  const result = spawnSync(command, args, { cwd: infrastructureDirectory, env: environment, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed${capture ? `: ${result.stderr.trim()}` : ''}`);
  return result.stdout?.trim() ?? '';
}

function aws(args: string[], capture = false): string {
  return run('aws', [...args, '--profile', profile, '--region', region, '--no-cli-pager'], capture);
}

function verifyAccount() {
  const actual = aws(['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'], true);
  if (actual !== accountId) throw new Error(`Expected AWS account ${accountId}, received ${actual}.`);
}

function bootstrap() {
  // Only treat a confirmed 404 as a missing bucket: a 403 must not trigger creation.
  const check = spawnSync('aws', ['s3api', 'head-bucket', '--bucket', stateBucket, '--expected-bucket-owner', accountId], { env: environment, encoding: 'utf8' });
  if (check.error) throw check.error;
  if (check.status !== 0) {
    if (!check.stderr.includes('(404)')) throw new Error(`Cannot inspect state bucket: ${check.stderr.trim()}`);
    aws(['s3api', 'create-bucket', '--bucket', stateBucket, '--create-bucket-configuration', `LocationConstraint=${region}`]);
  }
  aws(['s3api', 'put-public-access-block', '--bucket', stateBucket, '--public-access-block-configuration', JSON.stringify({ BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true })]);
  aws(['s3api', 'put-bucket-versioning', '--bucket', stateBucket, '--versioning-configuration', 'Status=Enabled']);
  aws(['s3api', 'put-bucket-encryption', '--bucket', stateBucket, '--server-side-encryption-configuration', JSON.stringify({ Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] })]);
  aws(['s3api', 'put-bucket-policy', '--bucket', stateBucket, '--policy', JSON.stringify({ Version: '2012-10-17', Statement: [{ Sid: 'RequireTLS', Effect: 'Deny', Principal: '*', Action: 's3:*', Resource: [`arn:aws:s3:::${stateBucket}`, `arn:aws:s3:::${stateBucket}/*`], Condition: { Bool: { 'aws:SecureTransport': 'false' } } }] })]);
  console.log(`State bucket ready: ${stateBackend}`);
}

function main() {
  const [operation, stackArgument] = process.argv.slice(2);
  if (operation === 'bootstrap-state') {
    verifyAccount();
    bootstrap();
    return;
  }
  if (!['preview', 'deploy', 'outputs'].includes(operation)) throw new Error('Use an Nx infra preview, deploy, outputs or bootstrap-state target.');
  const stack = requireStack(stackArgument);
  if (!environment.PULUMI_CONFIG_PASSPHRASE) throw new Error('Set PULUMI_CONFIG_PASSPHRASE to encrypt/decrypt Pulumi secrets. See README.md.');
  verifyAccount();
  run('pulumi', ['login', stateBackend, '--non-interactive']);
  if (operation !== 'outputs') run('pulumi', ['stack', 'select', stack, '--create', '--secrets-provider', 'passphrase', '--non-interactive']);
  if (operation === 'outputs') {
    run('pulumi', ['stack', 'output', '--stack', stack]);
    return;
  }
  // Keep Pulumi's interactive preview and confirmation for actual deployments.
  run('pulumi', [operation === 'deploy' ? 'up' : 'preview', '--stack', stack]);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
