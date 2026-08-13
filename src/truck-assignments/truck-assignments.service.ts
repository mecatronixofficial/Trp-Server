import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrucksService } from '../trucks/trucks.service';
import { TruckLoadsService } from '../truck-loads/truck-loads.service';
import { UpsertTruckAssignmentDto } from './dto/truck-assignment.dto';
import { TruckAssignment, TruckAssignmentDocument } from './schemas/truck-assignment.schema';
import { DailyClosing, DailyClosingDocument } from '../daily-closing/schemas/daily-closing.schema';
import { assertDayOpen } from '../daily-closing/closing-lock';

@Injectable()
export class TruckAssignmentsService {
  constructor(
    @InjectModel(TruckAssignment.name) private model: Model<TruckAssignmentDocument>,
    @InjectModel(DailyClosing.name) private closingModel: Model<DailyClosingDocument>,
    private trucksService: TrucksService,
    private truckLoadsService: TruckLoadsService,
  ) {}

  private dateBounds(date: string | Date) {
    const day = new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return { from: new Date(`${day}T00:00:00.000+05:30`), to: new Date(`${day}T23:59:59.999+05:30`) };
  }

  async upsert(dto: UpsertTruckAssignmentDto, user: any) {
    const truck = await this.trucksService.findOne(dto.truck, user);
    await assertDayOpen(this.closingModel, truck.branch.toString(), dto.date);
    const { from } = this.dateBounds(dto.date);
    const existingAssignment = await this.model.findOne({ truck: dto.truck, date: from });
    const acceptedQuantity = Number(existingAssignment?.quantity || 0);
    const pendingQuantity = Math.max(0, Number(dto.quantity || 0) - acceptedQuantity);
    const assignment = await this.model.findOneAndUpdate(
      { truck: dto.truck, date: from },
      {
        branch: truck.branch,
        truck: dto.truck,
        date: from,
        quantity: acceptedQuantity,
        pendingQuantity,
        status: pendingQuantity > 0 ? 'pending' : acceptedQuantity > 0 ? 'accepted' : 'rejected',
        notes: dto.notes || '',
        assignedBy: user.userId,
        responseReason: pendingQuantity > 0 ? '' : existingAssignment?.responseReason || '',
        respondedAt: pendingQuantity > 0 ? null : existingAssignment?.respondedAt || null,
      },
      { new: true, upsert: true },
    );
    return assignment;
  }

  async add(dto: UpsertTruckAssignmentDto, user: any) {
    if (dto.quantity <= 0) throw new BadRequestException('Assignment quantity must be greater than zero');
    const truck = await this.trucksService.findOne(dto.truck, user);
    await assertDayOpen(this.closingModel, truck.branch.toString(), dto.date);
    const { from } = this.dateBounds(dto.date);
    const assignment = await this.model.findOneAndUpdate(
      { truck: dto.truck, date: from },
      {
        $setOnInsert: { branch: truck.branch, truck: dto.truck, date: from, quantity: 0 },
        $set: {
          notes: dto.notes || '',
          assignedBy: user.userId,
          status: 'pending',
          responseReason: '',
          respondedAt: null,
        },
        $inc: { pendingQuantity: dto.quantity },
      },
      { new: true, upsert: true },
    );
    return assignment;
  }

  async accept(id: string, user: any) {
    const assignment = await this.model.findOne({ _id: id, truck: user.truck });
    if (!assignment) throw new NotFoundException('Ice bar assignment not found');
    const pendingQuantity = Number(assignment.pendingQuantity || 0);
    if (pendingQuantity <= 0) {
      throw new BadRequestException('This ice bar assignment is no longer waiting for a response.');
    }

    await this.truckLoadsService.prepareNewAssignment(user.truck, assignment.date);
    await this.truckLoadsService.createAssignedLoad(
      user.truck,
      assignment.branch.toString(),
      assignment.date,
      pendingQuantity,
      assignment.notes,
    );
    assignment.quantity = Number(assignment.quantity || 0) + pendingQuantity;
    assignment.pendingQuantity = 0;
    assignment.status = 'accepted';
    assignment.responseReason = '';
    assignment.respondedAt = new Date();
    return assignment.save();
  }

  async reject(id: string, reason: string, user: any) {
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) throw new BadRequestException('Enter a reason for cancelling the assigned bars.');
    const assignment = await this.model.findOne({ _id: id, truck: user.truck });
    if (!assignment) throw new NotFoundException('Ice bar assignment not found');
    if (Number(assignment.pendingQuantity || 0) <= 0) {
      throw new BadRequestException('This ice bar assignment is no longer waiting for a response.');
    }
    assignment.pendingQuantity = 0;
    assignment.status = 'rejected';
    assignment.responseReason = cleanReason;
    assignment.respondedAt = new Date();
    return assignment.save();
  }

  async cancelByAdmin(id: string, user: any) {
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    const assignment = await this.model.findOne({ _id: id, ...(branch ? { branch } : {}) });
    if (!assignment) throw new NotFoundException('Ice bar assignment not found');
    if (Number(assignment.pendingQuantity || 0) <= 0) {
      throw new BadRequestException('This assignment request is no longer waiting for the driver.');
    }
    assignment.pendingQuantity = 0;
    assignment.status = 'rejected';
    assignment.responseReason = 'Assignment request cancelled by Admin';
    assignment.respondedAt = new Date();
    return assignment.save();
  }

  findForDate(user: any, date: string, truck?: string) {
    const branch = user.role === 'super_admin' ? user.selectedBranch : user.branch;
    const { from, to } = this.dateBounds(date);
    const query: any = { date: { $gte: from, $lte: to } };
    if (branch) query.branch = branch;
    if (user.role === 'truck') query.truck = user.truck;
    else if (truck) query.truck = truck;
    return this.model.find(query).populate('truck', 'truckName truckNumber driverName').exec();
  }
}
