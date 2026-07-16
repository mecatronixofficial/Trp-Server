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
      await this.workersService.createDriver(
        truck._id.toString(),
        String(branch),
        dto.driverName,
        dto.phoneNumber,
        dto.monthlySalary || 0,
      );
    } catch (error) {
      await this.usersService.deleteByTruck(truck._id.toString());
      await truck.deleteOne();
      throw error;
    }

    return truck;
  }

  findAll(actor: any) {
    const filter = actor.role === Role.SUPER_ADMIN ? (actor.selectedBranch ? { branch: actor.selectedBranch } : {}) : { branch: actor.branch };
    return this.truckModel.find(filter).populate('branch', 'name code').sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, actor?: any) {
    const filter: any = { _id: id };
    if (actor?.role !== Role.SUPER_ADMIN) filter.branch = actor?.branch;
    else if (actor?.selectedBranch) filter.branch = actor.selectedBranch;
    const truck = await this.truckModel.findOne(filter).exec();
    if (!truck) throw new NotFoundException('Truck not found');
    return truck;
  }

  async update(id: string, dto: UpdateTruckDto, actor?: any) {
    const filter: any = { _id: id };
    if (actor?.role !== Role.SUPER_ADMIN) filter.branch = actor?.branch;
    else if (actor?.selectedBranch) filter.branch = actor.selectedBranch;
    const { monthlySalary, ...truckUpdate } = dto;
    const truck = await this.truckModel.findOneAndUpdate(filter, truckUpdate, { new: true });
    if (!truck) throw new NotFoundException('Truck not found');
    await this.workersService.updateDriver(id, {
      ...(dto.driverName !== undefined ? { name: dto.driverName } : {}),
      ...(dto.phoneNumber !== undefined ? { phoneNumber: dto.phoneNumber } : {}),
      ...(monthlySalary !== undefined ? { monthlySalary } : {}),
      ...(dto.status !== undefined ? { isActive: dto.status } : {}),
    });
    return truck;
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
    await this.workersService.deactivateDriver(id);
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
