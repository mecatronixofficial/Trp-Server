import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { ProductionService } from '../production/production.service';
import { SalesService } from '../sales/sales.service';
import { WastageService } from '../wastage/wastage.service';
import { SettingsService } from '../settings/settings.service';
import { MessagingService } from '../messaging/messaging.service';
import { DailyClosing, DailyClosingDocument } from './schemas/daily-closing.schema';
import { MakingCostService } from '../making-cost/making-cost.service';
import { TruckLoadsService } from '../truck-loads/truck-loads.service';
import { StockEntryService } from '../stock-entry/stock-entry.service';
import { totalBarQuantity } from '../common/bar-quantity';

@Injectable()
export class DailyClosingService implements OnModuleInit, OnModuleDestroy {
  private maintenanceTimer?: NodeJS.Timeout;
  private midnightTimer?: NodeJS.Timeout;
  private maintenanceRunning = false;
  private logger = new Logger(DailyClosingService.name);
  constructor(@InjectModel(DailyClosing.name) private model: Model<DailyClosingDocument>, @InjectModel(Branch.name) private branchModel: Model<BranchDocument>, private production: ProductionService, private sales: SalesService, private wastage: WastageService, private costs: MakingCostService, private truckLoads: TruckLoadsService, private stockEntries: StockEntryService, private settings: SettingsService, private messaging: MessagingService) {}
  onModuleInit() {
    this.maintenanceTimer = setInterval(() => this.checkOverdueClosings().catch((e) => this.logger.error(e)), 5 * 60 * 1000);
    this.maintenanceTimer.unref();
    this.scheduleNextMidnight();
    setTimeout(() => this.checkOverdueClosings().catch((e) => this.logger.error(e)), 5000);
  }
  onModuleDestroy() {
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
  }
  private bounds(date: string) { return { from: new Date(`${date}T00:00:00.000+05:30`), to: new Date(`${date}T23:59:59.999+05:30`) }; }
  private today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); }
  private indiaDayOffset(days: number) { return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); }
  private scheduleNextMidnight() {
    const nextMidnight = new Date(`${this.indiaDayOffset(1)}T00:00:01.000+05:30`).getTime();
    const delay = Math.max(1000, nextMidnight - Date.now());
    this.midnightTimer = setTimeout(async () => {
      try {
        await this.checkOverdueClosings();
      } catch (error) {
        this.logger.error('Automatic midnight closing failed', error);
      } finally {
        this.scheduleNextMidnight();
      }
    }, delay);
    this.midnightTimer.unref();
  }
  async calculate(branch: string, date: string) {
    const { from, to } = this.bounds(date);
    const previous = await this.model.findOne({ branch, date: { $lt: date }, status: 'closed' }).sort({ date: -1 });
    const [producedBySize, soldBySize, saleTotals, returned, wasted, makingCost, latestStock, latestProductionDay, current] = await Promise.all([
      this.production.sumBySizeInRange(from, to, branch), this.sales.sumBySizeInRange(from, to, undefined, branch),
      this.sales.sumInRange(from, to, undefined, branch), this.wastage.totalInRange(from, to, undefined, branch, 'unsold'), this.wastage.totalInRange(from, to, undefined, branch, undefined, 'unsold'), this.costs.totalInRange(from, to, branch),
      this.stockEntries.latestBefore(from, branch),
      this.production.latestDayBefore(from, branch),
      this.model.findOne({ branch, date }),
    ]);
    const produced = totalBarQuantity(Object.entries(producedBySize).map(([size, quantity]) => ({ size, quantity })));
    const sold = totalBarQuantity(Object.entries(soldBySize).map(([size, quantity]) => ({ size, quantity })));
    // A same-day reopen carries forward what this branch just returned at its
    // last close today (stored on the row itself). latestBefore() only sees
    // stock entries dated strictly before today, so it can never see that
    // same-day return and must not be used once one exists.
    const sameDayReturn = Math.max(0, Number(current?.returnedTotal ?? current?.returned ?? 0));
    // Legacy records could contain a negative closing balance after truck/shop
    // reconciliation. A new production day must always start from valid stock.
    const carryIn = sameDayReturn > 0
      ? sameDayReturn
      : latestStock && (!latestProductionDay || latestStock.day >= latestProductionDay)
        ? latestStock.total
        : previous?.closingBalance || 0;
    // Yesterday's closing stock is immediately available as today's opening
    // stock; a new production entry is not required to unlock carried bars.
    const openingBalance = Math.max(0, Number(carryIn));
    let closingBalance = Math.max(0, openingBalance + produced - sold - wasted);
    let closingReturned = returned;
    closingReturned = Math.max(closingReturned, sameDayReturn);
    let boxFields: Record<string, any> = {};
    if (current?.status === 'closed') {
      closingBalance = 0;
      const [dayBoxes, productionSettings] = await Promise.all([
        this.production.getDayBoxSummary(from, to, branch, current.sessionStartedAt),
        this.settings.get(),
      ]);
      if (dayBoxes) {
        const barsPerBox = Math.max(1, Number(dayBoxes.barsPerBox || productionSettings.barsPerBox || 2));
        const totalBoxes = Math.max(1, Number(productionSettings.totalBoxes || 200));
        const sessionReturned = Math.max(0, Number(current.lastSessionReturned ?? closingReturned));
        const closingBoxes = Math.ceil(sessionReturned / barsPerBox);
        // closingBox/closingBoxes are informational only; the next-production
        // box cursor always continues right after the last box actually
        // closed, regardless of whether this session's bars sold — see close().
        const closingBox = ((dayBoxes.lastBoxClose - closingBoxes + totalBoxes) % totalBoxes) + 1;
        boxFields = {
          closingBox,
          nextOpeningBox: dayBoxes.lastBoxClose >= totalBoxes ? 1 : dayBoxes.lastBoxClose + 1,
          closingBoxes,
          barsPerBox,
          boxCursorAt: current.boxCursorAt || current.closedAt || new Date(),
        };
      }
    }
    const sellingAmount = saleTotals.totalAmount; const profit = sellingAmount - makingCost;
    return this.model.findOneAndUpdate({ branch, date }, { openingBalance, produced, sold, returned: closingReturned, wastage: wasted, closingBalance, sellingAmount, makingCost, profit, ...boxFields }, { upsert: true, new: true, setDefaultsOnInsert: true }).populate('branch', 'name code');
  }
  async list(user: any, date = this.today()) {
    const branch = user.role === 'admin' ? user.branch : user.selectedBranch;
    if (branch) return [await this.calculate(branch, date)];
    const branches = await this.branchModel.find({ isActive: true });
    return Promise.all(branches.map((row) => this.calculate(row._id.toString(), date)));
  }
  async close(user: any, branchId: string | undefined, date: string) {
    const branch = user.role === 'admin' ? user.branch : branchId || user.selectedBranch;
    if (!branch) throw new BadRequestException('Select a branch before closing the day');
    const drivers: any[] = await this.truckLoads.reconciliation({ ...user, role: 'admin', branch }, date);
    const online = drivers.filter((driver) => Boolean(driver.truck?.isOnline));
    if (online.length) throw new BadRequestException({ message: 'All trucks must be offline before closing the shop', unclosedDrivers: online.map((driver) => ({ truckId: driver.truckId, driverName: driver.truck?.driverName || 'Driver', truckName: driver.truck?.truckName || 'Truck', reason: 'Truck is still online' })) });
    // Registered/offline trucks that never accepted bars today have no daily
    // account to close and must not block the shop closing.
    const activeDrivers = drivers.filter((driver) => Number(driver.taken || 0) > 0.0001);
    const unclosed = activeDrivers.filter((driver) => !driver.driverClosed);
    if (unclosed.length) throw new BadRequestException({ message: 'All drivers must close their truck day first', unclosedDrivers: unclosed.map((driver) => ({ truckId: driver.truckId, driverName: driver.truck?.driverName || 'Driver', truckName: driver.truck?.truckName || 'Truck', reason: driver.closeReason })) });
    const unchecked = activeDrivers.filter((driver) => !driver.checked);
    if (unchecked.length) throw new BadRequestException({ message: 'Admin must check every closed truck before closing the branch', unclosedDrivers: unchecked.map((driver) => ({ truckId: driver.truckId, driverName: driver.truck?.driverName || 'Driver', truckName: driver.truck?.truckName || 'Truck', reason: 'Truck closing has not been checked' })) });
    return this.finalizeClose(branch, date, user.userId);
  }
  private async finalizeClose(branch: string, date: string, closedBy: string | null) {
    const row = await this.calculate(branch, date);
    const { from, to } = this.bounds(date);
    const [dayBoxes, productionSettings] = await Promise.all([
      this.production.getDayBoxSummary(from, to, branch, row.sessionStartedAt),
      this.settings.get(),
    ]);
    const barsPerBox = Math.max(1, Number(dayBoxes?.barsPerBox || productionSettings.barsPerBox || 2));
    const totalBoxes = Math.max(1, Number(productionSettings.totalBoxes || 200));
    const sessionProduced = Math.max(0, Number(row.produced || 0) - Number(row.sessionProducedBaseline || 0));
    const sessionSold = Math.max(0, Number(row.sold || 0) - Number(row.sessionSoldBaseline || 0));
    const sessionWastage = Math.max(0, Number(row.wastage || 0) - Number(row.sessionWastageBaseline || 0));
    // row.openingBalance already carries this session's true starting balance
    // forward — calculate() folds the previous close's returnedTotal into it
    // once one exists (see the sameDayReturn branch above) — so it must not
    // be zeroed out for a 2nd+ session, and returnedTotal must not be added
    // again below. Doing both used to silently re-add stock that had already
    // been sold this session back into the new closing balance.
    const sessionOpeningBalance = Math.max(0, Number(row.openingBalance || 0));
    const returnedBars = Math.max(0, sessionOpeningBalance + sessionProduced - sessionSold - sessionWastage);
    const totalReturnedStock = returnedBars;
    await this.stockEntries.recordClosingStock(branch, date, totalReturnedStock);
    const closingBoxes = Math.ceil(returnedBars / barsPerBox);
    if (dayBoxes) {
      // closingBox/closingBoxes below are informational only (how many boxes'
      // worth of bars came back unsold, for the closing report). The box
      // *cursor* for the next production must not depend on whether today's
      // bars sold — a box is "used" the moment it is opened in production,
      // sold or not, so the next session always continues right after the
      // last box actually closed.
      row.closingBox = ((dayBoxes.lastBoxClose - closingBoxes + totalBoxes) % totalBoxes) + 1;
      row.nextOpeningBox = dayBoxes.lastBoxClose >= totalBoxes ? 1 : dayBoxes.lastBoxClose + 1;
      row.closingBoxes = closingBoxes;
      row.barsPerBox = barsPerBox;
      row.boxCursorAt = new Date();
    }
    if (row.closingBalance > 0) {
      row.closingBalance = 0;
    }
    row.lastSessionReturned = returnedBars;
    row.returnedTotal = totalReturnedStock;
    row.returned = row.returnedTotal;
    row.status = 'closed'; row.closedAt = new Date(); row.closedBy = closedBy as any; return row.save();
  }
  async reopen(user: any, branchId: string | undefined, date: string) {
    const branch = user.role === 'admin' ? user.branch : branchId || user.selectedBranch;
    if (!branch) throw new BadRequestException('Select a branch before reopening the day');
    const row = await this.calculate(branch, date);
    row.status = 'open'; row.closedAt = null; row.closedBy = null; row.alertSentAt = null;
    row.sessionStartedAt = new Date();
    row.sessionProducedBaseline = Number(row.produced || 0);
    row.sessionSoldBaseline = Number(row.sold || 0);
    row.sessionWastageBaseline = Number(row.wastage || 0);
    row.closingBalance = 0;
    return row.save();
  }
  async checkOverdueClosings() {
    if (this.maintenanceRunning) return;
    this.maintenanceRunning = true;
    try {
      const branches = await this.branchModel.find({ isActive: true });
      const previousDate = this.indiaDayOffset(-1);
      for (const branch of branches) {
        const branchId = branch._id.toString();
        try {
          const existing = await this.model.findOne({ branch: branchId, date: previousDate }).select('status');
          if (existing?.status === 'closed') continue;
          await this.truckLoads.autoCloseBranchTrips(branchId, previousDate);
          await this.finalizeClose(branchId, previousDate, null);
          this.logger.log(`Automatically closed ${branch.name} (${branch.code}) for ${previousDate}`);
        } catch (error) {
          this.logger.error(`Automatic closing failed for ${branch.name} (${branch.code}) on ${previousDate}`, error);
        }
      }

      const now = new Date();
      const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now));
      if (hour < 20 || hour >= 24) return;
      const date = this.today(); const settings = await this.settings.get(); const to = settings.whatsappNumber || settings.phoneNumber;
      for (const branch of branches) {
        const row = await this.calculate(branch._id.toString(), date);
        if (row.status === 'closed' || row.alertSentAt || !to) continue;
        try { const drivers: any[] = await this.truckLoads.reconciliation({ role: 'admin', branch: branch._id.toString() }, date); const openDrivers = drivers.filter((driver) => Number(driver.taken || 0) > 0.0001 && !driver.driverClosed).map((driver) => `${driver.truck?.driverName || driver.truck?.truckName || 'Driver'}: ${driver.closeReason}`).join('; '); await this.messaging.sendWhatsapp(to, `Tiruppur Ice alert: ${branch.name} (${branch.code}) daily account is not closed for ${date} after 8:00 PM. Driver status: ${openDrivers || 'All assigned drivers closed; branch admin closing pending'}. Produced ${row.produced}, sold ${row.sold}, returned ${row.returned}, wastage ${row.wastage}, balance ${row.closingBalance}, sales Rs.${row.sellingAmount}, making cost Rs.${row.makingCost}, profit Rs.${row.profit}.`); row.alertSentAt = new Date(); await row.save(); } catch (error) { this.logger.error(`WhatsApp closing alert failed for ${branch.name}`, error); }
      }
    } finally {
      this.maintenanceRunning = false;
    }
  }
}
