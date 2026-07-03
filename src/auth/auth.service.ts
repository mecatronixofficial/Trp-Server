import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        truck: user.truck,
        displayName: user.displayName,
      },
    };
  }
}
