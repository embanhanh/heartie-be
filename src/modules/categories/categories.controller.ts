import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UploadedFile as StoredFile } from 'src/common/types/uploaded-file.type';
import { createModuleMulterOptions } from 'src/common/utils/upload.util';

const categoryImageMulterOptions = createModuleMulterOptions({
  moduleName: 'categories',
  allowedMimeTypes: ['image/*'],
});

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Create a category. To upload an image, attach it as a file under the `image` field. To create without an image, omit this field or send a URL string.',
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          example: 'Thời trang nam',
        },
        parentId: {
          type: 'integer',
          nullable: true,
          example: 1,
        },
        image: {
          type: 'string',
          format: 'binary',
          nullable: true,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', categoryImageMulterOptions))
  create(@Body() dto: CreateCategoryDto, @UploadedFile() file?: StoredFile) {
    return this.service.create(dto, file);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('roots')
  @ApiOperation({ summary: 'Get categories that have no parent (top-level categories)' })
  findRootCategories() {
    return this.service.findRootCategories();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Update a category. Send a new image file under `image` to replace the current one. To remove the image, send the string `null` in the `image` field without a file.',
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Thời trang nam cao cấp',
        },
        parentId: {
          type: 'integer',
          nullable: true,
          example: 2,
        },
        image: {
          type: 'string',
          format: 'binary',
          nullable: true,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', categoryImageMulterOptions))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() file?: StoredFile,
  ) {
    return this.service.update(id, dto, file);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
