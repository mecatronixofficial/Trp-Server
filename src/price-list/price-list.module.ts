import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PriceListEntry, PriceListSchema } from './schemas/price-list.schema';
import { PriceListService } from './price-list.service';
import { PriceListController } from './price-list.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: PriceListEntry.name, schema: PriceListSchema }])],
  providers: [PriceListService],
  controllers: [PriceListController],
  exports: [MongooseModule, PriceListService],
})
export class PriceListModule {}
