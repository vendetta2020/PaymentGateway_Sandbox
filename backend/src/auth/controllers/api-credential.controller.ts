import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { ApiAuthGuard } from '../guards/api-auth.guard';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { ApiCredentialService } from '../services/api-credential.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('API Credentials')
@ApiBearerAuth('API-Key')
@Controller('api-credentials')
@UseGuards(ApiAuthGuard)
export class ApiCredentialController {
  constructor(private readonly apiCredentialService: ApiCredentialService) {}

  @ApiOperation({ summary: 'Provision a new API credential for the authenticated merchant' })
  @Post()
  async createCredential(@Req() req: AuthenticatedRequest) {
    const merchantId = req.merchant.merchantId;
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
