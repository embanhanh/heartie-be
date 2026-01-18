import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { StockTransferStatus } from './entities/stock-transfer.entity';
import {
  AdjustStockDto,
  AdminDirectTransferDto,
  CreateTransferRequestDto,
  UpdateTransferStatusDto,
} from './dto/inventory.dto';
import { Request } from 'express';
import { User } from '../users/entities/user.entity';

interface RequestWithUser extends Request {
  user: User;
}

@Controller('inventory')
@UseGuards(AuthGuard('jwt'), RoleGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.SHOP_OWNER)
  getInventory(@Req() req: RequestWithUser, @Query('branchId') branchId?: number) {
    console.log('getInventory req.user:', JSON.stringify(req.user, null, 2));
    return this.inventoryService.getInventory(req.user, branchId);
  }

  @Post('adjust')
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.SHOP_OWNER)
  adjustStock(@Req() req: RequestWithUser, @Body() body: AdjustStockDto) {
    return this.inventoryService.adjustStock(req.user, body);
  }

  @Post('transfer/request')
  @Roles(UserRole.BRANCH_MANAGER)
  createTransferRequest(@Req() req: RequestWithUser, @Body() body: CreateTransferRequestDto) {
    return this.inventoryService.createTransferRequest(req.user, body);
  }

  @Post('transfer/admin-direct')
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER)
  adminDirectTransfer(@Req() req: RequestWithUser, @Body() body: AdminDirectTransferDto) {
    return this.inventoryService.adminDirectTransfer(req.user, body);
  }

  @Get('transfers')
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.SHOP_OWNER)
  getTransfers(@Req() req: RequestWithUser, @Query('status') status?: StockTransferStatus) {
    return this.inventoryService.getTransfers(req.user, status);
  }

  @Patch('transfers/:id/status')
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.SHOP_OWNER)
  updateTransferStatus(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: UpdateTransferStatusDto,
  ) {
    return this.inventoryService.updateTransferStatus(req.user, Number(id), body.status);
  }
}
