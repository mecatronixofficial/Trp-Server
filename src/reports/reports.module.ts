import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { SalesModule } from '../sales/sales.module';
import { MakingCostModule } from '../making-cost/making-cost.module';
import { WastageModule } from '../wastage/wastage.module';
import { ProductionModule } from '../production/production.module';

@Module({
  imports: [SalesModule, MakingCostModule, WastageModule, ProductionModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
