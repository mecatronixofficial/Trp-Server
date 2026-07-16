import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { CreateTruckLoadDto } from './dto/truck-load.dto';
import { TruckLoadsService } from './truck-loads.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('truck-loads')
export class TruckLoadsController {
  constructor(private service: TruckLoadsService) {}
  @Roles(Role.TRUCK) @Post() create(@Body() dto: CreateTruckLoadDto, @CurrentUser() user: any) { return this.service.create(dto, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRUCK) @Get() findAll(@CurrentUser() user: any, @Query('truck') truck?: string, @Query('from') from?: string, @Query('to') to?: string) { return this.service.findAll(user, truck, from, to); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRUCK) @Get('reconciliation') reconcile(@CurrentUser() user: any, @Query('date') date: string, @Query('truck') truck?: string) { return this.service.reconciliation(user, date, truck); }
  @Roles(Role.TRUCK) @Post('reconciliation/driver-close') driverClose(@CurrentUser() user: any, @Body() dto: { date: string }) { return this.service.driverClose(user, dto.date); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post('reconciliation/check') check(@CurrentUser() user: any, @Body() dto: { truck: string; date: string }) { return this.service.checkReconciliation(user, dto.truck, dto.date); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: any) { return this.service.remove(id, user); }
}
