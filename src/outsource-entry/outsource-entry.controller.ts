import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OutsourceEntryService } from './outsource-entry.service';
import { CreateOutsourceEntryDto, UpdateOutsourceEntryDto } from './dto/outsource-entry.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('outsource-entries')
export class OutsourceEntryController {
  constructor(private outsourceEntryService: OutsourceEntryService) {}

  @Post()
  create(@Body() dto: CreateOutsourceEntryDto, @CurrentUser() user: any) {
    return this.outsourceEntryService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.outsourceEntryService.findAll(user, from, to);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOutsourceEntryDto, @CurrentUser() user: any) {
    return this.outsourceEntryService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.outsourceEntryService.remove(id, user);
  }
}
