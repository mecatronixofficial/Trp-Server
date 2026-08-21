import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverExpense, DriverExpenseDocument } from './schemas/driver-expense.schema';
import { TruckLoadsService } from '../truck-loads/truck-loads.service';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { TrucksService } from '../trucks/trucks.service';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';
@Injectable()
export class DriverExpensesService {
  constructor(@InjectModel(DriverExpense.name) private legacyModel: Model<DriverExpenseDocument>, @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>, private truckLoads: TruckLoadsService, private trucks: TrucksService) {}
  async create(dto: any, user: any) {
    const truck = user.role === 'truck' ? user.truck : dto.truck;
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (!truck || !branch) throw new ForbiddenException('Truck and branch are required');
    await this.truckLoads.assertTripOpen(truck, dto.date);
    const truckRecord = await this.trucks.findOne(String(truck), user);
    const normalized = String(dto.costType || dto.purpose || 'truck_expense').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const costType = normalized === 'worker_amount' ? 'advance_for_employee' : normalized;
    return this.expenseModel.create({
      branch,
      truck,
      truckName: `${truckRecord.truckName}${truckRecord.truckNumber ? ` (${truckRecord.truckNumber})` : ''}`,
      date: new Date(dto.date),
      amount: dto.amount,
      costType,
      notes: dto.notes || '',
      description: dto.purpose || '',
      fuelQuantity: dto.fuelQuantity || 0,
      workerName: costType === 'advance_for_employee' ? truckRecord.driverName : '',
      driverName: truckRecord.driverName,
      createdBy: user.id || user.userId,
      createdByType: 'DRIVER',
    });
  }
  async findAll(user: any, truck?: string, from?: string, to?: string) {
    const query: any = {};
    query.truck = user.role === 'truck' ? user.truck : truck;
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (branch) query.branch = branch;
    if (from || to) { query.date = {}; if (from) query.date.$gte = indiaDayStart(from); if (to) query.date.$lte = indiaDayEnd(to); }
    const [current, legacy] = await Promise.all([
      this.expenseModel.find({ ...query, createdByType: 'DRIVER' }).populate('truck', 'truckName truckNumber driverName').sort({ date: -1, createdAt: -1 }).exec(),
      this.legacyModel.find(query).populate('truck', 'truckName truckNumber driverName').sort({ date: -1, createdAt: -1 }).exec(),
    ]);
    return [...current, ...legacy].sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }
}
