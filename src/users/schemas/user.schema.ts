import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../common/enums';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: Role })
  role: Role;

  // Only set when role === TRUCK. Links the login to a Truck document.
  @Prop({ type: Types.ObjectId, ref: 'Truck', default: null })
  truck: Types.ObjectId | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: null })
  displayName: string;

  @Prop({ default: null })
  resetOtpHash: string | null;

  @Prop({ default: null })
  resetOtpExpiresAt: Date | null;

  @Prop({ default: null })
  resetOtpMethod: string | null;

  @Prop({ default: null })
  resetOtpDestination: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
