import { Test, TestingModule } from '@nestjs/testing';
import { ApiAuthGuard } from './api-auth.guard';
import { ApiCredentialService } from '../services/api-credential.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MerchantStatus } from '../../merchant/enums/merchant-status.enum';

describe('ApiAuthGuard', () => {
  let guard: ApiAuthGuard;
  let apiCredentialService: jest.Mocked<ApiCredentialService>;

  beforeEach(async () => {
    const apiCredentialServiceMock = {
      findActiveByPublicKey: jest.fn(),
      verifySecret: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiAuthGuard,
        {
          provide: ApiCredentialService,
          useValue: apiCredentialServiceMock,
        },
      ],
    }).compile();

    guard = module.get<ApiAuthGuard>(ApiAuthGuard);
    apiCredentialService = module.get(ApiCredentialService) as any;
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const request = {
      headers: {
        authorization: authHeader,
      },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  it('should throw UnauthorizedException if no header is present', async () => {
    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if header format is invalid', async () => {
    const context = createMockContext('Bearer invalid_format_token');
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key format');
  });

  it('should throw UnauthorizedException if credential is not found', async () => {
    const context = createMockContext('Bearer sk_test_validkey_secret');
    apiCredentialService.findActiveByPublicKey.mockResolvedValueOnce(null);

    await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
  });

  it('should throw UnauthorizedException if merchant is suspended', async () => {
    const context = createMockContext('Bearer sk_test_validkey_secret');
    apiCredentialService.findActiveByPublicKey.mockResolvedValueOnce({
      id: 'cred-1',
      merchantId: 'merch-1',
      merchant: { status: MerchantStatus.SUSPENDED },
    } as any);

    await expect(guard.canActivate(context)).rejects.toThrow('Merchant is not active');
  });

  it('should throw UnauthorizedException if secret is invalid', async () => {
    const context = createMockContext('Bearer sk_test_validkey_secret');
    apiCredentialService.findActiveByPublicKey.mockResolvedValueOnce({
      id: 'cred-1',
      merchantId: 'merch-1',
      secretHash: 'hash',
      merchant: { status: MerchantStatus.ACTIVE },
    } as any);
    apiCredentialService.verifySecret.mockReturnValueOnce(false);

    await expect(guard.canActivate(context)).rejects.toThrow('Invalid API key');
  });

  it('should attach merchant info and return true if valid', async () => {
    const context = createMockContext('Bearer sk_test_validkey_secret');
    apiCredentialService.findActiveByPublicKey.mockResolvedValueOnce({
      id: 'cred-1',
      merchantId: 'merch-1',
      secretHash: 'hash',
      merchant: { status: MerchantStatus.ACTIVE },
    } as any);
    apiCredentialService.verifySecret.mockReturnValueOnce(true);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);

    const req = context.switchToHttp().getRequest() as any;
    expect(req.merchant).toEqual({
      merchantId: 'merch-1',
      credentialId: 'cred-1',
    });
  });
});
