import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { BranchesService } from './branches.service';
import { CreateBranchAdminDto, CreateBranchDto, ResetBranchAdminPasswordDto, UpdateBranchDto } from './dto/branch.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('branches')
export class BranchesController {
  constructor(private branchesService: BranchesService) {}
  @Post() create(@Body() dto: CreateBranchDto) { return this.branchesService.create(dto); }
  @Get() findAll() { return this.branchesService.findAll(); }
  @Get('admins/all') findAdmins() { return this.branchesService.findAdmins(); }
  @Post(':id/admins') createAdmin(@Param('id') id: string, @Body() dto: CreateBranchAdminDto) { return this.branchesService.createAdmin(id, dto); }
  @Patch('admins/:adminId/status') setAdminStatus(@Param('adminId') adminId: string, @Body() dto: { isActive: boolean }) { return this.branchesService.setAdminStatus(adminId, dto.isActive); }
  @Patch('admins/:adminId/reset-password') resetSpecificPassword(@Param('adminId') adminId: string, @Body() dto: ResetBranchAdminPasswordDto) { return this.branchesService.resetSpecificAdminPassword(adminId, dto.newPassword); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateBranchDto) { return this.branchesService.update(id, dto); }
  @Patch(':id/admin/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetBranchAdminPasswordDto) {
    return this.branchesService.resetAdminPassword(id, dto.newPassword);
  }
}
