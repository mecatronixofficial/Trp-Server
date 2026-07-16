export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  TRUCK = 'truck',
}

export enum IceBarSize {
  QUARTER = '1/4',
  HALF = '1/2',
  THREE_QUARTER = '3/4',
  ONE = '1',
  TWO = '2',
  THREE = '3',
}

export const ICE_BAR_SIZES: IceBarSize[] = [
  IceBarSize.QUARTER,
  IceBarSize.HALF,
  IceBarSize.THREE_QUARTER,
  IceBarSize.ONE,
  IceBarSize.TWO,
  IceBarSize.THREE,
];

export enum SaleType {
  RETAIL = 'retail',
  WHOLESALE = 'wholesale',
}

export enum PaymentMode {
  CASH = 'cash',
  UPI = 'upi',
  BANK = 'bank',
  CREDIT = 'credit',
}

export enum CostType {
  ELECTRICITY = 'electricity',
  WATER = 'water',
  LABOUR = 'labour',
  DIESEL = 'diesel',
  MACHINE_MAINTENANCE = 'machine_maintenance',
  SALT_CHEMICAL = 'salt_chemical',
  PACKING = 'packing',
  TRUCK_EXPENSE = 'truck_expense',
  OTHER = 'other',
}

export enum Shift {
  MORNING = 'morning',
  EVENING = 'evening',
  NIGHT = 'night',
  FULL_DAY = 'full_day',
}

export enum WastageReason {
  BROKEN = 'broken',
  MELTED = 'melted',
  DAMAGED = 'damaged',
  UNSOLD = 'unsold',
  OTHER = 'other',
}
