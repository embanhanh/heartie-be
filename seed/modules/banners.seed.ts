import { DataSource } from 'typeorm';
import { Banner, BannerStatus } from '../../src/modules/banners/entities/banner.entity';
import { ensureBannerSeedImages, bannerSeedImageMap } from '../assets/banner-images';

interface BannerSeed {
  title: string;
  image: string;
  description?: string | null;
  btnTitle?: string | null;
  link?: string | null;
  clicks?: number;
  startDate: string;
  endDate: string;
  displayOrder?: number;
  status?: BannerStatus;
}

const bannerSeeds: BannerSeed[] = [
  {
    title: 'Heartie Summer Flash Sale',
    image: `uploads/banners/${bannerSeedImageMap.summerFlashSale}`,
    description: 'Giảm giá lên tới 50% cho bộ sưu tập mùa hè. Nhanh tay số lượng có hạn!',
    btnTitle: 'Mua ngay',
    link: 'shop',
    startDate: '2025-09-01',
    endDate: '2025-12-31',
    displayOrder: 1,
    status: BannerStatus.ACTIVE,
  },
  {
    title: 'Bộ sưu tập Thu Đông 2025',
    image: `uploads/banners/${bannerSeedImageMap.fallWinterCollection}`,
    description: 'Khám phá xu hướng thời trang Thu Đông mới nhất dành cho nam và nữ.',
    btnTitle: 'Khám phá',
    link: 'shop',
    startDate: '2025-09-01',
    endDate: '2025-12-31',
    displayOrder: 2,
    status: BannerStatus.ACTIVE,
  },
  {
    title: 'Ưu đãi thành viên thân thiết',
    image: `uploads/banners/${bannerSeedImageMap.memberExclusive}`,
    description: 'Tặng voucher 200K cho khách hàng thân thiết khi mua sắm trên 1.000.000đ.',
    btnTitle: 'Nhận voucher',
    link: 'shop',
    startDate: '2025-03-15',
    endDate: '2025-04-30',
    displayOrder: 3,
    status: BannerStatus.INACTIVE,
  },
  {
    title: 'Miễn phí vận chuyển toàn quốc',
    image: `uploads/banners/${bannerSeedImageMap.freeShipping}`,
    description: 'Áp dụng cho mọi đơn hàng từ 299K trong tháng 7.',
    btnTitle: 'Xem chi tiết',
    link: 'shop',
    startDate: '2025-07-01',
    endDate: '2025-07-31',
    displayOrder: 4,
    status: BannerStatus.EXPIRED,
  },
];

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export async function seedBanners(dataSource: DataSource) {
  await ensureBannerSeedImages();
  const repo = dataSource.getRepository(Banner);

  for (const seed of bannerSeeds) {
    const existing = await repo.findOne({ where: { title: seed.title } });

    if (existing) {
      continue;
    }

    const banner = repo.create({
      title: seed.title,
      image: seed.image,
      description: seed.description ?? null,
      btnTitle: seed.btnTitle ?? null,
      link: seed.link ?? null,
      clicks: seed.clicks ?? 0,
      startDate: toDateOnly(seed.startDate),
      endDate: toDateOnly(seed.endDate),
      status: seed.status ?? BannerStatus.ACTIVE,
      displayOrder: seed.displayOrder ?? 0,
    });

    await repo.save(banner);
  }

  console.log('✅ Banner seed data inserted successfully.');
}
