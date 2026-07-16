import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MakingCost, MakingCostDocument } from './schemas/making-cost.schema';
import { CreateMakingCostDto, UpdateMakingCostDto } from './dto/making-cost.dto';

@Injectable()
export class MakingCostService {
  constructor(@InjectModel(MakingCost.name) private costModel: Model<MakingCostDocument>) {}

  private branch(user: any, required = false) { const branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch; if (required && !branch) throw new BadRequestException('Select a branch before adding making cost'); return branch; }
  create(dto: CreateMakingCostDto, user: any) {
    return this.costModel.create({ ...dto, branch: this.branch(user, true), date: new Date(dto.date) });
  }

  findAll(from?: string, to?: string, user?: any) {
    const query: any = {};
    const branch = this.branch(user); if (branch) query.branch = branch;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    return this.costModel.find(query).sort({ date: -1 }).exec();
  }

  async update(id: string, dto: UpdateMakingCostDto, user?: any) {
    const branch = this.branch(user); const c = await this.costModel.findOneAndUpdate({ _id: id, ...(branch ? { branch } : {}) }, { ...dto, date: new Date(dto.date) }, { new: true });
    if (!c) throw new NotFoundException('Cost record not found');
    return c;
  }

  async remove(id: string, user?: any) {
    const branch = this.branch(user); const c = await this.costModel.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!c) throw new NotFoundException('Cost record not found');
    return { deleted: true };
  }

  async totalInRange(from: Date, to: Date, branch?: string) {
    const rows = await this.costModel.find({ date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}) }).exec();
    return rows.reduce((sum, r) => sum + r.amount, 0);
  }

  async totalByTypeInRange(from: Date, to: Date, branch?: string) {
    const rows = await this.costModel.find({ date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}) }).exec();
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.costType] = (totals[r.costType] || 0) + r.amount;
    return totals;
  }
}
