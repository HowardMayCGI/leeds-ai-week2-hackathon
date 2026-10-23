export const accountId = '322517362875';
export const region = 'eu-west-2';
export const profile = 'st-prod';
export const stateBucket = `leeds-ai-week2-hackathon-${accountId}-pulumi-state`;
export const stateBackend = `s3://${stateBucket}?region=${region}`;
export const originHeader = 'x-hackathon-origin';
export const runtimeRolePath = '/leeds-ai-week2/';
export const runtimeRoleBoundaryArn = 'arn:aws:iam::aws:policy/PowerUserAccess';

export function requireStack(stack: string | undefined): 'staging' | 'prod' {
  if (stack !== 'staging' && stack !== 'prod') throw new Error('Specify staging or prod explicitly.');
  return stack;
}
