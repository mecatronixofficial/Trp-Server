import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Sale, SaleDocument } from './schemas/sale.schema';
import { AddSalePaymentDto, CreateSaleDto, UpdateSaleDto } from './dto/sale.dto';
import { CustomersService } from '../customers/customers.service';
import { Truck, TruckDocument } from '../trucks/schemas/truck.schema';
import { TruckLoadsService } from '../truck-loads/truck-loads.service';
import { WastageService } from '../wastage/wastage.service';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';
import { totalBarQuantity } from '../common/bar-quantity';

interface AuthUser {
  userId: string;
  role: string;
  truck: string | null;
  branch: string | null;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name) private saleModel: Model<SaleDocument>,
    private customersService: CustomersService,
    @InjectModel(Truck.name) private truckModel: Model<TruckDocument>,
    private truckLoadsService: TruckLoadsService,
    private wastageService: WastageService,
    @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  private buildItems(items: { size: string; quantity: number; pricePerBar: number }[]) {
    const built = items.map((i) => ({
      ...i,
      total: Number(i.quantity) * Number(i.pricePerBar),
    }));
    const totalAmount = built.reduce((sum, i) => sum + i.total, 0);
    return { built, totalAmount };
  }

  async create(dto: CreateSaleDto, user: AuthUser) {
    // truck users can only create sales for their own truck
    const truckId = user.role === 'truck' ? user.truck : dto.truck;
    if (user.role === 'truck' && dto.truck !== user.truck) {
      throw new ForbiddenException('You can only add sales for your own truck');
    }
    const truck = truckId ? await this.truckModel.findById(truckId).exec() : null;
    if (truckId && !truck) throw new NotFoundException('Truck not found');
    const branch = truck?.branch?.toString() || (user.role === 'super_admin' ? (user as any).selectedBranch : user.branch);
    if (!branch) throw new ForbiddenException('Select a branch before recording a shop sale');
    if (truck && user.role !== 'super_admin' && branch !== user.branch) throw new ForbiddenException('Truck belongs to another branch');
    await assertDayOpen(this.closingModel, branch, dto.date);
    if (truckId) await this.truckLoadsService.assertTripOpen(truckId, dto.date);

    const { built, totalAmount } = this.buildItems(dto.items);
    if (truckId) {
      await this.truckLoadsService.assertTruckBalance(
        user,
        truckId,
        dto.date,
        totalBarQuantity(built),
      );
    } else {
      const requested: Record<string, number> = {};
      for (const item of built) requested[item.size] = (requested[item.size] || 0) + item.quantity;
      await this.truckLoadsService.assertShopStock(branch, dto.date, requested);
    }
    const balanceAmount = totalAmount - dto.paidAmount;

    const sale = await this.saleModel.create({
      date: new Date(dto.date),
      branch,
      truck: truckId,
      customer: dto.customer,
      saleType: dto.saleType,
      items: built,
      totalAmount,
      paymentMode: dto.paymentMode,
      paidAmount: dto.paidAmount,
      balanceAmount,
      notes: dto.notes || '',
    });

    if (balanceAmount > 0) {
      await this.customersService.adjustCreditBalance(dto.customer, balanceAmount);
    }

    return sale;
  }

  async findAll(
    filters: {
      from?: string;
      to?: string;
      truck?: string;
      customer?: string;
      saleType?: string;
      paymentStatus?: 'paid' | 'partial' | 'unpaid';
    },
    user: AuthUser,
  ) {
    const query: any = {};
    if (user.role !== 'super_admin') query.branch = user.branch;
    else if ((user as any).selectedBranch) query.branch = (user as any).selectedBranch;
    if (user.role === 'truck') query.truck = user.truck;
    else if (filters.truck) query.truck = filters.truck;

    if (filters.customer) query.customer = filters.customer;
    if (filters.saleType) query.saleType = filters.saleType;
    if (filters.from || filters.to) {
      query.date = {};
      if (filters.from) query.date.$gte = indiaDayStart(filters.from);
      if (filters.to) query.date.$lte = indiaDayEnd(filters.to);
    }
    if (filters.paymentStatus === 'paid') query.balanceAmount = 0;
    if (filters.paymentStatus === 'partial') query.balanceAmount = { $gt: 0, $lt: '$totalAmount' as any };
    if (filters.paymentStatus === 'unpaid') query.$expr = { $eq: ['$balanceAmount', '$totalAmount'] };

    const sales = await this.saleModel
      .find(query)
      .populate('truck', 'truckName truckNumber')
      .populate('customer', 'name phoneNumber address defaultSaleType creditBalance truck createdAt')
      .sort({ date: -1, createdAt: -1 })
      .exec();

    // Keep a direct name in the response for clients that render a compact
    // sale card, while retaining the populated customer object for details.
    return sales.map((sale) => ({
      ...sale.toObject(),
      customerName: (sale.customer as any)?.name || '',
    }));
  }

  async findOne(id: string, user: AuthUser) {
    const query: any = { _id: id };
    if (user.role !== 'super_admin') query.branch = user.branch;
    const sale = await this.saleModel.findOne(query).populate('truck customer').exec();
    if (!sale) throw new NotFoundException('Sale not found');
    if (user.role === 'truck' && (!sale.truck || (sale.truck as any)._id.toString() !== user.truck)) {
      throw new ForbiddenException('Not allowed to view this sale');
    }
    return sale;
  }

  async update(id: string, dto: UpdateSaleDto, user: AuthUser) {
    // Only admin can edit an existing sale entry (per spec: "Admin can edit wrong sales entry")
    if (!['admin', 'super_admin'].includes(user.role)) throw new ForbiddenException('Only admin can edit sales entries');

    const existing = await this.saleModel.findOne({ _id: id, ...(user.role === 'super_admin' ? {} : { branch: user.branch }) });
    if (!existing) throw new NotFoundException('Sale not found');

    const { built, totalAmount } = this.buildItems(dto.items);
    const balanceAmount = totalAmount - dto.paidAmount;
    if (balanceAmount < 0) throw new BadRequestException('Paid amount cannot be greater than the sale total');

    const truck = dto.truck ? await this.truckModel.findById(dto.truck).exec() : null;
    if (dto.truck && !truck) throw new NotFoundException('Truck not found');
    const branch = truck?.branch?.toString() || (user.role === 'super_admin' ? (user as any).selectedBranch : user.branch);
    if (!branch) throw new ForbiddenException('Select a branch before saving a shop sale');
    if (truck && user.role !== 'super_admin' && truck.branch?.toString() !== user.branch) throw new ForbiddenException('Truck belongs to another branch');
    await assertDayOpen(this.closingModel, branch, dto.date);
    if (dto.truck) {
      await this.truckLoadsService.assertTripOpen(dto.truck, dto.date);
      await this.truckLoadsService.assertTruckBalance(
        user,
        dto.truck,
        dto.date,
        totalBarQuantity(built),
        { saleId: id },
      );
    } else {
      const requested: Record<string, number> = {};
      for (const item of built) requested[item.size] = (requested[item.size] || 0) + item.quantity;
      await this.truckLoadsService.assertShopStock(branch, dto.date, requested, { saleId: id });
    }
    const session = await this.connection.startSession();
    try {
      let updated: SaleDocument | null = null;
      await session.withTransaction(async () => {
        updated = await this.saleModel.findOneAndUpdate(
          { _id: id, ...(user.role === 'super_admin' ? {} : { branch: user.branch }) },
          { date: new Date(dto.date), branch, truck: dto.truck || null, customer: dto.customer, saleType: dto.saleType, items: built, totalAmount, paymentMode: dto.paymentMode, paidAmount: dto.paidAmount, balanceAmount, notes: dto.notes || '', edited: true },
          { new: true, session },
        );
        if (!updated) throw new NotFoundException('Sale not found');
        if (existing.balanceAmount > 0) await this.customersService.adjustCreditBalance(existing.customer.toString(), -existing.balanceAmount, session);
        if (balanceAmount > 0) await this.customersService.adjustCreditBalance(dto.customer, balanceAmount, session);
      });
      return updated;
    } finally {
      await session.endSession();
    }
  }

  async addPayment(id: string, dto: AddSalePaymentDto, user: AuthUser) {
    const sale = await this.saleModel.findOne({ _id: id, ...(user.role === 'super_admin' ? {} : { branch: user.branch }) });
    if (!sale) throw new NotFoundException('Sale not found');
    await assertDayOpen(this.closingModel, sale.branch.toString(), dto.date);
    if (sale.truck) await this.truckLoadsService.assertTripOpen(sale.truck.toString(), dto.date);
    if (user.role === 'truck' && (!sale.truck || sale.truck.toString() !== user.truck)) {
      throw new ForbiddenException('Not allowed to update this sale payment');
    }

    const amount = Math.min(Number(dto.amount), sale.balanceAmount);
    if (amount <= 0) return sale;

    sale.paidAmount += amount;
    sale.balanceAmount -= amount;
    sale.paymentMode = dto.paymentMode;
    sale.payments = sale.payments || [];
    sale.payments.push({
      date: new Date(dto.date),
      amount,
      paymentMode: dto.paymentMode,
      notes: dto.notes || '',
    } as any);

    await sale.save();
    await this.customersService.adjustCreditBalance(sale.customer.toString(), -amount);

    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    if (!['admin', 'super_admin'].includes(user.role)) throw new ForbiddenException('Only admin can delete sales entries');
    const sale = await this.saleModel.findOneAndDelete({ _id: id, ...(user.role === 'super_admin' ? {} : { branch: user.branch }) });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.balanceAmount > 0) {
      await this.customersService.adjustCreditBalance(sale.customer.toString(), -sale.balanceAmount);
    }
    return { deleted: true };
  }

  // ---- Aggregation helpers used by dashboard/reports/stock ----

  async sumInRange(from: Date, to: Date, truckId?: string, branchId?: string) {
    const query: any = { date: { $gte: from, $lte: to } };
    if (truckId) query.truck = truckId;
    if (branchId) query.branch = branchId;
    const sales = await this.saleModel.find(query).exec();
    const totalAmount = sales.reduce((s, r) => s + r.totalAmount, 0);
    const totalPaid = sales.reduce((s, r) => s + r.paidAmount, 0);
    const totalBalance = sales.reduce((s, r) => s + r.balanceAmount, 0);
    return { totalAmount, totalPaid, totalBalance, count: sales.length };
  }

  async sumBySizeInRange(from: Date, to: Date, truckId?: string, branchId?: string, shopOnly = false) {
    const query: any = { date: { $gte: from, $lte: to } };
    if (shopOnly) query.truck = null;
    else if (truckId) query.truck = truckId;
    if (branchId) query.branch = branchId;
    const sales = await this.saleModel.find(query).exec();
    const totals: Record<string, number> = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        totals[item.size] = (totals[item.size] || 0) + item.quantity;
      }
    }
    return totals;
  }

  async sumByTruckInRange(from: Date, to: Date, branchId?: string) {
    const sales = await this.saleModel.find({ date: { $gte: from, $lte: to }, truck: { $ne: null }, ...(branchId ? { branch: branchId } : {}) }).populate('truck', 'truckName truckNumber driverName').exec();
    const totals: Record<string, { truckName: string; driverName: string; totalAmount: number; collectionAmount: number; pendingAmount: number; quantity: number }> = {};
    for (const sale of sales) {
      // The `truck` field can still hold an id whose document was later
      // deleted (trucks.service#remove does not block or cascade), which
      // makes populate() resolve it to null — skip those instead of
      // crashing the whole report on sale.truck._id.
      if (!sale.truck) continue;
      const key = sale.truck._id.toString();
      if (!totals[key]) totals[key] = { truckName: (sale.truck as any).truckName, driverName: (sale.truck as any).driverName || '', totalAmount: 0, collectionAmount: 0, pendingAmount: 0, quantity: 0 };
      totals[key].totalAmount += sale.totalAmount;
      totals[key].collectionAmount += sale.paidAmount;
      totals[key].pendingAmount += sale.balanceAmount;
      totals[key].quantity += totalBarQuantity(sale.items);
    }
    return totals;
  }

  async sumByCustomerInRange(from: Date, to: Date, branchId?: string) {
    const sales = await this.saleModel.find({ date: { $gte: from, $lte: to }, ...(branchId ? { branch: branchId } : {}) }).populate('customer', 'name').exec();
    const totals: Record<string, { customerName: string; totalAmount: number; quantity: number }> = {};
    for (const sale of sales) {
      // Same dangling-reference risk as truck above: customers.service#remove
      // never checks for existing sales before deleting, so a deleted
      // customer's old sales populate to null here.
      if (!sale.customer) continue;
      const key = sale.customer._id.toString();
      if (!totals[key]) totals[key] = { customerName: (sale.customer as any).name, totalAmount: 0, quantity: 0 };
      totals[key].totalAmount += sale.totalAmount;
      totals[key].quantity += totalBarQuantity(sale.items);
    }
    return totals;
  }

  async sumBySaleTypeInRange(from: Date, to: Date, branchId?: string) {
    const sales = await this.saleModel.find({ date: { $gte: from, $lte: to }, ...(branchId ? { branch: branchId } : {}) }).exec();
    const totals: Record<string, number> = { retail: 0, wholesale: 0 };
    for (const sale of sales) totals[sale.saleType] += sale.totalAmount;
    return totals;
  }

  async getPendingPayments(limit = 10, branchId?: string) {
    return this.saleModel
      .find({ balanceAmount: { $gt: 0 }, ...(branchId ? { branch: branchId } : {}) })
      .populate('truck', 'truckName truckNumber')
      .populate('customer', 'name phoneNumber creditBalance truck')
      .sort({ date: 1, createdAt: 1 })
      .limit(limit)
      .exec();
  }

  // Oldest-first + a small limit (getPendingPayments above) is meant for
  // surfacing the longest-overdue debts, not "today's" pending bills — with
  // more than `limit` old unpaid bills outstanding, today's newer ones never
  // make the cut. The dashboard's "Today's Pending Customer Payments" needs
  // an actual date-scoped query instead.
  async getPendingPaymentsInRange(from: Date, to: Date, branchId?: string) {
    return this.saleModel
      .find({ balanceAmount: { $gt: 0 }, date: { $gte: from, $lte: to }, ...(branchId ? { branch: branchId } : {}) })
      .populate('truck', 'truckName truckNumber')
      .populate('customer', 'name phoneNumber creditBalance truck')
      .sort({ date: 1, createdAt: 1 })
      .exec();
  }

  async getRecentPayments(from?: Date, to?: Date, limit = 10, branchId?: string) {
    const sales = await this.saleModel
      .find({ 'payments.0': { $exists: true }, ...(branchId ? { branch: branchId } : {}) })
      .populate('truck', 'truckName truckNumber')
      .populate('customer', 'name phoneNumber')
      .sort({ updatedAt: -1 })
      .limit(100)
      .exec();

    const payments: any[] = [];
    for (const sale of sales) {
      for (const payment of sale.payments || []) {
        const date = new Date(payment.date);
        if (from && date < from) continue;
        if (to && date > to) continue;
        payments.push({
          saleId: sale._id,
          date,
          amount: payment.amount,
          paymentMode: payment.paymentMode,
          notes: payment.notes,
          customer: sale.customer,
          truck: sale.truck,
          billDate: sale.date,
        });
      }
    }

    return payments.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
  }
}
