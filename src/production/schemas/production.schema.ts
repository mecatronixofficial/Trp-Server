import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IceBarSize, Shift } from '../../common/enums';

export type ProductionDocument = Production & Document;

@Schema({ _id: false })
export class SizeQuantity {
  @Prop({ enum: IceBarSize, required: true })
  size: IceBarSize;

  @Prop({ required: true, default: 0 })
  quantity: number;
}
export const SizeQuantitySchema = SchemaFactory.createForClass(SizeQuantity);

@Schema({ timestamps: true })
export class Production {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true }) branch: Types.ObjectId;
  @Prop({ required: true })
  date: Date;

  @Prop({ enum: Shift, default: Shift.FULL_DAY })
  shift: Shift;

  // box counter reading at the start of the day (continues from previous day's boxClose + 1)
  @Prop({ required: true })
  boxOpen: number;

  // box counter reading at the end of the day
  @Prop({ required: true })
  boxClose: number;

  // boxes made today, accounting for the counter wrapping back to 1 after totalBoxes
  @Prop({ default: 0 })
  boxesProduced: number;

  // snapshot of settings.barsPerBox used to compute totalBars for this record
  @Prop({ default: 0 })
  barsPerBoxUsed: number;

  @Prop({ type: [SizeQuantitySchema], default: [] })
  sizeWise: SizeQuantity[];

  @Prop({ required: true, default: 0 })
  totalBars: number;

  @Prop({ default: '' })
  notes: string;
}

export const ProductionSchema = SchemaFactory.createForClass(Production);
ProductionSchema.index({ date: 1 });
