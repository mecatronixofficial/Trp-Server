import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { PriceListService } from './price-list.service';
import { UpsertPriceDto } from './dto/price-list.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('price-list')
export class PriceListController {
  constructor(private priceListService: PriceListService) {}

  // Truck users need to read prices when creating a sale
  @Get('customer/:customerId')
  findByCustomer(@Param('customerId') customerId: string) {
    return this.priceListService.findByCustomer(customerId);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  upsert(@Body() dto: UpsertPriceDto) {
    return this.priceListService.upsert(dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.priceListService.remove(id);
  }
}
