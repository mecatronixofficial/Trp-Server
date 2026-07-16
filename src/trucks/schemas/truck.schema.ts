import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TruckDocument = Truck & Document;

@Schema({ timestamps: true })
export class Truck {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ required: true, trim: true })
  truckName: string;

  @Prop({ required: true, unique: true, trim: true })
  truckNumber: string;

  @Prop({ required: true, trim: true })
  driverName: string;

  @Prop({ required: true, trim: true })
  phoneNumber: string;

  @Prop({ default: 0, min: 0 })
  monthlySalary: number;

  // login credentials live in the User collection; this stores which
  // username is tied to this truck for quick display in admin UI.
  @Prop({ required: true, unique: true, trim: true })
  loginId: string;

  @Prop({ default: true })
  status: boolean; // true = active, false = deactivated
}

export const TruckSchema = SchemaFactory.createForClass(Truck);
