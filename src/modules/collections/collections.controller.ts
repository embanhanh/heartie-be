import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionsQueryDto } from './dto/collections-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CollectionListResponseDto, CollectionResponseDto } from './dto/collection-response.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createModuleMulterOptions } from '../../common/utils/upload.util';
import { UploadedFile as UploadedFileType } from '../../common/types/uploaded-file.type';

const collectionImageUploadOptions = createModuleMulterOptions({
  moduleName: 'collections',
  allowedMimeTypes: ['image/*'],
});

@ApiTags('Collections')
@Controller('collections')
@ApiBearerAuth()
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', collectionImageUploadOptions))
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Tạo bộ sưu tập mới' })
  @ApiOkResponse({ type: CollectionResponseDto })
  async create(
    @Body() dto: CreateCollectionDto,
    @UploadedFile() image?: UploadedFileType,
  ): Promise<CollectionResponseDto> {
    const created = await this.collectionsService.create(dto, image);
    return CollectionResponseDto.from(created);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách bộ sưu tập (có phân trang)' })
  @ApiOkResponse({ type: CollectionListResponseDto })
  async findAll(@Query() query: CollectionsQueryDto): Promise<CollectionListResponseDto> {
    const result = await this.collectionsService.findAll(query);
    return {
      data: result.data.map((item) => CollectionResponseDto.from(item)),
      meta: result.meta,
    };
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Chi tiết bộ sưu tập theo slug' })
  @ApiOkResponse({ type: CollectionResponseDto })
  async findBySlug(@Param('slug') slug: string): Promise<CollectionResponseDto> {
    const entity = await this.collectionsService.findBySlug(slug);
    return CollectionResponseDto.from(entity);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bộ sưu tập' })
  @ApiOkResponse({ type: CollectionResponseDto })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CollectionResponseDto> {
    const entity = await this.collectionsService.findOne(id);
    return CollectionResponseDto.from(entity);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', collectionImageUploadOptions))
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Cập nhật bộ sưu tập' })
  @ApiOkResponse({ type: CollectionResponseDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectionDto,
    @UploadedFile() image?: UploadedFileType,
  ): Promise<CollectionResponseDto> {
    const updated = await this.collectionsService.update(id, dto, image);
    return CollectionResponseDto.from(updated);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @Roles(UserRole.ADMIN, UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Xóa bộ sưu tập' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.collectionsService.remove(id);
  }
}
