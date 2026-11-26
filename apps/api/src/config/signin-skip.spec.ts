import { resetEnvCache, signinCodeSkipped, stepUpSkipped } from './env';

describe('signinCodeSkipped (MFA_REQUIRED=false)', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; resetEnvCache(); });
  const at = (vars: Record<string, string>) => { Object.assign(process.env, vars); resetEnvCache(); return signinCodeSkipped(); };

  it('is never skipped on production, even with MFA_REQUIRED=false', () => {
    expect(at({ NODE_ENV: 'production', DEPLOY_ENV: 'production', MFA_REQUIRED: 'false' })).toBe(false);
  });
  it('is skipped on staging only when MFA_REQUIRED=false', () => {
    expect(at({ NODE_ENV: 'production', DEPLOY_ENV: 'staging', MFA_REQUIRED: 'false' })).toBe(true);
    expect(at({ NODE_ENV: 'production', DEPLOY_ENV: 'staging', MFA_REQUIRED: 'true' })).toBe(false);
  });
  it('is skipped locally with MFA_REQUIRED=false', () => {
    expect(at({ NODE_ENV: 'development', DEPLOY_ENV: 'local', MFA_REQUIRED: 'false' })).toBe(true);
  });

  it('confirmation codes: skipped on staging with MFA_REQUIRED=false, never on production', () => {
    const step = (vars: Record<string, string>, hasAuth: boolean) => { Object.assign(process.env, vars); resetEnvCache(); return stepUpSkipped(hasAuth); };
    expect(step({ NODE_ENV: 'production', DEPLOY_ENV: 'staging', MFA_REQUIRED: 'false' }, true)).toBe(true);
    expect(step({ NODE_ENV: 'production', DEPLOY_ENV: 'staging', MFA_REQUIRED: 'true' }, true)).toBe(false);
    expect(step({ NODE_ENV: 'production', DEPLOY_ENV: 'production', MFA_REQUIRED: 'false' }, false)).toBe(false);
    expect(step({ NODE_ENV: 'development', DEPLOY_ENV: 'local', MFA_REQUIRED: 'false' }, false)).toBe(true);
    expect(step({ NODE_ENV: 'development', DEPLOY_ENV: 'local', MFA_REQUIRED: 'false' }, true)).toBe(false);
  });
});
