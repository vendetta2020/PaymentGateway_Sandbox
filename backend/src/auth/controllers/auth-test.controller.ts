import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiAuthGuard } from '../guards/api-auth.guard';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Controller('auth')
export class AuthTestController {
  @Get('me')
  @UseGuards(ApiAuthGuard)
  getMe(@Req() req: AuthenticatedRequest) {
    return {
      status: 'success',
      data: req.merchant,
      message: 'Authentication successful',
    };
  }
}
