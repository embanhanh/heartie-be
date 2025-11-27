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
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AdsAiService } from './ads_ai.service';
import { GenerateAdsAiDto } from './dto/generate-ads-ai.dto';
import { CreateAdsAiDto } from './dto/create-ads-ai.dto';
import { UpdateAdsAiDto } from './dto/update-ads-ai.dto';
import { AdsAiQueryDto } from './dto/ads-ai-query.dto';
import { ScheduleAdsAiDto } from './dto/schedule-ads-ai.dto';
import { PublishAdsAiDto } from './dto/publish-ads-ai.dto';
import { UploadedFile as UploadedFileType } from 'src/common/types/uploaded-file.type';
import { createModuleMulterOptions } from 'src/common/utils/upload.util';

const adsImageUploadOptions = createModuleMulterOptions({
  moduleName: 'ads-ai',
  allowedMimeTypes: ['image/*'],
});

@ApiTags('ads-ai')
@Controller('ads-ai')
export class AdsAiController {
  constructor(private readonly service: AdsAiService) {}

  @Post('generate')
  generate(@Body() dto: GenerateAdsAiDto) {
    return this.service.generateCreative(dto);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        productName: { type: 'string', nullable: true },
        productId: { type: 'number', nullable: true },
        targetAudience: { type: 'string', nullable: true },
        tone: { type: 'string', nullable: true },
        objective: { type: 'string', nullable: true },
        callToAction: { type: 'string', nullable: true },
        ctaUrl: { type: 'string', nullable: true },
        primaryText: { type: 'string', nullable: true },
        headline: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        scheduledAt: { type: 'string', format: 'date-time', nullable: true },
        prompt: { type: 'string', nullable: true },
        image: { type: 'string', format: 'binary', nullable: true },
        postType: { type: 'string', enum: ['link', 'photo'], nullable: true },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', adsImageUploadOptions))
  create(@UploadedFile() file: UploadedFileType | undefined, @Body() dto: CreateAdsAiDto) {
    return this.service.createFromForm(dto, file);
  }

  @Get()
  findAll(@Query() query: AdsAiQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', nullable: true },
        productName: { type: 'string', nullable: true },
        productId: { type: 'number', nullable: true },
        targetAudience: { type: 'string', nullable: true },
        tone: { type: 'string', nullable: true },
        objective: { type: 'string', nullable: true },
        callToAction: { type: 'string', nullable: true },
        ctaUrl: { type: 'string', nullable: true },
        primaryText: { type: 'string', nullable: true },
        headline: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        scheduledAt: { type: 'string', format: 'date-time', nullable: true },
        prompt: { type: 'string', nullable: true },
        image: { type: 'string', format: 'binary', nullable: true },
        postType: { type: 'string', enum: ['link', 'photo'], nullable: true },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', adsImageUploadOptions))
  update(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileType | undefined,
    @Body() dto: UpdateAdsAiDto,
  ) {
    return this.service.updateFromForm(Number(id), dto, file);
  }

  @Post(':id/schedule')
  schedule(@Param('id') id: string, @Body() dto: ScheduleAdsAiDto) {
    return this.service.schedule(Number(id), dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @Body() dto: PublishAdsAiDto) {
    return this.service.publishNow(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
