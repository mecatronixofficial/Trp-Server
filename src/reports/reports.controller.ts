import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('profit-loss')
  profitLoss(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string, @Query('truck') truck?: string) {
    return this.reportsService.profitLoss({ from, to, truck }, user);
  }

  @Get('truck-wise')
  truckWise(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.truckWise({ from, to }, user);
  }

  @Get('customer-wise')
  customerWise(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.customerWise({ from, to }, user);
  }

  @Get('size-wise')
  sizeWise(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string, @Query('truck') truck?: string) {
    return this.reportsService.sizeWise({ from, to, truck }, user);
  }

  @Get('wastage')
  wastage(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string, @Query('truck') truck?: string) {
    return this.reportsService.wastageReport({ from, to, truck }, user);
  }

  @Get('expense')
  expense(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.expenseReport({ from, to }, user);
  }

  @Get('retail-vs-wholesale')
  retailVsWholesale(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.retailVsWholesale({ from, to }, user);
  }

  @Get('sales')
  salesList(
    @CurrentUser() user: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('truck') truck?: string,
    @Query('customer') customer?: string,
    @Query('saleType') saleType?: string,
  ) {
    return this.reportsService.salesList({ from, to, truck, customer, saleType }, user);
  }

  @Get('top-customers')
  topCustomers(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string, @Query('limit') limit?: string) {
    return this.reportsService.topCustomers({ from, to }, limit ? Number(limit) : 5, user);
  }

  @Get('top-sizes')
  topSizes(@CurrentUser() user: any, @Query('from') from: string, @Query('to') to: string, @Query('limit') limit?: string) {
    return this.reportsService.topSizes({ from, to }, limit ? Number(limit) : 3, user);
  }
}
