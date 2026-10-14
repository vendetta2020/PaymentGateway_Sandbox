import { StructuredLoggerService } from './structured-logger.service';
import { loggerContext } from './logger.context';

describe('StructuredLoggerService', () => {
  let service: StructuredLoggerService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new StructuredLoggerService();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should redact sensitive information exactly, as substrings, and values in strings/errors', () => {
    const errorObj = new Error('Authorization failed using Bearer sk_live_xyz123 and whsec_abc');
    service.log({
      event: 'test',
      password: 'secretpassword',
      authorization: 'Bearer token',
      signingSecret: '1234',
      plaintextSecret: 'abc',
      cvv: '123',
      cardNumber: '4111',
      secretHash: 'hash',
      apiKeySecret: 'secret_here',
      bearerToken: 'token_here',
      webhookSigningSecret: 'whsec_secret',
      authorizationToken: 'auth_token',
      paymentCardNumber: '1111',
      secretValue: 'some_value',
      customerPassword: 'password123',
      normalField: 'ok',
      requestId: 'req_123',
      merchantId: 'merch_123',
      webhookEventId: 'evt_123',
      providerReference: 'ref_123',
      nested: {
        arrayObj: [{ innerSecret: 'hide_me' }, { normal: 'show_me' }],
      },
      errorMessage: 'Failed with sk_test_123456789 and Bearer abcdef',
      errorObj,
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    // Substring matches in keys
    expect(logged.password).toBe('[REDACTED]');
    expect(logged.authorization).toBe('[REDACTED]');
    expect(logged.signingSecret).toBe('[REDACTED]');
    expect(logged.plaintextSecret).toBe('[REDACTED]');
    expect(logged.cvv).toBe('[REDACTED]');
    expect(logged.cardNumber).toBe('[REDACTED]');
    expect(logged.secretHash).toBe('[REDACTED]');
    expect(logged.apiKeySecret).toBe('[REDACTED]');
    expect(logged.bearerToken).toBe('[REDACTED]');
    expect(logged.webhookSigningSecret).toBe('[REDACTED]');
    expect(logged.authorizationToken).toBe('[REDACTED]');
    expect(logged.paymentCardNumber).toBe('[REDACTED]');
    expect(logged.secretValue).toBe('[REDACTED]');
    expect(logged.customerPassword).toBe('[REDACTED]');

    // Non-redacted operational fields
    expect(logged.normalField).toBe('ok');
    expect(logged.requestId).toBe('req_123');
    expect(logged.merchantId).toBe('merch_123');
    expect(logged.webhookEventId).toBe('evt_123');
    expect(logged.providerReference).toBe('ref_123');
    expect(logged.level).toBe('info');
    expect(logged.service).toBe('payment-gateway');

    // Nested redaction
    expect(logged.nested.arrayObj[0].innerSecret).toBe('[REDACTED]');
    expect(logged.nested.arrayObj[1].normal).toBe('show_me');

    // String value redaction
    expect(logged.errorMessage).toBe('Failed with sk_test_[REDACTED] and Bearer [REDACTED]');

    // Error object redaction
    expect(logged.errorObj.message).toBe(
      'Authorization failed using Bearer [REDACTED] and whsec_[REDACTED]',
    );
  });

  it('should include request context when available', (done) => {
    loggerContext.run({ requestId: 'req_123', merchantId: 'merch_456' }, () => {
      service.error('An error occurred');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logged.message).toBe('An error occurred');
      expect(logged.requestId).toBe('req_123');
      expect(logged.merchantId).toBe('merch_456');
      expect(logged.level).toBe('error');
      done();
    });
  });

  it('should reliably redact sensitive data regardless of casing and delimiters', () => {
    service.log({
      card_number: '4111',
      'card-number': '4111',
      payment_card_number: '4111',
      'payment-card-number': '4111',

      // Other variations
      api_key_secret: 'secret',
      'api-key-secret': 'secret',
      API_KEY_SECRET: 'secret',
      apikeysecret: 'secret',

      bearer_token: 'secret',
      'bearer-token': 'secret',
      bearertoken: 'secret',

      webhook_signing_secret: 'secret',
      'webhook-signing-secret': 'secret',
      webhooksigningsecret: 'secret',

      secret_hash: 'secret',
      'secret-hash': 'secret',
      secrethash: 'secret',

      plaintext_secret: 'secret',
      'plaintext-secret': 'secret',
      plaintextsecret: 'secret',

      authorization_token: 'secret',
      'authorization-token': 'secret',
      authorizationtoken: 'secret',

      AUTHORIZATION: 'secret',
      Authorization: 'secret',

      // PAN variants
      pan: '4111',
      PAN: '4111',
      primaryAccountNumber: '4111',
      primary_account_number: '4111',
      'primary-account-number': '4111',

      // Ensure NO over-redaction
      company: 'Acme', // Contains 'pan' if we aren't careful
      span: 'test', // Contains 'pan'
      merchantId: 'merch_123',
      paymentId: 'pay_123',
      requestId: 'req_123',
      webhookEventId: 'evt_123',
      providerReference: 'ref_123',
      statusCode: 200,
      event: 'test',
      route: '/api/v1/test',
    });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    // Check delimited card fields
    expect(logged.card_number).toBe('[REDACTED]');
    expect(logged['card-number']).toBe('[REDACTED]');
    expect(logged.payment_card_number).toBe('[REDACTED]');
    expect(logged['payment-card-number']).toBe('[REDACTED]');

    // Check API Key
    expect(logged.api_key_secret).toBe('[REDACTED]');
    expect(logged['api-key-secret']).toBe('[REDACTED]');
    expect(logged.API_KEY_SECRET).toBe('[REDACTED]');
    expect(logged.apikeysecret).toBe('[REDACTED]');

    // Check Bearer Token
    expect(logged.bearer_token).toBe('[REDACTED]');
    expect(logged['bearer-token']).toBe('[REDACTED]');
    expect(logged.bearertoken).toBe('[REDACTED]');

    // Check Webhook Secret
    expect(logged.webhook_signing_secret).toBe('[REDACTED]');
    expect(logged['webhook-signing-secret']).toBe('[REDACTED]');
    expect(logged.webhooksigningsecret).toBe('[REDACTED]');

    // Check Secret Hash
    expect(logged.secret_hash).toBe('[REDACTED]');
    expect(logged['secret-hash']).toBe('[REDACTED]');
    expect(logged.secrethash).toBe('[REDACTED]');

    // Check Plaintext Secret
    expect(logged.plaintext_secret).toBe('[REDACTED]');
    expect(logged['plaintext-secret']).toBe('[REDACTED]');
    expect(logged.plaintextsecret).toBe('[REDACTED]');

    // Check Authorization Token
    expect(logged.authorization_token).toBe('[REDACTED]');
    expect(logged['authorization-token']).toBe('[REDACTED]');
    expect(logged.authorizationtoken).toBe('[REDACTED]');
    expect(logged.AUTHORIZATION).toBe('[REDACTED]');
    expect(logged.Authorization).toBe('[REDACTED]');

    // Check PAN variants
    expect(logged.pan).toBe('[REDACTED]');
    expect(logged.PAN).toBe('[REDACTED]');
    expect(logged.primaryAccountNumber).toBe('[REDACTED]');
    expect(logged.primary_account_number).toBe('[REDACTED]');
    expect(logged['primary-account-number']).toBe('[REDACTED]');

    // Verify NO over-redaction
    expect(logged.company).toBe('Acme');
    expect(logged.span).toBe('test');
    expect(logged.merchantId).toBe('merch_123');
    expect(logged.paymentId).toBe('pay_123');
    expect(logged.requestId).toBe('req_123');
    expect(logged.webhookEventId).toBe('evt_123');
    expect(logged.providerReference).toBe('ref_123');
    expect(logged.statusCode).toBe(200);
    expect(logged.event).toBe('test');
    expect(logged.route).toBe('/api/v1/test');
  });
});
