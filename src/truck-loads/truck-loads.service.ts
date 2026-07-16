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

@Injectable()
export class TruckLoadsService {
  constructor(@InjectModel(TruckLoad.name) private loadModel: Model<TruckLoadDocument>, @InjectModel(Sale.name) private saleModel: Model<SaleDocument>, @InjectModel(Wastage.name) private wastageModel: Model<WastageDocument>, @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>, @InjectModel(DriverExpense.name) private expenseModel: Model<DriverExpenseDocument>, private trucksService: TrucksService) {}

  async create(dto: CreateTruckLoadDto, user: any) {
    const truckId = user.role === 'truck' ? user.truck : dto.truck;
    if (!truckId) throw new NotFoundException('Truck is required');
    const truck = await this.trucksService.findOne(truckId, user);
    await assertDayOpen(this.closingModel, truck.branch.toString(), dto.date);
    await this.assertTripOpen(truckId, dto.date);
    return this.loadModel.create({ ...dto, truck: truckId, branch: truck.branch, date: new Date(dto.date), size: dto.size || '1' });
  }

  findAll(user: any, truck?: string, from?: string, to?: string) {
    const query: any = {};
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (branch) query.branch = branch;
    if (user.role === 'truck') query.truck = user.truck;
    else if (truck) query.truck = truck;
    if (from || to) { query.date = {}; if (from) query.date.$gte = new Date(from); if (to) query.date.$lte = new Date(`${to}T23:59:59.999Z`); }
    return this.loadModel.find(query).populate('truck', 'truckName truckNumber driverName').sort({ date: -1, createdAt: -1 }).exec();
  }

  async remove(id: string, user: any) {
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    const row = await this.loadModel.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!row) throw new NotFoundException('Truck load not found');
    return { deleted: true };
  }

  async sumBySizeInRange(from: Date, to: Date, branch?: string, truck?: string) {
    const rows = await this.loadModel.find({ date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}), ...(truck ? { truck } : {}) });
    const totals: Record<string, number> = {};
    for (const row of rows) totals[row.size] = (totals[row.size] || 0) + row.quantity;
    return totals;
  }

  async reconciliation(user: any, date: string, truckId?: string) {
    const { from, to } = this.dateBounds(date);
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (user.role === 'truck') truckId = user.truck;
    const match: any = { date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}), ...(truckId ? { truck: truckId } : {}) };
    const [loads, sales, wastages, expenses] = await Promise.all([
      this.loadModel.find(match).populate('truck', 'truckName truckNumber driverName'),
      this.saleModel.find(match), this.wastageModel.find(match), this.expenseModel.find(match),
    ]);
    const rows: Record<string, any> = {};
    const ensure = (id: string, truck?: any) => rows[id] ||= { truckId: id, truck, date, taken: 0, sold: 0, returned: 0, wastage: 0, remaining: 0, salesAmount: 0, collectedAmount: 0, pendingAmount: 0, driverAmount: 0, driverClosed: false, driverClosedAt: null, checked: false, checkedAt: null };
    if (user.role !== 'truck') {
      const trucks = await this.trucksService.findAll(user);
      for (const truck of trucks) if (truck.status) ensure(truck._id.toString(), truck);
    }
    for (const load of loads) { const id = String((load.truck as any)?._id || load.truck); const row = ensure(id, load.truck); row.taken += load.quantity; if (load.driverClosedAt) { row.driverClosed = true; row.driverClosedAt = load.driverClosedAt; } if (load.checkedAt) { row.checked = true; row.checkedAt = load.checkedAt; } }
    for (const sale of sales) { const id = String(sale.truck); const row = ensure(id); row.sold += sale.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0); row.salesAmount += Number(sale.totalAmount || 0); row.collectedAmount += Number(sale.paidAmount || 0); row.pendingAmount += Number(sale.balanceAmount || 0); }
    for (const waste of wastages) { const id = String(waste.truck); const row = ensure(id); if (waste.reason === 'unsold') row.returned += waste.quantity; else row.wastage += waste.quantity; }
    for (const expense of expenses) { const id = String(expense.truck); ensure(id).driverAmount += Number(expense.amount || 0); }
    return Object.values(rows).map((row: any) => {
      const remaining = row.taken - row.sold - row.returned - row.wastage;
      const closeReason = row.driverClosed ? 'Closed' : !row.taken ? 'No bars taken / day not started' : remaining < 0 ? `Negative balance ${remaining}` : remaining > 0 ? `${remaining} bar(s) not tallied` : 'Driver has not confirmed closing';
      return { ...row, remaining, closeReason };
    });
  }

  async assertTripOpen(truckId: string, date: string | Date) {
    const { from, to } = this.dateBounds(date);
    if (await this.loadModel.exists({ truck: truckId, date: { $gte: from, $lte: to }, driverClosedAt: { $ne: null } })) throw new BadRequestException('This truck day is closed. No more sales, collections, pickups, returns, wastage, or amounts can be entered.');
  }

  async driverClose(user: any, date: string) {
    const rows: any[] = await this.reconciliation(user, date, user.truck);
    const row = rows[0];
    if (!row?.taken) throw new BadRequestException('Enter bars taken before closing the truck day');
    const remaining = Number(row.remaining || 0);
    if (remaining < -0.0001) throw new BadRequestException(`Cannot close: truck balance is ${remaining}. Sold/returned/wastage is greater than bars taken.`);
    if (remaining > 0.0001) {
      const { from } = this.dateBounds(date);
      await this.wastageModel.create({ branch: user.branch, truck: user.truck, date: from, size: '1', quantity: remaining, reason: 'unsold', notes: 'Automatically returned when driver closed the truck day' });
      row.returned += remaining;
      row.remaining = 0;
    }
    await this.loadModel.updateMany({ truck: user.truck, ...this.dateQuery(date) }, { driverClosedAt: new Date() });
    return { ...row, driverClosed: true, driverClosedAt: new Date() };
  }

  private dateBounds(date: string | Date) { const day = new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); return { from: new Date(`${day}T00:00:00.000+05:30`), to: new Date(`${day}T23:59:59.999+05:30`) }; }
  private dateQuery(date: string | Date) { const { from, to } = this.dateBounds(date); return { date: { $gte: from, $lte: to } }; }

  async checkReconciliation(user: any, truckId: string, date: string) {
    const from = new Date(`${date}T00:00:00.000Z`); const to = new Date(`${date}T23:59:59.999Z`);
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    await this.loadModel.updateMany({ truck: truckId, date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}) }, { checkedAt: new Date(), checkedBy: user.userId });
    return { success: true };
  }
}
