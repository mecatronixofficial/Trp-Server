import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WastageService } from './wastage.service';
import { CreateWastageDto, UpdateWastageDto } from './dto/wastage.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wastage')
export class WastageController {
  constructor(private wastageService: WastageService) {}

  @Post()
  create(@Body() dto: CreateWastageDto, @CurrentUser() user: any) {
    return this.wastageService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('truck') truck?: string,
    @Query('size') size?: string,
  ) {
    return this.wastageService.findAll({ from, to, truck, size }, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWastageDto, @CurrentUser() user: any) {
    return this.wastageService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.wastageService.remove(id, user);
  }
}
