import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MakingCost, MakingCostSchema } from './schemas/making-cost.schema';
import { MakingCostService } from './making-cost.service';
import { MakingCostController } from './making-cost.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: MakingCost.name, schema: MakingCostSchema }])],
  providers: [MakingCostService],
  controllers: [MakingCostController],
  exports: [MongooseModule, MakingCostService],
})
export class MakingCostModule {}
