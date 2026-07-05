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
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
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
    DashboardModule,
    ReportsModule,
    SettingsModule,
    WorkersModule,
  ],
})
export class AppModule {}
