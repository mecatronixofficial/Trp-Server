import { Injectable, NotFoundException } from '@nestjs/common';
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

  createWorker(dto: CreateWorkerDto) {
    return this.workerModel.create(dto);
  }

  findWorkers(includeInactive?: string) {
    const query = includeInactive === 'true' ? {} : { isActive: true };
    return this.workerModel.find(query).sort({ name: 1 }).exec();
  }

  async updateWorker(id: string, dto: UpdateWorkerDto) {
    const worker = await this.workerModel.findByIdAndUpdate(id, dto, { new: true });
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  async removeWorker(id: string) {
    const worker = await this.workerModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!worker) throw new NotFoundException('Worker not found');
    return worker;
  }

  async createAttendance(dto: CreateWorkerAttendanceDto) {
    await this.ensureWorker(dto.worker);
    return this.attendanceModel.findOneAndUpdate(
      { worker: dto.worker, date: this.dayStart(dto.date) },
      {
        worker: dto.worker,
        date: this.dayStart(dto.date),
        status: dto.status,
        buyingAmount: dto.buyingAmount,
        notes: dto.notes || '',
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).populate('worker').exec();
  }

  createBuying(dto: CreateWorkerBuyingDto) {
    return this.createAttendance({ ...dto, status: WorkerAttendanceStatus.PRESENT });
  }

  async findAttendance(from?: string, to?: string, worker?: string) {
    const query: any = {};
    if (worker) query.worker = worker;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = this.dayStart(from);
      if (to) query.date.$lte = this.dayEnd(to);
    }
    return this.attendanceModel.find(query).populate('worker').sort({ date: -1 }).exec();
  }

  async updateAttendance(id: string, dto: UpdateWorkerAttendanceDto) {
    await this.ensureWorker(dto.worker);
    const record = await this.attendanceModel.findByIdAndUpdate(
      id,
      { ...dto, date: this.dayStart(dto.date) },
      { new: true },
    ).populate('worker');
    if (!record) throw new NotFoundException('Attendance record not found');
    return record;
  }

  updateBuying(id: string, dto: UpdateWorkerBuyingDto) {
    return this.updateAttendance(id, { ...dto, status: WorkerAttendanceStatus.PRESENT });
  }

  async removeAttendance(id: string) {
    const record = await this.attendanceModel.findByIdAndDelete(id);
    if (!record) throw new NotFoundException('Attendance record not found');
    return { deleted: true };
  }

  async totalBuyingInRange(from: Date, to: Date) {
    const records = await this.attendanceModel.find({ date: { $gte: from, $lte: to } }).exec();
    return records.reduce((sum, record) => sum + Number(record.buyingAmount || 0), 0);
  }

  async monthlySummary(month?: string) {
    const monthKey = month || new Date().toISOString().slice(0, 7);
    const from = new Date(`${monthKey}-01T00:00:00.000Z`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const [workers, records] = await Promise.all([
      this.workerModel.find({ isActive: true }).sort({ name: 1 }).exec(),
      this.attendanceModel.find({ date: { $gte: from, $lte: to } }).exec(),
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

  private async ensureWorker(id: string) {
    const worker = await this.workerModel.findById(id);
    if (!worker) throw new NotFoundException('Worker not found');
  }

  private dayStart(date: string) {
    return new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  }

  private dayEnd(date: string) {
    return new Date(`${date.slice(0, 10)}T23:59:59.999Z`);
  }
}
