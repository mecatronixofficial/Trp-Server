import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wastage, WastageSchema } from './schemas/wastage.schema';
import { WastageService } from './wastage.service';
import { WastageController } from './wastage.controller';
import { DailyClosing, DailyClosingSchema } from '../daily-closing/schemas/daily-closing.schema';
import { TruckLoadsModule } from '../truck-loads/truck-loads.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Wastage.name, schema: WastageSchema }, { name: DailyClosing.name, schema: DailyClosingSchema }]), TruckLoadsModule],
  providers: [WastageService],
  controllers: [WastageController],
  exports: [MongooseModule, WastageService],
})
export class WastageModule {}
