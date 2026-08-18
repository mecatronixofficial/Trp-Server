import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StockSnapshot, StockSnapshotDocument } from './schemas/stock.schema';
import { ProductionService } from '../production/production.service';
import { SalesService } from '../sales/sales.service';
import { WastageService } from '../wastage/wastage.service';
import { ICE_BAR_SIZES } from '../common/enums';
import { TruckLoadsService } from '../truck-loads/truck-loads.service';
import { ForbiddenException } from '@nestjs/common';
import { totalBarQuantity } from '../common/bar-quantity';

const EPOCH = new Date('2000-01-01');

@Injectable()
export class StockService {
  constructor(
    @InjectModel(StockSnapshot.name) private stockModel: Model<StockSnapshotDocument>,
    private productionService: ProductionService,
    private salesService: SalesService,
    private wastageService: WastageService,
    private truckLoadsService: TruckLoadsService,
  ) {}

  /**
   * Closing stock as of `asOfDate` (inclusive), computed cumulatively from
   * the beginning of records: total production - total sales - total wastage.
   * This gives an always-correct live figure without needing manual
   * "opening stock" entry, matching: opening + production - sales - wastage = closing.
   */
  async getStockAsOf(asOfDate: Date, branch?: string) {
    const endOfDay = new Date(asOfDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [production, loaded, shopSales, wastage, returned] = await Promise.all([
      this.productionService.sumBySizeInRange(EPOCH, endOfDay, branch),
      this.truckLoadsService.sumBySizeInRange(EPOCH, endOfDay, branch),
      this.salesService.sumBySizeInRange(EPOCH, endOfDay, undefined, branch, true),
      this.wastageService.sumBySizeInRange(EPOCH, endOfDay, undefined, branch, true),
      this.wastageService.sumBySizeInRange(EPOCH, endOfDay, undefined, branch, false, 'unsold'),
    ]);

    const sizeWise = ICE_BAR_SIZES.map((size) => {
      const produced = production[size] || 0;
      const picked = loaded[size] || 0;
      const sold = shopSales[size] || 0;
      const wasted = wastage[size] || 0;
      return { size, quantity: produced - picked - sold - wasted + (returned[size] || 0) };
    });

    const toItems = (totals: Record<string, number>) => Object.entries(totals).map(([size, quantity]) => ({ size, quantity }));
    const totalClosingStock =
      totalBarQuantity(toItems(production))
      - totalBarQuantity(toItems(loaded))
      - totalBarQuantity(toItems(shopSales))
      - totalBarQuantity(toItems(wastage))
      + totalBarQuantity(toItems(returned));
    return { asOfDate, sizeWise, totalClosingStock };
  }

  async getTruckStock(truckId: string, user: any, asOfDate = new Date()) {
    if (user.role === 'truck' && user.truck !== truckId) throw new ForbiddenException('Not allowed to view another truck stock');
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    // Driver availability is a daily balance: today's assigned bars less
    // today's truck sales and wastage/returns. Historical loads must not be
    // carried into the new driver's dashboard.
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(asOfDate);
    const start = new Date(`${day}T00:00:00.000+05:30`);
    const end = new Date(`${day}T23:59:59.999+05:30`);
    const [loaded, sold, wasted] = await Promise.all([
      this.truckLoadsService.sumBySizeInRange(start, end, branch, truckId),
      this.salesService.sumBySizeInRange(start, end, truckId, branch),
      this.wastageService.sumBySizeInRange(start, end, truckId, branch),
    ]);
    const sizeWise = ICE_BAR_SIZES.map((size) => ({ size, quantity: (loaded[size] || 0) - (sold[size] || 0) - (wasted[size] || 0) }));
    const toItems = (totals: Record<string, number>) => Object.entries(totals).map(([size, quantity]) => ({ size, quantity }));
    const totalStock = totalBarQuantity(toItems(loaded)) - totalBarQuantity(toItems(sold)) - totalBarQuantity(toItems(wasted));
    return { truck: truckId, asOfDate, sizeWise, totalStock };
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
