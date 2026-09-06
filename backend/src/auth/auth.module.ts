import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiCredential } from './entities/api-credential.entity';
import { Merchant } from '../merchant/entities/merchant.entity';
import { ApiCredentialService } from './services/api-credential.service';
import { InternalApiCredentialController } from './controllers/internal-api-credential.controller';
import { ApiCredentialController } from './controllers/api-credential.controller';
import { AuthTestController } from './controllers/auth-test.controller';
import { ApiAuthGuard } from './guards/api-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ApiCredential, Merchant])],
  controllers: [InternalApiCredentialController, ApiCredentialController, AuthTestController],
  providers: [ApiCredentialService, ApiAuthGuard],
  exports: [ApiCredentialService, ApiAuthGuard],
})
export class AuthModule {}
