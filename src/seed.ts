/**
 * Run with: npm run seed
 * Creates the default admin account defined in .env (SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD).
 */
import 'dotenv/config';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { UserSchema } from './users/schemas/user.schema';
import { Role } from './common/enums';
import { getMongoUri } from './config/mongo-uri';

async function seed() {
  const uri = getMongoUri();
  await mongoose.connect(uri, { family: 4 });

  const UserModel = mongoose.model('User', UserSchema);

  const username = process.env.SEED_ADMIN_USERNAME || 'Admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123!';

  const existing = await UserModel.findOne({ username });
  if (existing) {
    if (existing.role !== Role.SUPER_ADMIN) {
      existing.role = Role.SUPER_ADMIN;
      existing.branch = null;
      await existing.save();
      console.log(`Existing admin "${username}" upgraded to super admin.`);
    } else {
      console.log(`Super admin user "${username}" already exists. Skipping.`);
    }
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await UserModel.create({
    username,
    passwordHash,
    role: Role.SUPER_ADMIN,
    truck: null,
    isActive: true,
    displayName: 'Administrator',
  });

  console.log(`Admin user created: username="${username}".`);
  console.log('IMPORTANT: change the configured initial password after first login.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
