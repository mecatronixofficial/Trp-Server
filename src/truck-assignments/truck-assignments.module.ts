import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrucksModule } from '../trucks/trucks.module';
import { TruckLoadsModule } from '../truck-loads/truck-loads.module';
import { TruckAssignment, TruckAssignmentSchema } from './schemas/truck-assignment.schema';
import { TruckAssignmentsController } from './truck-assignments.controller';
import { TruckAssignmentsService } from './truck-assignments.service';
import { DailyClosing, DailyClosingSchema } from '../daily-closing/schemas/daily-closing.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: TruckAssignment.name, schema: TruckAssignmentSchema },
    { name: DailyClosing.name, schema: DailyClosingSchema },
  ]), TrucksModule, TruckLoadsModule],
  controllers: [TruckAssignmentsController],
  providers: [TruckAssignmentsService],
  exports: [TruckAssignmentsService],
})
export class TruckAssignmentsModule {}
