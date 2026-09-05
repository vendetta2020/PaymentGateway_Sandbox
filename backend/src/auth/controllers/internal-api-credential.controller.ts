import { Controller, Post, Param, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCredentialService } from '../services/api-credential.service';

@Controller('internal/merchants/:merchantId/api-credentials')
export class InternalApiCredentialController {
  constructor(
    private readonly apiCredentialService: ApiCredentialService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async createCredential(
    @Param('merchantId', new ParseUUIDPipe({ version: '4' })) merchantId: string,
  ) {
    const isDevProvisioningAllowed = this.configService.get<boolean>('ALLOW_DEV_CREDENTIAL_PROVISIONING');
    
    if (!isDevProvisioningAllowed) {
      throw new NotFoundException('Cannot POST /api/v1/internal/merchants/:merchantId/api-credentials');
    }

    const result = await this.apiCredentialService.createCredential(merchantId);
    
    // We return the plaintextSecret ONLY ONCE here.
    return {
      status: 'success',
      data: {
        credentialId: result.credentialId,
        publicKey: result.publicKey,
        secretKey: result.plaintextSecret,
      },
      message: 'Store this secret key safely. It will not be shown again.',
    };
  }
}
