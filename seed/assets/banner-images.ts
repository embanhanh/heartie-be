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
