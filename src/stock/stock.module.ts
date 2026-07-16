import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockSnapshot, StockSnapshotSchema } from './schemas/stock.schema';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { ProductionModule } from '../production/production.module';
import { SalesModule } from '../sales/sales.module';
import { WastageModule } from '../wastage/wastage.module';
import { TruckLoadsModule } from '../truck-loads/truck-loads.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: StockSnapshot.name, schema: StockSnapshotSchema }]),
    ProductionModule,
    SalesModule,
    WastageModule,
    TruckLoadsModule,
  ],
  providers: [StockService],
  controllers: [StockController],
  exports: [StockService],
})
export class StockModule {}
