import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';
import { MailService } from '../mail/mail.service';
import { MessagingService } from '../messaging/messaging.service';

type ResetMethod = 'email' | 'mobile' | 'whatsapp';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private settingsService: SettingsService,
    private mailService: MailService,
    private messagingService: MessagingService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new UnauthorizedException('Invalid username or password');
    if (!user.isActive) throw new UnauthorizedException('This account has been deactivated');

    const valid = await this.usersService.validatePassword(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid username or password');

    const payload = {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
      truck: user.truck ? user.truck.toString() : null,
      branch: user.branch ? user.branch.toString() : null,
    };

    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        truck: user.truck,
        displayName: user.displayName,
        branch: user.branch,
      },
    };
  }

  async requestAdminPasswordReset(method: ResetMethod) {
    const admin = await this.usersService.findAdmin();
    if (!admin) throw new BadRequestException('Admin account is not active.');

    const destination = await this.getAdminResetDestination(method);
    const otp = randomInt(100000, 1000000).toString();

    admin.resetOtpHash = await bcrypt.hash(otp, 10);
    admin.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    admin.resetOtpMethod = method;
    admin.resetOtpDestination = destination;
    await admin.save();

    const delivery = await this.sendOtp(method, destination, otp);
    return {
      success: true,
      method,
      maskedDestination: this.maskDestination(method, destination),
      delivery,
    };
  }

  async resetAdminPassword(method: ResetMethod, otp: string, newPassword: string) {
    if (!otp || !/^\d{4,6}$/.test(otp.trim())) {
      throw new BadRequestException('Enter the OTP sent to the admin.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters.');
    }

    const admin = await this.usersService.findAdmin();
    if (!admin || !admin.resetOtpHash || !admin.resetOtpExpiresAt) {
      throw new BadRequestException('Request a new OTP before resetting the password.');
    }

    if (admin.resetOtpMethod !== method) {
      throw new BadRequestException('Request a new OTP for this reset method.');
    }

    if (admin.resetOtpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP expired. Request a new OTP.');
    }

    const validOtp = await bcrypt.compare(otp.trim(), admin.resetOtpHash);
    if (!validOtp) throw new BadRequestException('Invalid OTP.');

    await this.usersService.resetPassword(admin._id.toString(), newPassword);
    return { success: true };
  }

  private async getAdminResetDestination(method: ResetMethod) {
    const settings = await this.settingsService.get();
    const destinationByMethod: Record<ResetMethod, string> = {
      email: settings.email,
      mobile: settings.phoneNumber,
      whatsapp: settings.whatsappNumber || settings.phoneNumber,
    };

    const destination = (destinationByMethod[method] || '').trim();
    if (!destination) {
      throw new BadRequestException(`Add admin ${method === 'email' ? 'email' : 'phone number'} in settings first.`);
    }

    return destination;
  }

  private async sendOtp(method: ResetMethod, destination: string, otp: string) {
    if (method === 'email') return this.sendEmailOtp(destination, otp);
    if (method === 'mobile') return this.messagingService.sendOtp('sms', destination, otp);
    return this.messagingService.sendOtp('whatsapp', destination, otp);
  }

  private async sendEmailOtp(destination: string, otp: string) {
    return this.mailService.send({
      to: destination,
      subject: 'Tiruppur Ice admin password reset OTP',
      text: `Your Tiruppur Ice admin password reset OTP is ${otp}. It expires in 10 minutes.`,
    });
  }

  private maskDestination(method: ResetMethod, destination: string) {
    if (method === 'email') {
      const [name, domain] = destination.split('@');
      if (!domain) return destination;
      return `${name.slice(0, 2)}***@${domain}`;
    }

    const digits = destination.replace(/\D/g, '');
    if (digits.length <= 4) return destination;
    return `${destination.slice(0, Math.max(0, destination.length - 4)).replace(/\d/g, '*')}${digits.slice(-4)}`;
  }
}
