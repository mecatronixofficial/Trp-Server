import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ProductionModule } from '../production/production.module';
import { MakingCostModule } from '../making-cost/making-cost.module';
import { SalesModule } from '../sales/sales.module';
import { WastageModule } from '../wastage/wastage.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [ProductionModule, MakingCostModule, SalesModule, WastageModule, StockModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
