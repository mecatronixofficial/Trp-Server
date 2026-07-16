import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DriverExpense, DriverExpenseDocument } from './schemas/driver-expense.schema';
import { TruckLoadsService } from '../truck-loads/truck-loads.service';
@Injectable()
export class DriverExpensesService {
  constructor(@InjectModel(DriverExpense.name) private model: Model<DriverExpenseDocument>, private truckLoads: TruckLoadsService) {}
  async create(dto: any, user: any) {
    const truck = user.role === 'truck' ? user.truck : dto.truck;
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (!truck || !branch) throw new ForbiddenException('Truck and branch are required');
    await this.truckLoads.assertTripOpen(truck, dto.date);
    return this.model.create({ ...dto, truck, branch, date: new Date(dto.date) });
  }
  findAll(user: any, truck?: string, from?: string, to?: string) {
    const query: any = {};
    query.truck = user.role === 'truck' ? user.truck : truck;
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (branch) query.branch = branch;
    if (from || to) { query.date = {}; if (from) query.date.$gte = new Date(from); if (to) query.date.$lte = new Date(`${to}T23:59:59.999Z`); }
    return this.model.find(query).populate('truck', 'truckName truckNumber').sort({ date: -1, createdAt: -1 });
  }
}
