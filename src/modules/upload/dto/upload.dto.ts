import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadRequestDto {
  @ApiPropertyOptional({
    description: 'Tên thư mục con bên trong uploads để lưu file. Nếu bỏ trống sẽ dùng uploads/',
    example: 'products/banners',
  })
  @IsOptional()
  @IsString()
  folder?: string;
}

export class UploadFileResponseDto {
  @ApiProperty({ description: 'Tên file mới sau khi lưu' })
  filename!: string;

  @ApiProperty({ description: 'Tên file gốc do người dùng tải lên' })
  originalName!: string;

  @ApiProperty({ description: 'Kích thước file (bytes)' })
  size!: number;

  @ApiProperty({ description: 'MIME type' })
  mimeType!: string;

  @ApiProperty({
    description: 'Đường dẫn tương đối tính từ project root, ví dụ uploads/abc/file.png',
  })
  path!: string;

  @ApiProperty({ description: 'Đường dẫn có thể dùng để expose qua static host (tùy cấu hình)' })
  url!: string;

  @ApiProperty({ description: 'Thư mục con đã lưu file (bên trong uploads)' })
  folder!: string;
}

export class UploadManyResponseDto {
  @ApiProperty({ type: [UploadFileResponseDto] })
  files!: UploadFileResponseDto[];
}
