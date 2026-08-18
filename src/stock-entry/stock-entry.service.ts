import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StockEntry, StockEntryDocument } from './schemas/stock-entry.schema';
import { CreateStockEntryDto, UpdateStockEntryDto } from './dto/stock-entry.dto';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';

const AUTOMATIC_CLOSING_NOTE = 'Automatically moved from ready bars at day closing';

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

  async totalInRange(from: Date, to: Date, branch: string, createdAfter?: Date | null) {
    const rows = await this.stockEntryModel.find({ branch, date: { $gte: from, $lte: to }, ...(createdAfter ? { createdAt: { $gte: createdAfter } } : {}) });
    return rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  }

  async latestBefore(date: Date, branch: string) {
    const latest = await this.stockEntryModel.findOne({ branch, date: { $lt: date } }).sort({ date: -1, createdAt: -1 });
    if (!latest) return null;
    const day = new Date(latest.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const dayStart = indiaDayStart(day);
    const dayEnd = indiaDayEnd(day);
    return { day, total: await this.totalInRange(dayStart, dayEnd, branch) };
  }

  async latestTotalBefore(date: Date, branch: string) {
    return (await this.latestBefore(date, branch))?.total || 0;
  }

  async recordClosingStock(branch: string, date: string, totalStock: number) {
    const from = indiaDayStart(date);
    const to = indiaDayEnd(date);
    const rows = await this.stockEntryModel.find({ branch, date: { $gte: from, $lte: to } });
    const automatic = rows.find((row) => row.notes === AUTOMATIC_CLOSING_NOTE);
    const manuallyMoved = rows
      .filter((row) => row.notes !== AUTOMATIC_CLOSING_NOTE)
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const quantity = Math.max(0, Math.round((Number(totalStock || 0) - manuallyMoved) * 100) / 100);

    if (quantity < 0.0001) {
      if (automatic) await this.stockEntryModel.deleteOne({ _id: automatic._id });
      return null;
    }
    if (automatic) {
      automatic.quantity = quantity;
      return automatic.save();
    }
    return this.stockEntryModel.create({
      branch,
      date: new Date(date),
      quantity,
      notes: AUTOMATIC_CLOSING_NOTE,
    });
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
