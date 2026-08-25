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
    const admin = await this.getAvailableAdmin(dto.adminId);
    if (await this.branchModel.exists({ code: dto.code.trim().toUpperCase() })) {
      throw new BadRequestException('Branch code is already in use');
    }
    if (await this.branchModel.exists({ name: { $regex: `^${this.escapeRegex(dto.name.trim())}$`, $options: 'i' } })) {
      throw new BadRequestException('Branch name is already in use');
    }
    if (dto.phoneNumber && await this.branchModel.exists({ phoneNumber: dto.phoneNumber.trim() })) {
      throw new BadRequestException('Phone number is already in use');
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
      await this.usersService.assignAdminToBranch(admin._id.toString(), branch._id.toString());
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
    const existing = await this.branchModel.findById(id);
    if (!existing) throw new NotFoundException('Branch not found');
    let selectedAdmin = null;
    if (dto.adminId) {
      selectedAdmin = await this.usersService.findById(dto.adminId);
      if (!selectedAdmin || selectedAdmin.role !== Role.ADMIN) throw new NotFoundException('Administrator not found');
      const assignedBranch = selectedAdmin.branch?.toString();
      if (assignedBranch && assignedBranch !== id) {
        throw new BadRequestException('This administrator is already assigned to another branch');
      }
      if (!selectedAdmin.isActive && assignedBranch !== id) {
        throw new BadRequestException('Activate the administrator before assigning a branch');
      }
    }
    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.trim().toLowerCase()) {
      const duplicateName = await this.branchModel.exists({ _id: { $ne: id }, name: { $regex: `^${this.escapeRegex(dto.name.trim())}$`, $options: 'i' } });
      if (duplicateName) throw new BadRequestException('Branch name is already in use');
    }
    if (dto.phoneNumber !== undefined && dto.phoneNumber.trim() !== (existing.phoneNumber || '').trim()) {
      const duplicatePhone = dto.phoneNumber.trim() && await this.branchModel.exists({ _id: { $ne: id }, phoneNumber: dto.phoneNumber.trim() });
      if (duplicatePhone) throw new BadRequestException('Phone number is already in use');
    }
    const { adminId, ...branchUpdate } = dto;
    const branch = await this.branchModel.findByIdAndUpdate(id, branchUpdate, { new: true });
    if (!branch) throw new NotFoundException('Branch not found');
    if (selectedAdmin && adminId) {
      await this.usersService.unassignBranchAdmins(id, adminId);
      await this.usersService.assignAdminToBranch(adminId, id);
    }
    return this.withAdmin(branch);
  }

  async remove(id: string) {
    const branch = await this.branchModel.findById(id);
    if (!branch) throw new NotFoundException('Branch not found');
    // A branch has trucks, customers and daily transaction history attached;
    // require it to be deactivated first as a deliberate confirmation step
    // before its admin account is removed and the branch record deleted.
    if (branch.isActive) throw new BadRequestException('Deactivate the branch before deleting it');
    await this.usersService.deleteBranchUsers(id);
    await branch.deleteOne();
    return { deleted: true };
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

  async createUnassignedAdmin(dto: CreateBranchAdminDto) {
    if (await this.usersService.findByUsername(dto.username)) throw new BadRequestException('Admin username is already in use');
    const admin = await this.usersService.createUser({
      username: dto.username,
      password: dto.password,
      displayName: dto.displayName,
      role: Role.ADMIN,
      branch: null,
    });
    return { id: admin._id, username: admin.username, displayName: admin.displayName, isActive: admin.isActive, branch: null };
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

  async removeAdmin(adminId: string) {
    const admin = await this.usersService.findById(adminId);
    if (!admin || admin.role !== Role.ADMIN) throw new NotFoundException('Branch admin not found');
    if (admin.branch) throw new BadRequestException('Change the branch administrator before deleting this account');
    // Same deliberate-confirmation pattern as branch deletion: disable the
    // login first, then delete it, rather than removing an active account
    // in one click.
    if (admin.isActive) throw new BadRequestException('Deactivate the admin before deleting it');
    await this.usersService.deleteUser(adminId);
    return { deleted: true };
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

  private async getAvailableAdmin(adminId: string) {
    const admin = await this.usersService.findById(adminId);
    if (!admin || admin.role !== Role.ADMIN) throw new NotFoundException('Administrator not found');
    if (admin.branch) throw new BadRequestException('This administrator is already assigned to another branch');
    if (!admin.isActive) throw new BadRequestException('Activate the administrator before assigning a branch');
    return admin;
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
