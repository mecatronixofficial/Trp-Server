import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

interface AuthUser {
  userId: string;
  role: string;
  truck: string | null;
}

@Injectable()
export class CustomersService {
  constructor(@InjectModel(Customer.name) private customerModel: Model<CustomerDocument>) {}

  create(dto: CreateCustomerDto, user?: AuthUser) {
    const truck = user?.role === 'truck' ? user.truck : dto.truck || null;
    return this.customerModel.create({ ...dto, truck });
  }

  findAll(search?: string, user?: AuthUser) {
    const query: any = {};
    const and: any[] = [];

    if (user?.role === 'truck') {
      and.push({ $or: [{ truck: user.truck }, { truck: null }, { truck: { $exists: false } }] });
    }

    if (search) {
      and.push({ $or: [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ] });
    }

    if (and.length) query.$and = and;

    return this.customerModel.find(query).populate('truck', 'truckName truckNumber driverName').sort({ name: 1 }).exec();
  }

  async findOne(id: string, user?: AuthUser) {
    const customer = await this.customerModel.findById(id).populate('truck', 'truckName truckNumber driverName').exec();
    if (!customer) throw new NotFoundException('Customer not found');
    const customerTruck = (customer.truck as any)?._id?.toString?.() || customer.truck?.toString?.();
    if (user?.role === 'truck' && customerTruck && customerTruck !== user.truck) {
      throw new ForbiddenException('Not allowed to view this customer');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const customer = await this.customerModel.findByIdAndUpdate(id, dto, { new: true });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async remove(id: string) {
    const customer = await this.customerModel.findByIdAndDelete(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return { deleted: true };
  }

  async adjustCreditBalance(id: string, delta: number) {
    return this.customerModel.findByIdAndUpdate(
      id,
      { $inc: { creditBalance: delta } },
      { new: true },
    );
  }

  async getTruckCustomerSummary() {
    const customers = await this.customerModel.find().populate('truck', 'truckName truckNumber driverName').exec();
    const summary: Record<string, { truckName: string; truckNumber?: string; customers: number; dueCustomers: number; creditBalance: number }> = {};

    for (const customer of customers) {
      const truck: any = customer.truck;
      const key = truck?._id?.toString?.() || 'unassigned';
      if (!summary[key]) {
        summary[key] = {
          truckName: truck?.truckName || 'All trucks / unassigned',
          truckNumber: truck?.truckNumber,
          customers: 0,
          dueCustomers: 0,
          creditBalance: 0,
        };
      }
      summary[key].customers += 1;
      summary[key].creditBalance += customer.creditBalance || 0;
      if ((customer.creditBalance || 0) > 0) summary[key].dueCustomers += 1;
    }

    return summary;
  }

  async getRecentCustomers(limit = 8) {
    return this.customerModel
      .find()
      .populate('truck', 'truckName truckNumber driverName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
