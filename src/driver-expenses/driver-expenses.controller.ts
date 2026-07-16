import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DriverExpensesService } from './driver-expenses.service';
class DriverExpenseDto { @IsOptional() @IsMongoId() truck?: string; @IsDateString() date: string; @IsNumber() @Min(0.01) amount: number; @IsString() purpose: string; @IsOptional() @IsString() notes?: string; }
@UseGuards(JwtAuthGuard)
@Controller('driver-expenses')
export class DriverExpensesController {
  constructor(private service: DriverExpensesService) {}
  @Post() create(@Body() dto: DriverExpenseDto, @CurrentUser() user: any) { return this.service.create(dto, user); }
  @Get() findAll(@CurrentUser() user: any, @Query('truck') truck?: string, @Query('from') from?: string, @Query('to') to?: string) { return this.service.findAll(user, truck, from, to); }
}
