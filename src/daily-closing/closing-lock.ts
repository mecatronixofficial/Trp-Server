import { BadRequestException } from '@nestjs/common';
import { Model } from 'mongoose';
import { DailyClosingDocument } from './schemas/daily-closing.schema';
export async function assertDayOpen(model: Model<DailyClosingDocument>, branch: string, date: string | Date) {
  const day = new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (await model.exists({ branch, date: day, status: 'closed' })) throw new BadRequestException(`Daily ice-bar account for ${day} is closed. Sales, collections, pickups, returns, wastage, and production are locked.`);
}
