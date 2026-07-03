import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Roles(Role.ADMIN)
  @Get('admin')
  getAdmin() {
    return this.dashboardService.getAdminDashboard();
  }

  @Roles(Role.ADMIN)
  @Get('monthly-profit')
  getMonthlyProfit(@Query('months') months?: string) {
    return this.dashboardService.getMonthlyProfitChart(months ? Number(months) : 6);
  }

  @Roles(Role.TRUCK)
  @Get('truck')
  getTruck(@CurrentUser() user: any) {
    return this.dashboardService.getTruckDashboard(user.truck);
  }
}
