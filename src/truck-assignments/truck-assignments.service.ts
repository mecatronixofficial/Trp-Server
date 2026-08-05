import { BadRequestException, Injectable } from '@nestjs/common';
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
    await this.truckLoadsService.assertTripOpen(dto.truck, dto.date);
    const { from } = this.dateBounds(dto.date);
    const assignment = await this.model.findOneAndUpdate(
      { truck: dto.truck, date: from },
      { branch: truck.branch, truck: dto.truck, date: from, quantity: dto.quantity, notes: dto.notes || '', assignedBy: user.userId },
      { new: true, upsert: true },
    );
    await this.truckLoadsService.upsertAssignedLoad(dto.truck, truck.branch.toString(), dto.date, dto.quantity, dto.notes);
    return assignment;
  }

  async add(dto: UpsertTruckAssignmentDto, user: any) {
    if (dto.quantity <= 0) throw new BadRequestException('Assignment quantity must be greater than zero');
    const truck = await this.trucksService.findOne(dto.truck, user);
    await assertDayOpen(this.closingModel, truck.branch.toString(), dto.date);
    await this.truckLoadsService.assertTripOpen(dto.truck, dto.date);
    const { from } = this.dateBounds(dto.date);
    const assignment = await this.model.findOneAndUpdate(
      { truck: dto.truck, date: from },
      {
        $setOnInsert: { branch: truck.branch, truck: dto.truck, date: from },
        $set: { notes: dto.notes || '', assignedBy: user.userId },
        $inc: { quantity: dto.quantity },
      },
      { new: true, upsert: true },
    );
    await this.truckLoadsService.createAssignedLoad(dto.truck, truck.branch.toString(), dto.date, dto.quantity, dto.notes);
    return assignment;
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
