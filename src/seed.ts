/**
 * Run with: npm run seed
 * Creates the default admin account defined in .env (SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD).
 */
import 'dotenv/config';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema } from './users/schemas/user.schema';
import { Role } from './common/enums';

async function seed() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/tiruppur_ice';
  await mongoose.connect(uri);

  const UserModel = mongoose.model('User', UserSchema);

  const username = process.env.SEED_ADMIN_USERNAME || 'Admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123!';

  const existing = await UserModel.findOne({ username });
  if (existing) {
    console.log(`Admin user "${username}" already exists. Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await UserModel.create({
    username,
    passwordHash,
    role: Role.ADMIN,
    truck: null,
    isActive: true,
    displayName: 'Administrator',
  });

  console.log(`Admin user created: username="${username}" password="${password}"`);
  console.log('IMPORTANT: change this password after first login.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
