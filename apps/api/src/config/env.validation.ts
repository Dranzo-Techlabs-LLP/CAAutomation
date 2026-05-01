type Env = Record<string, string | undefined>;

const requiredKeys = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

export function validateEnv(config: Env): Env {
  const missing = requiredKeys.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (Number.isNaN(Number(config.DB_PORT))) {
    throw new Error('DB_PORT must be a number');
  }

  const accessSecret = config.JWT_ACCESS_SECRET ?? '';
  const refreshSecret = config.JWT_REFRESH_SECRET ?? '';
  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters');
  }

  return config;
}
