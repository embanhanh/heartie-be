import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Express } from 'express';
import { UploadFileResponseDto, UploadManyResponseDto, UploadRequestDto } from './dto/upload.dto';
import { UploadService } from './upload.service';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload 1 file vào thư mục uploads hoặc thư mục con chỉ định' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        folder: { type: 'string', example: 'products' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: UploadFileResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @Body() dto: UploadRequestDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadFileResponseDto> {
    if (!file) {
      throw new BadRequestException('Thiếu file tải lên');
    }

    return this.uploadService.uploadSingle(file, dto.folder);
  }

  @Post('multiple')
  @ApiOperation({ summary: 'Upload nhiều file cùng lúc' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        folder: { type: 'string', example: 'products/gallery' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiOkResponse({ type: UploadManyResponseDto })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @Body() dto: UploadRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadManyResponseDto> {
    if (!files?.length) {
      throw new BadRequestException('Thiếu danh sách files');
    }

    const stored = await this.uploadService.uploadMany(files, dto.folder);
    return { files: stored };
  }
}
