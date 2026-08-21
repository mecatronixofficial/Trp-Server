import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrucksModule } from '../trucks/trucks.module';
import { TruckLoad, TruckLoadSchema } from './schemas/truck-load.schema';
import { Sale, SaleSchema } from '../sales/schemas/sale.schema';
import { Wastage, WastageSchema } from '../wastage/schemas/wastage.schema';
import { DailyClosing, DailyClosingSchema } from '../daily-closing/schemas/daily-closing.schema';
import { DriverExpense, DriverExpenseSchema } from '../driver-expenses/schemas/driver-expense.schema';
import { TruckLoadsController } from './truck-loads.controller';
import { TruckLoadsService } from './truck-loads.service';
import { ProductionModule } from '../production/production.module';
import { StockEntryModule } from '../stock-entry/stock-entry.module';
import { OutsourceEntryModule } from '../outsource-entry/outsource-entry.module';
import { ExpensesModule } from '../expenses/expenses.module';

@Module({ imports: [MongooseModule.forFeature([{ name: TruckLoad.name, schema: TruckLoadSchema }, { name: Sale.name, schema: SaleSchema }, { name: Wastage.name, schema: WastageSchema }, { name: DailyClosing.name, schema: DailyClosingSchema }, { name: DriverExpense.name, schema: DriverExpenseSchema }]), TrucksModule, ProductionModule, StockEntryModule, OutsourceEntryModule, ExpensesModule], controllers: [TruckLoadsController], providers: [TruckLoadsService], exports: [TruckLoadsService] })
export class TruckLoadsModule {}
