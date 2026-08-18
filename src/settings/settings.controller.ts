import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.get();
  }

  // A branch admin may edit their shop's business identity (name/logo/
  // GST/address). Recovery contacts and box-cycle config are shared across
  // every branch, so those stay super_admin-only — enforced field-by-field
  // in the service, not just by this role gate.
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch()
  update(@Body() dto: any, @CurrentUser() user: any) {
    return this.settingsService.update(dto, user.role === Role.SUPER_ADMIN);
  }
}
