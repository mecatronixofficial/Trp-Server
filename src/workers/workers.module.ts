import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Worker, WorkerSchema } from './schemas/worker.schema';
import { WorkerBuying, WorkerBuyingSchema } from './schemas/worker-buying.schema';
import { Truck, TruckSchema } from '../trucks/schemas/truck.schema';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Worker.name, schema: WorkerSchema },
      { name: WorkerBuying.name, schema: WorkerBuyingSchema },
      // Registered here (not by importing TrucksModule, which itself imports
      // WorkersModule) so a worker edit can keep a linked truck's driver
      // fields in sync without a circular module dependency.
      { name: Truck.name, schema: TruckSchema },
    ]),
  ],
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
