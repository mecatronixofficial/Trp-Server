import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrucksService } from '../trucks/trucks.service';
import { CreateTruckLoadDto } from './dto/truck-load.dto';
import { TruckLoad, TruckLoadDocument } from './schemas/truck-load.schema';
import { Sale, SaleDocument } from '../sales/schemas/sale.schema';
import { Wastage, WastageDocument } from '../wastage/schemas/wastage.schema';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';
import { DriverExpense, DriverExpenseDocument } from '../driver-expenses/schemas/driver-expense.schema';
import { BadRequestException } from '@nestjs/common';
import { ProductionService } from '../production/production.service';
import { StockEntryService } from '../stock-entry/stock-entry.service';
import { OutsourceEntryService } from '../outsource-entry/outsource-entry.service';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';

@Injectable()
export class TruckLoadsService {
  constructor(@InjectModel(TruckLoad.name) private loadModel: Model<TruckLoadDocument>, @InjectModel(Sale.name) private saleModel: Model<SaleDocument>, @InjectModel(Wastage.name) private wastageModel: Model<WastageDocument>, @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>, @InjectModel(DriverExpense.name) private expenseModel: Model<DriverExpenseDocument>, private trucksService: TrucksService, private productionService: ProductionService, private stockEntryService: StockEntryService, private outsourceEntryService: OutsourceEntryService) {}

  async assertShopStock(branch: string, date: string | Date, requested: Record<string, number>) {
    const { from, to } = this.dateBounds(date);
    const day = new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const closing = await this.closingModel.findOne({ branch, date: day });
    const sessionStartedAt = closing?.status === 'open' ? closing.sessionStartedAt : null;
    const createdAt = sessionStartedAt ? { createdAt: { $gte: sessionStartedAt } } : {};
    const [produced, loads, shopSales, factoryWastage, stocked, outsourced] = await Promise.all([
      this.productionService.sumBySizeInRange(from, to, branch, sessionStartedAt),
      this.sumBySizeInRange(from, to, branch, undefined, sessionStartedAt),
      this.saleModel.find({ branch, truck: null, date: { $gte: from, $lte: to }, ...createdAt }),
      this.wastageModel.find({ branch, truck: null, reason: { $ne: 'unsold' }, date: { $gte: from, $lte: to }, ...createdAt }),
      this.stockEntryService.totalInRange(from, to, branch, sessionStartedAt),
      this.outsourceEntryService.totalInRange(from, to, branch, sessionStartedAt),
    ]);
    const sold: Record<string, number> = {};
    const wasted: Record<string, number> = {};
    for (const sale of shopSales) for (const item of sale.items) sold[item.size] = (sold[item.size] || 0) + Number(item.quantity || 0);
    for (const row of factoryWastage) wasted[row.size] = (wasted[row.size] || 0) + Number(row.quantity || 0);
    for (const [size, quantity] of Object.entries(requested)) {
      const available = (produced[size] || 0) + (size === '1' ? outsourced - stocked : 0) - (wasted[size] || 0) - (loads[size] || 0) - (sold[size] || 0);
      if (quantity > available + 0.0001) {
        const remaining = Math.max(available, 0);
        throw new BadRequestException(
          `Only ${remaining} bar(s) remaining. The entered ${quantity} bar(s) is higher than the available balance.`,
        );
      }
    }
  }

  async create(dto: CreateTruckLoadDto, user: any) {
    const truckId = user.role === 'truck' ? user.truck : dto.truck;
    if (!truckId) throw new NotFoundException('Truck is required');
    const truck = await this.trucksService.findOne(truckId, user);
    await assertDayOpen(this.closingModel, truck.branch.toString(), dto.date);
    await this.assertTripOpen(truckId, dto.date);
    await this.assertShopStock(truck.branch.toString(), dto.date, { [dto.size || '1']: dto.quantity });
    return this.loadModel.create({ ...dto, truck: truckId, branch: truck.branch, date: new Date(dto.date), size: dto.size || '1' });
  }

