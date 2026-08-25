import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { Truck, TruckDocument } from '../trucks/schemas/truck.schema';

interface AuthUser {
  userId: string;
  role: string;
  truck: string | null;
  branch?: string | null;
  selectedBranch?: string | null;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(Truck.name) private truckModel: Model<TruckDocument>,
  ) {}

  async create(dto: CreateCustomerDto, user?: AuthUser) {
    const truck = user?.role === 'truck' ? user.truck : dto.truck || null;
    const customerType = user?.role === 'truck' ? 'truck' : dto.customerType || (truck ? 'truck' : 'local');
    if (customerType === 'truck' && !truck) throw new BadRequestException('Select a truck for a truck customer');

    let branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch;
    if (user?.role === 'truck') {
      const assignedTruck = await this.truckModel.findById(truck).select('branch status').exec();
      if (!assignedTruck) throw new ForbiddenException('This login is not linked to a truck. Ask an admin to check the truck account.');
      if (assignedTruck.status === false) throw new ForbiddenException('This truck login is disabled. Ask an admin to enable it.');
      branch = String(assignedTruck.branch || '');
    }
    if (!branch) throw new BadRequestException('A branch is required before creating a customer');
    return this.customerModel.create({ ...dto, branch, customerType, truck: customerType === 'local' ? null : truck });
  }

  async findAll(search?: string, user?: AuthUser) {
    const query: any = {};
    const and: any[] = [];

    // Drivers can search every existing customer when recording a sale.
    // The sale itself is still stored against the logged-in driver's truck.

    if (search) {
      const escapedSearch = this.escapeRegex(search);
      and.push({ $or: [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { phoneNumber: { $regex: escapedSearch, $options: 'i' } },
      ] });
    }

    if (and.length) query.$and = and;

    let branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch;
    if (user?.role === 'truck' && user.truck) {
      const assignedTruck = await this.truckModel.findById(user.truck).select('branch').exec();
      if (!assignedTruck) throw new ForbiddenException('This login is not linked to a truck');
      branch = String(assignedTruck.branch || '');
    }
    if (branch) query.branch = branch;
    return this.customerModel.find(query).populate('truck', 'truckName truckNumber driverName branch').sort({ name: 1 }).exec();
  }

  async findOne(id: string, user?: AuthUser) {
    const query: any = { _id: id };
    let branch = user?.role === 'super_admin' ? user.selectedBranch : user?.branch;
    if (user?.role === 'truck' && user.truck) {
      const assignedTruck = await this.truckModel.findById(user.truck).select('branch').exec();
      if (!assignedTruck) throw new ForbiddenException('This login is not linked to a truck');
      branch = String(assignedTruck.branch || '');
    }
    if (branch) query.branch = branch;
    const customer = await this.customerModel.findOne(query).populate('truck', 'truckName truckNumber driverName').exec();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const existing = await this.customerModel.findById(id);
    if (!existing) throw new NotFoundException('Customer not found');
    const customerType = dto.customerType || existing.customerType || (existing.truck ? 'truck' : 'local');
    const truck = dto.truck !== undefined ? dto.truck : existing.truck;
    if (customerType === 'truck' && !truck) throw new BadRequestException('Select a truck for a truck customer');
    const customer = await this.customerModel.findByIdAndUpdate(id, { ...dto, customerType, truck: customerType === 'local' ? null : truck }, { new: true });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async remove(id: string) {
    const customer = await this.customerModel.findByIdAndDelete(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return { deleted: true };
  }

  async adjustCreditBalance(id: string, delta: number, session?: ClientSession) {
    return this.customerModel.findByIdAndUpdate(
      id,
      { $inc: { creditBalance: delta } },
      { new: true, session },
    );
  }

  async getTruckCustomerSummary(branch?: string) {
    const customers = await this.customerModel.find(branch ? { branch } : {}).populate('truck', 'truckName truckNumber driverName').exec();
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

  async getRecentCustomers(limit = 8, branch?: string) {
    return this.customerModel
      .find(branch ? { branch } : {})
      .populate('truck', 'truckName truckNumber driverName')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
