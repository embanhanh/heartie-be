import { DataSource } from 'typeorm';
import {
  AdsAiCampaign,
  AdsAiPostType,
  AdsAiStatus,
} from '../../src/modules/ads_ai/entities/ads-ai-campaign.entity';

export async function seedAdsAiMetrics(dataSource: DataSource) {
  const repository = dataSource.getRepository(AdsAiCampaign);

  const demoAds = [
    {
      name: 'Chiến dịch Giáng sinh An lành',
      productName: 'Bộ sưu tập Áo khoác Mùa đông 2025',
      targetAudience: 'Giới trẻ 18-30, quan tâm thời trang',
      tone: 'Thân thiện, ấm áp',
      objective: 'Tăng trưởng doanh thu dịp Giáng sinh',
      callToAction: 'Mua ngay',
      ctaUrl: 'https://fashia.vn/collections/winter-2025',
      postType: AdsAiPostType.PHOTO,
      image: 'uploads/demo/winter-coat.jpg',
      primaryText:
        'Giáng sinh này, hãy để Fashia sưởi ấm tâm hồn bạn bằng bộ sưu tập áo khoác mới nhất. Thiết kế tinh tế, chất liệu cao cấp.',
      headline: 'Bộ sưu tập Áo khoác Mùa đông - Giảm giá 20%',
      status: AdsAiStatus.PUBLISHED,
      publishedAt: new Date('2025-12-21T09:00:00Z'),
      reach: 15400,
      impressions: 21000,
      engagement: 3200,
      clicks: 850,
      conversions: 42,
      spend: 1200000,
      rating: 5,
      notes: 'Hiệu quả cực tốt, hình ảnh bắt mắt thu hút nhiều lượt tương tác.',
    },
    {
      name: 'Promotion Link Post - Phụ kiện Tết',
      productName: 'Túi xách & Phụ kiện',
      targetAudience: 'Nữ giới, quan tâm phụ kiện cao cấp',
      tone: 'Sang trọng, hiện đại',
      objective: 'Tăng lượt truy cập website',
      callToAction: 'Tìm hiểu thêm',
      ctaUrl: 'https://fashia.vn/accessories',
      postType: AdsAiPostType.LINK,
      primaryText:
        'Đón Tết sang với bộ sưu tập túi xách độc quyền từ Fashia. Miễn phí vận chuyển cho đơn hàng từ 500k.',
      headline: 'Phụ kiện sang trọng - Nâng tầm phong cách',
      status: AdsAiStatus.PUBLISHED,
      publishedAt: new Date('2025-12-22T14:30:00Z'),
      reach: 8200,
      impressions: 11500,
      engagement: 950,
      clicks: 420,
      conversions: 15,
      spend: 600000,
      rating: 4,
      notes: 'Lượt click ổn định nhưng tỷ lệ chuyển đổi cần cải thiện.',
    },
    {
      name: 'Carousel Post - Mix & Match Tết',
      productName: 'Bộ sưu tập Tết Nguyên Đán 2026',
      targetAudience: 'Mọi đối tượng, yêu thích thời trang truyền thống cách tân',
      tone: 'Hào hứng, lễ hội',
      objective: 'Giới thiệu nhiều sản phẩm cùng lúc',
      callToAction: 'Xem thêm',
      ctaUrl: 'https://fashia.vn/tet-2026',
      postType: AdsAiPostType.CAROUSEL,
      images: ['uploads/demo/tet-1.jpg', 'uploads/demo/tet-2.jpg', 'uploads/demo/tet-3.jpg'],
      primaryText:
        ' Tết này mặc gì cho đẹp? Khám phá ngay 10+ set đồ mix & match cực chất từ Fashia.',
      headline: 'BST Tết Nguyên Đán - Đẹp rạng ngời',
      status: AdsAiStatus.PUBLISHED,
      publishedAt: new Date('2025-12-24T08:00:00Z'),
      reach: 25000,
      impressions: 45000,
      engagement: 8500,
      clicks: 1200,
      conversions: 68,
      spend: 2500000,
      rating: 5,
      notes: 'Dạng Carousel rất phù hợp để show nhiều mẫu, khách hàng phản hồi rất tích cực.',
    },
    {
      name: 'Flash Sale Cuối Năm',
      productName: 'Tất cả sản phẩm',
      targetAudience: 'Khách hàng cũ, người săn deal',
      tone: 'Gấp gáp, sôi nổi',
      objective: 'Đẩy mạnh hàng tồn kho',
      callToAction: 'Nhận ưu đãi',
      ctaUrl: 'https://fashia.vn/sale-off',
      postType: AdsAiPostType.PHOTO,
      image: 'uploads/demo/flash-sale.jpg',
      primaryText: 'CHỈ CÒN 48H! Xả kho toàn bộ cửa hàng đón năm mới. Giảm giá lên đến 70%.',
      headline: 'Xả kho Cuối Năm - Sale cực khủng',
      status: AdsAiStatus.PUBLISHED,
      publishedAt: new Date('2025-12-26T18:00:00Z'),
      reach: 12000,
      impressions: 18000,
      engagement: 4500,
      clicks: 1100,
      conversions: 130,
      spend: 1500000,
      rating: 5,
      notes: 'Tỷ lệ chuyển đổi rất cao do yếu tố khan hiếm.',
    },
    {
      name: 'Bài viết tri ân khách hàng',
      productName: 'Fashia Brand',
      targetAudience: 'Khách hàng thân thiết',
      tone: 'Chân thành, biết ơn',
      objective: 'Tăng sự gắn kết thương hiệu',
      callToAction: 'Gửi yêu thương',
      ctaUrl: 'https://fashia.vn/thank-you',
      postType: AdsAiPostType.PHOTO,
      image: 'uploads/demo/thank-you.jpg',
      primaryText: 'Cảm ơn bạn đã luôn đồng hành cùng Fashia trong suốt năm 2025 vừa qua.',
      headline: 'Fashia - Đồng hành cùng phong cách của bạn',
      status: AdsAiStatus.PUBLISHED,
      publishedAt: new Date('2025-12-28T10:00:00Z'),
      reach: 5000,
      impressions: 6500,
      engagement: 2100,
      clicks: 80,
      conversions: 2,
      spend: 300000,
      rating: 4,
      notes: 'Tương tác tốt (like/comment) nhưng ít click, đúng theo mục tiêu brand awareness.',
    },
  ];

  for (const adData of demoAds) {
    const existing = await repository.findOneBy({ name: adData.name });
    if (!existing) {
      await repository.save(repository.create(adData));
    }
  }

  console.log('Seeded Ads AI metrics successfully.');
}
