import * as Joi from 'joi';

/**
 * Joi schema for environment variable validation.
 * Validates all required variables at application startup.
 * If any required variable is missing or invalid, the app will fail to start
 * with a clear error message — preventing silent misconfiguration.
 */
const configSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),

  // PostgreSQL
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
});

/**
 * Custom validation function for @nestjs/config.
 * Validates process.env against configSchema.
 */
export function validateConfig(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = configSchema.validate(config, {
    abortEarly: true,
    allowUnknown: true, // process.env contains system variables
  });

  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }

  return value as Record<string, unknown>;
}
