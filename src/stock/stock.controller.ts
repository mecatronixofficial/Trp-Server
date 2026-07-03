import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { StockService } from './stock.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('stock')
export class StockController {
  constructor(private stockService: StockService) {}

  @Get()
  async getStock(@Query('date') date?: string) {
    return this.stockService.getStockAsOf(date ? new Date(date) : new Date());
  }
}
