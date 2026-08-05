import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutsourceEntry, OutsourceEntrySchema } from './schemas/outsource-entry.schema';
import { OutsourceEntryService } from './outsource-entry.service';
import { OutsourceEntryController } from './outsource-entry.controller';
import { DailyClosing, DailyClosingSchema } from '../daily-closing/schemas/daily-closing.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: OutsourceEntry.name, schema: OutsourceEntrySchema }, { name: DailyClosing.name, schema: DailyClosingSchema }])],
  providers: [OutsourceEntryService],
  controllers: [OutsourceEntryController],
  exports: [MongooseModule, OutsourceEntryService],
})
export class OutsourceEntryModule {}
