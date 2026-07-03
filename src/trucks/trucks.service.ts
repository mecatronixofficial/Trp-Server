import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Truck, TruckDocument } from './schemas/truck.schema';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums';
import { CreateTruckDto, UpdateTruckDto } from './dto/truck.dto';

@Injectable()
export class TrucksService {
  constructor(
    @InjectModel(Truck.name) private truckModel: Model<TruckDocument>,
    private usersService: UsersService,
  ) {}

  async create(dto: CreateTruckDto) {
    const existingLogin = await this.usersService.findByUsername(dto.loginId);
    if (existingLogin) throw new BadRequestException('Login ID already in use');

    const truck = await this.truckModel.create({
      truckName: dto.truckName,
      truckNumber: dto.truckNumber,
      driverName: dto.driverName,
      phoneNumber: dto.phoneNumber,
      loginId: dto.loginId,
      status: true,
    });

    await this.usersService.createUser({
      username: dto.loginId,
      password: dto.password,
      role: Role.TRUCK,
      truck: truck._id.toString(),
      displayName: dto.truckName,
    });

    return truck;
  }

  findAll() {
    return this.truckModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const truck = await this.truckModel.findById(id).exec();
    if (!truck) throw new NotFoundException('Truck not found');
    return truck;
  }

  async update(id: string, dto: UpdateTruckDto) {
    const truck = await this.truckModel.findByIdAndUpdate(id, dto, { new: true });
    if (!truck) throw new NotFoundException('Truck not found');
    return truck;
  }

  async setStatus(id: string, status: boolean) {
    const truck = await this.update(id, { status });
    const user = await this.usersService.findByUsername(truck.loginId);
    if (user) await this.usersService.setActive(user._id.toString(), status);
    return truck;
  }

  async remove(id: string) {
    const truck = await this.truckModel.findByIdAndDelete(id);
    if (!truck) throw new NotFoundException('Truck not found');
    await this.usersService.deleteByTruck(id);
    return { deleted: true };
  }

  async resetPassword(id: string, newPassword: string) {
    const truck = await this.findOne(id);
    const user = await this.usersService.findByUsername(truck.loginId);
    if (!user) throw new NotFoundException('Login for this truck not found');
    await this.usersService.resetPassword(user._id.toString(), newPassword);
    return { success: true };
  }
}
