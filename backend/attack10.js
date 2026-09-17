const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('./dist/app.module');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { Merchant } = require('./dist/merchant/entities/merchant.entity');
const { ApiCredentialService } = require('./dist/auth/services/api-credential.service');

async function run() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();

  const merchantRepo = app.get(getRepositoryToken(Merchant));
  const merchant = merchantRepo.create({
    name: 'Attack',
    businessName: 'Attack Co',
    email: 'atk' + Date.now() + '@ex.com'
  });
  const savedMerchant = await merchantRepo.save(merchant);
  
  const apiCredService = app.get(ApiCredentialService);
  const cred = await apiCredService.createCredential(savedMerchant.id);
  const token = 'sk_test_' + cred.publicKey + '_' + cred.plaintextSecret;

  let cases = [
    { n: '1d', s: '2026-09-01T00:00:00Z', e: '2026-09-02T00:00:00Z' },
    { n: '31d', s: '2026-09-01T00:00:00Z', e: '2026-10-02T00:00:00Z' },
    { n: '31d+1s', s: '2026-09-01T00:00:00Z', e: '2026-10-02T00:00:01Z' },
    { n: '32d', s: '2026-09-01T00:00:00Z', e: '2026-10-03T00:00:00Z' },
    { n: '90d', s: '2026-09-01T00:00:00Z', e: '2026-11-30T00:00:00Z' },
    { n: '365d', s: '2026-09-01T00:00:00Z', e: '2027-09-01T00:00:00Z' },
    { n: '5y', s: '2026-09-01T00:00:00Z', e: '2031-09-01T00:00:00Z' },
    { n: 'rev', s: '2026-09-02T00:00:00Z', e: '2026-09-01T00:00:00Z' },
    { n: 'zero', s: '2026-09-01T00:00:00Z', e: '2026-09-01T00:00:00Z' },
    { n: 'undefined', s: undefined, e: undefined },
    { n: 'malformed', s: 'not-a-date', e: 'also-not-a-date' }
  ];

  for (let c of cases) {
    let r = await request(app.getHttpServer()).post('/api/v1/reconciliations').set('Authorization', 'Bearer '+token).send({periodStart: c.s, periodEnd: c.e});
    console.log(c.n, '| Status:', r.status, '| Response:', Array.isArray(r.body.message) ? r.body.message.join(', ') : r.body.message || r.body.status);
  }
  await app.close();
}
run();
