import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryFailedError } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyKey } from '../entities/idempotency-key.entity';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let idempotencyRepository: jest.Mocked<Repository<IdempotencyKey>>;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: any;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as any;

    idempotencyRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation(dto => dto),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(IdempotencyKey),
          useValue: idempotencyRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  it('should replay result when exact same key and hash exist', async () => {
    idempotencyRepository.findOne.mockResolvedValue({
      requestHash: 'hash123',
      responseStatus: 201,
      responseBody: { success: true },
    } as IdempotencyKey);

    const result = await service.executeIdempotent(
      'merchant1',
      'key1',
      'hash123',
      '/path',
      async () => ({ status: 500, body: 'should not execute' }),
    );

    expect(result.status).toBe(201);
    expect(result.body).toEqual({ success: true });
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('should throw ConflictException if key exists but hash is different', async () => {
    idempotencyRepository.findOne.mockResolvedValue({
      requestHash: 'oldHash',
    } as IdempotencyKey);

    await expect(
      service.executeIdempotent('m1', 'k1', 'newHash', '/path', async () => ({
        status: 200,
        body: 'ok',
      })),
    ).rejects.toThrow(ConflictException);
  });

  it('should execute operation and save idempotency key if not exists', async () => {
    idempotencyRepository.findOne.mockResolvedValue(null);
    
    let executed = false;
    const result = await service.executeIdempotent(
      'm1', 'k1', 'hash1', '/path',
      async (manager) => {
        executed = true;
        expect(manager).toBe(queryRunner.manager);
        return { status: 201, body: { data: 'created' } };
      }
    );

    expect(executed).toBe(true);
    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(queryRunner.manager.save).toHaveBeenCalledTimes(2);
    expect(queryRunner.manager.save).toHaveBeenLastCalledWith(expect.objectContaining({
      merchantId: 'm1',
      key: 'k1',
      requestHash: 'hash1',
      responseStatus: 201,
      responseBody: { data: 'created' },
    }));
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ data: 'created' });
  });

  it('should rollback and return cached response if concurrent transaction commits first (23505)', async () => {
    idempotencyRepository.findOne
      .mockResolvedValueOnce(null) // first check
      .mockResolvedValueOnce({       // check after concurrent commit
        requestHash: 'hash1',
        responseStatus: 201,
        responseBody: { data: 'concurrent-success' },
      } as IdempotencyKey);

    const uniqueError = Object.assign(new QueryFailedError('query', [], new Error()), {
      code: '23505',
      constraint: 'idx_idempotency_merchant_key',
    });

    queryRunner.manager.save.mockRejectedValue(uniqueError);

    const result = await service.executeIdempotent(
      'm1', 'k1', 'hash1', '/path',
      async () => ({ status: 201, body: { data: 'my-success' } })
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(result.body).toEqual({ data: 'concurrent-success' });
  });

  it('should rollback and throw ConflictException if concurrent transaction had DIFFERENT payload', async () => {
    idempotencyRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        requestHash: 'differentHash',
        responseStatus: 201,
        responseBody: { data: 'other-data' },
      } as IdempotencyKey);

    const uniqueError = Object.assign(new QueryFailedError('query', [], new Error()), {
      code: '23505',
      constraint: 'idx_idempotency_merchant_key',
    });

    queryRunner.manager.save.mockRejectedValue(uniqueError);

    await expect(
      service.executeIdempotent(
        'm1', 'k1', 'hash1', '/path',
        async () => ({ status: 201, body: 'ok' })
      )
    ).rejects.toThrow(ConflictException);
  });

  it('should rollback and rethrow business logic errors', async () => {
    idempotencyRepository.findOne.mockResolvedValue(null);

    const businessError = new Error('Business error');

    await expect(
      service.executeIdempotent(
        'm1', 'k1', 'hash1', '/path',
        async () => { throw businessError; }
      )
    ).rejects.toThrow(businessError);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    // Placeholder was saved, but second save with response was never called
    expect(queryRunner.manager.save).toHaveBeenCalledTimes(1);
  });
});
