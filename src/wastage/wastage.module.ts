import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wastage, WastageSchema } from './schemas/wastage.schema';
import { WastageService } from './wastage.service';
import { WastageController } from './wastage.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Wastage.name, schema: WastageSchema }])],
  providers: [WastageService],
  controllers: [WastageController],
  exports: [MongooseModule, WastageService],
})
export class WastageModule {}