  async upsertAssignedLoad(truckId: string, branch: string, date: string, quantity: number, notes?: string) {
    const { from } = this.dateBounds(date);
    const existing = await this.loadModel.findOne({ truck: truckId, branch, date: from, driverClosedAt: null }).sort({ createdAt: -1 });
    const additionalQuantity = Math.max(quantity - Number(existing?.quantity || 0), 0);
    if (additionalQuantity) await this.assertShopStock(branch, date, { '1': additionalQuantity });
    return this.loadModel.findOneAndUpdate(
      { truck: truckId, branch, date: from, driverClosedAt: null },
      { truck: truckId, branch, date: from, size: '1', quantity, notes: notes || '' },
      { new: true, upsert: true },
    );
  }

  async createAssignedLoad(truckId: string, branch: string, date: string | Date, quantity: number, notes?: string) {
    await this.assertShopStock(branch, date, { '1': quantity });
    const { from } = this.dateBounds(date);
    return this.loadModel.create({
      truck: truckId,
      branch,
      date: from,
      size: '1',
      quantity,
      notes: notes || '',
    });
  }

  findAll(user: any, truck?: string, from?: string, to?: string) {
    const query: any = {};
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (branch) query.branch = branch;
    if (user.role === 'truck') query.truck = user.truck;
    else if (truck) query.truck = truck;
    if (from || to) { query.date = {}; if (from) query.date.$gte = indiaDayStart(from); if (to) query.date.$lte = indiaDayEnd(to); }
    return this.loadModel.find(query).populate('truck', 'truckName truckNumber driverName').sort({ date: -1, createdAt: -1 }).exec();
  }

