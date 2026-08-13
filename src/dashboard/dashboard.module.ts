import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ProductionModule } from '../production/production.module';
import { MakingCostModule } from '../making-cost/making-cost.module';
import { SalesModule } from '../sales/sales.module';
import { WastageModule } from '../wastage/wastage.module';
import { StockModule } from '../stock/stock.module';
import { CustomersModule } from '../customers/customers.module';
import { WorkersModule } from '../workers/workers.module';
import { TruckLoadsModule } from '../truck-loads/truck-loads.module';
import { TrucksModule } from '../trucks/trucks.module';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyClosing, DailyClosingSchema } from '../daily-closing/schemas/daily-closing.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: DailyClosing.name, schema: DailyClosingSchema }]), ProductionModule, MakingCostModule, SalesModule, WastageModule, StockModule, CustomersModule, WorkersModule, TruckLoadsModule, TrucksModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
