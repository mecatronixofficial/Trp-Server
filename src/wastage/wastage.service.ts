import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wastage, WastageDocument } from './schemas/wastage.schema';
import { CreateWastageDto, UpdateWastageDto } from './dto/wastage.dto';

interface AuthUser {
  userId: string;
  role: string;
  truck: string | null;
}

@Injectable()
export class WastageService {
  constructor(@InjectModel(Wastage.name) private wastageModel: Model<WastageDocument>) {}

  create(dto: CreateWastageDto, user: AuthUser) {
    const truck = user.role === 'truck' ? user.truck : dto.truck || null;
    if (user.role === 'truck' && dto.truck && dto.truck !== user.truck) {
      throw new ForbiddenException('You can only add wastage for your own truck');
    }
    return this.wastageModel.create({ ...dto, date: new Date(dto.date), truck });
  }

  findAll(
    filters: { from?: string; to?: string; truck?: string; size?: string },
    user: AuthUser,
  ) {
    const query: any = {};
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
    if (user.role !== 'admin') throw new ForbiddenException('Only admin can edit wastage entries');
    const w = await this.wastageModel.findByIdAndUpdate(id, { ...dto, date: new Date(dto.date) }, { new: true });
    if (!w) throw new NotFoundException('Wastage record not found');
    return w;
  }

  async remove(id: string, user: AuthUser) {
    if (user.role !== 'admin') throw new ForbiddenException('Only admin can delete wastage entries');
    const w = await this.wastageModel.findByIdAndDelete(id);
    if (!w) throw new NotFoundException('Wastage record not found');
    return { deleted: true };
  }

  async sumBySizeInRange(from: Date, to: Date, truckId?: string) {
    const query: any = { date: { $gte: from, $lte: to } };
    if (truckId) query.truck = truckId;
    const rows = await this.wastageModel.find(query).exec();
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.size] = (totals[r.size] || 0) + r.quantity;
    return totals;
  }

  async totalInRange(from: Date, to: Date, truckId?: string) {
    const query: any = { date: { $gte: from, $lte: to } };
    if (truckId) query.truck = truckId;
    const rows = await this.wastageModel.find(query).exec();
    return rows.reduce((s, r) => s + r.quantity, 0);
  }
}
