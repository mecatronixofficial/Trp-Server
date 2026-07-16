import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { TrucksService } from './trucks.service';
import { CreateTruckDto, ResetTruckPasswordDto, UpdateTruckDto } from './dto/truck.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('trucks')
export class TrucksController {
  constructor(private trucksService: TrucksService) {}

  @Post()
  create(@Body() dto: CreateTruckDto, @CurrentUser() user: any) {
    return this.trucksService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.trucksService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trucksService.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTruckDto, @CurrentUser() user: any) {
    return this.trucksService.update(id, dto, user);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trucksService.setStatus(id, true, user);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trucksService.setStatus(id, false, user);
  }

  @Patch(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetTruckPasswordDto, @CurrentUser() user: any) {
    return this.trucksService.resetPassword(id, dto.newPassword, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.trucksService.remove(id, user);
  }
}
