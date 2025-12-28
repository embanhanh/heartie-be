import { AppDataSource } from './data-source';
import { Order } from '../src/modules/orders/entities/order.entity';
import { User } from '../src/modules/users/entities/user.entity';
// Product import removed as unused
import { ProductVariant } from '../src/modules/product_variants/entities/product_variant.entity';
import { DailyStatistic } from '../src/modules/stats/entities/daily-statistic.entity';

async function verify() {
  await AppDataSource.initialize();

  // 1. Check Date Range of Orders
  const orderRepo = AppDataSource.getRepository(Order);
  const firstOrders = await orderRepo.find({ order: { createdAt: 'ASC' }, take: 1 });
  const lastOrders = await orderRepo.find({ order: { createdAt: 'DESC' }, take: 1 });
  const totalOrders = await orderRepo.count();

  console.log('--- Order Verification ---');
  console.log(`Total Orders: ${totalOrders}`);
  console.log(`First Order Date: ${firstOrders[0]?.createdAt?.toISOString()}`);
  console.log(`Last Order Date: ${lastOrders[0]?.createdAt?.toISOString()}`);

  // 2. Check Users
  const userRepo = AppDataSource.getRepository(User);
  const totalUsers = await userRepo.count();
  console.log('--- User Verification ---');
  console.log(`Total Users: ${totalUsers}`);

  // 3. Check Products & Image Mapping
  const variantRepo = AppDataSource.getRepository(ProductVariant);
  const variants = await variantRepo.find({
    relations: [
      'product',
      'attributeValues',
      'attributeValues.attribute',
      'attributeValues.attributeValue',
    ],
  });

  console.log('--- Product Variant Image Verification (Sample) ---');
  for (const v of variants.slice(0, 5)) {
    const colorAttr = v.attributeValues.find((av) => av.attribute.name === 'Màu sắc');
    console.log(
      `Product: ${v.product.name} | Color: ${colorAttr?.attributeValue?.value} | Image: ${v.image}`,
    );
  }

  // 4. Check Stats
  const statsRepo = AppDataSource.getRepository(DailyStatistic);
  const totalStats = await statsRepo.count();
  const sumRevenue = await statsRepo
    .createQueryBuilder('stats')
    .select('SUM(stats.totalRevenue)', 'sum')
    .select('SUM(stats.totalRevenue)', 'sum')
    .getRawOne<{ sum: string }>();

  console.log('--- Stats Verification ---');
  console.log(`Total Daily Stats Records: ${totalStats}`);
  console.log(`Total Revenue in Stats: ${sumRevenue?.sum}`);

  await AppDataSource.destroy();
}

verify().catch(console.error);
