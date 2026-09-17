import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
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

  @ApiOperation({ summary: 'List all API credentials for the authenticated merchant' })
  @Get()
  async listCredentials(@Req() req: AuthenticatedRequest) {
    const merchantId = req.merchant.merchantId;
    const credentials = await this.apiCredentialService.listCredentials(merchantId);

    return {
      status: 'success',
      data: credentials,
    };
  }

  @ApiOperation({ summary: 'Revoke an API credential for the authenticated merchant' })
  @Delete(':id')
  async revokeCredential(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const merchantId = req.merchant.merchantId;
    const credential = await this.apiCredentialService.revokeCredential(merchantId, id);

    return {
      status: 'success',
      data: credential,
      message: 'API credential successfully revoked',
    };
  }
}
