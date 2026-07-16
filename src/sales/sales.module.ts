import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sale, SaleSchema } from './schemas/sale.schema';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { CustomersModule } from '../customers/customers.module';
import { TrucksModule } from '../trucks/trucks.module';
import { TruckLoadsModule } from '../truck-loads/truck-loads.module';
import { WastageModule } from '../wastage/wastage.module';
import { DailyClosing, DailyClosingSchema } from '../daily-closing/schemas/daily-closing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Sale.name, schema: SaleSchema }, { name: DailyClosing.name, schema: DailyClosingSchema }]),
    CustomersModule,
    TrucksModule,
    TruckLoadsModule,
    WastageModule,
  ],
  providers: [SalesService],
  controllers: [SalesController],
  exports: [MongooseModule, SalesService],
})
export class SalesModule {}
