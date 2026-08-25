import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateWorkerBuyingDto,
  CreateWorkerDto,
  UpdateWorkerBuyingDto,
  UpdateWorkerDto,
} from './dto/worker.dto';
import { Worker, WorkerDocument } from './schemas/worker.schema';
import { WorkerBuying, WorkerBuyingDocument } from './schemas/worker-buying.schema';
import { Truck, TruckDocument } from '../trucks/schemas/truck.schema';
import { indiaDayEnd, indiaDayStart } from '../common/india-date';

@Injectable()
export class WorkersService {
  constructor(
    @InjectModel(Worker.name) private workerModel: Model<WorkerDocument>,
    @InjectModel(WorkerBuying.name) private buyingModel: Model<WorkerBuyingDocument>,
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

  // A truck never creates a person. Drivers are existing workers selected by
  // id, which makes assignment deterministic even when names are similar.
  async assignDriver(workerId: string, truck: string, branch: string) {
    const selectedWorker = await this.workerModel.findOne({
      _id: workerId,
      branch,
    }).exec();
    if (!selectedWorker) throw new NotFoundException('Selected worker was not found in this branch');

    const assignedTruck = String(selectedWorker.truck || '');
    if (selectedWorker.isActive === false && assignedTruck !== truck) {
      throw new BadRequestException('Selected worker is inactive');
    }
    if (assignedTruck && assignedTruck !== truck) {
      throw new BadRequestException('Selected worker is already assigned to another truck');
    }

    const currentDriver = await this.workerModel.findOne({ truck }).exec();
    if (currentDriver && String(currentDriver._id) !== String(selectedWorker._id)) {
      await this.workerModel.updateOne({ _id: currentDriver._id }, { $unset: { truck: 1 } }).exec();
    }

    selectedWorker.truck = new Types.ObjectId(truck) as any;
    selectedWorker.role = 'Driver';
    selectedWorker.isActive = true;
    return selectedWorker.save();
  }

  // Removing a truck or changing its driver must not remove/deactivate the
  // person. The worker remains available for another assignment.
  unassignDriver(truck: string) {
    return this.workerModel.findOneAndUpdate(
      { truck },
      { $unset: { truck: 1 } },
      { new: true },
    ).exec();
  }

  findWorkers(includeInactive: string | undefined, user: any, requestedBranch?: string) {
    const query: any = includeInactive === 'true' ? {} : { isActive: true };
    const branch = this.branchFor(user, requestedBranch);
    if (branch) query.branch = branch;
    return this.workerModel.find(query).populate('branch', 'name code isActive').sort({ name: 1 }).exec();
  }

  async updateWorker(id: string, dto: UpdateWorkerDto, user: any) {
    const branch = this.branchFor(user, (dto as any).branch);
    const currentWorker = await this.workerModel.findOne({ _id: id, ...(branch ? { branch } : {}) }).exec();
    if (!currentWorker) throw new NotFoundException('Worker not found');

    if (
      currentWorker.truck &&
      dto.role !== undefined &&
      String(dto.role || '').trim().toLowerCase() !== 'driver'
    ) {
      throw new BadRequestException('This worker is assigned to a truck. Change the truck assignment before changing the Driver role.');
    }

    const nextName = String(dto.name ?? currentWorker.name).trim().toLowerCase();
    const nextPhone = String(dto.phoneNumber ?? currentWorker.phoneNumber ?? '').replace(/\D/g, '');
    const otherWorkers = await this.workerModel.find({
      branch: currentWorker.branch,
      _id: { $ne: currentWorker._id },
    }).exec();
    const duplicate = otherWorkers.find((worker) => {
      if (worker.name.trim().toLowerCase() === nextName) return true;
      const workerPhone = String(worker.phoneNumber || '').replace(/\D/g, '');
      return Boolean(nextPhone) && workerPhone === nextPhone;
    });
    if (duplicate) {
      throw new BadRequestException(
        duplicate.name.trim().toLowerCase() === nextName
          ? 'A worker with this name already exists.'
          : 'A worker with this phone number already exists.',
      );
    }

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
    const worker = await this.workerModel.findOne({ _id: id, ...(branch ? { branch } : {}) }).exec();
    if (!worker) throw new NotFoundException('Worker not found');
    if (worker.truck) {
      throw new BadRequestException('This worker is assigned to a truck. Change or remove the driver assignment before removing the worker.');
    }
    worker.isActive = false;
    return worker.save();
  }

  async createBuying(dto: CreateWorkerBuyingDto, user: any) {
    const worker = await this.ensureWorker(dto.worker, user);
    const branch = worker.branch;
    return this.buyingModel.findOneAndUpdate(
      { worker: dto.worker, branch, date: this.dayStart(dto.date) },
      {
        worker: dto.worker,
        branch,
        date: this.dayStart(dto.date),
        buyingAmount: dto.buyingAmount,
        notes: dto.notes || '',
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).populate('worker').exec();
  }

  async findBuying(from: string | undefined, to: string | undefined, worker: string | undefined, user: any, requestedBranch?: string, limit?: string) {
    const query: any = { buyingAmount: { $gt: 0 } };
    const branch = this.branchFor(user, requestedBranch);
    if (branch) query.branch = branch;
    if (worker) query.worker = worker;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = this.dayStart(from);
      if (to) query.date.$lte = this.dayEnd(to);
    }
    const requestedLimit = Math.min(Math.max(Number(limit) || 0, 0), 100);
    let recordQuery = this.buyingModel.find(query).populate('worker').sort({ date: -1, updatedAt: -1 });
    if (requestedLimit) recordQuery = recordQuery.limit(requestedLimit);
    const records = await recordQuery.exec();
    return records.map((record: any) => ({
      ...record.toObject(),
      entryDateTime: record.updatedAt || record.createdAt || record.date,
    }));
  }

  async updateBuying(id: string, dto: UpdateWorkerBuyingDto, user: any) {
    const worker = await this.ensureWorker(dto.worker, user);
    const record = await this.buyingModel.findOneAndUpdate(
      { _id: id, branch: worker.branch },
      { ...dto, date: this.dayStart(dto.date) },
      { new: true },
    ).populate('worker');
    if (!record) throw new NotFoundException('Worker amount record not found');
    return record;
  }

  async removeBuying(id: string, user: any) {
    const query: any = { _id: id };
    if (user.role !== 'super_admin') query.branch = user.branch;
    const record = await this.buyingModel.findOneAndDelete(query);
    if (!record) throw new NotFoundException('Worker amount record not found');
    return { deleted: true };
  }

  async totalBuyingInRange(from: Date, to: Date, branchId?: string) {
    const records = await this.buyingModel.find({ buyingAmount: { $gt: 0 }, date: { $gte: from, $lte: to }, ...(branchId ? { branch: branchId } : {}) }).exec();
    return records.reduce((sum, record) => sum + Number(record.buyingAmount || 0), 0);
  }

  async monthlySummary(month: string | undefined, user: any, requestedBranch?: string) {
    const monthKey = month || new Date().toISOString().slice(0, 7);
    const from = new Date(`${monthKey}-01T00:00:00.000Z`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const [workers, records] = await Promise.all([
      this.workerModel.find({ isActive: true, ...(this.branchFor(user, requestedBranch) ? { branch: this.branchFor(user, requestedBranch) } : {}) }).sort({ name: 1 }).exec(),
      this.buyingModel.find({ buyingAmount: { $gt: 0 }, ...(this.branchFor(user, requestedBranch) ? { branch: this.branchFor(user, requestedBranch) } : {}), date: { $gte: from, $lte: to } }).exec(),
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
