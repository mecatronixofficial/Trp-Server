import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import {
  CreateWorkerAttendanceDto,
  CreateWorkerBuyingDto,
  CreateWorkerDto,
  UpdateWorkerAttendanceDto,
  UpdateWorkerBuyingDto,
  UpdateWorkerDto,
} from './dto/worker.dto';
import { WorkersService } from './workers.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('workers')
export class WorkersController {
  constructor(private workersService: WorkersService) {}

  @Post()
  createWorker(@Body() dto: CreateWorkerDto, @CurrentUser() user: any) {
    return this.workersService.createWorker(dto, user);
  }

  @Get()
  findWorkers(@CurrentUser() user: any, @Query('includeInactive') includeInactive?: string, @Query('branch') branch?: string) {
    return this.workersService.findWorkers(includeInactive, user, branch);
  }

  @Get('summary')
  monthlySummary(@CurrentUser() user: any, @Query('month') month?: string, @Query('branch') branch?: string) {
    return this.workersService.monthlySummary(month, user, branch);
  }

  @Patch(':id')
  updateWorker(@Param('id') id: string, @Body() dto: UpdateWorkerDto, @CurrentUser() user: any) {
    return this.workersService.updateWorker(id, dto, user);
  }

  @Delete(':id')
  removeWorker(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workersService.removeWorker(id, user);
  }

  @Post('attendance')
  createAttendance(@Body() dto: CreateWorkerAttendanceDto, @CurrentUser() user: any) {
    return this.workersService.createAttendance(dto, user);
  }

  @Post('buying')
  createBuying(@Body() dto: CreateWorkerBuyingDto, @CurrentUser() user: any) {
    return this.workersService.createBuying(dto, user);
  }

  @Get('attendance')
  findAttendance(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string, @Query('worker') worker?: string, @Query('branch') branch?: string) {
    return this.workersService.findAttendance(from, to, worker, user, branch);
  }

  @Get('buying')
  findBuying(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string, @Query('worker') worker?: string, @Query('branch') branch?: string) {
    return this.workersService.findAttendance(from, to, worker, user, branch);
  }

  @Patch('attendance/:id')
  updateAttendance(@Param('id') id: string, @Body() dto: UpdateWorkerAttendanceDto, @CurrentUser() user: any) {
    return this.workersService.updateAttendance(id, dto, user);
  }

  @Patch('buying/:id')
  updateBuying(@Param('id') id: string, @Body() dto: UpdateWorkerBuyingDto, @CurrentUser() user: any) {
    return this.workersService.updateBuying(id, dto, user);
  }

  @Delete('attendance/:id')
  removeAttendance(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workersService.removeAttendance(id, user);
  }

  @Delete('buying/:id')
  removeBuying(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workersService.removeAttendance(id, user);
  }
}
