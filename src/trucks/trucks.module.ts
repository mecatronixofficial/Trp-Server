import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Truck, TruckSchema } from './schemas/truck.schema';
import { TrucksService } from './trucks.service';
import { TrucksController } from './trucks.controller';
import { UsersModule } from '../users/users.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Truck.name, schema: TruckSchema }]),
    UsersModule,
    WorkersModule,
  ],
  providers: [TrucksService],
  controllers: [TrucksController],
  exports: [MongooseModule, TrucksService],
})
export class TrucksModule {}
