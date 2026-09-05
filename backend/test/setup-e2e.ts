/**
 * E2E test setup — provides default environment variables
 * matching docker-compose.yml so tests work without a .env file.
 */

function setDefault(key: string, value: string): void {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

setDefault('NODE_ENV', 'test');
setDefault('PORT', '3001');
setDefault('DB_HOST', 'localhost');
setDefault('DB_PORT', '5432');
setDefault('DB_USERNAME', 'paymentgw');
setDefault('DB_PASSWORD', 'paymentgw_secret');
setDefault('DB_NAME', 'payment_gateway_test');
setDefault('ALLOW_DEV_CREDENTIAL_PROVISIONING', 'true');
