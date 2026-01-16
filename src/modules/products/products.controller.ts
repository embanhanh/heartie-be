import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile as UploadedFileDecorator,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductSuggestQueryDto } from './dto/product-suggest-query.dto';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  AttributePayloadDto,
  AttributeValuePayloadDto,
  ProductFormPayloadDto,
  VariantAttributePayloadDto,
  VariantPayloadDto,
} from './dto/product-form.dto';
import { BoundingBoxDto } from './dto/image-search.dto';
import { UploadedFile } from 'src/common/types/uploaded-file.type';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { ProductStatus } from './entities/product.entity';

@ApiExtraModels(
  ProductFormPayloadDto,
  AttributePayloadDto,
  AttributeValuePayloadDto,
  VariantPayloadDto,
  VariantAttributePayloadDto,
)
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Create product from form payload. Primitive fields can be entered directly. Arrays (`attributes`, `variants`) should be provided as JSON strings or repeated string values. Files: attach product image under `productImage` and variant images using the field name pattern `variants[0].image`, `variants[1].image`, etc.',
    schema: {
      type: 'object',
      required: ['branchId', 'name', 'attributes', 'variants'],
      properties: {
        branchId: { type: 'integer' },
        name: { type: 'string' },
        brandId: { type: 'integer', nullable: true },
        categoryId: { type: 'integer', nullable: true },
        description: { type: 'string', nullable: true },
        originalPrice: { type: 'number', format: 'float', nullable: true },
        status: { type: 'string', enum: Object.values(ProductStatus), nullable: true },
        attributes: {
          oneOf: [
            { type: 'string', description: 'JSON string: array of AttributePayloadDto' },
            {
              type: 'array',
              items: { $ref: getSchemaPath(AttributePayloadDto) },
              description:
                'Repeat fields such as attributes[0], attributes[1], ... when supported by the client.',
            },
          ],
          example:
            '[{"name":"Màu sắc","type":"common","values":[{"value":"Đỏ"},{"value":"Xanh"}]}]',
        },
        variants: {
          oneOf: [
            { type: 'string', description: 'JSON string: array of VariantPayloadDto' },
            {
              type: 'array',
              items: { $ref: getSchemaPath(VariantPayloadDto) },
              description:
                'Repeat fields such as variants[0], variants[1], ... when supported by the client.',
            },
          ],
          example:
            '[{"price":199000,"stock":15,"status":"active","attributes":[{"attributeName":"Màu sắc","attributeValue":"Đỏ"}]}]',
        },
        productImage: { type: 'string', format: 'binary', nullable: true },
        'variants[0].image': {
          type: 'string',
          format: 'binary',
          nullable: true,
          description: 'Use the variant index, e.g. variants[0].image, variants[1].image, ...',
        },
      },
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: UploadedFile[] | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const dto = await this.parseAndValidateForm(body, false);
    return this.service.createFromForm(dto, files ?? []);
  }

  @Get()
  findAll(@Query() options: ProductQueryDto) {
    return this.service.findAll(options);
  }

  @Get('suggestions')
  async suggest(@Query() query: ProductSuggestQueryDto) {
    const data = await this.service.suggestKeywords(query.keyword, query.limit);
    return { data };
  }

  @Post('search-by-image')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async searchByImage(
    @UploadedFileDecorator() file: Express.Multer.File,
    @Query() options: ProductQueryDto,
  ) {
    return this.service.searchByImage(file, options);
  }

  @Post('detect-objects')
  @ApiOperation({ summary: 'Phát hiện các vật thể trong ảnh để người dùng chọn' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async detectObjects(@UploadedFileDecorator() file: Express.Multer.File) {
    return await this.service.detectObjects(file);
  }

  @Post('search-by-objects')
  @ApiOperation({ summary: 'Tìm kiếm sản phẩm dựa trên các vật thể được chọn' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
        boxes: {
          type: 'string',
          description: 'JSON string of selected BoundingBoxDto[]',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  async searchByObjects(
    @UploadedFileDecorator() file: Express.Multer.File,
    @Body('boxes') boxesRaw: string,
    @Query() options: ProductQueryDto,
  ) {
    const boxes = this.ensureArrayOfObjects('boxes', boxesRaw) as unknown as BoundingBoxDto[];
    return await this.service.searchBySelectedObjects(file, boxes, options);
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.service.findOne(+id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Update product using the product form payload. Use the same structure as the create endpoint. Files: attach product image under `productImage` and variant images using the field name pattern `variants[0].image`, `variants[1].image`, etc.',
    schema: {
      type: 'object',
      required: ['branchId', 'name', 'attributes', 'variants'],
      properties: {
        branchId: { type: 'integer' },
        name: { type: 'string' },
        brandId: { type: 'integer', nullable: true },
        categoryId: { type: 'integer', nullable: true },
        description: { type: 'string', nullable: true },
        originalPrice: { type: 'number', format: 'float', nullable: true },
        status: { type: 'string', enum: Object.values(ProductStatus), nullable: true },
        attributes: {
          oneOf: [
            { type: 'string', description: 'JSON string: array of AttributePayloadDto' },
            {
              type: 'array',
              items: { $ref: getSchemaPath(AttributePayloadDto) },
              description:
                'Repeat fields such as attributes[0], attributes[1], ... when supported by the client.',
            },
          ],
          example:
            '[{"name":"Màu sắc","type":"common","values":[{"value":"Đỏ"},{"value":"Xanh"}]}]',
        },
        variants: {
          oneOf: [
            { type: 'string', description: 'JSON string: array of VariantPayloadDto' },
            {
              type: 'array',
              items: { $ref: getSchemaPath(VariantPayloadDto) },
              description:
                'Repeat fields such as variants[0], variants[1], ... when supported by the client.',
            },
          ],
          example:
            '[{"price":199000,"stock":15,"status":"active","attributes":[{"attributeName":"Màu sắc","attributeValue":"Đỏ"}]}]',
        },
        productImage: { type: 'string', format: 'binary', nullable: true },
        'variants[0].image': {
          type: 'string',
          format: 'binary',
          nullable: true,
          description: 'Use the variant index, e.g. variants[0].image, variants[1].image, ...',
        },
      },
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: UploadedFile[] | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const dto = await this.parseAndValidateForm(body, true);
    return this.service.updateFromForm(Number(id), dto, files ?? []);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }

  private normalizeFormPayload(
    body: Record<string, unknown>,
    isUpdate = false,
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...body };

    const attributes = this.ensureArrayOfObjects('attributes', body['attributes'], isUpdate);
    if (attributes !== undefined) {
      normalized.attributes = attributes;
    }

    const variants = this.ensureArrayOfObjects('variants', body['variants'], isUpdate);
    if (variants !== undefined) {
      normalized.variants = variants;
    }

    // Remove "payload" field if present, as it's sent redundantly by frontend and triggers whitelist validation error
    if ('payload' in normalized) {
      delete normalized.payload;
    }

    return normalized;
  }

  private ensureArrayOfObjects(
    fieldName: string,
    rawValue: unknown,
    isOptional = false,
  ): Record<string, unknown>[] | undefined {
    if (rawValue === undefined || rawValue === null) {
      if (isOptional) {
        return undefined;
      }
      throw new BadRequestException(`${fieldName} is required`);
    }

    const toArray = (value: unknown): unknown[] => {
      if (Array.isArray(value)) {
        return value.flatMap((item) => toArray(item));
      }

      if (typeof value === 'string') {
        return toArray(this.parseJsonValue(fieldName, value));
      }

      return [value];
    };

    const arrayValue = toArray(rawValue);

    if (!arrayValue.length) {
      throw new BadRequestException(`${fieldName} must contain at least one item`);
    }

    if (!arrayValue.every((item) => typeof item === 'object' && item !== null)) {
      throw new BadRequestException(`${fieldName} must be an array of objects`);
    }

    return arrayValue as Record<string, unknown>[];
  }

  private parseJsonValue(fieldName: string, raw: string): unknown {
    const trimmed = raw.trim();

    if (!trimmed) {
      throw new BadRequestException(`${fieldName} must not be empty`);
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      throw new BadRequestException(`${fieldName} must be valid JSON`);
    }
  }

  private async parseAndValidateForm(
    body: Record<string, unknown>,
    isUpdate = false,
  ): Promise<ProductFormPayloadDto> {
    const normalizedPayload = this.normalizeFormPayload(body, isUpdate);
    const dto = plainToInstance(ProductFormPayloadDto, normalizedPayload);

    try {
      await validateOrReject(dto, { whitelist: true, forbidNonWhitelisted: true });
    } catch (err) {
      console.error('Validation failed:', JSON.stringify(err, null, 2));
      throw new BadRequestException(err);
    }

    return dto;
  }
}