  async remove(id: string, user: any) {
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    const row = await this.loadModel.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!row) throw new NotFoundException('Truck load not found');
    return { deleted: true };
  }

  async sumBySizeInRange(from: Date, to: Date, branch?: string, truck?: string, createdAfter?: Date | null) {
    const rows = await this.loadModel.find({ date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}), ...(truck ? { truck } : {}), ...(createdAfter ? { createdAt: { $gte: createdAfter } } : {}) });
    const totals: Record<string, number> = {};
    for (const row of rows) totals[row.size] = (totals[row.size] || 0) + row.quantity;
    return totals;
  }

  async reconciliation(user: any, date: string, truckId?: string) {
    const { from, to } = this.dateBounds(date);
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (user.role === 'truck') truckId = user.truck;
    const match: any = { date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}), ...(truckId ? { truck: truckId } : {}) };
    const salesMatch = { ...match, truck: truckId || { $ne: null } };
    const truckOnlyMatch = { ...match, truck: truckId || { $ne: null } };
    const [loads, sales, wastages, expenses] = await Promise.all([
      this.loadModel.find(match).populate('truck', 'truckName truckNumber driverName'),
      this.saleModel.find(salesMatch), this.wastageModel.find(truckOnlyMatch), this.expenseModel.find(truckOnlyMatch),
    ]);
    const rows: Record<string, any> = {};
    const ensure = (id: string, truck?: any) => rows[id] ||= { truckId: id, truck, date, taken: 0, sold: 0, returned: 0, wastage: 0, remaining: 0, salesAmount: 0, collectedAmount: 0, pendingAmount: 0, driverAmount: 0, driverClosed: false, driverClosedAt: null, checked: false, checkedAt: null };
    if (user.role !== 'truck') {
      const trucks = await this.trucksService.findAll(user);
      for (const truck of trucks) if (truck.status) ensure(truck._id.toString(), truck);
    }
    for (const load of loads) {
      const id = String((load.truck as any)?._id || load.truck);
      const row = ensure(id, load.truck);
      row.taken += load.quantity;
      const loadTime = new Date((load as any).createdAt || load.date).getTime();
      if (!row.latestLoadAt || loadTime >= row.latestLoadAt) {
        row.latestLoadAt = loadTime;
        row.driverClosed = Boolean(load.driverClosedAt);
        row.driverClosedAt = load.driverClosedAt || null;
        row.checked = Boolean(load.checkedAt);
        row.checkedAt = load.checkedAt || null;
      }
    }
    for (const sale of sales) { const id = String(sale.truck); const row = ensure(id); row.sold += sale.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0); row.salesAmount += Number(sale.totalAmount || 0); row.collectedAmount += Number(sale.paidAmount || 0); row.pendingAmount += Number(sale.balanceAmount || 0); }
    for (const waste of wastages) { const id = String(waste.truck); const row = ensure(id); if (waste.reason === 'unsold') row.returned += waste.quantity; else row.wastage += waste.quantity; }
    for (const expense of expenses) { const id = String(expense.truck); ensure(id).driverAmount += Number(expense.amount || 0); }
    return Object.values(rows).map((row: any) => {
      const remaining = row.taken - row.sold - row.returned - row.wastage;
      const closeReason = row.driverClosed ? 'Closed' : !row.taken ? 'No bars taken / day not started' : remaining < 0 ? `${Math.abs(remaining)} bar(s) over-entered. Correct sale or wastage.` : remaining > 0 ? `${remaining} bar(s) not tallied` : 'Driver has not confirmed closing';
      return { ...row, remaining, closeReason };
    });
  }

  async assertTripOpen(truckId: string, date: string | Date) {
    const { from, to } = this.dateBounds(date);
    const latest = await this.loadModel.findOne({ truck: truckId, date: { $gte: from, $lte: to } }).sort({ createdAt: -1 });
    if (latest?.driverClosedAt) throw new BadRequestException('This truck trip is closed. Admin must assign new ice bars to start another trip.');
  }

  async prepareNewAssignment(truckId: string, date: string | Date) {
    const { from, to } = this.dateBounds(date);
    const latest = await this.loadModel.findOne({ truck: truckId, date: { $gte: from, $lte: to } }).sort({ createdAt: -1 });
    if (!latest?.driverClosedAt) return { startsNewTrip: false };
    if (!latest.checkedAt) {
      throw new BadRequestException('The previous truck return is waiting for Admin approval. Accept it before assigning new bars.');
    }
    await this.correctAcceptedNegativeBalance(truckId, date, latest.branch.toString(), latest.checkedBy);
    return { startsNewTrip: true };
  }

  private async correctAcceptedNegativeBalance(truckId: string, date: string | Date, branch: string, checkedBy?: any) {
    const { from, to } = this.dateBounds(date);
    const match = { truck: truckId, date: { $gte: from, $lte: to } };
    const [loads, sales, wastages] = await Promise.all([
      this.loadModel.find(match),
      this.saleModel.find(match),
      this.wastageModel.find(match),
    ]);
    const taken = loads.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const sold = sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
      0,
    );
    const returnedOrWasted = wastages.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const discrepancy = taken - sold - returnedOrWasted;
    if (discrepancy >= -0.0001) return;

    const acceptedAt = new Date();
    await this.loadModel.create({
      truck: truckId,
      branch,
      date: from,
      size: '1',
      quantity: Math.abs(discrepancy),
      notes: 'Admin-approved balance correction for a completed trip',
      driverClosedAt: acceptedAt,
      checkedAt: acceptedAt,
      checkedBy: checkedBy || null,
    });
  }

  async assertCanLogout(user: any) {
    if (user?.role !== 'truck' || !user?.truck) return;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const rows: any[] = await this.reconciliation(user, today, user.truck);
    const row = rows[0];
    if (!row) return;

    const remaining = Number(row.remaining || 0);
    if (!row.driverClosed && Number(row.taken || 0) > 0) {
      throw new BadRequestException(
        remaining > 0.0001
          ? `Return ${remaining} ice bar(s) and wait for admin approval before logout.`
          : 'Check all truck totals and close the truck day before logout.',
      );
    }
    if (row.driverClosed && !row.checked) {
      throw new BadRequestException('Returned ice bars are waiting for admin approval. The truck must remain Online.');
    }
  }

  async assertTruckBalance(
    user: any,
    truckId: string,
    date: string | Date,
    requestedQuantity: number,
    exclusions: { saleId?: string; wastageId?: string } = {},
  ) {
    const { from, to } = this.dateBounds(date);
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    const match: any = {
      truck: truckId,
      date: { $gte: from, $lte: to },
      ...(branch ? { branch } : {}),
    };
    const [loads, sales, wastages] = await Promise.all([
      this.loadModel.find(match),
      this.saleModel.find({
        ...match,
        ...(exclusions.saleId ? { _id: { $ne: exclusions.saleId } } : {}),
      }),
      this.wastageModel.find({
        ...match,
        ...(exclusions.wastageId ? { _id: { $ne: exclusions.wastageId } } : {}),
      }),
    ]);
    const taken = loads.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const sold = sales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
      0,
    );
    const wastedOrReturned = wastages.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const available = Math.max(0, taken - sold - wastedOrReturned);
    if (requestedQuantity > available + 0.0001) {
      throw new BadRequestException(
        `Only ${available} bar(s) are available in this truck. Correct the sale or wastage quantity.`,
      );
    }
  }

  async driverClose(user: any, date: string) {
    const rows: any[] = await this.reconciliation(user, date, user.truck);
    const row = rows[0];
    if (!row?.taken) throw new BadRequestException('Enter bars taken before closing the truck day');
    const remaining = Number(row.remaining || 0);
    const balanceDiscrepancy = remaining < -0.0001 ? Math.abs(remaining) : 0;
    const { from, to } = this.dateBounds(date);
    const previousAccepted = await this.loadModel.findOne({
      truck: user.truck,
      date: { $gte: from, $lte: to },
      checkedAt: { $ne: null },
    }).sort({ checkedAt: -1 });
    const currentReturnMatch: any = {
      truck: user.truck,
      date: { $gte: from, $lte: to },
      reason: 'unsold',
      ...(previousAccepted?.checkedAt ? { createdAt: { $gt: previousAccepted.checkedAt } } : {}),
    };
    let requiresAdminApproval = Boolean(await this.wastageModel.exists(currentReturnMatch)) || balanceDiscrepancy > 0;
    if (balanceDiscrepancy > 0) row.remaining = 0;
    if (remaining > 0.0001) {
      const { from } = this.dateBounds(date);
      await this.wastageModel.create({ branch: user.branch, truck: user.truck, date: from, size: '1', quantity: remaining, reason: 'unsold', notes: 'Automatically returned when driver closed the truck day' });
      row.returned += remaining;
      row.remaining = 0;
      requiresAdminApproval = true;
    }
    const closedAt = new Date();
    await this.loadModel.updateMany(
      { truck: user.truck, ...this.dateQuery(date), driverClosedAt: null },
      {
        driverClosedAt: closedAt,
        ...(requiresAdminApproval ? {} : { checkedAt: closedAt, checkedBy: user.userId }),
      },
    );
    return {
      ...row,
      driverClosed: true,
      driverClosedAt: closedAt,
      checked: !requiresAdminApproval,
      checkedAt: requiresAdminApproval ? null : closedAt,
      requiresAdminApproval,
      balanceDiscrepancy,
    };
  }

  private dateBounds(date: string | Date) { const day = new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); return { from: new Date(`${day}T00:00:00.000+05:30`), to: new Date(`${day}T23:59:59.999+05:30`) }; }
  private dateQuery(date: string | Date) { const { from, to } = this.dateBounds(date); return { date: { $gte: from, $lte: to } }; }

  async checkReconciliation(user: any, truckId: string, date: string) {
    const { from, to } = this.dateBounds(date);
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    await this.loadModel.updateMany({ truck: truckId, date: { $gte: from, $lte: to }, driverClosedAt: { $ne: null }, checkedAt: null, ...(branch ? { branch } : {}) }, { checkedAt: new Date(), checkedBy: user.userId });
    if (branch) await this.correctAcceptedNegativeBalance(truckId, date, String(branch), user.userId);
    return { success: true };
  }
}
