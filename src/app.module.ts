import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TrucksModule } from './trucks/trucks.module';
import { CustomersModule } from './customers/customers.module';
import { PriceListModule } from './price-list/price-list.module';
import { ProductionModule } from './production/production.module';
import { MakingCostModule } from './making-cost/making-cost.module';
import { SalesModule } from './sales/sales.module';
import { WastageModule } from './wastage/wastage.module';
import { StockModule } from './stock/stock.module';
import { StockEntryModule } from './stock-entry/stock-entry.module';
import { OutsourceEntryModule } from './outsource-entry/outsource-entry.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { WorkersModule } from './workers/workers.module';
import { BranchesModule } from './branches/branches.module';
import { TruckLoadsModule } from './truck-loads/truck-loads.module';
import { TruckAssignmentsModule } from './truck-assignments/truck-assignments.module';
import { DriverExpensesModule } from './driver-expenses/driver-expenses.module';
import { DailyClosingModule } from './daily-closing/daily-closing.module';
import { getMongoUri } from './config/mongo-uri';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: getMongoUri({
          ...process.env,
          MONGO_URI: config.get<string>('MONGO_URI'),
          MONGO_DIRECT_HOSTS: config.get<string>('MONGO_DIRECT_HOSTS'),
          MONGO_REPLICA_SET: config.get<string>('MONGO_REPLICA_SET'),
          MONGO_AUTH_SOURCE: config.get<string>('MONGO_AUTH_SOURCE'),
        }),
        family: 4,
      }),
    }),
    AuthModule,
    UsersModule,
    TrucksModule,
    CustomersModule,
    PriceListModule,
    ProductionModule,
    MakingCostModule,
    SalesModule,
    WastageModule,
    StockModule,
    StockEntryModule,
    OutsourceEntryModule,
    DashboardModule,
    ReportsModule,
    SettingsModule,
    WorkersModule,
    BranchesModule,
    TruckLoadsModule,
    TruckAssignmentsModule,
    DriverExpensesModule,
    DailyClosingModule,
  ],
})
export class AppModule {}
