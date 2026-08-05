import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockEntry, StockEntrySchema } from './schemas/stock-entry.schema';
import { StockEntryService } from './stock-entry.service';
import { StockEntryController } from './stock-entry.controller';
import { DailyClosing, DailyClosingSchema } from '../daily-closing/schemas/daily-closing.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: StockEntry.name, schema: StockEntrySchema }, { name: DailyClosing.name, schema: DailyClosingSchema }])],
  providers: [StockEntryService],
  controllers: [StockEntryController],
  exports: [MongooseModule, StockEntryService],
})
export class StockEntryModule {}
