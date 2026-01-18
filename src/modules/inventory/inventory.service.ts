import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductVariantInventory } from './entities/product-variant-inventory.entity';
import { InventoryLog, InventoryLogType } from './entities/inventory-log.entity';
import { StockTransfer, StockTransferStatus } from './entities/stock-transfer.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Branch } from '../branches/entities/branch.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(ProductVariantInventory)
    private inventoryRepo: Repository<ProductVariantInventory>,
    @InjectRepository(InventoryLog)
    private logRepo: Repository<InventoryLog>,
    @InjectRepository(StockTransfer)
    private transferRepo: Repository<StockTransfer>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getInventory(user: User, branchId?: number) {
    const relations = [
      'variant',
      'variant.product',
      'variant.attributeValues',
      'variant.attributeValues.attribute',
      'variant.attributeValues.attributeValue',
      'branch',
    ];

    if (user.role === UserRole.BRANCH_MANAGER) {
      if (!user.branchId) {
        throw new ForbiddenException('You do not belong to any branch');
      }
      if (branchId && Number(branchId) !== user.branchId) {
        throw new ForbiddenException('You can only view your own branch inventory');
      }
      return this.inventoryRepo.find({
        where: { branchId: user.branchId },
        relations,
      });
    }

    // Admin can view all or specific branch
    if (branchId) {
      return this.inventoryRepo.find({
        where: { branchId },
        relations,
      });
    }

    return this.inventoryRepo.find({
      relations,
    });
  }

  async adjustStock(
    user: User,
    data: { variantId: number; branchId: number; newStock: number; reason: string },
  ) {
    const { variantId, branchId, newStock, reason } = data;

    if (user.role === UserRole.BRANCH_MANAGER && Number(branchId) !== user.branchId) {
      throw new ForbiddenException('You can only adjust stock for your own branch');
    }

    let inventory = await this.inventoryRepo.findOne({
      where: { variantId, branchId },
    });

    if (!inventory) {
      // Create if not exists (usually for initial stock)
      inventory = this.inventoryRepo.create({
        variantId,
        branchId,
        stock: 0,
        status: 'active',
      });
    }

    const previousStock = inventory.stock;
    const changeAmount = newStock - previousStock;

    inventory.stock = newStock;
    await this.inventoryRepo.save(inventory);

    // Log the adjustment
    await this.logRepo.save({
      branchId,
      productVariantId: variantId,
      changeAmount,
      previousStock,
      newStock,
      type: InventoryLogType.ADJUSTMENT,
      reason,
      performedById: user.id,
    });

    return inventory;
  }

  async createTransferRequest(
    user: User,
    data: {
      toBranchId: number;
      productVariantId: number;
      quantity: number;
      note?: string;
    },
  ) {
    if (
      user.role !== UserRole.BRANCH_MANAGER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SHOP_OWNER
    ) {
      throw new ForbiddenException(
        'Only Admin, Shop Owner and Branch Managers can create transfers',
      );
    }

    const fromBranchId = user.branchId;

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException("Admin should use 'directTransfer' method");
    }

    if (!fromBranchId) {
      throw new BadRequestException('User must belong to a branch to create a transfer');
    }

    const [fromBranch, toBranch] = await Promise.all([
      this.branchRepo.findOne({ where: { id: fromBranchId } }),
      this.branchRepo.findOne({ where: { id: data.toBranchId } }),
    ]);

    if (!fromBranch || !toBranch) {
      throw new NotFoundException('Branch not found');
    }

    // Check stock availability
    const inventory = await this.inventoryRepo.findOne({
      where: { variantId: data.productVariantId, branchId: fromBranchId },
    });

    if (!inventory || inventory.stock < data.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const transfer = await this.transferRepo.save(
      this.transferRepo.create({
        fromBranchId,
        toBranchId: data.toBranchId,
        productVariantId: data.productVariantId,
        quantity: data.quantity,
        status: StockTransferStatus.PENDING,
        note: data.note,
        requesterId: user.id,
      }),
    );

    // Notify receiving branch manager
    await this.notifyBranchManager(
      data.toBranchId,
      'Yêu cầu chuyển kho mới',
      `Bạn có một yêu cầu chuyển kho mới từ ${fromBranch.name}`,
      { type: 'TRANSFER_REQUEST', transferId: transfer.id },
    );

    return transfer;
  }

  async adminDirectTransfer(
    user: User,
    data: {
      fromBranchId: number;
      toBranchId: number;
      productVariantId: number;
      quantity: number;
      note?: string;
    },
  ) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SHOP_OWNER)
      throw new ForbiddenException();

    const [fromBranch, toBranch] = await Promise.all([
      this.branchRepo.findOne({ where: { id: data.fromBranchId } }),
      this.branchRepo.findOne({ where: { id: data.toBranchId } }),
    ]);

    if (!fromBranch || !toBranch) {
      throw new NotFoundException('Branch not found');
    }

    // Check stock
    const sourceInventory = await this.inventoryRepo.findOne({
      where: { variantId: data.productVariantId, branchId: data.fromBranchId },
    });

    if (!sourceInventory || sourceInventory.stock < data.quantity) {
      throw new BadRequestException('Insufficient source stock');
    }

    // Decrement source
    sourceInventory.stock -= data.quantity;
    await this.inventoryRepo.save(sourceInventory);

    // Log Source
    await this.logRepo.save({
      branchId: data.fromBranchId,
      productVariantId: data.productVariantId,
      changeAmount: -data.quantity,
      previousStock: sourceInventory.stock + data.quantity,
      newStock: sourceInventory.stock,
      type: InventoryLogType.TRANSFER_OUT,
      reason: `Điều chuyển Admin đến ${toBranch.name}`,
      performedById: user.id,
    });

    // Increment Dest
    let destInventory = await this.inventoryRepo.findOne({
      where: { variantId: data.productVariantId, branchId: data.toBranchId },
    });
    if (!destInventory) {
      destInventory = this.inventoryRepo.create({
        variantId: data.productVariantId,
        branchId: data.toBranchId,
        stock: 0,
        status: 'active',
      });
    }

    const prevDestStock = destInventory.stock;
    destInventory.stock += data.quantity;
    await this.inventoryRepo.save(destInventory);

    // Log Dest
    await this.logRepo.save({
      branchId: data.toBranchId,
      productVariantId: data.productVariantId,
      changeAmount: data.quantity,
      previousStock: prevDestStock,
      newStock: destInventory.stock,
      type: InventoryLogType.TRANSFER_IN,
      reason: `Điều chuyển Admin từ ${fromBranch.name}`,
      performedById: user.id,
    });

    return { message: 'Transfer successful' };
  }

  async getTransfers(user: User, status?: StockTransferStatus) {
    const query = this.transferRepo
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.fromBranch', 'fromBranch')
      .leftJoinAndSelect('transfer.toBranch', 'toBranch')
      .leftJoinAndSelect('transfer.productVariant', 'variant')
      .leftJoinAndSelect('variant.product', 'product')
      .leftJoinAndSelect('transfer.requester', 'requester');

    if (user.role === UserRole.BRANCH_MANAGER) {
      query.andWhere('(transfer.fromBranchId = :branchId OR transfer.toBranchId = :branchId)', {
        branchId: user.branchId,
      });
    }

    if (status) {
      query.andWhere('transfer.status = :status', { status });
    }

    return query.orderBy('transfer.createdAt', 'DESC').getMany();
  }

  async updateTransferStatus(user: User, id: number, status: StockTransferStatus) {
    const transfer = await this.transferRepo.findOne({
      where: { id },
      relations: ['fromBranch', 'toBranch'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');

    // Authorization logic
    if (user.role === UserRole.BRANCH_MANAGER) {
      // If receiving, can mark as COMPLETED (Accepted) or REJECTED
      if (transfer.toBranchId === user.branchId) {
        if (![StockTransferStatus.COMPLETED, StockTransferStatus.REJECTED].includes(status)) {
          throw new BadRequestException('Invalid status update for receiver');
        }
      }
      // If sending, can perhaps CANCEL if still PENDING?
      else if (transfer.fromBranchId === user.branchId) {
        if (
          status !== StockTransferStatus.CANCELLED ||
          transfer.status !== StockTransferStatus.PENDING
        ) {
          throw new BadRequestException('Sender can only cancel pending transfers');
        }
      } else {
        throw new ForbiddenException('Not involved in this transfer');
      }
    }

    // Execute Stock movement if COMPLETED
    if (
      status === StockTransferStatus.COMPLETED &&
      transfer.status !== StockTransferStatus.COMPLETED
    ) {
      // 1. Deduct from Source
      const sourceInventory = await this.inventoryRepo.findOne({
        where: { variantId: transfer.productVariantId, branchId: transfer.fromBranchId },
      });
      if (!sourceInventory || sourceInventory.stock < transfer.quantity) {
        throw new BadRequestException('Source branch has insufficient stock now');
      }
      sourceInventory.stock -= transfer.quantity;
      await this.inventoryRepo.save(sourceInventory);

      await this.logRepo.save({
        branchId: transfer.fromBranchId,
        productVariantId: transfer.productVariantId,
        changeAmount: -transfer.quantity,
        previousStock: sourceInventory.stock + transfer.quantity,
        newStock: sourceInventory.stock,
        type: InventoryLogType.TRANSFER_OUT,
        reason: `Chuyển kho #${transfer.id} đến ${transfer.toBranch.name}`,
        performedById: user.id || transfer.requesterId, // Approver or Requester? Usually user is approver here
      });

      // 2. Add to Dest
      let destInventory = await this.inventoryRepo.findOne({
        where: { variantId: transfer.productVariantId, branchId: transfer.toBranchId },
      });
      if (!destInventory) {
        destInventory = this.inventoryRepo.create({
          variantId: transfer.productVariantId,
          branchId: transfer.toBranchId,
          stock: 0,
          status: 'active',
        });
      }
      const prevDestStock = destInventory.stock;
      destInventory.stock += transfer.quantity;
      await this.inventoryRepo.save(destInventory);

      await this.logRepo.save({
        branchId: transfer.toBranchId,
        productVariantId: transfer.productVariantId,
        changeAmount: transfer.quantity,
        previousStock: prevDestStock,
        newStock: destInventory.stock,
        type: InventoryLogType.TRANSFER_IN,
        reason: `Chuyển kho #${transfer.id} từ ${transfer.fromBranch.name}`,
        performedById: user.id,
      });

      // User accepted it, notify the SENDER
      await this.notifyBranchManager(
        transfer.fromBranchId,
        'Yêu cầu chuyển kho được chấp nhận',
        `Yêu cầu chuyển kho của bạn đến ${transfer.toBranch.name} đã được chấp nhận.`,
        { type: 'TRANSFER_ACCEPTED', transferId: transfer.id },
      );
    }

    transfer.status = status;
    transfer.approverId = user.id;
    return this.transferRepo.save(transfer);
  }

  private async notifyBranchManager(
    branchId: number,
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    const managers = await this.userRepo.find({
      where: { branchId, role: UserRole.BRANCH_MANAGER },
    });

    for (const manager of managers) {
      await this.notificationsService.createNotification(manager.id, title, body, data);
    }
  }
}
