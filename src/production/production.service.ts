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

  private async startNextSessionIfClosed(branch: string, date: string | Date) {
    const day = new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const closing = await this.closingModel.findOne({ branch, date: day, status: 'closed' });
    if (!closing) return;

    await this.closingModel.updateOne(
      { _id: closing._id, status: 'closed' },
      {
        status: 'open',
        closedAt: null,
        closedBy: null,
        alertSentAt: null,
        sessionStartedAt: new Date(),
        sessionProducedBaseline: Number(closing.produced || 0),
        sessionSoldBaseline: Number(closing.sold || 0),
        sessionWastageBaseline: Number(closing.wastage || 0),
        closingBalance: 0,
      },
    );
  }

  async create(dto: CreateProductionDto, user: any) {
    const branch = this.branch(user, true);
    const fields = await this.buildBoxFields(dto.boxOpen, dto.boxClose);
    // Adding production after a close starts the next same-day session
    // automatically. Previous batches and totals remain attached to the date.
    await this.startNextSessionIfClosed(branch, dto.date);
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
    return this.productionModel.find(query).populate('branch', 'name code').sort({ date: -1 }).exec();
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
    const [last, closing] = await Promise.all([
      this.productionModel.findOne({ branch, boxClose: { $ne: null } }).sort({ date: -1, createdAt: -1 }),
      this.closingModel.findOne({ branch, closingBox: { $ne: null }, boxCursorAt: { $ne: null } }).sort({ boxCursorAt: -1 }),
    ]);
    const productionAt = last ? new Date((last as any).createdAt || last.date).getTime() : 0;
    const closingAt = closing?.boxCursorAt ? new Date(closing.boxCursorAt).getTime() : 0;
    const savedNextOpen = closing && closingAt >= productionAt ? Number(closing.nextOpeningBox || 0) : 0;
    const lastBox = closing && closingAt >= productionAt ? Number(closing.closingBox) : Number(last?.boxClose || 0);
    const nextOpen = savedNextOpen || (!lastBox ? 1 : (lastBox >= totalBoxes ? 1 : lastBox + 1));
    return { nextOpen, totalBoxes, barsPerBox: settings.barsPerBox || 2 };
  }

  async getDayBoxSummary(from: Date, to: Date, branch: string, createdAfter?: Date | null) {
    const rows = await this.productionModel.find({
      branch,
      date: { $gte: from, $lte: to },
      ...(createdAfter ? { createdAt: { $gte: createdAfter } } : {}),
    }).sort({ createdAt: 1 }).exec();
    if (!rows.length) return null;
    return {
      firstBoxOpen: Number(rows[0].boxOpen),
      lastBoxClose: Number(rows[rows.length - 1].boxClose),
      barsPerBox: Number(rows[0].barsPerBoxUsed || 0),
    };
  }

  async latestDayBefore(date: Date, branch: string) {
    const latest = await this.productionModel.findOne({ branch, date: { $lt: date } }).sort({ date: -1, createdAt: -1 });
    return latest
      ? new Date(latest.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : null;
  }

  async update(id: string, dto: UpdateProductionDto, user?: any) {
    const branch = this.branch(user);
    await assertDayOpen(this.closingModel, branch, dto.date);
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
    const branch = this.branch(user);
    const existing = await this.productionModel.findOne({ _id: id, ...(branch ? { branch } : {}) });
    if (!existing) throw new NotFoundException('Production record not found');
    await assertDayOpen(this.closingModel, branch, existing.date);
    const p = await this.productionModel.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!p) throw new NotFoundException('Production record not found');
    return { deleted: true };
  }

  // Used by stock/dashboard calculations
  async sumBySizeInRange(from: Date, to: Date, branch?: string, createdAfter?: Date | null) {
    const rows = await this.productionModel.find({ date: { $gte: from, $lte: to }, ...(branch ? { branch } : {}), ...(createdAfter ? { createdAt: { $gte: createdAfter } } : {}) }).exec();
    const totals: Record<string, number> = {};
    for (const row of rows) {
      for (const s of row.sizeWise) {
        totals[s.size] = (totals[s.size] || 0) + s.quantity;
      }
    }
    return totals;
  }
}
