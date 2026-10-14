import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let dbIndicator: TypeOrmHealthIndicator;

  beforeEach(async () => {
    const mockHealthResult = {
      status: 'ok' as const,
      info: { database: { status: 'up' as const } },
      error: {},
      details: { database: { status: 'up' as const } },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockImplementation((indicators: Array<() => unknown>) => {
              indicators.forEach((fn) => fn());
              return Promise.resolve(mockHealthResult);
            }),
          },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: {
            pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    dbIndicator = module.get<TypeOrmHealthIndicator>(TypeOrmHealthIndicator);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should execute health check with database ping', async () => {
    const result = await controller.check();

    expect(healthCheckService.check).toHaveBeenCalledTimes(1);
    expect(dbIndicator.pingCheck).toHaveBeenCalledWith('database');
    expect(result.status).toBe('ok');
    expect(result.info?.database?.status).toBe('up');
  });

  it('should return ok for live endpoint', () => {
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });

  it('should execute ready check with database ping', async () => {
    const result = await controller.ready();

    expect(healthCheckService.check).toHaveBeenCalledTimes(1); // since it's the second call in tests
    expect(dbIndicator.pingCheck).toHaveBeenCalledWith('database');
    expect(result.status).toBe('ok');
  });
});
