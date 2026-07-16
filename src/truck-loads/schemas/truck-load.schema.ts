import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IceBarSize } from '../../common/enums';

export type TruckLoadDocument = TruckLoad & Document;

@Schema({ timestamps: true })
export class TruckLoad {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Truck', required: true, index: true }) truck: Types.ObjectId;
  @Prop({ required: true, index: true }) date: Date;
  @Prop({ enum: IceBarSize, default: IceBarSize.ONE }) size: IceBarSize;
  @Prop({ required: true, min: 0.01 }) quantity: number;
  @Prop({ default: '' }) notes: string;
  @Prop({ default: null }) checkedAt: Date | null;
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) checkedBy: Types.ObjectId | null;
  @Prop({ default: null }) driverClosedAt: Date | null;
}

export const TruckLoadSchema = SchemaFactory.createForClass(TruckLoad);
TruckLoadSchema.index({ branch: 1, truck: 1, date: 1 });
