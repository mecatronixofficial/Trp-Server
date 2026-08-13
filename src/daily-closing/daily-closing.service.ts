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

@Injectable()
export class DailyClosingService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private logger = new Logger(DailyClosingService.name);
  constructor(@InjectModel(DailyClosing.name) private model: Model<DailyClosingDocument>, @InjectModel(Branch.name) private branchModel: Model<BranchDocument>, private production: ProductionService, private sales: SalesService, private wastage: WastageService, private costs: MakingCostService, private truckLoads: TruckLoadsService, private settings: SettingsService, private messaging: MessagingService) {}
  onModuleInit() { this.timer = setInterval(() => this.checkOverdueClosings().catch((e) => this.logger.error(e)), 5 * 60 * 1000); this.timer.unref(); setTimeout(() => this.checkOverdueClosings().catch((e) => this.logger.error(e)), 5000); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  private bounds(date: string) { return { from: new Date(`${date}T00:00:00.000+05:30`), to: new Date(`${date}T23:59:59.999+05:30`) }; }
  private today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); }
  async calculate(branch: string, date: string) {
    const { from, to } = this.bounds(date);
    const previous = await this.model.findOne({ branch, date: { $lt: date }, status: 'closed' }).sort({ date: -1 });
    const [producedBySize, soldBySize, saleTotals, returned, wasted, makingCost] = await Promise.all([
      this.production.sumBySizeInRange(from, to, branch), this.sales.sumBySizeInRange(from, to, undefined, branch),
      this.sales.sumInRange(from, to, undefined, branch), this.wastage.totalInRange(from, to, undefined, branch, 'unsold'), this.wastage.totalInRange(from, to, undefined, branch, undefined, 'unsold'), this.costs.totalInRange(from, to, branch),
    ]);
    const produced = Object.values(producedBySize).reduce((s, v) => s + v, 0);
    const sold = Object.values(soldBySize).reduce((s, v) => s + v, 0);
    // Legacy records could contain a negative closing balance after truck/shop
    // reconciliation. A new production day must always start from valid stock.
    const openingBalance = Math.max(0, Number(previous?.closingBalance || 0));
    let closingBalance = Math.max(0, openingBalance + produced - sold - wasted);
    let closingReturned = returned;
    const current = await this.model.findOne({ branch, date });
    closingReturned = Math.max(closingReturned, Number(current?.returnedTotal ?? current?.returned ?? 0));
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
        const sessionSold = Math.max(0, Number(current.sold || 0) - Number(current.sessionSoldBaseline || 0));
        const closingBox = ((dayBoxes.lastBoxClose - closingBoxes + totalBoxes) % totalBoxes) + 1;
        boxFields = {
          closingBox,
          nextOpeningBox: sessionSold <= 0 ? dayBoxes.firstBoxOpen : (closingBox >= totalBoxes ? 1 : closingBox + 1),
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
    const returnedBars = Math.max(0, sessionProduced - sessionSold - sessionWastage);
    const closingBoxes = Math.ceil(returnedBars / barsPerBox);
    if (dayBoxes) {
      // Returned boxes move the reusable box cursor backwards from the last
      // production closing reading. Example: close 57, return 7 boxes => 51.
      row.closingBox = ((dayBoxes.lastBoxClose - closingBoxes + totalBoxes) % totalBoxes) + 1;
      row.nextOpeningBox = sessionSold <= 0
        ? dayBoxes.firstBoxOpen
        : (row.closingBox >= totalBoxes ? 1 : row.closingBox + 1);
      row.closingBoxes = closingBoxes;
      row.barsPerBox = barsPerBox;
      row.boxCursorAt = new Date();
    }
    if (row.closingBalance > 0) {
      row.closingBalance = 0;
    }
    row.lastSessionReturned = returnedBars;
    row.returnedTotal = Number(row.returnedTotal || 0) + returnedBars;
    row.returned = row.returnedTotal;
    row.status = 'closed'; row.closedAt = new Date(); row.closedBy = user.userId; return row.save();
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
    const now = new Date(); const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now));
    if (hour < 20) return;
    const date = this.today(); const branches = await this.branchModel.find({ isActive: true }); const settings = await this.settings.get(); const to = settings.whatsappNumber || settings.phoneNumber;
    for (const branch of branches) {
      const row = await this.calculate(branch._id.toString(), date);
      if (row.status === 'closed' || row.alertSentAt || !to) continue;
      try { const drivers: any[] = await this.truckLoads.reconciliation({ role: 'admin', branch: branch._id.toString() }, date); const openDrivers = drivers.filter((driver) => Number(driver.taken || 0) > 0.0001 && !driver.driverClosed).map((driver) => `${driver.truck?.driverName || driver.truck?.truckName || 'Driver'}: ${driver.closeReason}`).join('; '); await this.messaging.sendWhatsapp(to, `Tiruppur Ice alert: ${branch.name} (${branch.code}) daily account is not closed for ${date} after 8:00 PM. Driver status: ${openDrivers || 'All assigned drivers closed; branch admin closing pending'}. Produced ${row.produced}, sold ${row.sold}, returned ${row.returned}, wastage ${row.wastage}, balance ${row.closingBalance}, sales Rs.${row.sellingAmount}, making cost Rs.${row.makingCost}, profit Rs.${row.profit}.`); row.alertSentAt = new Date(); await row.save(); } catch (error) { this.logger.error(`WhatsApp closing alert failed for ${branch.name}`, error); }
    }
  }
}
