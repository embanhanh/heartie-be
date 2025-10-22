import { constants } from 'fs';
import { access, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

type BannerImageAsset = {
  key: 'summerFlashSale' | 'fallWinterCollection' | 'memberExclusive' | 'freeShipping';
  fileName: string;
  content: string;
};

const bannerImageAssets: BannerImageAsset[] = [
  {
    key: 'summerFlashSale',
    fileName: 'summer-flash-sale.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs>
    <linearGradient id="summerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff9a8b" />
      <stop offset="50%" stop-color="#ff6a88" />
      <stop offset="100%" stop-color="#ff99ac" />
    </linearGradient>
  </defs>
  <rect fill="url(#summerGradient)" width="1200" height="600" rx="32" />
  <text x="600" y="220" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="64" fill="#ffffff" font-weight="700">Heartie Summer</text>
  <text x="600" y="320" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="92" fill="#ffffff" font-weight="800">FLASH SALE</text>
  <text x="600" y="420" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="36" fill="#ffffff">Giảm giá tới 50% cho bộ sưu tập 2025</text>
</svg>
`,
  },
  {
    key: 'fallWinterCollection',
    fileName: 'fall-winter-collection.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs>
    <linearGradient id="fallWinterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1b2735" />
      <stop offset="50%" stop-color="#3a6073" />
      <stop offset="100%" stop-color="#16222a" />
    </linearGradient>
  </defs>
  <rect fill="url(#fallWinterGradient)" width="1200" height="600" rx="32" />
  <text x="600" y="220" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="64" fill="#f8f9fa" font-weight="700">Bộ sưu tập</text>
  <text x="600" y="320" text-anchor="middle" font-family="'Playfair Display', 'Times New Roman', serif" font-size="88" fill="#ffffff" font-weight="700">Thu Đông 2025</text>
  <text x="600" y="420" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="34" fill="#e9ecef">Sang trọng - Ấm áp - Thời thượng</text>
</svg>
`,
  },
  {
    key: 'memberExclusive',
    fileName: 'member-exclusive.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs>
    <linearGradient id="memberGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#42275a" />
      <stop offset="100%" stop-color="#734b6d" />
    </linearGradient>
  </defs>
  <rect fill="url(#memberGradient)" width="1200" height="600" rx="32" />
  <text x="600" y="210" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="58" fill="#f8f9fa" font-weight="600">Ưu đãi thành viên</text>
  <text x="600" y="320" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="90" fill="#ffe066" font-weight="800">Thân thiết</text>
  <text x="600" y="410" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="34" fill="#f1f3f5">Nhận voucher 200K cho đơn từ 1.000.000đ</text>
</svg>
`,
  },
  {
    key: 'freeShipping',
    fileName: 'free-shipping.svg',
    content: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <defs>
    <linearGradient id="shippingGradient" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#134e5e" />
      <stop offset="100%" stop-color="#71b280" />
    </linearGradient>
  </defs>
  <rect fill="url(#shippingGradient)" width="1200" height="600" rx="32" />
  <text x="600" y="220" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="62" fill="#ffffff" font-weight="700">Miễn phí vận chuyển</text>
  <text x="600" y="320" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="100" fill="#ffffff" font-weight="800">TOÀN QUỐC</text>
  <text x="600" y="420" text-anchor="middle" font-family="'Montserrat', 'Arial', sans-serif" font-size="34" fill="#e9f5ec">Cho mọi đơn hàng từ 299K trong tháng 7</text>
</svg>
`,
  },
];

export async function ensureBannerSeedImages(): Promise<void> {
  const bannerDir = join(process.cwd(), 'uploads', 'banners');
  await mkdir(bannerDir, { recursive: true });

  for (const asset of bannerImageAssets) {
    const targetPath = join(bannerDir, asset.fileName);

    try {
      await access(targetPath, constants.F_OK);
      continue;
    } catch {
      // File does not exist, proceed to write.
    }

    await writeFile(targetPath, asset.content, 'utf8');
  }
}

export const bannerSeedImageMap = bannerImageAssets.reduce(
  (acc, asset) => {
    acc[asset.key] = asset.fileName;
    return acc;
  },
  {} as Record<BannerImageAsset['key'], string>,
);
