import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdsAiService } from './ads_ai.service';
import { VideoAiService } from './video-ai.service';
import { GenerateAdsAiDto } from './dto/generate-ads-ai.dto';
import { CreateAdsAiDto } from './dto/create-ads-ai.dto';
import { UpdateAdsAiDto } from './dto/update-ads-ai.dto';
import { AdsAiQueryDto } from './dto/ads-ai-query.dto';
import { ScheduleAdsAiDto } from './dto/schedule-ads-ai.dto';
import { PublishAdsAiDto } from './dto/publish-ads-ai.dto';
import { TestVideoAdDto } from './dto/test-video-ad.dto';
import { TestVeoDto } from './dto/test-veo.dto';
import { UploadedFile as UploadedFileType } from 'src/common/types/uploaded-file.type';
import { createModuleMulterOptions } from 'src/common/utils/upload.util';

const adsUploadOptions = createModuleMulterOptions({
  moduleName: 'ads-ai',
  allowedMimeTypes: ['image/*', 'video/*'],
});

@ApiTags('ads-ai')
@Controller('ads-ai')
export class AdsAiController {
  private readonly logger = new Logger(AdsAiController.name);

  constructor(
    private readonly service: AdsAiService,
    private readonly videoAiService: VideoAiService,
  ) {}

  @Post('generate')
  generate(@Body() dto: GenerateAdsAiDto) {
    this.logger.debug(`[generate] DTO: ${JSON.stringify(dto)}`);
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
        // ... (truncated common properties for brevity if possible, or keep all)
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
        images: { type: 'array', items: { type: 'string', format: 'binary' }, nullable: true },
        video: { type: 'string', format: 'binary', nullable: true },
        postType: { type: 'string', enum: ['link', 'photo', 'carousel', 'video'], nullable: true },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
        rating: { type: 'number', nullable: true },
        notes: { type: 'string', nullable: true },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 },
      ],
      adsUploadOptions,
    ),
  )
  create(
    @UploadedFiles()
    files: { image?: UploadedFileType[]; images?: UploadedFileType[]; video?: UploadedFileType[] },
    @Body() dto: CreateAdsAiDto,
  ) {
    this.logger.debug(`[create] DTO: ${JSON.stringify(dto)}`);
    const mainFile = files?.image?.[0];
    const extraFiles = files?.images;
    const videoFile = files?.video?.[0];
    return this.service.createFromForm(dto, mainFile, extraFiles, videoFile);
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
        images: { type: 'array', items: { type: 'string', format: 'binary' }, nullable: true },
        video: { type: 'string', format: 'binary', nullable: true },
        postType: { type: 'string', enum: ['link', 'photo', 'carousel', 'video'], nullable: true },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
          nullable: true,
        },
        rating: { type: 'number', nullable: true },
        notes: { type: 'string', nullable: true },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'images', maxCount: 10 },
        { name: 'video', maxCount: 1 },
      ],
      adsUploadOptions,
    ),
  )
  update(
    @Param('id') id: string,
    @UploadedFiles()
    files: { image?: UploadedFileType[]; images?: UploadedFileType[]; video?: UploadedFileType[] },
    @Body() dto: UpdateAdsAiDto,
  ) {
    this.logger.debug(`[update] ID: ${id}, DTO: ${JSON.stringify(dto)}`);
    const mainFile = files?.image?.[0];
    const extraFiles = files?.images;
    const videoFile = files?.video?.[0];
    return this.service.updateFromForm(Number(id), dto, mainFile, extraFiles, videoFile);
  }

  @Post(':id/schedule')
  schedule(@Param('id') id: string, @Body() dto: ScheduleAdsAiDto) {
    this.logger.debug(`[schedule] ID: ${id}, DTO: ${JSON.stringify(dto)}`);
    return this.service.schedule(Number(id), dto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @Body() dto: PublishAdsAiDto) {
    this.logger.debug(`[publish] ID: ${id}, DTO: ${JSON.stringify(dto)}`);
    return this.service.publishNow(Number(id), dto);
  }

  @Post(':id/sync-metrics')
  syncMetrics(@Param('id') id: string) {
    return this.service.syncMetrics(Number(id));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }

  @Post('test-video')
  @ApiOperation({ summary: 'Test endpoint sinh video quảng cáo (Dev Only)' })
  @ApiResponse({ status: 201, description: 'Trả về URL video' })
  testVideo(@Body() body: TestVideoAdDto) {
    return this.videoAiService.generateVideoAd(body);
  }

  @Post('test-veo')
  @ApiOperation({ summary: 'Test endpoint sinh video Veo (Dev Only)' })
  testVeo(@Body() body: TestVeoDto) {
    return this.videoAiService.generateVideoWithVeo(body.prompt);
  }
}
