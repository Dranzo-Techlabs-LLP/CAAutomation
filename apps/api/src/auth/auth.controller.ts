import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() user: RequestUser) {
    const fullUser = await this.authService.getProfile(user.id);
    return {
      ...fullUser,
      permissions: user.permissions,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<{ message: string; resetToken?: string }> {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<{ message: string }> {
    return this.authService.confirmPasswordReset(dto.token, dto.newPassword);
  }
}
