import { Injectable } from '@nestjs/common';
import { ProductionService } from '../production/production.service';
import { MakingCostService } from '../making-cost/making-cost.service';
import { SalesService } from '../sales/sales.service';
import { WastageService } from '../wastage/wastage.service';
import { StockService } from '../stock/stock.service';
import { CustomersService } from '../customers/customers.service';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

@Injectable()
export class DashboardService {
  constructor(
    private productionService: ProductionService,
    private costService: MakingCostService,
    private salesService: SalesService,
    private wastageService: WastageService,
    private stockService: StockService,
    private customersService: CustomersService,
  ) {}

  async getAdminDashboard() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [
      productionBySize,
      salesToday,
      wastageTotal,
      makingCostToday,
      stock,
      truckWiseToday,
      salesMonth,
      salesYear,
      last7DaysSales,
      pendingPayments,
      recentPaymentsToday,
      truckCustomerSummary,
      recentCustomers,
    ] = await Promise.all([
      this.productionService.sumBySizeInRange(todayStart, todayEnd),
      this.salesService.sumInRange(todayStart, todayEnd),
      this.wastageService.totalInRange(todayStart, todayEnd),
      this.costService.totalInRange(todayStart, todayEnd),
      this.stockService.getStockAsOf(now),
      this.salesService.sumByTruckInRange(todayStart, todayEnd),
      this.salesService.sumInRange(startOfMonth(now), todayEnd),
      this.salesService.sumInRange(startOfYear(now), todayEnd),
      this.getLast7DaysSales(),
      this.salesService.getPendingPayments(8),
      this.salesService.getRecentPayments(todayStart, todayEnd, 8),
      this.customersService.getTruckCustomerSummary(),
      this.customersService.getRecentCustomers(8),
    ]);

    const todayProductionTotal = Object.values(productionBySize).reduce((s, v) => s + v, 0);
    const todayProfit = salesToday.totalAmount - makingCostToday;

    return {
      today: {
        production: todayProductionTotal,
        productionBySize,
        sales: salesToday.totalAmount,
        salesCount: salesToday.count,
        wastage: wastageTotal,
        makingCost: makingCostToday,
        profit: todayProfit,
        collection: salesToday.totalPaid,
        balance: salesToday.totalBalance,
      },
      truckWiseSalesToday: truckWiseToday,
      payments: {
        pendingBills: pendingPayments,
        recentToday: recentPaymentsToday,
        pendingAmount: pendingPayments.reduce((sum, sale) => sum + sale.balanceAmount, 0),
        todayCollectedLater: recentPaymentsToday.reduce((sum, payment) => sum + payment.amount, 0),
      },
      customers: {
        truckWise: truckCustomerSummary,
        recent: recentCustomers,
      },
      pendingStock: stock,
      monthlySales: salesMonth.totalAmount,
      yearlySales: salesYear.totalAmount,
      last7DaysSales,
    };
  }

  async getLast7DaysSales() {
    const days: { date: string; total: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const sum = await this.salesService.sumInRange(startOfDay(d), endOfDay(d));
      days.push({ date: d.toISOString().slice(0, 10), total: sum.totalAmount });
    }
    return days;
  }

  async getMonthlyProfitChart(months = 6) {
    const now = new Date();
    const result: { month: string; sales: number; cost: number; profit: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const [sales, cost] = await Promise.all([
        this.salesService.sumInRange(d, monthEnd),
        this.costService.totalInRange(d, monthEnd),
      ]);
      result.push({
        month: d.toISOString().slice(0, 7),
        sales: sales.totalAmount,
        cost,
        profit: sales.totalAmount - cost,
      });
    }
    return result;
  }

  async getTruckDashboard(truckId: string) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [salesToday, wastageToday, customerWise] = await Promise.all([
      this.salesService.sumInRange(todayStart, todayEnd, truckId),
      this.wastageService.totalInRange(todayStart, todayEnd, truckId),
      this.salesService.sumByCustomerInRange(todayStart, todayEnd),
    ]);

    const sizeWiseToday = await this.salesService.sumBySizeInRange(todayStart, todayEnd, truckId);
    const quantityToday = Object.values(sizeWiseToday).reduce((s, v) => s + v, 0);

    return {
      todaySales: salesToday.totalAmount,
      todayQuantitySold: quantityToday,
      todayCollection: salesToday.totalPaid,
      todayBalance: salesToday.totalBalance,
      todayWastage: wastageToday,
      customerWiseSalesToday: customerWise,
    };
  }
}
