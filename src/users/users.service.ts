import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { Role } from '../common/enums';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  findByUsername(username: string) {
    return this.userModel.findOne({ username: username.trim() }).exec();
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  findAdmin() {
    return this.userModel.findOne({ role: Role.SUPER_ADMIN, isActive: true }).exec();
  }

  async createUser(params: {
    username: string;
    password: string;
    role: Role;
    truck?: string | null;
    displayName?: string;
    branch?: string | null;
  }) {
    const passwordHash = await bcrypt.hash(params.password, 10);
    return this.userModel.create({
      username: params.username.trim(),
      passwordHash,
      role: params.role,
      truck: params.truck || null,
      displayName: params.displayName || params.username,
      branch: params.branch || null,
    });
  }

  async resetPassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        passwordHash,
        resetOtpHash: null,
        resetOtpExpiresAt: null,
        resetOtpMethod: null,
        resetOtpDestination: null,
      },
      { new: true },
    );
  }

  async setActive(userId: string, isActive: boolean) {
    return this.userModel.findByIdAndUpdate(userId, { isActive }, { new: true });
  }

  async validatePassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  }

  async deleteByTruck(truckId: string) {
    return this.userModel.deleteMany({ truck: truckId });
  }

  findBranchAdmin(branchId: string) {
    return this.userModel.findOne({ branch: branchId, role: Role.ADMIN }).exec();
  }

  findBranchAdmins(branchId?: string) {
    const query: any = { role: Role.ADMIN };
    if (branchId) query.branch = branchId;
    return this.userModel.find(query).select('-passwordHash -resetOtpHash').populate('branch', 'name code').sort({ createdAt: -1 }).exec();
  }

  async deleteBranchUsers(branchId: string) {
    return this.userModel.deleteMany({ branch: branchId });
  }
}
