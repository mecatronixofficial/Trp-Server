import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wastage, WastageDocument } from './schemas/wastage.schema';
import { CreateWastageDto, UpdateWastageDto } from './dto/wastage.dto';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';
import { TruckLoadsService } from '../truck-loads/truck-loads.service';

interface AuthUser {
  userId: string;
  role: string;
  truck: string | null;
  branch?: string | null;
  selectedBranch?: string | null;
}

@Injectable()
export class WastageService {
  constructor(@InjectModel(Wastage.name) private wastageModel: Model<WastageDocument>, @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>, private truckLoads: TruckLoadsService) {}

  async create(dto: CreateWastageDto, user: AuthUser) {
    const truck = user.role === 'truck' ? user.truck : dto.truck || null;
    if (user.role === 'truck' && dto.truck && dto.truck !== user.truck) {
      throw new ForbiddenException('You can only add wastage for your own truck');
    }
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (!branch) throw new BadRequestException('Select a branch before adding wastage');
    await assertDayOpen(this.closingModel, branch, dto.date);
    if (truck) await this.truckLoads.assertTripOpen(truck, dto.date);
    return this.wastageModel.create({ ...dto, branch, date: new Date(dto.date), truck });
  }

  findAll(
    filters: { from?: string; to?: string; truck?: string; size?: string },
    user: AuthUser,
  ) {
    const query: any = {};
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    if (branch) query.branch = branch;
    if (user.role === 'truck') query.truck = user.truck;
    else if (filters.truck) query.truck = filters.truck;

    if (filters.size) query.size = filters.size;
    if (filters.from || filters.to) {
      query.date = {};
      if (filters.from) query.date.$gte = new Date(filters.from);
      if (filters.to) query.date.$lte = new Date(filters.to);
    }
    return this.wastageModel.find(query).populate('truck', 'truckName truckNumber').sort({ date: -1 }).exec();
  }

  async update(id: string, dto: UpdateWastageDto, user: AuthUser) {
    if (!['admin', 'super_admin'].includes(user.role)) throw new ForbiddenException('Only admin can edit wastage entries');
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    const w = await this.wastageModel.findOneAndUpdate({ _id: id, ...(branch ? { branch } : {}) }, { ...dto, date: new Date(dto.date) }, { new: true });
    if (!w) throw new NotFoundException('Wastage record not found');
    return w;
  }

  async remove(id: string, user: AuthUser) {
    if (!['admin', 'super_admin'].includes(user.role)) throw new ForbiddenException('Only admin can delete wastage entries');
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    const w = await this.wastageModel.findOneAndDelete({ _id: id, ...(branch ? { branch } : {}) });
    if (!w) throw new NotFoundException('Wastage record not found');
    return { deleted: true };
  }

  async sumBySizeInRange(from: Date, to: Date, truckId?: string, branchId?: string, factoryOnly = false, reason?: string) {
    const query: any = { date: { $gte: from, $lte: to } };
    if (truckId) query.truck = truckId;
    if (factoryOnly) query.truck = null;
    if (reason) query.reason = reason;
    if (branchId) query.branch = branchId;
    const rows = await this.wastageModel.find(query).exec();
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.size] = (totals[r.size] || 0) + r.quantity;
    return totals;
  }

  async totalInRange(from: Date, to: Date, truckId?: string, branchId?: string, reason?: string, excludeReason?: string) {
    const query: any = { date: { $gte: from, $lte: to } };
    if (truckId) query.truck = truckId;
    if (branchId) query.branch = branchId;
    if (reason) query.reason = reason;
    if (excludeReason) query.reason = { $ne: excludeReason };
    const rows = await this.wastageModel.find(query).exec();
    return rows.reduce((s, r) => s + r.quantity, 0);
  }
}
