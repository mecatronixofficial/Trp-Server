import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StockEntry, StockEntryDocument } from './schemas/stock-entry.schema';
import { CreateStockEntryDto, UpdateStockEntryDto } from './dto/stock-entry.dto';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';

@Injectable()
export class StockEntryService {
  constructor(
    @InjectModel(StockEntry.name) private stockEntryModel: Model<StockEntryDocument>,
    @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>,
  ) {}

  private branch(user: any, required = false) {
    const branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch;
    if (required && !branch) throw new BadRequestException('Select a branch before adding stock');
    return branch;
  }

  async create(dto: CreateStockEntryDto, user: any) {
    const branch = this.branch(user, true);
    await assertDayOpen(this.closingModel, branch, dto.date);
    const existing = await this.stockEntryModel.findOne({ branch, date: new Date(dto.date) });
    if (existing) throw new BadRequestException('Stock is already recorded for this date. Edit the existing entry instead.');
    return this.stockEntryModel.create({ ...dto, branch, date: new Date(dto.date) });
  }

  findAll(user: any, from?: string, to?: string) {
    const query: any = {};
    const branch = this.branch(user); if (branch) query.branch = branch;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = indiaDayStart(from);
      if (to) query.date.$lte = indiaDayEnd(to);
    }
    return this.stockEntryModel.find(query).sort({ date: -1, createdAt: -1 }).exec();
  }

  async totalInRange(from: Date, to: Date, branch: string) {
    const rows = await this.stockEntryModel.find({ branch, date: { $gte: from, $lte: to } });
    return rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  }

  async update(id: string, dto: UpdateStockEntryDto, user: any) {
    const branch = this.branch(user);
    const entry = await this.stockEntryModel.findOneAndUpdate(
      { _id: id, ...(branch ? { branch } : {}) },
      { ...dto, date: new Date(dto.date) },
      { new: true },
    );
    if (!entry) throw new NotFoundException('Stock entry not found');
    return entry;
  }

  async remove(id: string, user: any) {
    const branch = this.branch(user);
    const entry = await this.stockEntryModel.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!entry) throw new NotFoundException('Stock entry not found');
    return { deleted: true };
  }
}
