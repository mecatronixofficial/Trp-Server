import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

@Injectable()
export class WorkersService {
  constructor(
    @InjectModel(Worker.name) private workerModel: Model<WorkerDocument>,
    @InjectModel(WorkerAttendance.name) private attendanceModel: Model<WorkerAttendanceDocument>,
  ) {}

  private branchFor(user: any, requested?: string, required = false) {
    const branch = user?.role === 'super_admin' ? (requested || user?.selectedBranch) : user?.branch;
    if (required && !branch) throw new BadRequestException('Select a branch before adding a worker');
    return branch;
  }

  createWorker(dto: CreateWorkerDto, user: any) {
    return this.workerModel.create({ ...dto, branch: this.branchFor(user, (dto as any).branch, true) });
  }

  createDriver(truck: string, branch: string, name: string, phoneNumber: string, monthlySalary = 0) {
    return this.workerModel.create({
      truck,
      branch,
      name,
      phoneNumber,
      role: 'Driver',
      monthlySalary,
      isActive: true,
    });
  }

  updateDriver(truck: string, values: { name?: string; phoneNumber?: string; monthlySalary?: number; isActive?: boolean }) {
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

  async findAttendance(from: string | undefined, to: string | undefined, worker: string | undefined, user: any, requestedBranch?: string) {
    const query: any = {};
    const branch = this.branchFor(user, requestedBranch);
    if (branch) query.branch = branch;
    if (worker) query.worker = worker;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = this.dayStart(from);
      if (to) query.date.$lte = this.dayEnd(to);
    }
    return this.attendanceModel.find(query).populate('worker').sort({ date: -1 }).exec();
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
        monthlySalary: Number(worker.monthlySalary || 0),
        buyingAmount,
        balanceAmount: Number(worker.monthlySalary || 0) - buyingAmount,
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
    return new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  }

  private dayEnd(date: string) {
    return new Date(`${date.slice(0, 10)}T23:59:59.999Z`);
  }
}
