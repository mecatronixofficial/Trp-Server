import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Production, ProductionDocument } from './schemas/production.schema';
import { CreateProductionDto, UpdateProductionDto } from './dto/production.dto';

@Injectable()
export class ProductionService {
  constructor(@InjectModel(Production.name) private productionModel: Model<ProductionDocument>) {}

  private computeTotal(sizeWise: { size: string; quantity: number }[]) {
    return sizeWise.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  }

  create(dto: CreateProductionDto) {
    return this.productionModel.create({
      ...dto,
      date: new Date(dto.date),
      totalBars: this.computeTotal(dto.sizeWise),
    });
  }

  findAll(from?: string, to?: string) {
    const query: any = {};
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }
    return this.productionModel.find(query).sort({ date: -1 }).exec();
  }

  async findOne(id: string) {
    const p = await this.productionModel.findById(id);
    if (!p) throw new NotFoundException('Production record not found');
    return p;
  }

  async update(id: string, dto: UpdateProductionDto) {
    const p = await this.productionModel.findByIdAndUpdate(
      id,
      { ...dto, date: new Date(dto.date), totalBars: this.computeTotal(dto.sizeWise) },
      { new: true },
    );
    if (!p) throw new NotFoundException('Production record not found');
    return p;
  }

  async remove(id: string) {
    const p = await this.productionModel.findByIdAndDelete(id);
    if (!p) throw new NotFoundException('Production record not found');
    return { deleted: true };
  }

  // Used by stock/dashboard calculations
  async sumBySizeInRange(from: Date, to: Date) {
    const rows = await this.productionModel.find({ date: { $gte: from, $lte: to } }).exec();
    const totals: Record<string, number> = {};
    for (const row of rows) {
      for (const s of row.sizeWise) {
        totals[s.size] = (totals[s.size] || 0) + s.quantity;
      }
    }
    return totals;
  }
}
