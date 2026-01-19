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
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiExtraModels, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductSuggestQueryDto } from './dto/product-suggest-query.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  AttributePayloadDto,
  AttributeValuePayloadDto,
  ProductFormPayloadDto,
  VariantAttributePayloadDto,
  VariantPayloadDto,
} from './dto/product-form.dto';
import { UploadedFile } from 'src/common/types/uploaded-file.type';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { ProductStatus } from './entities/product.entity';
import { InteractionsService } from '../interactions/interactions.service';
import { InteractionType } from '../interactions/entities/interaction.entity';
import { Request } from 'express';
import { UseGuards } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';

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
  constructor(
    private readonly service: ProductsService,
    private readonly interactionsService: InteractionsService,
  ) {}
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
    const dto = await this.parseAndValidateForm(body);
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

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Req() req: Request, @Param('id') id: number) {
    const product = await this.service.findOne(+id);
    const user = req.user as { id?: number };

    // Track CLICK interaction if user is logged in
    if (user?.id && product && product.tikiId) {
      console.log(
        `[ProductsController] Logging CLICK for User ${user.id}, TikiId ${product.tikiId}`,
      );
      this.interactionsService
        .logInteraction(user.id, +product.tikiId, InteractionType.CLICK)
        .catch((err) => console.error('Failed to log interaction', err));
    } else {
      if (user?.id) {
        console.warn(
          `[ProductsController] SKIPPING interaction log. User: ${user.id}, Product: ${product?.id}, TikiId: ${product?.tikiId}`,
        );
      }
    }

    return product;
  }

  @Get(':id/similar')
  async getSimilar(@Param('id') id: string) {
    return this.service.getSimilarProducts(+id);
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
    const dto = await this.parseAndValidateForm(body);
    return this.service.updateFromForm(Number(id), dto, files ?? []);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.service.remove(+id);
  }

  private normalizeFormPayload(body: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...body };

    normalized.attributes = this.ensureArrayOfObjects('attributes', body['attributes']);
    normalized.variants = this.ensureArrayOfObjects('variants', body['variants']);

    return normalized;
  }

  private ensureArrayOfObjects(fieldName: string, rawValue: unknown): Record<string, unknown>[] {
    if (rawValue === undefined || rawValue === null) {
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
  ): Promise<ProductFormPayloadDto> {
    const normalizedPayload = this.normalizeFormPayload(body);
    const dto = plainToInstance(ProductFormPayloadDto, normalizedPayload);

    try {
      await validateOrReject(dto, { whitelist: true, forbidNonWhitelisted: true });
    } catch (err) {
      throw new BadRequestException(err);
    }

    return dto;
  }
}
