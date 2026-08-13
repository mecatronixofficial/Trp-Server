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

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('admin')
  getAdmin(@CurrentUser() user: any) {
    return this.dashboardService.getAdminDashboard(user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('monthly-profit')
  getMonthlyProfit(@CurrentUser() user: any, @Query('months') months?: string) {
    return this.dashboardService.getMonthlyProfitChart(months ? Number(months) : 6, user?.role === Role.ADMIN ? user.branch : user?.selectedBranch || undefined);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('sales-trend')
  getSalesTrend(@CurrentUser() user: any, @Query('range') range?: string) {
    const branch = user?.role === Role.ADMIN ? user.branch : user?.selectedBranch || undefined;
    return this.dashboardService.getSalesTrend(range === 'monthly' ? 'monthly' : 'weekly', branch);
  }

  @Roles(Role.TRUCK)
  @Get('truck')
  getTruck(@CurrentUser() user: any) {
    return this.dashboardService.getTruckDashboard(user.truck, user);
  }

  @Roles(Role.TRUCK)
  @Get('truck/trend')
  getTruckTrend(@CurrentUser() user: any, @Query('range') range?: string) {
    return this.dashboardService.getTruckSalesTrend(user.truck, range === 'monthly' ? 'monthly' : 'weekly');
  }
}
