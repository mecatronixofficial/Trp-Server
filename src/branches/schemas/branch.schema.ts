import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BranchDocument = Branch & Document;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, unique: true, uppercase: true, trim: true }) code: string;
  @Prop({ default: '', trim: true }) address: string;
  @Prop({ default: '', trim: true }) phoneNumber: string;
  @Prop({ default: true }) isActive: boolean;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
