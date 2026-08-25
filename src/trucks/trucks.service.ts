import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Truck, TruckDocument } from './schemas/truck.schema';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums';
import { CreateTruckDto, UpdateTruckDto } from './dto/truck.dto';
import { WorkersService } from '../workers/workers.service';

@Injectable()
export class TrucksService {
  constructor(
    @InjectModel(Truck.name) private truckModel: Model<TruckDocument>,
    private usersService: UsersService,
    private workersService: WorkersService,
  ) {}

  async create(dto: CreateTruckDto, actor: any) {
    const branch = actor.role === Role.SUPER_ADMIN ? ((dto as any).branch || actor.selectedBranch) : actor.branch;
    if (!branch) throw new BadRequestException('A branch is required for this driver');
    const existingLogin = await this.usersService.findByUsername(dto.loginId);
    if (existingLogin) throw new BadRequestException('Login ID already in use');

    const truck = await this.truckModel.create({
      truckName: dto.truckName,
      truckNumber: dto.truckNumber,
      driverName: dto.driverName,
      phoneNumber: dto.phoneNumber,
      monthlySalary: dto.monthlySalary || 0,
      loginId: dto.loginId,
      status: true,
      branch,
    });

    try {
      await this.usersService.createUser({
        username: dto.loginId,
        password: dto.password,
        role: Role.TRUCK,
        truck: truck._id.toString(),
        displayName: dto.truckName,
        branch,
      });
      const driver = await this.workersService.assignDriver(
        dto.worker,
        truck._id.toString(),
        String(branch),
      );
      truck.driverName = driver.name;
      truck.phoneNumber = driver.phoneNumber || '';
      await truck.save();
    } catch (error) {
      await this.workersService.unassignDriver(truck._id.toString());
      await this.usersService.deleteByTruck(truck._id.toString());
      await truck.deleteOne();
      throw error;
    }

    return truck;
  }

  async findAll(actor: any) {
    const filter = actor.role === Role.SUPER_ADMIN ? (actor.selectedBranch ? { branch: actor.selectedBranch } : {}) : { branch: actor.branch };
    const trucks = await this.truckModel.find(filter).populate('branch', 'name code').sort({ createdAt: -1 }).exec();
    const presenceRows: any[] = await this.usersService.findTruckPresence(trucks.map((truck) => truck._id.toString()));
    const presence = new Map(presenceRows.map((row) => [String(row.truck), row]));
    const onlineCutoff = Date.now() - 90_000;
    return trucks.map((truck) => {
      const row: any = presence.get(truck._id.toString());
      const lastSeenAt = row?.lastSeenAt ? new Date(row.lastSeenAt) : null;
      return {
        ...truck.toObject(),
        isOnline: Boolean(row?.isOnline && lastSeenAt && lastSeenAt.getTime() >= onlineCutoff),
        lastSeenAt,
      };
    });
  }

  async findOne(id: string, actor?: any) {
    const filter: any = { _id: id };
    if (actor?.role !== Role.SUPER_ADMIN) filter.branch = actor?.branch;
    else if (actor?.selectedBranch) filter.branch = actor.selectedBranch;
    const truck = await this.truckModel.findOne(filter).populate('branch', 'name code').exec();
    if (!truck) throw new NotFoundException('Truck not found');
    const [presence]: any[] = await this.usersService.findTruckPresence([id]);
    const lastSeenAt = presence?.lastSeenAt ? new Date(presence.lastSeenAt) : null;
    return {
      ...truck.toObject(),
      isOnline: Boolean(presence?.isOnline && lastSeenAt && lastSeenAt.getTime() >= Date.now() - 90_000),
      lastSeenAt,
    };
  }

  async assertOnline(id: string) {
    const [presence]: any[] = await this.usersService.findTruckPresence([id]);
    const lastSeenAt = presence?.lastSeenAt ? new Date(presence.lastSeenAt) : null;
    const online = Boolean(
      presence?.isOnline &&
      lastSeenAt &&
      lastSeenAt.getTime() >= Date.now() - 90_000,
    );
    if (!online) {
      throw new BadRequestException('This truck is Offline. The driver must login before Admin can assign ice bars.');
    }
  }

  async update(id: string, dto: UpdateTruckDto, actor?: any) {
    const filter: any = { _id: id };
    if (actor?.role !== Role.SUPER_ADMIN) filter.branch = actor?.branch;
    else if (actor?.selectedBranch) filter.branch = actor.selectedBranch;
    const existingTruck = await this.truckModel.findOne(filter);
    if (!existingTruck) throw new NotFoundException('Truck not found');

    const { worker, ...truckChanges } = dto;
    if (worker) {
      const driver = await this.workersService.assignDriver(worker, id, String(existingTruck.branch));
      truckChanges.driverName = driver.name;
      truckChanges.phoneNumber = driver.phoneNumber || '';
    }

    return this.truckModel.findOneAndUpdate(filter, truckChanges, { new: true });
  }

  async setStatus(id: string, status: boolean, actor?: any) {
    const truck = await this.update(id, { status }, actor);
    const user = await this.usersService.findByUsername(truck.loginId);
    if (user) await this.usersService.setActive(user._id.toString(), status);
    return truck;
  }

  async remove(id: string, actor?: any) {
    const filter: any = { _id: id };
    if (actor?.role !== Role.SUPER_ADMIN) filter.branch = actor?.branch;
    else if (actor?.selectedBranch) filter.branch = actor.selectedBranch;
    const truck = await this.truckModel.findOneAndDelete(filter);
    if (!truck) throw new NotFoundException('Truck not found');
    await this.usersService.deleteByTruck(id);
    await this.workersService.unassignDriver(id);
    return { deleted: true };
  }

  async resetPassword(id: string, newPassword: string, actor?: any) {
    const truck = await this.findOne(id, actor);
    const user = await this.usersService.findByUsername(truck.loginId);
    if (!user) throw new NotFoundException('Login for this truck not found');
    await this.usersService.resetPassword(user._id.toString(), newPassword);
    return { success: true };
  }
}
