import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { StockService } from './stock.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRUCK)
@Controller('stock')
export class StockController {
  constructor(private stockService: StockService) {}

  @Get('truck/:id')
  getTruckStock(@Param('id') id: string, @CurrentUser() user: any, @Query('date') date?: string) {
    return this.stockService.getTruckStock(id, user, date ? new Date(date) : new Date());
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getStock(@CurrentUser() user: any, @Query('date') date?: string) {
    const branch = user.role === Role.ADMIN ? user.branch : user.selectedBranch;
    return this.stockService.getStockAsOf(date ? new Date(date) : new Date(), branch);
  }
}
