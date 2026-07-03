import { Injectable } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { MakingCostService } from '../making-cost/making-cost.service';
import { WastageService } from '../wastage/wastage.service';
import { ProductionService } from '../production/production.service';

export interface ReportRangeFilters {
  from: string;
  to: string;
  truck?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private salesService: SalesService,
    private costService: MakingCostService,
    private wastageService: WastageService,
    private productionService: ProductionService,
  ) {}

  private range(filters: ReportRangeFilters) {
    const from = new Date(filters.from);
    const to = new Date(filters.to);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  async profitLoss(filters: ReportRangeFilters) {
    const { from, to } = this.range(filters);
    const [sales, cost, wastage, production] = await Promise.all([
      this.salesService.sumInRange(from, to, filters.truck),
      this.costService.totalInRange(from, to),
      this.wastageService.totalInRange(from, to, filters.truck),
      this.productionService.sumBySizeInRange(from, to),
    ]);
    const grossSales = sales.totalAmount;
    const totalExpenses = cost;
    const netProfit = grossSales - totalExpenses;
    return {
      from: filters.from,
      to: filters.to,
      grossSales,
      totalExpenses,
      netProfit,
      totalCollected: sales.totalPaid,
      totalOutstanding: sales.totalBalance,
      totalWastage: wastage,
      totalProduction: Object.values(production).reduce((s, v) => s + v, 0),
    };
  }

  async truckWise(filters: ReportRangeFilters) {
    const { from, to } = this.range(filters);
    return this.salesService.sumByTruckInRange(from, to);
  }

  async customerWise(filters: ReportRangeFilters) {
    const { from, to } = this.range(filters);
    return this.salesService.sumByCustomerInRange(from, to);
  }

  async sizeWise(filters: ReportRangeFilters) {
    const { from, to } = this.range(filters);
    return this.salesService.sumBySizeInRange(from, to, filters.truck);
  }

  async wastageReport(filters: ReportRangeFilters) {
    const { from, to } = this.range(filters);
    return this.wastageService.sumBySizeInRange(from, to, filters.truck);
  }

  async expenseReport(filters: ReportRangeFilters) {
    const { from, to } = this.range(filters);
    return this.costService.totalByTypeInRange(from, to);
  }

  async retailVsWholesale(filters: ReportRangeFilters) {
    const { from, to } = this.range(filters);
    return this.salesService.sumBySaleTypeInRange(from, to);
  }

  async salesList(filters: ReportRangeFilters & { customer?: string; saleType?: string }, user: any) {
    return this.salesService.findAll(
      { from: filters.from, to: filters.to, truck: filters.truck, customer: filters.customer, saleType: filters.saleType },
      user,
    );
  }

  async topCustomers(filters: ReportRangeFilters, limit = 5) {
    const totals = await this.customerWise(filters);
    return Object.entries(totals)
      .map(([customerId, v]) => ({ customerId, ...v }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit);
  }

  async topSizes(filters: ReportRangeFilters, limit = 3) {
    const totals = await this.sizeWise(filters);
    return Object.entries(totals)
      .map(([size, quantity]) => ({ size, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }
}
