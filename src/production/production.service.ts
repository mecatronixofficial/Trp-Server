import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Production, ProductionDocument } from './schemas/production.schema';
import { CreateProductionDto, UpdateProductionDto } from './dto/production.dto';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';
import { SettingsService } from '../settings/settings.service';
import { IceBarSize } from '../common/enums';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';

@Injectable()
export class ProductionService {
  constructor(
    @InjectModel(Production.name) private productionModel: Model<ProductionDocument>,
    @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>,
    private settingsService: SettingsService,
  ) {}

  // Boxes cycle 1..totalBoxes like a meter/odometer, wrapping back to 1.
  // Inclusive count: both the opening and closing box are counted as made.
  private computeBoxesProduced(boxOpen: number, boxClose: number, totalBoxes: number) {
    return (boxClose >= boxOpen ? boxClose - boxOpen : (totalBoxes - boxOpen) + boxClose) + 1;
  }

  private branch(user: any, required = false) {
    const branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch;
    if (required && !branch) throw new BadRequestException('Select a branch before adding production');
    return branch;
  }

  private async buildBoxFields(boxOpen: number, boxClose: number) {
    const settings = await this.settingsService.get();
    const totalBoxes = settings.totalBoxes || 200;
    const barsPerBox = settings.barsPerBox || 2;
    if (boxOpen > totalBoxes || boxClose > totalBoxes) {
      throw new BadRequestException(`Box readings must be between 1 and ${totalBoxes}`);
    }
    const boxesProduced = this.computeBoxesProduced(boxOpen, boxClose, totalBoxes);
    const totalBars = boxesProduced * barsPerBox;
    return {
      boxOpen, boxClose, boxesProduced,
      barsPerBoxUsed: barsPerBox,
      totalBars,
      sizeWise: [{ size: IceBarSize.ONE, quantity: totalBars }],
    };
  }

  async create(dto: CreateProductionDto, user: any) {
    const branch = this.branch(user, true);
    await assertDayOpen(this.closingModel, branch, dto.date);
    const existing = await this.productionModel.findOne({ branch, date: new Date(dto.date) });
    if (existing) throw new BadRequestException('Production is already recorded for this date. Edit the existing entry instead.');
    const fields = await this.buildBoxFields(dto.boxOpen, dto.boxClose);
    return this.productionModel.create({
      ...dto,
      branch,
      date: new Date(dto.date),
      ...fields,
    });
  }

  findAll(from?: string, to?: string, user?: any) {
    const query: any = {};
    const branch = this.branch(user); if (branch) query.branch = branch;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = indiaDayStart(from);
      if (to) query.date.$lte = indiaDayEnd(to);
    }
    return this.productionModel.find(query).sort({ date: -1 }).exec();
  }

  async findOne(id: string, user?: any) {
    const branch = this.branch(user); const p = await this.productionModel.findOne({ _id: id, ...(branch ? { branch } : {}) });
    if (!p) throw new NotFoundException('Production record not found');
    return p;
  }

  // Opening box reading for the next entry: continues from the most recent boxClose + 1,
  // wrapping back to 1 once the counter has passed totalBoxes.
  async getNextBoxOpen(user: any) {
    const branch = this.branch(user, true);
    const settings = await this.settingsService.get();
    const totalBoxes = settings.totalBoxes || 200;
    const last = await this.productionModel.findOne({ branch, boxClose: { $ne: null } }).sort({ date: -1, createdAt: -1 });
    const nextOpen = !last ? 1 : (last.boxClose >= totalBoxes ? 1 : last.boxClose + 1);
    return { nextOpen, totalBoxes, barsPerBox: settings.barsPerBox || 2 };
  }

  async update(id: string, dto: UpdateProductionDto, user?: any) {
    const branch = this.branch(user);
    const fields = await this.buildBoxFields(dto.boxOpen, dto.boxClose);
    const p = await this.productionModel.findOneAndUpdate(
      { _id: id, ...(branch ? { branch } : {}) },
      { ...dto, date: new Date(dto.date), ...fields },
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
