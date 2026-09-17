const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { AppModule } = require('./dist/app.module');

async function run() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  await app.init();

  let mRes = await request(app.getHttpServer()).post('/api/v1/internal/merchants').send({email: 'atk'+Date.now()+'@ex.com', companyName: 'atk'});
  let mId = mRes.body.id;
  let cRes = await request(app.getHttpServer()).post('/api/v1/internal/merchants/'+mId+'/api-credentials').send();
  
  if (!cRes.body || !cRes.body.data) {
    console.error('Failed to get credentials:', cRes.body);
    process.exit(1);
  }
  let token = cRes.body.data.plaintextSecret;

  let cases = [
    { n: '1d', s: '2026-09-01T00:00:00Z', e: '2026-09-02T00:00:00Z' },
    { n: '31d', s: '2026-09-01T00:00:00Z', e: '2026-10-02T00:00:00Z' },
    { n: '31d+1s', s: '2026-09-01T00:00:00Z', e: '2026-10-02T00:00:01Z' },
    { n: '32d', s: '2026-09-01T00:00:00Z', e: '2026-10-03T00:00:00Z' },
    { n: '90d', s: '2026-09-01T00:00:00Z', e: '2026-11-30T00:00:00Z' },
    { n: '365d', s: '2026-09-01T00:00:00Z', e: '2027-09-01T00:00:00Z' },
    { n: '5y', s: '2026-09-01T00:00:00Z', e: '2031-09-01T00:00:00Z' },
    { n: 'rev', s: '2026-09-02T00:00:00Z', e: '2026-09-01T00:00:00Z' },
    { n: 'zero', s: '2026-09-01T00:00:00Z', e: '2026-09-01T00:00:00Z' }
  ];

  for (let c of cases) {
    let r = await request(app.getHttpServer()).post('/api/v1/reconciliations').set('Authorization', 'Bearer '+token).send({periodStart: c.s, periodEnd: c.e});
    console.log(c.n, r.status, r.body.message || '');
  }
  await app.close();
}
run();
