import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument } from './schemas/settings.schema';

// A branch admin runs a shop, not a business — they may rename/rebrand their
// shop's identity, but the OTP recovery contacts (which recover the super
// admin's own login) and the box-cycle config (shared math across every
// branch) stay super_admin-only.
const BRANCH_ADMIN_EDITABLE_FIELDS = ['businessName', 'businessLogo', 'gstNumber', 'address'] as const;

@Injectable()
export class SettingsService {
  constructor(@InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>) {}

  async get() {
    let settings = await this.settingsModel.findOne();
    if (!settings) settings = await this.settingsModel.create({});
    return settings;
  }

  async update(dto: Partial<Settings>, isSuperAdmin: boolean) {
    if (!isSuperAdmin) {
      const disallowed = Object.keys(dto).filter((key) => !BRANCH_ADMIN_EDITABLE_FIELDS.includes(key as any));
      if (disallowed.length) throw new ForbiddenException('Only Super Admin can change these settings');
    }
    const settings = await this.get();
    Object.assign(settings, dto);
    return settings.save();
  }
}
