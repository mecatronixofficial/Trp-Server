import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateWorkerAttendanceDto,
  CreateWorkerBuyingDto,
  CreateWorkerDto,
  UpdateWorkerAttendanceDto,
  UpdateWorkerBuyingDto,
  UpdateWorkerDto,
} from './dto/worker.dto';
import { Worker, WorkerDocument } from './schemas/worker.schema';
import { WorkerAttendance, WorkerAttendanceDocument, WorkerAttendanceStatus } from './schemas/worker-attendance.schema';
import { Truck, TruckDocument } from '../trucks/schemas/truck.schema';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';

@Injectable()
export class WorkersService {
  constructor(
    @InjectModel(Worker.name) private workerModel: Model<WorkerDocument>,
    @InjectModel(WorkerAttendance.name) private attendanceModel: Model<WorkerAttendanceDocument>,
    @InjectModel(Truck.name) private truckModel: Model<TruckDocument>,
  ) {}

  private branchFor(user: any, requested?: string, required = false) {
    const branch = user?.role === 'super_admin' ? (requested || user?.selectedBranch) : user?.branch;
    if (required && !branch) throw new BadRequestException('Select a branch before adding a worker');
    return branch;
  }

  // The Workers page already blocks a duplicate name/phone client-side, but
  // that check only looks at whatever list happened to be loaded in the
  // browser — enforce it here too so a person can never end up with two
  // records (one plain, one truck-linked) no matter how it's triggered.
  async createWorker(dto: CreateWorkerDto, user: any) {
    const branch = this.branchFor(user, (dto as any).branch, true);
    const normalizedName = String(dto.name || '').trim().toLowerCase();
    const normalizedPhone = String(dto.phoneNumber || '').replace(/\D/g, '');
    const existing = await this.workerModel.find({ branch }).exec();
    const duplicate = existing.find((worker) => {
      if (worker.name.trim().toLowerCase() === normalizedName) return true;
      const workerPhone = String(worker.phoneNumber || '').replace(/\D/g, '');
      return Boolean(normalizedPhone) && workerPhone === normalizedPhone;
    });
    if (duplicate) {
      throw new BadRequestException(
        duplicate.name.trim().toLowerCase() === normalizedName
          ? 'A worker with this name already exists.'
          : 'A worker with this phone number already exists.',
      );
    }
    return this.workerModel.create({ ...dto, branch });
  }

  // A driver is often typed in as the name of a worker that was already
  // created separately on the Workers page. Link that existing worker to
  // the new truck instead of creating a duplicate person record — matched
  // the same way the Workers page itself checks for duplicates (name or
  // phone number), restricted to workers not already linked to a truck.
  async createDriver(truck: string, branch: string, name: string, phoneNumber: string) {
    const normalizedName = String(name || '').trim().toLowerCase();
    const normalizedPhone = String(phoneNumber || '').replace(/\D/g, '');
    const unlinkedWorkers = await this.workerModel.find({ branch, truck: { $exists: false } }).exec();
    const existing = unlinkedWorkers.find((worker) => {
      if (worker.name.trim().toLowerCase() === normalizedName) return true;
      const workerPhone = String(worker.phoneNumber || '').replace(/\D/g, '');
      return Boolean(normalizedPhone) && workerPhone === normalizedPhone;
    });
    if (existing) {
      existing.truck = new Types.ObjectId(truck) as any;
      existing.name = name;
      existing.phoneNumber = phoneNumber;
      existing.role = 'Driver';
      existing.isActive = true;
      return existing.save();
    }
    return this.workerModel.create({
      truck,
      branch,
      name,
      phoneNumber,
      role: 'Driver',
      isActive: true,
    });
  }

