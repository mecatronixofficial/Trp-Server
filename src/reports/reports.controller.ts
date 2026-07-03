import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums';
import { ReportsService } from './reports.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('profit-loss')
  profitLoss(@Query('from') from: string, @Query('to') to: string, @Query('truck') truck?: string) {
    return this.reportsService.profitLoss({ from, to, truck });
  }

  @Get('truck-wise')
  truckWise(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.truckWise({ from, to });
  }

  @Get('customer-wise')
  customerWise(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.customerWise({ from, to });
  }

  @Get('size-wise')
  sizeWise(@Query('from') from: string, @Query('to') to: string, @Query('truck') truck?: string) {
    return this.reportsService.sizeWise({ from, to, truck });
  }

  @Get('wastage')
  wastage(@Query('from') from: string, @Query('to') to: string, @Query('truck') truck?: string) {
    return this.reportsService.wastageReport({ from, to, truck });
  }

  @Get('expense')
  expense(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.expenseReport({ from, to });
  }

  @Get('retail-vs-wholesale')
  retailVsWholesale(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.retailVsWholesale({ from, to });
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
  topCustomers(@Query('from') from: string, @Query('to') to: string, @Query('limit') limit?: string) {
    return this.reportsService.topCustomers({ from, to }, limit ? Number(limit) : 5);
  }

  @Get('top-sizes')
  topSizes(@Query('from') from: string, @Query('to') to: string, @Query('limit') limit?: string) {
    return this.reportsService.topSizes({ from, to }, limit ? Number(limit) : 3);
  }
}
