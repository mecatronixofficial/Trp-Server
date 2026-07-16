import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { ProductionService } from './production.service';
import { CreateProductionDto, UpdateProductionDto } from './dto/production.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('production')
export class ProductionController {
  constructor(private productionService: ProductionService) {}

  @Post()
  create(@Body() dto: CreateProductionDto, @CurrentUser() user: any) {
    return this.productionService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.productionService.findAll(from, to, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productionService.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductionDto, @CurrentUser() user: any) {
    return this.productionService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productionService.remove(id, user);
  }
}
