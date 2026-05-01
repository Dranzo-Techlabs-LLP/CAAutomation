import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { RolesService } from '../roles/roles.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './jwt-payload';
import { PasswordResetToken } from './password-reset-token.entity';
import { RefreshToken } from './refresh-token.entity';
import { TokenResponseDto } from './dto/token-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async login(email: string, password: string): Promise<TokenResponseDto> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.markLogin(user.id);
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<TokenResponseDto> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });

    if (!storedToken || !storedToken.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepository.update({ id: storedToken.id }, { revokedAt: new Date() });
    return this.issueTokens(storedToken.user);
  }

  async requestPasswordReset(email: string): Promise<{ message: string; resetToken?: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    const resetToken = randomBytes(32).toString('hex');
    await this.passwordResetTokenRepository.save(
      this.passwordResetTokenRepository.create({
        userId: user.id,
        tokenHash: this.hashToken(resetToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }),
    );

    const response: { message: string; resetToken?: string } = {
      message: 'If the email exists, a reset link has been sent.',
    };

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      response.resetToken = resetToken;
    }

    return response;
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(token);
    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const rounds = Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);
    await this.userRepository.update(
      { id: resetToken.userId },
      { passwordHash: await bcrypt.hash(newPassword, rounds) },
    );
    await this.passwordResetTokenRepository.update({ id: resetToken.id }, { usedAt: new Date() });
    await this.refreshTokenRepository.update({ userId: resetToken.userId }, { revokedAt: new Date() });

    return { message: 'Password reset successfully' };
  }

  async permissionsForUser(user: User): Promise<string[]> {
    return this.rolesService.getPermissionCodes(user.roleId);
  }

  private async issueTokens(user: User): Promise<TokenResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      firmId: user.firmId,
      email: user.email,
      roleId: user.roleId,
    };
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.expiryFrom(refreshExpiresIn),
      }),
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiryFrom(value: string): Date {
    const match = /^(?<amount>\d+)(?<unit>[mhd])$/.exec(value);
    if (!match?.groups) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const amount = Number(match.groups.amount);
    const multipliers: Record<string, number> = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + amount * multipliers[match.groups.unit]);
  }
}
