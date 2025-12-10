import slugify from 'slugify';
import { DataSource } from 'typeorm';
import {
  Collection,
  CollectionStatus,
} from '../../src/modules/collections/entities/collection.entity';

const collectionSeeds: Array<{
  name: string;
  description?: string;
  image?: string;
  status?: CollectionStatus;
}> = [
  {
    name: 'Sắc Màu Đô Thị',
    description: 'Gam màu đậm nét, phom dáng linh hoạt cho nhịp sống hiện đại.',
    image:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Dáng Việt Tinh Tế',
    description: 'Khai thác chất liệu truyền thống trên nền thiết kế tối giản.',
    image:
      'https://images.unsplash.com/photo-1490480175275-85a10a9cb26c?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Hơi Thở Thủ Đô',
    description: 'Tinh thần Hà Nội thanh lịch dành cho những buổi gặp gỡ.',
    image:
      'https://images.unsplash.com/photo-1490480788368-90f5b9e02aa7?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Nắng Phố Cổ',
    description: 'Chất liệu lụa nhẹ, bảng màu ấm áp cho những ngày dạo phố.',
    image:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Sương Mai Hồ Tây',
    description: 'Tông pastel dịu mắt, phù hợp trang phục resort hoặc cuối tuần.',
    image:
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Biển Xanh Cát Trắng',
    description: 'Hơi thở mùa hè với chất liệu thoáng mát và chi tiết hải sắc.',
    image:
      'https://images.unsplash.com/photo-1475180098004-ca77a66827be?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Mộc Nhiên',
    description: 'Phong cách eco-chic kết hợp cotton hữu cơ và palette trung tính.',
    image:
      'https://images.unsplash.com/photo-1521572275903-6fdc9c1d5c8b?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Đảo Ngọc',
    description: 'Sự hòa quyện giữa satin bóng và phom dáng neo-chic.',
    image:
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Bình Minh Bến Cảng',
    description: 'Lấy cảm hứng từ sắc cam quýt và đường cắt utilitarian.',
    image:
      'https://images.unsplash.com/photo-1520962944511-6c703d0770cc?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'Đêm Phố Thị',
    description: 'Thiết kế tiệc tối với nhũ ánh kim và chi tiết bất đối xứng.',
    image:
      'https://images.unsplash.com/photo-1521335629791-ce4aec67dd47?auto=format&fit=crop&w=900&q=80',
  },
];

function normalizeSlug(source: string): string {
  const base = slugify(source, { lower: true, strict: true });
  return base || source.trim().toLowerCase().replace(/\s+/g, '-');
}

export async function seedCollections(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Collection);

  for (const seed of collectionSeeds) {
    const slug = normalizeSlug(seed.name);
    const payload = {
      name: seed.name,
      slug,
      description: seed.description ?? null,
      image: seed.image ?? null,
      status: seed.status ?? CollectionStatus.ACTIVE,
    } satisfies Partial<Collection>;

    const existing = await repo.findOne({ where: { slug } });
    if (existing) {
      await repo.save(repo.merge(existing, payload));
      continue;
    }

    const entity = repo.create(payload);
    await repo.save(entity);
  }

  console.log(`✅ Collection seed data inserted successfully (${collectionSeeds.length} items).`);
}
