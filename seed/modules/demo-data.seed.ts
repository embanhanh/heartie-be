import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../src/modules/users/entities/user.entity';
import { Address, AddressType } from '../../src/modules/addresses/entities/address.entity';
import { Product, ProductStatus } from '../../src/modules/products/entities/product.entity';
import {
  ProductVariant,
  ProductVariantStatus,
} from '../../src/modules/product_variants/entities/product_variant.entity';
import { ProductAttribute } from '../../src/modules/product_attributes/entities/product-attribute.entity';
import { VariantAttributeValue } from '../../src/modules/variant_attribute_values/entities/variant-attribute-value.entity';
import {
  Attribute,
  AttributeType as AttrType,
} from '../../src/modules/attributes/entities/attribute.entity';
import { AttributeValue } from '../../src/modules/attribute_values/entities/attribute-value.entity';
import { Category } from '../../src/modules/categories/entities/category.entity';
import { Branch } from '../../src/modules/branches/entities/branch.entity';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  FulfillmentMethod,
} from '../../src/modules/orders/entities/order.entity';
import { OrderItem } from '../../src/modules/order_items/entities/order-item.entity';
import { DailyStatistic } from '../../src/modules/stats/entities/daily-statistic.entity';
import { ProductVariantInventory } from '../../src/modules/inventory/entities/product-variant-inventory.entity';
import { Rating } from '../../src/modules/ratings/entities/rating.entity';

// --- Constants & Config ---

const DEMO_PASSWORD = 'Password@123';
const START_DATE = new Date('2025-01-01T00:00:00+07:00');
const END_DATE = new Date('2025-12-27T23:59:59+07:00');

const HO_VA_LOT = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
  'Bạch',
  'Trương',
  'Gia',
  'Thái',
];
const TEN = [
  'An',
  'Bình',
  'Cường',
  'Dũng',
  'Giang',
  'Hải',
  'Hùng',
  'Huy',
  'Khánh',
  'Lan',
  'Linh',
  'Long',
  'Minh',
  'Nam',
  'Nga',
  'Ngọc',
  'Phúc',
  'Quân',
  'Quang',
  'Sơn',
  'Thảo',
  'Trang',
  'Tú',
  'Tuấn',
  'Tùng',
  'Vân',
  'Việt',
  'Vy',
  'Xuân',
  'Yến',
];

const VN_LOCATIONS = [
  {
    city: 'Hà Nội',
    districts: [
      'Hoàn Kiếm',
      'Ba Đình',
      'Đống Đa',
      'Hai Bà Trưng',
      'Cầu Giấy',
      'Thanh Xuân',
      'Tây Hồ',
      'Long Biên',
    ],
  },
  {
    city: 'Hồ Chí Minh',
    districts: [
      'Quận 1',
      'Quận 3',
      'Quận 4',
      'Quận 5',
      'Quận 7',
      'Quận 10',
      'Bình Thạnh',
      'Phú Nhuận',
      'Tân Bình',
      'Thủ Đức',
    ],
  },
  {
    city: 'Đà Nẵng',
    districts: ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ'],
  },
  { city: 'Cần Thơ', districts: ['Ninh Kiều', 'Bình Thủy', 'Cái Răng'] },
  { city: 'Hải Phòng', districts: ['Hồng Bàng', 'Ngô Quyền', 'Lê Chân'] },
];

const STREET_NAMES = [
  'Lê Lợi',
  'Nguyễn Huệ',
  'Trần Hưng Đạo',
  'Hai Bà Trưng',
  'Lý Tự Trọng',
  'Pasteur',
  'Nam Kỳ Khởi Nghĩa',
  'Võ Văn Kiệt',
  'Phạm Văn Đồng',
  'Nguyễn Văn Linh',
  'Điện Biên Phủ',
  'Cách Mạng Tháng 8',
];

