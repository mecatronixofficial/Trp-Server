import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OutsourceEntry, OutsourceEntryDocument } from './schemas/outsource-entry.schema';
import { CreateOutsourceEntryDto, UpdateOutsourceEntryDto } from './dto/outsource-entry.dto';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';

@Injectable()
export class OutsourceEntryService {
  constructor(
    @InjectModel(OutsourceEntry.name) private outsourceEntryModel: Model<OutsourceEntryDocument>,
    @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>,
  ) {}

  private branch(user: any, required = false) {
    const branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch;
    if (required && !branch) throw new BadRequestException('Select a branch before adding outsourced bars');
    return branch;
  }

  async create(dto: CreateOutsourceEntryDto, user: any) {
    const branch = this.branch(user, true);
    await assertDayOpen(this.closingModel, branch, dto.date);
    const existing = await this.outsourceEntryModel.findOne({ branch, date: new Date(dto.date) });
    if (existing) throw new BadRequestException('Outsource is already recorded for this date. Edit the existing entry instead.');
    return this.outsourceEntryModel.create({ ...dto, branch, date: new Date(dto.date) });
  }

  findAll(user: any, from?: string, to?: string) {
    const query: any = {};
    const branch = this.branch(user); if (branch) query.branch = branch;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    return this.outsourceEntryModel.find(query).sort({ date: -1, createdAt: -1 }).exec();
  }

  async update(id: string, dto: UpdateOutsourceEntryDto, user: any) {
    const branch = this.branch(user);
    const entry = await this.outsourceEntryModel.findOneAndUpdate(
      { _id: id, ...(branch ? { branch } : {}) },
      { ...dto, date: new Date(dto.date) },
      { new: true },
    );
    if (!entry) throw new NotFoundException('Outsource entry not found');
    return entry;
  }

  async remove(id: string, user: any) {
    const branch = this.branch(user);
    const entry = await this.outsourceEntryModel.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!entry) throw new NotFoundException('Outsource entry not found');
    return { deleted: true };
  }
}
