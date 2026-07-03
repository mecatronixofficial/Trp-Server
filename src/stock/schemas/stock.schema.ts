import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IceBarSize } from '../../common/enums';

export type StockSnapshotDocument = StockSnapshot & Document;

@Schema({ _id: false })
export class SizeStock {
  @Prop({ enum: IceBarSize, required: true })
  size: IceBarSize;

  @Prop({ required: true, default: 0 })
  quantity: number;
}
export const SizeStockSchema = SchemaFactory.createForClass(SizeStock);

// One document per calendar date, storing the closing stock snapshot.
@Schema({ timestamps: true })
export class StockSnapshot {
  @Prop({ required: true, unique: true })
  date: Date;

  @Prop({ type: [SizeStockSchema], default: [] })
  sizeWise: SizeStock[];

  @Prop({ required: true, default: 0 })
  totalClosingStock: number;
}

export const StockSnapshotSchema = SchemaFactory.createForClass(StockSnapshot);
