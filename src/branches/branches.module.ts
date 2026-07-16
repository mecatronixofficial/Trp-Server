import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { Branch, BranchSchema } from './schemas/branch.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Branch.name, schema: BranchSchema }]), UsersModule],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
