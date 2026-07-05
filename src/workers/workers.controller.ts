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

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('workers')
export class WorkersController {
  constructor(private workersService: WorkersService) {}

  @Post()
  createWorker(@Body() dto: CreateWorkerDto) {
    return this.workersService.createWorker(dto);
  }

  @Get()
  findWorkers(@Query('includeInactive') includeInactive?: string) {
    return this.workersService.findWorkers(includeInactive);
  }

  @Get('summary')
  monthlySummary(@Query('month') month?: string) {
    return this.workersService.monthlySummary(month);
  }

  @Patch(':id')
  updateWorker(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    return this.workersService.updateWorker(id, dto);
  }

  @Delete(':id')
  removeWorker(@Param('id') id: string) {
    return this.workersService.removeWorker(id);
  }

  @Post('attendance')
  createAttendance(@Body() dto: CreateWorkerAttendanceDto) {
    return this.workersService.createAttendance(dto);
  }

  @Post('buying')
  createBuying(@Body() dto: CreateWorkerBuyingDto) {
    return this.workersService.createBuying(dto);
  }

  @Get('attendance')
  findAttendance(@Query('from') from?: string, @Query('to') to?: string, @Query('worker') worker?: string) {
    return this.workersService.findAttendance(from, to, worker);
  }

  @Get('buying')
  findBuying(@Query('from') from?: string, @Query('to') to?: string, @Query('worker') worker?: string) {
    return this.workersService.findAttendance(from, to, worker);
  }

  @Patch('attendance/:id')
  updateAttendance(@Param('id') id: string, @Body() dto: UpdateWorkerAttendanceDto) {
    return this.workersService.updateAttendance(id, dto);
  }

  @Patch('buying/:id')
  updateBuying(@Param('id') id: string, @Body() dto: UpdateWorkerBuyingDto) {
    return this.workersService.updateBuying(id, dto);
  }

  @Delete('attendance/:id')
  removeAttendance(@Param('id') id: string) {
    return this.workersService.removeAttendance(id);
  }

  @Delete('buying/:id')
  removeBuying(@Param('id') id: string) {
    return this.workersService.removeAttendance(id);
  }
}
