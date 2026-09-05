import { Test, TestingModule } from '@nestjs/testing';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { Merchant } from './entities/merchant.entity';
import { MerchantStatus } from './enums/merchant-status.enum';

describe('MerchantController', () => {
  let controller: MerchantController;
  let service: jest.Mocked<Partial<MerchantService>>;

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
    service = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantController],
      providers: [
        {
          provide: MerchantService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<MerchantController>(MerchantController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call service.create with DTO', async () => {
    const dto = {
      name: 'PT Acme',
      businessName: 'Acme Inc',
      email: 'finance@acme.com',
    };
    (service.create as jest.Mock).mockResolvedValue(mockMerchant);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockMerchant);
  });

  it('should call service.findById with ID', async () => {
    (service.findById as jest.Mock).mockResolvedValue(mockMerchant);

    const result = await controller.findOne(mockMerchant.id);

    expect(service.findById).toHaveBeenCalledWith(mockMerchant.id);
    expect(result).toEqual(mockMerchant);
  });

  it('should call service.findAll', async () => {
    (service.findAll as jest.Mock).mockResolvedValue([mockMerchant]);

    const result = await controller.findAll();

    expect(service.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([mockMerchant]);
  });
});
