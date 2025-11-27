import { DataSource } from 'typeorm';
import { CustomerGroup } from '../../src/modules/customer_groups/entities/customer-group.entity';

interface CustomerGroupSeedDefinition {
  name: string;
  description?: string;
}

const customerGroupSeeds: CustomerGroupSeedDefinition[] = [
  {
    name: 'Khách hàng mới',
    description: 'Những khách hàng vừa đăng ký tài khoản hoặc mua sắm lần đầu.',
  },
  {
    name: 'Khách hàng tiềm năng',
    description: 'Khách hàng đã quan tâm đến sản phẩm nhưng mua hàng chưa nhiều.',
  },
  {
    name: 'Khách hàng thân thiết',
    description: 'Khách hàng mua sắm thường xuyên và có điểm thành viên cao.',
  },
  {
    name: 'Khách hàng VIP',
    description: 'Khách hàng mang lại doanh thu lớn và được ưu tiên chăm sóc.',
  },
];

export async function seedCustomerGroups(dataSource: DataSource) {
  const repository = dataSource.getRepository(CustomerGroup);

  for (const seed of customerGroupSeeds) {
    const existing = await repository.findOne({ where: { name: seed.name } });

    if (existing) {
      continue;
    }

    const customerGroup = repository.create(seed);
    await repository.save(customerGroup);
  }

  console.log('✅ Customer group seed data inserted successfully.');
}
