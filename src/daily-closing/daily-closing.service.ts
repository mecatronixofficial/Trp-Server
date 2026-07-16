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
    const openingBalance = Number(previous?.closingBalance || 0);
    let closingBalance = openingBalance + produced - sold - wasted;
    let closingReturned = returned;
    const current = await this.model.findOne({ branch, date });
    if (current?.status === 'closed' && closingBalance > 0) {
      closingReturned = closingBalance;
      closingBalance = 0;
    }
    const sellingAmount = saleTotals.totalAmount; const profit = sellingAmount - makingCost;
    return this.model.findOneAndUpdate({ branch, date }, { openingBalance, produced, sold, returned: closingReturned, wastage: wasted, closingBalance, sellingAmount, makingCost, profit }, { upsert: true, new: true, setDefaultsOnInsert: true }).populate('branch', 'name code');
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
    const unclosed = drivers.filter((driver) => !driver.driverClosed);
    if (unclosed.length) throw new BadRequestException({ message: 'All drivers must close their truck day first', unclosedDrivers: unclosed.map((driver) => ({ truckId: driver.truckId, driverName: driver.truck?.driverName || 'Driver', truckName: driver.truck?.truckName || 'Truck', reason: driver.closeReason })) });
    const row = await this.calculate(branch, date);
    if (row.closingBalance > 0) {
      row.returned = row.closingBalance;
      row.closingBalance = 0;
    }
    row.status = 'closed'; row.closedAt = new Date(); row.closedBy = user.userId; return row.save();
  }
  async reopen(user: any, branchId: string | undefined, date: string) {
    const branch = user.role === 'admin' ? user.branch : branchId || user.selectedBranch;
    if (!branch) throw new BadRequestException('Select a branch before reopening the day');
    const row = await this.calculate(branch, date);
    row.status = 'open'; row.closedAt = null; row.closedBy = null; row.alertSentAt = null;
    return row.save();
  }
  async checkOverdueClosings() {
    const now = new Date(); const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now));
    if (hour < 20) return;
    const date = this.today(); const branches = await this.branchModel.find({ isActive: true }); const settings = await this.settings.get(); const to = settings.whatsappNumber || settings.phoneNumber;
    for (const branch of branches) {
      const row = await this.calculate(branch._id.toString(), date);
      if (row.status === 'closed' || row.alertSentAt || !to) continue;
      try { const drivers: any[] = await this.truckLoads.reconciliation({ role: 'admin', branch: branch._id.toString() }, date); const openDrivers = drivers.filter((driver) => !driver.driverClosed).map((driver) => `${driver.truck?.driverName || driver.truck?.truckName || 'Driver'}: ${driver.closeReason}`).join('; '); await this.messaging.sendWhatsapp(to, `Tiruppur Ice alert: ${branch.name} (${branch.code}) daily account is not closed for ${date} after 8:00 PM. Driver status: ${openDrivers || 'All drivers closed; branch admin closing pending'}. Produced ${row.produced}, sold ${row.sold}, returned ${row.returned}, wastage ${row.wastage}, balance ${row.closingBalance}, sales Rs.${row.sellingAmount}, making cost Rs.${row.makingCost}, profit Rs.${row.profit}.`); row.alertSentAt = new Date(); await row.save(); } catch (error) { this.logger.error(`WhatsApp closing alert failed for ${branch.name}`, error); }
    }
  }
}
