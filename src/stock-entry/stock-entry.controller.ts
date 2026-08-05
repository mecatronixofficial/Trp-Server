import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StockEntryService } from './stock-entry.service';
import { CreateStockEntryDto, UpdateStockEntryDto } from './dto/stock-entry.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('stock-entries')
export class StockEntryController {
  constructor(private stockEntryService: StockEntryService) {}

  @Post()
  create(@Body() dto: CreateStockEntryDto, @CurrentUser() user: any) {
    return this.stockEntryService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.stockEntryService.findAll(user, from, to);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStockEntryDto, @CurrentUser() user: any) {
    return this.stockEntryService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.stockEntryService.remove(id, user);
  }
}
