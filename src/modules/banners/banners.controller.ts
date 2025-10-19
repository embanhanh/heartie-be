import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BannerQueryDto } from './dto/banner-query.dto';
import { UploadedFile as UploadedFileType } from 'src/common/types/uploaded-file.type';
import { BannerStatus } from './entities/banner.entity';
import { createModuleMulterOptions } from 'src/common/utils/upload.util';

const bannerImageUploadOptions = createModuleMulterOptions({
  moduleName: 'banners',
  allowedMimeTypes: ['image/*'],
});

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly service: BannersService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'startDate', 'endDate'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string', nullable: true },
        btnTitle: { type: 'string', nullable: true },
        link: { type: 'string', nullable: true },
        startDate: { type: 'string', format: 'date' },
        endDate: { type: 'string', format: 'date' },
        status: { type: 'string', enum: Object.values(BannerStatus), nullable: true },
        displayOrder: { type: 'integer', nullable: true },
        image: { type: 'string', format: 'binary', description: 'Ảnh banner' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', bannerImageUploadOptions))
  create(@UploadedFile() file: UploadedFileType | undefined, @Body() dto: CreateBannerDto) {
    return this.service.createFromForm(dto, file);
  }

  @Get()
  findAll(@Query() query: BannerQueryDto) {
    return this.service.findAll(query);
  }

  @Get('visible')
  findVisible() {
    return this.service.findVisible();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        btnTitle: { type: 'string', nullable: true },
        link: { type: 'string', nullable: true },
        startDate: { type: 'string', format: 'date', nullable: true },
        endDate: { type: 'string', format: 'date', nullable: true },
        status: { type: 'string', enum: Object.values(BannerStatus), nullable: true },
        displayOrder: { type: 'integer', nullable: true },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh banner mới (nếu thay đổi)',
          nullable: true,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', bannerImageUploadOptions))
  update(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileType | undefined,
    @Body() dto: UpdateBannerDto,
  ) {
    return this.service.updateFromForm(Number(id), dto, file);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }
}
