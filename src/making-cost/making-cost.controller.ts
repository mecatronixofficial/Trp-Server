import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { MakingCostService } from './making-cost.service';
import { CreateMakingCostDto, UpdateMakingCostDto } from './dto/making-cost.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('making-cost')
export class MakingCostController {
  constructor(private costService: MakingCostService) {}

  @Post()
  create(@Body() dto: CreateMakingCostDto) {
    return this.costService.create(dto);
  }

  @Get()
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.costService.findAll(from, to);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMakingCostDto) {
    return this.costService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.costService.remove(id);
  }
}
