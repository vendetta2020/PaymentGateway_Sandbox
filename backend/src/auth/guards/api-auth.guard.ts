import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ApiCredentialService } from '../services/api-credential.service';
import { MerchantStatus } from '../../merchant/enums/merchant-status.enum';
import { loggerContext } from '../../common/logger/logger.context';

@Injectable()
export class ApiAuthGuard implements CanActivate {
  constructor(private readonly apiCredentialService: ApiCredentialService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    // Token format expected: sk_test_<publicKey>_<randomSecret>
    const parts = token.split('_');
    if (parts.length !== 4 || parts[0] !== 'sk' || parts[1] !== 'test') {
      throw new UnauthorizedException('Invalid API key format');
    }

    const publicKey = parts[2];

    // Find active credential by public key
    const credential = await this.apiCredentialService.findActiveByPublicKey(publicKey);
    if (!credential) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Check merchant status
    if (credential.merchant.status !== MerchantStatus.ACTIVE) {
      throw new UnauthorizedException('Merchant is not active');
    }

    // Verify secret hash
    const isSecretValid = this.apiCredentialService.verifySecret(token, credential.secretHash);
    if (!isSecretValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Attach authenticated context to request
    // We augment the Express Request object with a custom `merchant` property.
    (request as any).merchant = {
      merchantId: credential.merchantId,
      credentialId: credential.id,
    };

    const ctx = loggerContext.getStore();
    if (ctx) {
      ctx.merchantId = credential.merchantId;
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
