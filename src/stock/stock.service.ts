import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StockSnapshot, StockSnapshotDocument } from './schemas/stock.schema';
import { ProductionService } from '../production/production.service';
import { SalesService } from '../sales/sales.service';
import { WastageService } from '../wastage/wastage.service';
import { ICE_BAR_SIZES } from '../common/enums';

const EPOCH = new Date('2000-01-01');

@Injectable()
export class StockService {
  constructor(
    @InjectModel(StockSnapshot.name) private stockModel: Model<StockSnapshotDocument>,
    private productionService: ProductionService,
    private salesService: SalesService,
    private wastageService: WastageService,
  ) {}

  /**
   * Closing stock as of `asOfDate` (inclusive), computed cumulatively from
   * the beginning of records: total production - total sales - total wastage.
   * This gives an always-correct live figure without needing manual
   * "opening stock" entry, matching: opening + production - sales - wastage = closing.
   */
  async getStockAsOf(asOfDate: Date) {
    const endOfDay = new Date(asOfDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [production, sales, wastage] = await Promise.all([
      this.productionService.sumBySizeInRange(EPOCH, endOfDay),
      this.salesService.sumBySizeInRange(EPOCH, endOfDay),
      this.wastageService.sumBySizeInRange(EPOCH, endOfDay),
    ]);

    const sizeWise = ICE_BAR_SIZES.map((size) => {
      const produced = production[size] || 0;
      const sold = sales[size] || 0;
      const wasted = wastage[size] || 0;
      return { size, quantity: produced - sold - wasted };
    });

    const totalClosingStock = sizeWise.reduce((s, r) => s + r.quantity, 0);
    return { asOfDate, sizeWise, totalClosingStock };
  }

  async getTodayStock() {
    return this.getStockAsOf(new Date());
  }

  // Persist a snapshot for a given date (useful for historical reporting / caching)
  async snapshot(date: Date) {
    const stock = await this.getStockAsOf(date);
    return this.stockModel.findOneAndUpdate(
      { date },
      { sizeWise: stock.sizeWise, totalClosingStock: stock.totalClosingStock },
      { upsert: true, new: true },
    );
  }
}
