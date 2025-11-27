import { DataSource, IsNull, Repository } from 'typeorm';
import { Category } from '../../src/modules/categories/entities/category.entity';

type CategorySeedNode = {
  name: string;
  children?: CategorySeedNode[];
};

const categoryTree: CategorySeedNode[] = [
  {
    name: 'Thời trang nam',
    children: [
      {
        name: 'Áo nam',
        children: [{ name: 'Áo thun' }, { name: 'Áo sơ mi' }, { name: 'Áo khoác' }],
      },
      {
        name: 'Quần nam',
        children: [{ name: 'Quần jeans' }, { name: 'Quần kaki' }, { name: 'Quần short' }],
      },
      {
        name: 'Phụ kiện nam',
        children: [{ name: 'Giày nam' }, { name: 'Thắt lưng' }, { name: 'Đồng hồ' }],
      },
    ],
  },
  {
    name: 'Thời trang nữ',
    children: [
      {
        name: 'Áo nữ',
        children: [{ name: 'Áo thun' }, { name: 'Áo sơ mi' }, { name: 'Áo kiểu' }],
      },
      {
        name: 'Váy & Đầm',
        children: [{ name: 'Đầm công sở' }, { name: 'Đầm dự tiệc' }, { name: 'Váy ngắn' }],
      },
      {
        name: 'Quần nữ',
        children: [{ name: 'Quần jeans' }, { name: 'Quần tây' }, { name: 'Quần short' }],
      },
      {
        name: 'Phụ kiện nữ',
        children: [{ name: 'Túi xách' }, { name: 'Giày cao gót' }, { name: 'Trang sức' }],
      },
    ],
  },
];

async function upsertCategoryNode(
  repo: Repository<Category>,
  node: CategorySeedNode,
  parent?: Category,
): Promise<Category> {
  const whereClause = parent
    ? { name: node.name, parentId: parent.id }
    : { name: node.name, parentId: IsNull() };

  let category = await repo.findOne({ where: whereClause });

  if (!category) {
    category = repo.create({ name: node.name, parentId: parent?.id ?? null });
    category = await repo.save(category);
  }

  if (node.children?.length) {
    for (const child of node.children) {
      await upsertCategoryNode(repo, child, category);
    }
  }

  return category;
}

export async function seedCategories(dataSource: DataSource) {
  const repo = dataSource.getRepository(Category);

  for (const rootNode of categoryTree) {
    await upsertCategoryNode(repo, rootNode);
  }

  console.log('✅ Category seed data inserted successfully.');
}