  // Same duplicate-prevention rule as createDriver, but for the "edit an
  // existing truck's driver" path: renaming the truck's linked driver to a
  // name that now matches a different, separately-created worker must merge
  // into that worker rather than just renaming the truck's own worker record
  // in place — otherwise a second person with the same name still results.
  async updateDriver(truck: string, branch: string, values: { name?: string; phoneNumber?: string; isActive?: boolean }) {
    const currentDriver = await this.workerModel.findOne({ truck }).exec();
    if (!currentDriver) return null;

    const nextName = values.name !== undefined ? values.name : currentDriver.name;
    const nextPhone = values.phoneNumber !== undefined ? values.phoneNumber : currentDriver.phoneNumber;
    const normalizedName = String(nextName || '').trim().toLowerCase();
    const normalizedPhone = String(nextPhone || '').replace(/\D/g, '');
    const isChanging = (values.name !== undefined && normalizedName !== currentDriver.name.trim().toLowerCase())
      || (values.phoneNumber !== undefined && normalizedPhone !== String(currentDriver.phoneNumber || '').replace(/\D/g, ''));

    if (isChanging && branch) {
      const otherUnlinked = await this.workerModel.find({ branch, truck: { $exists: false }, _id: { $ne: currentDriver._id } }).exec();
      const match = otherUnlinked.find((worker) => {
        if (worker.name.trim().toLowerCase() === normalizedName) return true;
        const workerPhone = String(worker.phoneNumber || '').replace(/\D/g, '');
        return Boolean(normalizedPhone) && workerPhone === normalizedPhone;
      });
      if (match) {
        currentDriver.isActive = false;
        currentDriver.truck = undefined as any;
        await currentDriver.save();
        match.truck = new Types.ObjectId(truck) as any;
        match.name = nextName;
        match.phoneNumber = nextPhone;
        match.role = 'Driver';
        match.isActive = values.isActive !== undefined ? values.isActive : true;
        return match.save();
      }
    }

    return this.workerModel.findOneAndUpdate({ truck }, values, { new: true }).exec();
  }

  deactivateDriver(truck: string) {
    return this.workerModel.findOneAndUpdate(
      { truck },
      { $set: { isActive: false }, $unset: { truck: 1 } },
      { new: true },
    ).exec();
  }

  findWorkers(includeInactive: string | undefined, user: any, requestedBranch?: string) {
    const query: any = includeInactive === 'true' ? {} : { isActive: true };
    const branch = this.branchFor(user, requestedBranch);
    if (branch) query.branch = branch;
    return this.workerModel.find(query).sort({ name: 1 }).exec();
  }

  async updateWorker(id: string, dto: UpdateWorkerDto, user: any) {
    const branch = this.branchFor(user, (dto as any).branch);
    const worker = await this.workerModel.findOneAndUpdate({ _id: id, ...(branch ? { branch } : {}) }, dto, { new: true });
    if (!worker) throw new NotFoundException('Worker not found');
    // Keep a linked truck's own driver fields in sync so editing this person
    // from either the Workers page or the Trucks page shows the same name/
    // phone number everywhere.
    if (worker.truck && (dto.name !== undefined || dto.phoneNumber !== undefined)) {
      await this.truckModel.findByIdAndUpdate(worker.truck, {
        ...(dto.name !== undefined ? { driverName: dto.name } : {}),
        ...(dto.phoneNumber !== undefined ? { phoneNumber: dto.phoneNumber } : {}),
      });
    }
    return worker;
  }