// Product Configs: Category -> Attributes (Color) -> Images
const PRODUCT_BLUEPRINTS = [
  {
    name: 'Áo Thun Basic Premium',
    category: 'Áo thun',
    price: 350000,
    material: 'Cotton Organic',
    description:
      'Áo thun basic chất liệu cotton organic cao cấp, thấm hút mồ hôi tốt, form dáng chuẩn.',
    variants: [
      {
        color: 'Trắng',
        image:
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Đen',
        image:
          'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Xám',
        image:
          'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
  {
    name: 'Áo Sơ Mi Linen Thoáng Mát',
    category: 'Áo sơ mi',
    price: 550000,
    material: 'Linen',
    description: 'Áo sơ mi linen thoáng mát, phù hợp cho mùa hè và những chuyến đi biển.',
    variants: [
      {
        color: 'Trắng',
        image:
          'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Vàng Nhạt',
        image:
          'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=800&q=80',
      }, // Approximation
      {
        color: 'Xanh Nhạt',
        image:
          'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
  {
    name: 'Quần Jeans Slim Fit',
    category: 'Quần jeans',
    price: 650000,
    material: 'Denim',
    description: 'Quần jeans form slim fit tôn dáng, chất liệu denim co giãn nhẹ thoải mái.',
    variants: [
      {
        color: 'Xanh Đậm',
        image:
          'https://images.unsplash.com/photo-1542272617-08f08630329e?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Xanh Nhạt',
        image:
          'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Đen',
        image:
          'https://images.unsplash.com/photo-1582552938357-32b906df40cb?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
  {
    name: 'Giày Sneaker Sporty Dynamic',
    category: 'Giày sneaker',
    price: 1200000,
    material: 'Vải dệt & Cao su',
    description: 'Giày sneaker thiết kế năng động, đế êm ái hỗ trợ vận động tối đa.',
    variants: [
      {
        color: 'Trắng',
        image:
          'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Đỏ',
        image:
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Đen',
        image:
          'https://images.unsplash.com/photo-1537543598583-04e4c3be9954?auto=format&fit=crop&w=800&q=80',
      }, // Changed to verify logic
    ],
  },
  {
    name: 'Đầm Maxi Đi Biển',
    category: 'Đầm maxi',
    price: 790000,
    material: 'Voan',
    description: 'Đầm maxi thướt tha, họa tiết hoa nhí xinh xắn, item không thể thiếu cho mùa hè.',
    variants: [
      {
        color: 'Hồng',
        image:
          'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Xanh Ngọc',
        image:
          'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
  {
    name: 'Áo Khoác Blazer Hàn Quốc',
    category: 'Áo blazer',
    price: 890000,
    material: 'Tech',
    description: 'Áo khoác blazer phong cách Hàn Quốc, trẻ trung và thanh lịch.',
    variants: [
      {
        color: 'Be',
        image:
          'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
      },
      {
        color: 'Đen',
        image:
          'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
      },
    ],
  },
];

const COLORS_HEX: Record<string, string> = {
  Trắng: '#FFFFFF',
  Đen: '#000000',
  Xám: '#808080',
  'Vàng Nhạt': '#FDFD96',
  'Xanh Nhạt': '#ADD8E6',
  'Xanh Đậm': '#00008B',
  Đỏ: '#FF0000',
  Hồng: '#FFC0CB',
  'Xanh Ngọc': '#00FFFF',
  Be: '#F5F5DC',
};

const SIZES = ['S', 'M', 'L', 'XL'];

// --- Helpers ---

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomBoolean = (prob = 0.5) => Math.random() < prob;

const generateVNName = () => {
  return {
    firstName: randomItem(HO_VA_LOT),
    lastName: randomItem(TEN),
  };
};

const generateVNAddress = () => {
  const loc = randomItem(VN_LOCATIONS);
  const district = randomItem(loc.districts);
  const street = randomItem(STREET_NAMES);
  const num = randomInt(1, 999);
  return {
    street: `${num} ${street}`,
    district,
    city: loc.city,
    fullAddress: `${num} ${street}, ${district}, ${loc.city}`,
  };
};

// --- Seed Logic ---

export async function seedDemoData(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);
  const variantRepo = dataSource.getRepository(ProductVariant);
  const orderRepo = dataSource.getRepository(Order);
  const orderItemRepo = dataSource.getRepository(OrderItem);
  const addressRepo = dataSource.getRepository(Address);
  const branchRepo = dataSource.getRepository(Branch);
  const categoryRepo = dataSource.getRepository(Category);
  const brandRepo = dataSource.getRepository('Brand'); // Using string if entity not easily imported, or import it
  const statsRepo = dataSource.getRepository(DailyStatistic);
  const ratingRepo = dataSource.getRepository(Rating);

  console.log('🚀 Starting Demo Data Seeding...');

  // 1. Ensure Branches exist
  const branches = await branchRepo.find();
  if (!branches.length) {
    console.warn('⚠️ No branches found. Please seed branches first.');
    return;
  }
  const mainBranch = branches.find((b) => b.isMainBranch) || branches[0];

  // 2. Create Categories if missing
  const categories = await categoryRepo.find();
  const getCategory = async (name: string) => {
    let cat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!cat) {
      cat = categoryRepo.create({ name, slug: name.toLowerCase().replace(/ /g, '-') });
      await categoryRepo.save(cat);
      categories.push(cat);
    }
    return cat;
  };

  // 3. Create Attributes (Color, Size, Material)
  const attrRepo = dataSource.getRepository(Attribute);
  const attrValueRepo = dataSource.getRepository(AttributeValue);

  const getOrCreateAttribute = async (name: string) => {
    let attr = await attrRepo.findOne({ where: { name } });
    if (!attr) {
      attr = attrRepo.create({ name, type: AttrType.COMMON });
      await attrRepo.save(attr);
    }
    return attr;
  };

  const getOrCreateAttrValue = async (
    attr: Attribute,
    value: string,
    meta: Record<string, unknown> = {},
  ) => {
    let val = await attrValueRepo.findOne({ where: { attributeId: attr.id, value } });
    if (!val) {
      val = attrValueRepo.create({ attributeId: attr.id, value, meta });
      await attrValueRepo.save(val);
    }
    return val;
  };

  const colorAttr = await getOrCreateAttribute('Màu sắc');
  const sizeAttr = await getOrCreateAttribute('Kích thước');
  const materialAttr = await getOrCreateAttribute('Chất liệu');

  // 4. Products & Variants
  const generatedVariants: ProductVariant[] = [];
  const allProducts: Product[] = [];

  for (const blueprint of PRODUCT_BLUEPRINTS) {
    const category = await getCategory(blueprint.category);
    const brands = await brandRepo.find();
    const brand = brands.length > 0 ? randomItem(brands) : null;
    let product = await productRepo.findOne({ where: { name: blueprint.name } });

    if (!product) {
      product = productRepo.create({
        name: blueprint.name,
        description: blueprint.description,
        categoryId: category.id,
        brandId: brand ? (brand as { id: number }).id : undefined,
        originalPrice: blueprint.price,
        status: ProductStatus.ACTIVE,
        rating: 0, // Will update via ratings
        viewCount: 0,
        soldCount: 0,
        stock: 0, // Will update
        image: blueprint.variants[0].image,
      });
      await productRepo.save(product);

      // Save Product Attributes
      await dataSource.getRepository(ProductAttribute).save([
        { productId: product.id, attributeId: colorAttr.id, isRequired: true },
        { productId: product.id, attributeId: sizeAttr.id, isRequired: true },
        { productId: product.id, attributeId: materialAttr.id, isRequired: true },
      ]);
    }
    allProducts.push(product);

    // Variants
    let totalStock = 0;
    for (const variantBP of blueprint.variants) {
      const colorVal = await getOrCreateAttrValue(colorAttr, variantBP.color, {
        hex: COLORS_HEX[variantBP.color],
      });
      const materialVal = await getOrCreateAttrValue(materialAttr, blueprint.material);

      for (const size of SIZES) {
        const sizeVal = await getOrCreateAttrValue(sizeAttr, size);

        // Check if variant exists logic simplified
        // We assume we can create/update logic but for seed just creating helps
        // Ideally checking specific combination via attributeValues:
        // skip complex check for demo speed, assume if product new, variants new

        /* let variant = await variantRepo.findOne({
          where: {
            productId: product.id,
            attributeValues: { attributeValueId: sizeVal.id },
          },
        }); */
        // Note: checking variant by attr values is complex in TypeORM without join
        // Just always create if product new... or verify count.
        // For simplicity in this update, we will leverage existing logic or create if missing

        const existingCount = await variantRepo.count({ where: { productId: product.id } });
        if (existingCount < blueprint.variants.length * SIZES.length) {
          // Discount Logic: 30% chance for a discount
          let price = blueprint.price;
          if (randomBoolean(0.3)) {
            price = Math.round((Number(blueprint.price) * 0.8) / 1000) * 1000; // 20% off
          }

          const variant = variantRepo.create({
            productId: product.id,
            price: price, // Use discounted price if applicable
            status: ProductVariantStatus.ACTIVE,
            image: variantBP.image,
          });
          await variantRepo.save(variant);
          generatedVariants.push(variant);

          // Variant Attribute Values
          await dataSource.getRepository(VariantAttributeValue).save([
            { variantId: variant.id, attributeId: colorAttr.id, attributeValueId: colorVal.id },
            { variantId: variant.id, attributeId: sizeAttr.id, attributeValueId: sizeVal.id },
            {
              variantId: variant.id,
              attributeId: materialAttr.id,
              attributeValueId: materialVal.id,
            },
          ]);

          // Inventory
          const stock = randomInt(50, 200); // Higher stock for high volume orders
          await dataSource.getRepository(ProductVariantInventory).save({
            variantId: variant.id,
            branchId: mainBranch.id,
            stock: stock,
          });
          totalStock += stock;
        } else {
          // Retrieve existing variants for order generation
          const existing = await variantRepo.find({ where: { productId: product.id } });
          generatedVariants.push(...existing);
        }
      }
    }
    // Update stock if changed
    if (product.stock !== totalStock) {
      product.stock = totalStock;
      await productRepo.save(product);
    }
  }

  // Deduplicate variants list if pushed multiple times
  const uniqueVariants = Array.from(new Set(generatedVariants.map((v) => v.id))).map(
    (id) => generatedVariants.find((v) => v.id === id)!,
  );

  console.log(`✅ Seeded ${allProducts.length} products and variants.`);

  // 5. Users (Members) - Increased to 300
  const users: User[] = [];
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const TARGET_USERS = 300;

  console.log(`Generating ${TARGET_USERS} users...`);
  for (let i = 0; i < TARGET_USERS; i++) {
    const { firstName, lastName } = generateVNName();
    const email = `user${i + 1}@demo.com`;
    let user = await userRepo.findOne({ where: { email } });

    if (!user) {
      user = userRepo.create({
        email,
        firstName,
        lastName,
        phoneNumber: `09${randomInt(10000000, 99999999)}`,
        role: UserRole.CUSTOMER,
        password: hashedPassword,
        isActive: true,
      });
      await userRepo.save(user);

      // Address
      const addrData = generateVNAddress();
      const address = addressRepo.create({
        ...addrData,
        fullName: `${firstName} ${lastName}`,
        phoneNumber: user.phoneNumber,
        email: user.email,
        userId: user.id,
        isDefault: true,
        addressType: AddressType.HOME,
      });
      await addressRepo.save(address);
    }
    users.push(user);
  }
  console.log(`✅ Seeded ${users.length} users.`);

  // 6. Orders - High Volume (~4000)
  const currentDate = new Date(START_DATE);
  let totalOrdersGenerated = 0;
  const productSoldCounts = new Map<number, number>();

  console.log('Generating orders history...');

  while (currentDate <= END_DATE) {
    // Approx 10-15 orders per day to reach ~4000 in a year
    const dailyOrdersCount = randomInt(10, 15);
    const dayStats = { revenue: 0, orders: 0, productsSold: 0, customers: new Set<number>() };

    for (let i = 0; i < dailyOrdersCount; i++) {
      const isGuest = randomBoolean(0.3); // 30% guest
      let customer: User | null = null;
      let address: Address;

      if (isGuest) {
        const { firstName, lastName } = generateVNName();
        const addrData = generateVNAddress();
        address = addressRepo.create({
          ...addrData,
          fullName: `${firstName} ${lastName}`,
          phoneNumber: `09${randomInt(10000000, 99999999)}`,
          email: `guest${randomInt(1000, 9999)}@example.com`,
          addressType: AddressType.OTHER,
        });
        await addressRepo.save(address);
      } else {
        // Prefer "VIP" users (first 10% users buy more often)
        if (randomBoolean(0.4)) {
          const vipIdx = randomInt(0, Math.floor(users.length * 0.1));
          customer = users[vipIdx];
        } else {
          customer = randomItem(users);
        }

        const userAddrs = await addressRepo.find({ where: { userId: customer.id } });
        address =
          userAddrs[0] ||
          (await addressRepo.save(
            addressRepo.create({
              ...generateVNAddress(),
              fullName: `${customer.firstName} ${customer.lastName}`,
              phoneNumber: customer.phoneNumber,
              email: customer.email,
              userId: customer.id,
            }),
          ));
      }

      // Order Items
      const itemCount = randomInt(1, 4);
      const itemsData: { variant: ProductVariant; quantity: number; itemTotal: number }[] = [];
      let subTotal = 0;

      for (let k = 0; k < itemCount; k++) {
        const variant = randomItem(uniqueVariants);
        const quantity = randomInt(1, 3);
        const itemTotal = Number(variant.price) * quantity;

        itemsData.push({
          variant,
          quantity,
          itemTotal,
        });
        subTotal += itemTotal;
      }

      const shippingFee = randomItem([30000, 15000, 0]);
      const totalAmount = subTotal + shippingFee;

      // Status determination
      let status = OrderStatus.DELIVERED;
      let paidAt: Date | null = new Date(currentDate);
      let deliveredAt: Date | null = new Date(currentDate);
      deliveredAt.setDate(deliveredAt.getDate() + randomInt(2, 5));
      let cancelledAt: Date | null = null;

      const diffDays = (END_DATE.getTime() - currentDate.getTime()) / (1000 * 3600 * 24);

      if (randomBoolean(0.05)) {
        status = OrderStatus.CANCELLED;
        cancelledAt = new Date(currentDate);
        paidAt = null;
        deliveredAt = null;
      } else if (diffDays < 2) {
        status = OrderStatus.PROCESSING;
        deliveredAt = null;
      } else if (diffDays < 5) {
        status = OrderStatus.SHIPPED;
        deliveredAt = null;
      }

      const orderTime = new Date(currentDate);
      orderTime.setHours(randomInt(8, 22), randomInt(0, 59));

      const order = orderRepo.create({
        orderNumber: `ORD-${orderTime.getTime()}-${randomInt(100, 999)}`,
        userId: customer?.id ?? null,
        branchId: mainBranch.id,
        addressId: address.id,
        status,
        subTotal,
        discountTotal: 0,
        shippingFee,
        taxTotal: 0,
        totalAmount,
        paymentMethod: PaymentMethod.COD,
        fulfillmentMethod: FulfillmentMethod.DELIVERY,
        createdAt: orderTime,
        updatedAt: orderTime,
        paidAt: paidAt ? orderTime : undefined,
        deliveredAt: deliveredAt || undefined,
        cancelledAt: cancelledAt || undefined,
      });

      await orderRepo.save(order);

      // Save Items
      for (const item of itemsData) {
        if (!item.variant) continue;
        await orderItemRepo.save({
          orderId: order.id,
          variantId: item.variant.id,
          quantity: item.quantity,
          subTotal: item.itemTotal,
          totalAmount: item.itemTotal,
          discountTotal: 0,
        });

        // Track stats for update later
        if (status === OrderStatus.DELIVERED) {
          const pid = item.variant.productId; // assuming pre-loaded or available
          // If variant doesn't have productId loaded, we might need a lookup map.
          // But uniqueVariants were just created/fetched, checking relations.
          // Since uniqueVariants came from generatedVariants which has productId set
          // But let's be safe.

          const currentSold = productSoldCounts.get(pid) ?? 0;
          productSoldCounts.set(pid, currentSold + item.quantity);
        }
      }

      if (status === OrderStatus.DELIVERED) {
        dayStats.revenue += totalAmount;
        dayStats.orders += 1;
        itemsData.forEach((item) => (dayStats.productsSold += item.quantity));
        if (customer) dayStats.customers.add(customer.id);
      }
      totalOrdersGenerated++;
    }

    // Daily Stats
    if (dayStats.orders > 0) {
      const dateStr = currentDate.toISOString().split('T')[0];
      let stat = await statsRepo.findOne({ where: { date: dateStr, branchId: mainBranch.id } });
      if (!stat) {
        stat = statsRepo.create({
          date: dateStr,
          branchId: mainBranch.id,
          totalRevenue: 0,
          totalOrders: 0,
          totalCustomers: 0,
          totalProductsSold: 0,
        });
      }
      stat.totalRevenue = Number(stat.totalRevenue) + dayStats.revenue;
      stat.totalOrders += dayStats.orders;
      stat.totalProductsSold += dayStats.productsSold;
      stat.totalCustomers += dayStats.customers.size;
      await statsRepo.save(stat);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log(`✅ Seeded orders history: ${totalOrdersGenerated} orders created.`);

  // 7. Sync Product Counts & Generate Ratings
  console.log('🔄 Syncing Product Stats and Generating Ratings...');

  // We need to fetch all delivered orders with items to generate ratings
  // This could be heavy, so let's use a smarter approach:
  // Iterate products, find who bought them (via OrderItem -> Order -> User)

  // But first, update soldCounts
  for (const [productId, soldCount] of productSoldCounts) {
    // Generate realistic viewCount (soldCount * 10..50)
    const viewCount = soldCount * randomInt(10, 50);
    await productRepo.update(productId, { soldCount, viewCount });
  }

  // Generate Ratings
  // Strategy: For each user, find their delivered orders, rate some items.

  for (const user of users) {
    // Find user's delivered orders
    const orders = await orderRepo.find({
      where: { userId: user.id, status: OrderStatus.DELIVERED },
      relations: { items: { variant: true } },
    });

    if (orders.length === 0) continue;

    // Rate ~30% of items bought
    for (const order of orders) {
      if (randomBoolean(0.3)) {
        // 30% chance to rate an order
        for (const item of order.items) {
          if (!item.variant) continue;
          const productId = item.variant.productId;

          // Check if already rated
          const existingRating = await ratingRepo.findOne({
            where: { userId: user.id, productId },
          });

          if (!existingRating) {
            // Generate rating
            // Bias towards 4-5 stars
            const ratingVal = randomBoolean(0.7) ? randomInt(4, 5) : randomInt(1, 5);
            const comments = [
              'Sản phẩm tuyệt vời!',
              'Chất lượng tốt, đóng gói đẹp.',
              'Giao hàng nhanh.',
              'Hơi rộng một chút nhưng vẫn đẹp.',
              'Màu sắc y hình.',
              'Vải mềm mịn, rất thích.',
              'Good product.',
              'Will buy again.',
            ];

            const rating = ratingRepo.create({
              userId: user.id,
              productId,
              rating: ratingVal,
              comment: randomItem(comments),
              createdAt: order.deliveredAt ?? new Date(),
            });
            await ratingRepo.save(rating);
          }
        }
      }
    }
  }

  console.log('✅ Ratings generated and Product Stats synced!');
  console.log('✅ Demo Data Generation Complete!');
}
