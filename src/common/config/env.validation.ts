const FORBIDDEN_SECRET_PATTERNS = [
  'change-me',
  'default-secret',
  'replace-with',
  'vidaloca-dev',
];

function isWeakSecret(val: string | undefined, minLength: number): boolean {
  if (!val || val.trim().length < minLength) return true;
  const lower = val.trim().toLowerCase();
  return FORBIDDEN_SECRET_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv =
    typeof config.NODE_ENV === 'string'
      ? config.NODE_ENV.trim()
      : 'development';

  if (nodeEnv === 'production') {
    const errors: string[] = [];

    const dbUrl =
      typeof config.DATABASE_URL === 'string' ? config.DATABASE_URL.trim() : '';
    if (!dbUrl || dbUrl.includes('USER:PASSWORD@HOST')) {
      errors.push(
        'DATABASE_URL must be configured with a valid PostgreSQL connection string in production',
      );
    }

    const jwtSecret =
      typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET : '';
    if (isWeakSecret(jwtSecret, 16)) {
      errors.push(
        'JWT_SECRET must be at least 16 chars and non-placeholder in production',
      );
    }

    const vaultKey =
      typeof config.VAULT_MASTER_KEY === 'string'
        ? config.VAULT_MASTER_KEY
        : '';
    if (isWeakSecret(vaultKey, 32)) {
      errors.push(
        'VAULT_MASTER_KEY must be at least 32 chars and non-placeholder in production',
      );
    }

    const auditPepper =
      typeof config.AUDIT_HASH_PEPPER === 'string'
        ? config.AUDIT_HASH_PEPPER
        : '';
    if (isWeakSecret(auditPepper, 16)) {
      errors.push(
        'AUDIT_HASH_PEPPER must be at least 16 chars and non-placeholder in production',
      );
    }

    if (errors.length > 0) {
      throw new Error(
        `Production environment validation failed:\n- ${errors.join('\n- ')}`,
      );
    }
  }

  return config;
}
