import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { MakingCostService } from './making-cost.service';
import { CreateMakingCostDto, UpdateMakingCostDto } from './dto/making-cost.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('making-cost')
export class MakingCostController {
  constructor(private costService: MakingCostService) {}

  @Post()
  create(@Body() dto: CreateMakingCostDto, @CurrentUser() user: any) {
    return this.costService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.costService.findAll(from, to, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMakingCostDto, @CurrentUser() user: any) {
    return this.costService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.costService.remove(id, user);
  }
}
