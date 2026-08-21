import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from './schemas/expense.schema';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';

export type ExpenseFilters = {
  month?: number | null;
  year?: number | null;
  today?: boolean;
  date?: string | null;
  from?: string | null;
  to?: string | null;
};

// worker/truck are optional ObjectId refs — an empty string from the client
// must become "no ref" rather than a Mongoose cast error.
function cleanRefs<T extends Record<string, any>>(input: T) {
  const cleaned: Record<string, any> = { ...input };
  if (!cleaned.worker) delete cleaned.worker;
  if (!cleaned.truck) delete cleaned.truck;
  return cleaned;
}

@Injectable()
export class ExpensesService {
  constructor(@InjectModel(Expense.name) private model: Model<ExpenseDocument>) {}

  private branch(user: any, required = false) {
    const branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch;
    if (required && !branch) throw new BadRequestException('Select a branch before adding an expense.');
    return branch;
  }

  private dateRange(filters: ExpenseFilters) {
    if (filters.today) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      return { $gte: indiaDayStart(today), $lte: indiaDayEnd(today) };
    }
    if (filters.date) {
      return { $gte: indiaDayStart(filters.date), $lte: indiaDayEnd(filters.date) };
    }
    if (filters.from || filters.to) {
      const range: any = {};
      if (filters.from) range.$gte = indiaDayStart(filters.from);
      if (filters.to) range.$lte = indiaDayEnd(filters.to);
      return range;
    }
    if (filters.month && filters.year) {
      const lastDay = new Date(Date.UTC(filters.year, filters.month, 0)).getUTCDate();
      const monthKey = `${String(filters.year).padStart(4, '0')}-${String(filters.month).padStart(2, '0')}`;
      return { $gte: indiaDayStart(`${monthKey}-01`), $lte: indiaDayEnd(`${monthKey}-${String(lastDay).padStart(2, '0')}`) };
    }
    return null;
  }

  findAll(user: any, filters: ExpenseFilters) {
    const branch = this.branch(user);
    const query: any = {};
    if (branch) query.branch = branch;
    const dateRange = this.dateRange(filters);
    if (dateRange) query.date = dateRange;
    return this.model.find(query).sort({ date: -1, createdAt: -1 }).exec();
  }

  async sumByTruckInRange(from: Date, to: Date, branch?: string) {
    const rows = await this.model.find({
      date: { $gte: from, $lte: to },
      truck: { $ne: null },
      ...(branch ? { branch } : {}),
    }).select('truck amount').lean().exec();
    return rows.reduce((totals: Record<string, number>, row: any) => {
      const truckId = String(row.truck || '');
      if (truckId) totals[truckId] = (totals[truckId] || 0) + Number(row.amount || 0);
      return totals;
    }, {});
  }

  create(dto: CreateExpenseDto, user: any) {
    const branch = this.branch(user, true);
    return this.model.create({ ...cleanRefs(dto), branch, date: new Date(dto.date), createdBy: user.id || user.userId, createdByType: 'ADMIN' });
  }

  async update(id: string, dto: UpdateExpenseDto, user: any) {
    const branch = this.branch(user);
    const updated = await this.model.findOneAndUpdate(
      { _id: id, ...(branch ? { branch } : {}) },
      { ...cleanRefs(dto), date: new Date(dto.date) },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Expense not found');
    return updated;
  }

  async remove(id: string, user: any) {
    const branch = this.branch(user);
    const deleted = await this.model.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!deleted) throw new NotFoundException('Expense not found');
    return { deleted: true };
  }
}
