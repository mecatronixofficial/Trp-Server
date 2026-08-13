import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { RejectTruckAssignmentDto, UpsertTruckAssignmentDto } from './dto/truck-assignment.dto';
import { TruckAssignmentsService } from './truck-assignments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('truck-assignments')
export class TruckAssignmentsController {
  constructor(private service: TruckAssignmentsService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  upsert(@Body() dto: UpsertTruckAssignmentDto, @CurrentUser() user: any) {
    return this.service.upsert(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('add')
  add(@Body() dto: UpsertTruckAssignmentDto, @CurrentUser() user: any) {
    return this.service.add(dto, user);
  }

  @Roles(Role.TRUCK)
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.accept(id, user);
  }

  @Roles(Role.TRUCK)
  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: RejectTruckAssignmentDto) {
    return this.service.reject(id, dto.reason, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.cancelByAdmin(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.TRUCK)
  @Get()
  find(@CurrentUser() user: any, @Query('date') date: string, @Query('truck') truck?: string) {
    return this.service.findForDate(user, date, truck);
  }
}
