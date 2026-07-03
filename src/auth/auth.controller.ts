import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

const DEFAULT_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function parseDurationMs(value?: string): number {
  if (!value) return DEFAULT_COOKIE_MAX_AGE_MS;

  const match = value.trim().match(/^(\d+)([smhd])?$/i);
  if (!match) return DEFAULT_COOKIE_MAX_AGE_MS;

  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.authService.login(dto.username, dto.password);
    const nodeEnv = this.config.get<string>('NODE_ENV') || 'development';
    const cookieName = this.config.get<string>('JWT_COOKIE_NAME') || 'tii_token';
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN');
    const cookieSecure = this.config.get<string>('COOKIE_SECURE') === 'true' || nodeEnv === 'production';
    const cookieSameSite = (this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE') ||
      (cookieSecure ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: cookieDomain || undefined,
      path: '/',
      maxAge: parseDurationMs(this.config.get<string>('JWT_EXPIRES_IN')),
    });

    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    const nodeEnv = this.config.get<string>('NODE_ENV') || 'development';
    const cookieName = this.config.get<string>('JWT_COOKIE_NAME') || 'tii_token';
    const cookieDomain = this.config.get<string>('COOKIE_DOMAIN');
    const cookieSecure = this.config.get<string>('COOKIE_SECURE') === 'true' || nodeEnv === 'production';
    const cookieSameSite = (this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE') ||
      (cookieSecure ? 'none' : 'lax')) as 'lax' | 'strict' | 'none';

    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      domain: cookieDomain || undefined,
      path: '/',
    });

    return { success: true };
  }

  @Post('admin/forgot-password')
  forgotAdminPassword(@Body() dto: { method: 'email' | 'mobile' | 'whatsapp' }) {
    return this.authService.requestAdminPasswordReset(dto.method);
  }

  @Post('admin/reset-password')
  resetAdminPassword(
    @Body() dto: { method: 'email' | 'mobile' | 'whatsapp'; otp: string; newPassword: string },
  ) {
    return this.authService.resetAdminPassword(dto.method, dto.otp, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: any) {
    return user;
  }
}
