import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
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

  async setPresence(userId: string, isOnline: boolean) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { isOnline, lastSeenAt: new Date() },
      { new: true },
    );
  }

  async findTruckPresence(truckIds: string[]) {
    if (!truckIds.length) return [];
    return this.userModel
      .find({ role: Role.TRUCK, truck: { $in: truckIds } })
      .select('truck isOnline lastSeenAt')
      .lean()
      .exec();
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
    return this.userModel.find(query).select('-passwordHash -resetOtpHash').populate('branch', 'name code isActive').sort({ createdAt: -1 }).exec();
  }

  async assignAdminToBranch(adminId: string, branchId: string) {
    return this.userModel.findOneAndUpdate(
      { _id: adminId, role: Role.ADMIN },
      { branch: branchId },
      { new: true },
    );
  }

  async unassignBranchAdmins(branchId: string, exceptAdminId?: string) {
    const query: any = { branch: branchId, role: Role.ADMIN };
    if (exceptAdminId) query._id = { $ne: exceptAdminId };
    return this.userModel.updateMany(query, { branch: null, isOnline: false });
  }

  async deleteBranchUsers(branchId: string) {
    await this.unassignBranchAdmins(branchId);
    return this.userModel.deleteMany({ branch: branchId, role: { $ne: Role.ADMIN } });
  }

  async deleteUser(userId: string) {
    return this.userModel.deleteOne({ _id: userId });
  }

  async updateProfile(userId: string, dto: { displayName?: string; phoneNumber?: string; email?: string; profileImage?: string }) {
    const update: Record<string, string> = {};
    if (dto.displayName !== undefined) update.displayName = dto.displayName.trim();
    if (dto.phoneNumber !== undefined) update.phoneNumber = dto.phoneNumber.trim();
    if (dto.email !== undefined) update.email = dto.email.trim();
    if (dto.profileImage !== undefined) update.profileImage = dto.profileImage.trim();
    return this.userModel.findByIdAndUpdate(userId, update, { new: true }).select('-passwordHash -resetOtpHash');
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userModel.findById(userId);
    if (!user) return null;
    const valid = await this.validatePassword(currentPassword, user.passwordHash);
    if (!valid) return 'invalid';
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    return 'ok';
  }
}
