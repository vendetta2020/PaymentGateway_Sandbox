import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MerchantService } from './merchant.service';
import { Merchant } from './entities/merchant.entity';
import { MerchantStatus } from './enums/merchant-status.enum';

describe('MerchantService', () => {
  let service: MerchantService;
  let repository: jest.Mocked<Partial<Repository<Merchant>>>;

  const mockMerchant: Merchant = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'PT Acme Solusi',
    businessName: 'Acme Solutions Inc.',
    email: 'finance@acme.com',
    status: MerchantStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantService,
        {
          provide: getRepositoryToken(Merchant),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<MerchantService>(MerchantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new merchant successfully with normalized email', async () => {
      const createDto = {
        name: '  PT Acme Solusi  ',
        businessName: '  Acme Solutions Inc.  ',
        email: '  FINANCE@ACME.COM  ',
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);
      (repository.create as jest.Mock).mockReturnValue(mockMerchant);
      (repository.save as jest.Mock).mockResolvedValue(mockMerchant);

      const result = await service.create(createDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'finance@acme.com' },
      });
      expect(repository.create).toHaveBeenCalledWith({
        name: 'PT Acme Solusi',
        businessName: 'Acme Solutions Inc.',
        email: 'finance@acme.com',
        status: MerchantStatus.ACTIVE,
      });
      expect(repository.save).toHaveBeenCalledWith(mockMerchant);
      expect(result).toEqual(mockMerchant);
    });

    it('should throw ConflictException if email already exists', async () => {
      const createDto = {
        name: 'PT Acme',
        businessName: 'Acme Inc',
        email: 'finance@acme.com',
      };

      (repository.findOne as jest.Mock).mockResolvedValue(mockMerchant);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on database unique constraint violation (code 23505)', async () => {
      const createDto = {
        name: 'PT Acme',
        businessName: 'Acme Inc',
        email: 'finance@acme.com',
      };

      (repository.findOne as jest.Mock).mockResolvedValue(null);
      (repository.create as jest.Mock).mockReturnValue(mockMerchant);
      (repository.save as jest.Mock).mockRejectedValue({ code: '23505' });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return a merchant if found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(mockMerchant);

      const result = await service.findById(mockMerchant.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockMerchant.id },
      });
      expect(result).toEqual(mockMerchant);
    });

    it('should throw NotFoundException if merchant is not found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return an array of merchants', async () => {
      (repository.find as jest.Mock).mockResolvedValue([mockMerchant]);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockMerchant]);
    });
  });
});
