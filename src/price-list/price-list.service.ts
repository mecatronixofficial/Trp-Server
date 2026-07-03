import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PriceListEntry, PriceListDocument } from './schemas/price-list.schema';
import { UpsertPriceDto } from './dto/price-list.dto';

@Injectable()
export class PriceListService {
  constructor(
    @InjectModel(PriceListEntry.name) private priceModel: Model<PriceListDocument>,
  ) {}

  upsert(dto: UpsertPriceDto) {
    return this.priceModel.findOneAndUpdate(
      { customer: dto.customer, size: dto.size, saleType: dto.saleType },
      { price: dto.price },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  findByCustomer(customerId: string) {
    return this.priceModel.find({ customer: customerId }).exec();
  }

  async getPrice(customerId: string, size: string, saleType: string) {
    const entry = await this.priceModel.findOne({ customer: customerId, size, saleType }).exec();
    return entry ? entry.price : null;
  }

  remove(id: string) {
    return this.priceModel.findByIdAndDelete(id);
  }
}
