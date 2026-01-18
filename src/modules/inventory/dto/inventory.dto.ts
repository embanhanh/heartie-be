import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { StockTransferStatus } from '../entities/stock-transfer.entity';

export class AdjustStockDto {
  @IsNumber()
  variantId: number;

  @IsNumber()
  branchId: number;

  @IsNumber()
  @Min(0)
  newStock: number;

  @IsString()
  reason: string;
}

export class CreateTransferRequestDto {
  @IsNumber()
  toBranchId: number;

  @IsNumber()
  productVariantId: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AdminDirectTransferDto {
  @IsNumber()
  fromBranchId: number;

  @IsNumber()
  toBranchId: number;

  @IsNumber()
  productVariantId: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateTransferStatusDto {
  @IsEnum(StockTransferStatus)
  status: StockTransferStatus;
}
