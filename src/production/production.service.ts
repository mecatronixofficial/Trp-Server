import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Production, ProductionDocument } from './schemas/production.schema';
import { CreateProductionDto, UpdateProductionDto } from './dto/production.dto';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';

@Injectable()
export class ProductionService {
  constructor(@InjectModel(Production.name) private productionModel: Model<ProductionDocument>, @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>) {}

  private computeTotal(sizeWise: { size: string; quantity: number }[]) {
    return sizeWise.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  }

  private branch(user: any, required = false) {
    const branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch;
    if (required && !branch) throw new BadRequestException('Select a branch before adding production');
    return branch;
  }
  async create(dto: CreateProductionDto, user: any) {
    const branch = this.branch(user, true);
    await assertDayOpen(this.closingModel, branch, dto.date);
    return this.productionModel.create({
      ...dto,
      branch,
      date: new Date(dto.date),
      totalBars: this.computeTotal(dto.sizeWise),
    });
  }

  findAll(from?: string, to?: string, user?: any) {
    const query: any = {};
    const branch = this.branch(user); if (branch) query.branch = branch;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    return this.productionModel.find(query).sort({ date: -1 }).exec();
  }

  async findOne(id: string, user?: any) {
    const branch = this.branch(user); const p = await this.productionModel.findOne({ _id: id, ...(branch ? { branch } : {}) });
    if (!p) throw new NotFoundException('Production record not found');
    return p;
  }

  async update(id: string, dto: UpdateProductionDto, user?: any) {
    const branch = this.branch(user); const p = await this.productionModel.findOneAndUpdate(
      { _id: id, ...(branch ? { branch } : {}) },
      { ...dto, date: new Date(dto.date), totalBars: this.computeTotal(dto.sizeWise) },
      { new: true },
    );
    if (!p) throw new NotFoundException('Production record not found');
    return p;
  }

  async remove(id: string, user?: any) {
    const branch = this.branch(user); const p = await this.productionModel.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!p) throw new NotFoundException('Production record not found');
    return { deleted: true };
  }

  // Used by stock/dashboard calculations
  async sumBySizeInRange(from: Date, to: Date, branch?: string) {
    const rows = await this.productionModel.find({ date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}) }).exec();
    const totals: Record<string, number> = {};
    for (const row of rows) {
      for (const s of row.sizeWise) {
        totals[s.size] = (totals[s.size] || 0) + s.quantity;
      }
    }
    return totals;
  }
}
