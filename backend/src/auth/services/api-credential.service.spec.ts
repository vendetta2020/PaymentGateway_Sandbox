import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiCredentialService } from './api-credential.service';
import { ApiCredential } from '../entities/api-credential.entity';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { NotFoundException } from '@nestjs/common';

describe('ApiCredentialService', () => {
  let service: ApiCredentialService;
  let apiCredentialRepository: jest.Mocked<Repository<ApiCredential>>;
  let merchantRepository: jest.Mocked<Repository<Merchant>>;

  beforeEach(async () => {
    const apiCredentialRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const merchantRepoMock = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiCredentialService,
        {
          provide: getRepositoryToken(ApiCredential),
          useValue: apiCredentialRepoMock,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: merchantRepoMock,
        },
      ],
    }).compile();

    service = module.get<ApiCredentialService>(ApiCredentialService);
    apiCredentialRepository = module.get(getRepositoryToken(ApiCredential));
    merchantRepository = module.get(getRepositoryToken(Merchant));
  });

  describe('createCredential', () => {
    it('should throw NotFoundException if merchant does not exist', async () => {
      merchantRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.createCredential('some-id')).rejects.toThrow(NotFoundException);
    });

    it('should create a credential and return the plaintext secret', async () => {
      merchantRepository.findOne.mockResolvedValueOnce({ id: 'some-id' } as Merchant);
      apiCredentialRepository.create.mockImplementationOnce((dto) => dto as any);
      apiCredentialRepository.save.mockResolvedValueOnce({ id: 'cred-id' } as any);

      const result = await service.createCredential('some-id');

      expect(result).toHaveProperty('credentialId');
      expect(result).toHaveProperty('publicKey');
      expect(result).toHaveProperty('plaintextSecret');
      expect(result.plaintextSecret).toMatch(/^sk_test_[a-f0-9]{32}_[a-f0-9]{64}$/);

      expect(apiCredentialRepository.save).toHaveBeenCalled();
      const savedDto = apiCredentialRepository.create.mock.calls[0][0] as ApiCredential;
      expect(savedDto.publicKey).toBe(result.publicKey);
      expect(savedDto.secretHash).toBeDefined();

      // Ensure plaintext isn't stored in hash field
      expect(savedDto.secretHash).not.toContain(result.plaintextSecret);
      expect(savedDto.secretHash).toHaveLength(64); // SHA-256 hex length
    });
  });

  describe('verifySecret', () => {
    it('should return true for a valid secret', async () => {
      // Simulate create
      merchantRepository.findOne.mockResolvedValueOnce({ id: '123' } as Merchant);
      apiCredentialRepository.create.mockImplementationOnce((dto) => dto as any);
      const { plaintextSecret } = await service.createCredential('123');
      const savedDto = apiCredentialRepository.create.mock.calls[0][0];

      // Verify
      const isValid = service.verifySecret(plaintextSecret, (savedDto as ApiCredential).secretHash);
      expect(isValid).toBe(true);
    });

    it('should return false for an invalid secret', async () => {
      merchantRepository.findOne.mockResolvedValueOnce({ id: '123' } as Merchant);
      apiCredentialRepository.create.mockImplementationOnce((dto) => dto as any);
      const { plaintextSecret } = await service.createCredential('123');
      const savedDto = apiCredentialRepository.create.mock.calls[0][0];

      // Verify with tampered secret
      const lastChar = plaintextSecret.slice(-1);
      const replacementChar = lastChar === 'a' ? 'b' : 'a';
      const tamperedSecret =
        plaintextSecret.substring(0, plaintextSecret.length - 1) + replacementChar;
      const isValid = service.verifySecret(tamperedSecret, (savedDto as ApiCredential).secretHash);
      expect(isValid).toBe(false);
    });
  });
});
