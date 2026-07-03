import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MakingCost, MakingCostDocument } from './schemas/making-cost.schema';
import { CreateMakingCostDto, UpdateMakingCostDto } from './dto/making-cost.dto';

@Injectable()
export class MakingCostService {
  constructor(@InjectModel(MakingCost.name) private costModel: Model<MakingCostDocument>) {}

  create(dto: CreateMakingCostDto) {
    return this.costModel.create({ ...dto, date: new Date(dto.date) });
  }

  findAll(from?: string, to?: string) {
    const query: any = {};
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    return this.costModel.find(query).sort({ date: -1 }).exec();
  }

  async update(id: string, dto: UpdateMakingCostDto) {
    const c = await this.costModel.findByIdAndUpdate(id, { ...dto, date: new Date(dto.date) }, { new: true });
    if (!c) throw new NotFoundException('Cost record not found');
    return c;
  }

  async remove(id: string) {
    const c = await this.costModel.findByIdAndDelete(id);
    if (!c) throw new NotFoundException('Cost record not found');
    return { deleted: true };
  }

  async totalInRange(from: Date, to: Date) {
    const rows = await this.costModel.find({ date: { $gte: from, $lte: to } }).exec();
    return rows.reduce((sum, r) => sum + r.amount, 0);
  }

  async totalByTypeInRange(from: Date, to: Date) {
    const rows = await this.costModel.find({ date: { $gte: from, $lte: to } }).exec();
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.costType] = (totals[r.costType] || 0) + r.amount;
    return totals;
  }
}
