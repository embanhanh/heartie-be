import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Banner, BannerStatus } from './entities/banner.entity';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BaseService } from 'src/common/services/base.service';
import { BannerQueryDto } from './dto/banner-query.dto';
import { UploadedFile } from 'src/common/types/uploaded-file.type';
import { SortParam } from 'src/common/dto/pagination.dto';
import { resolveModuleUploadPath } from 'src/common/utils/upload.util';

@Injectable()
export class BannersService extends BaseService<Banner> {
  private static readonly MODULE_NAME = 'banners';

  constructor(
    @InjectRepository(Banner)
    private repo: Repository<Banner>,
  ) {
    super(repo, 'banner');
  }

  async createFromForm(dto: CreateBannerDto, file?: UploadedFile) {
    const imagePath = resolveModuleUploadPath(
      BannersService.MODULE_NAME,
      file,
      this.sanitizeExistingImage(dto.image),
    );

    if (!imagePath) {
      throw new BadRequestException('Banner image is required');
    }

    const entity = this.repo.create({
      title: dto.title,
      image: imagePath,
      description: dto.description ?? null,
      btnTitle: dto.btnTitle ?? null,
      link: dto.link ?? null,
      clicks: 0,
      startDate: this.normalizeDate(dto.startDate),
      endDate: this.normalizeDate(dto.endDate),
      status: dto.status ?? BannerStatus.ACTIVE,
      displayOrder: dto.displayOrder ?? 0,
    });

    return this.repo.save(entity);
  }

  async updateFromForm(id: number, dto: UpdateBannerDto, file?: UploadedFile) {
    const banner = await this.repo.findOne({ where: { id } });

    if (!banner) {
      throw new NotFoundException(`Banner not found: ${id}`);
    }

    const fallbackImage =
      dto.image !== undefined ? (this.sanitizeExistingImage(dto.image) ?? null) : banner.image;

    const imagePath = resolveModuleUploadPath(BannersService.MODULE_NAME, file, fallbackImage);

    banner.title = dto.title ?? banner.title;
    banner.description = dto.description ?? banner.description;
    banner.btnTitle = dto.btnTitle ?? banner.btnTitle;
    banner.link = dto.link ?? banner.link;
    banner.startDate = dto.startDate ? this.normalizeDate(dto.startDate) : banner.startDate;
    banner.endDate = dto.endDate ? this.normalizeDate(dto.endDate) : banner.endDate;
    banner.status = dto.status ?? banner.status;
    banner.displayOrder = dto.displayOrder ?? banner.displayOrder;
    banner.image = imagePath ?? banner.image;

    return this.repo.save(banner);
  }

  async findAll(options: BannerQueryDto) {
    const { status, title, startDateFrom, startDateTo, endDateFrom, endDateTo } = options;

    const result = await this.paginate(options, (qb) => {
      if (status) {
        qb.andWhere('banner.status = :status', { status });
      }

      if (title) {
        qb.andWhere('LOWER(banner.title) LIKE :title', {
          title: `%${title.toLowerCase()}%`,
        });
      }

      this.applyDateFilter(qb, 'startDate', startDateFrom, startDateTo);
      this.applyDateFilter(qb, 'endDate', endDateFrom, endDateTo);
    });

    return result;
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  async findVisible(): Promise<Banner[]> {
    const now = new Date();

    return this.repo
      .createQueryBuilder('banner')
      .where('banner.status = :status', { status: BannerStatus.ACTIVE })
      .andWhere('(banner.startDate IS NULL OR banner.startDate <= :now)', { now })
      .andWhere('(banner.endDate IS NULL OR banner.endDate >= :now)', { now })
      .orderBy('banner.displayOrder', 'ASC')
      .addOrderBy('banner.startDate', 'DESC')
      .getMany();
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  protected override getDefaultSorts(): SortParam[] {
    return [
      { field: 'displayOrder', direction: 'asc' },
      { field: 'startDate', direction: 'desc' },
    ];
  }

  private normalizeDate(value: string | Date): Date {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date value');
    }

    return date;
  }

  private sanitizeExistingImage(value?: string | null): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    return trimmed.replace(/^upload\//, 'uploads/');
  }
}