  async removeWorker(id: string, user: any) {
    const branch = this.branchFor(user, (user as any).requestedBranch);
    const worker = await this.workerModel.findOneAndUpdate({ _id: id, ...(branch ? { branch } : {}) }, { isActive: false }, { new: true });
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  async createAttendance(dto: CreateWorkerAttendanceDto, user: any) {
    const worker = await this.ensureWorker(dto.worker, user);
    const branch = worker.branch;
    return this.attendanceModel.findOneAndUpdate(
      { worker: dto.worker, branch, date: this.dayStart(dto.date) },
      {
        worker: dto.worker,
        branch,
        date: this.dayStart(dto.date),
        status: dto.status,
        buyingAmount: dto.buyingAmount,
        notes: dto.notes || '',
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).populate('worker').exec();
  }

  createBuying(dto: CreateWorkerBuyingDto, user: any) {
    return this.createAttendance({ ...dto, status: WorkerAttendanceStatus.PRESENT }, user);
  }

  async findAttendance(from: string | undefined, to: string | undefined, worker: string | undefined, user: any, requestedBranch?: string, limit?: string) {
    const query: any = {};
    const branch = this.branchFor(user, requestedBranch);
    if (branch) query.branch = branch;
    if (worker) query.worker = worker;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = this.dayStart(from);
      if (to) query.date.$lte = this.dayEnd(to);
    }
    const requestedLimit = Math.min(Math.max(Number(limit) || 0, 0), 100);
    let recordQuery = this.attendanceModel.find(query).populate('worker').sort({ date: -1, updatedAt: -1 });
    if (requestedLimit) recordQuery = recordQuery.limit(requestedLimit);
    const records = await recordQuery.exec();
    return records.map((record: any) => ({
      ...record.toObject(),
      entryDateTime: record.updatedAt || record.createdAt || record.date,
    }));
  }

  async updateAttendance(id: string, dto: UpdateWorkerAttendanceDto, user: any) {
    const worker = await this.ensureWorker(dto.worker, user);
    const record = await this.attendanceModel.findOneAndUpdate(
      { _id: id, branch: worker.branch },
      { ...dto, date: this.dayStart(dto.date) },
      { new: true },
    ).populate('worker');
    if (!record) throw new NotFoundException('Attendance record not found');
    return record;
  }

  updateBuying(id: string, dto: UpdateWorkerBuyingDto, user: any) {
    return this.updateAttendance(id, { ...dto, status: WorkerAttendanceStatus.PRESENT }, user);
  }

  async removeAttendance(id: string, user: any) {
    const query: any = { _id: id };
    if (user.role !== 'super_admin') query.branch = user.branch;
    const record = await this.attendanceModel.findOneAndDelete(query);
    if (!record) throw new NotFoundException('Attendance record not found');
    return { deleted: true };
  }

  async totalBuyingInRange(from: Date, to: Date, branchId?: string) {
    const records = await this.attendanceModel.find({ date: { $gte: from, $lte: to }, ...(branchId ? { branch: branchId } : {}) }).exec();
    return records.reduce((sum, record) => sum + Number(record.buyingAmount || 0), 0);
  }

  async monthlySummary(month: string | undefined, user: any, requestedBranch?: string) {
    const monthKey = month || new Date().toISOString().slice(0, 7);
    const from = new Date(`${monthKey}-01T00:00:00.000Z`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const [workers, records] = await Promise.all([
      this.workerModel.find({ isActive: true, ...(this.branchFor(user, requestedBranch) ? { branch: this.branchFor(user, requestedBranch) } : {}) }).sort({ name: 1 }).exec(),
      this.attendanceModel.find({ ...(this.branchFor(user, requestedBranch) ? { branch: this.branchFor(user, requestedBranch) } : {}), date: { $gte: from, $lte: to } }).exec(),
    ]);

    return workers.map((worker: any) => {
      const workerRecords = records.filter((record: any) => String(record.worker) === String(worker._id));
      const buyingAmount = workerRecords.reduce((sum: number, record: any) => sum + Number(record.buyingAmount || 0), 0);

      return {
        workerId: worker._id,
        name: worker.name,
        role: worker.role,
        buyingAmount,
        buyingDays: workerRecords.length,
      };
    });
  }

  private async ensureWorker(id: string, user: any) {
    const query: any = { _id: id };
    if (user.role !== 'super_admin') query.branch = user.branch;
    const worker = await this.workerModel.findOne(query);
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  private dayStart(date: string) {
    return indiaDayStart(date.slice(0, 10));
  }

  private dayEnd(date: string) {
    return indiaDayEnd(date.slice(0, 10));
  }
}
