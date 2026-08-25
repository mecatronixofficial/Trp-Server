import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { Truck, TruckSchema } from '../trucks/schemas/truck.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Customer.name, schema: CustomerSchema },
    { name: Truck.name, schema: TruckSchema },
  ])],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [MongooseModule, CustomersService],
})
export class CustomersModule {}
