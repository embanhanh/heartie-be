import {
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PaginationOptionsDto } from 'src/common/dto/pagination.dto';
import { UserRole } from '../entities/user.entity';

function transformBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

export class FilterUserDto extends PaginationOptionsDto {
  @ApiPropertyOptional({
    description: 'Email của user (hỗ trợ tìm kiếm tương đối)',
    example: 'user@example.com',
    type: String,
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm cho tên, email hoặc số điện thoại',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo role',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(transformBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Số điện thoại (hỗ trợ tìm kiếm tương đối)',
    example: '0901234567',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo chi nhánh',
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo ngày tạo (từ)',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdFrom?: Date;

  @ApiPropertyOptional({
    description: 'Lọc theo ngày tạo (đến)',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdTo?: Date;
}
