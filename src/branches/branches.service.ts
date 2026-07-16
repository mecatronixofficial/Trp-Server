import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../common/enums';
import { UsersService } from '../users/users.service';
import { CreateBranchAdminDto, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { Branch, BranchDocument } from './schemas/branch.schema';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name) private branchModel: Model<BranchDocument>,
    private usersService: UsersService,
  ) {}

  async create(dto: CreateBranchDto) {
    if (await this.usersService.findByUsername(dto.adminUsername)) {
      throw new BadRequestException('Admin username is already in use');
    }
    if (await this.branchModel.exists({ code: dto.code.trim().toUpperCase() })) {
      throw new BadRequestException('Branch code is already in use');
    }

    let branch: BranchDocument;
    try {
      branch = await this.branchModel.create({
        name: dto.name,
        code: dto.code.trim().toUpperCase(),
        address: dto.address || '',
        phoneNumber: dto.phoneNumber || '',
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.code) {
        throw new ConflictException('Branch code is already in use');
      }
      throw error;
    }
    try {
      await this.usersService.createUser({
        username: dto.adminUsername,
        password: dto.adminPassword,
        displayName: dto.adminName,
        role: Role.ADMIN,
        branch: branch._id.toString(),
      });
    } catch (error) {
      await branch.deleteOne();
      throw error;
    }
    return this.withAdmin(branch);
  }

  async findAll() {
    const branches = await this.branchModel.find().sort({ createdAt: -1 }).exec();
    return Promise.all(branches.map((branch) => this.withAdmin(branch)));
  }

  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.branchModel.findByIdAndUpdate(id, dto, { new: true });
    if (!branch) throw new NotFoundException('Branch not found');
    if (dto.isActive !== undefined) {
      const admin = await this.usersService.findBranchAdmin(id);
      if (admin) await this.usersService.setActive(admin._id.toString(), dto.isActive);
    }
    return this.withAdmin(branch);
  }

  async resetAdminPassword(id: string, newPassword: string) {
    const admin = await this.usersService.findBranchAdmin(id);
    if (!admin) throw new NotFoundException('Branch admin not found');
    await this.usersService.resetPassword(admin._id.toString(), newPassword);
    return { success: true };
  }

  async createAdmin(branchId: string, dto: CreateBranchAdminDto) {
    if (!await this.branchModel.exists({ _id: branchId })) throw new NotFoundException('Branch not found');
    if (await this.usersService.findByUsername(dto.username)) throw new BadRequestException('Admin username is already in use');
    const admin = await this.usersService.createUser({
      username: dto.username,
      password: dto.password,
      displayName: dto.displayName,
      role: Role.ADMIN,
      branch: branchId,
    });
    return { id: admin._id, username: admin.username, displayName: admin.displayName, isActive: admin.isActive, branch: admin.branch };
  }

  findAdmins(branchId?: string) {
    return this.usersService.findBranchAdmins(branchId);
  }

  async setAdminStatus(adminId: string, isActive: boolean) {
    const admin = await this.usersService.findById(adminId);
    if (!admin || admin.role !== Role.ADMIN) throw new NotFoundException('Branch admin not found');
    return this.usersService.setActive(adminId, isActive);
  }

  async resetSpecificAdminPassword(adminId: string, newPassword: string) {
    const admin = await this.usersService.findById(adminId);
    if (!admin || admin.role !== Role.ADMIN) throw new NotFoundException('Branch admin not found');
    await this.usersService.resetPassword(adminId, newPassword);
    return { success: true };
  }

  private async withAdmin(branch: BranchDocument) {
    const admins = await this.usersService.findBranchAdmins(branch._id.toString());
    const admin = admins[0];
    return {
      ...branch.toObject(),
      admin: admin ? { id: admin._id, username: admin.username, displayName: admin.displayName, isActive: admin.isActive } : null,
      admins: admins.map((item: any) => ({ id: item._id, username: item.username, displayName: item.displayName, isActive: item.isActive })),
    };
  }
}
