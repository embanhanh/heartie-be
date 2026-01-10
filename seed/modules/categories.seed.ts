import { DataSource, IsNull, Repository } from 'typeorm';
import { Category } from '../../src/modules/categories/entities/category.entity';

type CategorySeedNode = {
  name: string;
  children?: CategorySeedNode[];
};

const categoryTree: CategorySeedNode[] = [
  {
    name: 'Thời Trang',
    children: [],
  },
  {
    name: 'Thời trang nữ',
    children: [
      {
        name: 'Đầm nữ',
        children: [
          {
            name: 'Đầm dáng xòe',
          },
          {
            name: 'Đầm dáng ôm',
          },
          {
            name: 'Đầm suông',
          },
          {
            name: 'Đầm công sở',
          },
          {
            name: 'Đầm dự tiệc',
          },
          {
            name: 'Đầm maxi',
          },
          {
            name: 'Đầm jumpsuit',
          },
          {
            name: 'Đầm hai dây',
          },
          {
            name: 'Đầm chữ A',
          },
          {
            name: 'Đầm yếm',
          },
          {
            name: 'Đầm baby doll',
          },
          {
            name: 'Đầm trễ vai',
          },
        ],
      },
      {
        name: 'Chân váy',
        children: [
          {
            name: 'Chân váy dài',
          },
          {
            name: 'Chân váy ngắn',
          },
          {
            name: 'Chân váy xếp li',
          },
          {
            name: 'Chân váy bút chì',
          },
          {
            name: 'Chân váy chữ A',
          },
          {
            name: 'Chân váy công sở',
          },
        ],
      },
      {
        name: 'Quần nữ',
        children: [
          {
            name: 'Quần jean nữ',
          },
          {
            name: 'Quần shorts nữ',
          },
          {
            name: 'Quần tây nữ',
          },
          {
            name: 'Quần ống rộng nữ',
          },
          {
            name: 'Quần baggy nữ',
          },
          {
            name: 'Quần legging – tregging nữ',
          },
          {
            name: 'Quần yếm',
          },
          {
            name: 'Quần kaki nữ',
          },
        ],
      },
      {
        name: 'Áo vest – Áo khoác nữ',
        children: [
          {
            name: 'Áo cardigan nữ',
          },
          {
            name: 'Áo vest, blazer nữ',
          },
          {
            name: 'Áo len – Áo khoác nỉ nữ',
          },
          {
            name: 'Áo khoác jeans nữ',
          },
          {
            name: 'Áo khoác dạ nữ',
          },
          {
            name: 'Áo khoác chống nắng nữ',
          },
          {
            name: 'Áo khoác phao nữ',
          },
          {
            name: 'Áo khoác da nữ',
          },
          {
            name: 'Áo khoác bomber jackets',
          },
          {
            name: 'Áo khoác gió nữ',
          },
          {
            name: 'Áo hoodies nữ',
          },
        ],
      },
      {
        name: 'Áo liền quần – Bộ trang phục',
        children: [
          {
            name: 'Áo liền quần',
          },
          {
            name: 'Bộ trang phục',
          },
          {
            name: 'Áo dài',
          },
        ],
      },
      {
        name: 'Đồ đôi – Đồ gia đình',
        children: [
          {
            name: 'Đồ gia đình',
          },
          {
            name: 'Áo đôi',
          },
        ],
      },
      {
        name: 'Thời trang bầu và sau sinh',
        children: [
          {
            name: 'Đầm bầu',
          },
          {
            name: 'Áo bầu',
          },
          {
            name: 'Quần bầu',
          },
          {
            name: 'Bộ đồ bầu',
          },
          {
            name: 'Đồ lót bầu',
          },
        ],
      },
      {
        name: 'Thời trang nữ trung niên',
        children: [
          {
            name: 'Thời trang nữ trung niên khác',
          },
          {
            name: 'Đầm nữ trung niên',
          },
          {
            name: 'Quần nữ trung niên',
          },
          {
            name: 'Áo nữ trung niên',
          },
        ],
      },
      {
        name: 'Đồ lót nữ',
        children: [
          {
            name: 'Áo ngực',
          },
          {
            name: 'Quần lót nữ',
          },
          {
            name: 'Nịt bụng',
          },
          {
            name: 'Bộ đồ lót nữ',
          },
          {
            name: 'Đồ lót giữ nhiệt nữ',
          },
        ],
      },
      {
        name: 'Đồ ngủ – Đồ mặc nhà nữ',
        children: [
          {
            name: 'Đồ ngủ nữ',
          },
          {
            name: 'Đồ mặc nhà',
          },
        ],
      },
      {
        name: 'Trang phục bơi nữ',
        children: [
          {
            name: 'Bikini',
          },
          {
            name: 'Đồ bơi một mảnh',
          },
          {
            name: 'Đồ bơi hai mảnh',
          },
        ],
      },
      {
        name: 'Áo sơ mi nữ',
        children: [
          {
            name: 'Áo sơ mi nữ tay ngắn',
          },
          {
            name: 'Áo sơ mi nữ tay dài',
          },
        ],
      },
      {
        name: 'Áo kiểu nữ',
        children: [
          {
            name: 'Áo kiểu nữ khác',
          },
          {
            name: 'Áo trễ vai',
          },
          {
            name: 'Áo cúp ngực',
          },
          {
            name: 'Áo ống',
          },
        ],
      },
      {
        name: 'Áo crop-top',
        children: [
          {
            name: 'Áo crop-top tay dài',
          },
          {
            name: 'Áo crop-top tay ngắn',
          },
          {
            name: 'Áo hai dây – Áo ba lỗ nữ',
          },
        ],
      },
      {
        name: 'Áo thun nữ',
        children: [
          {
            name: 'Áo thun nữ dài tay có cổ',
          },
          {
            name: 'Áo thun nữ dài tay không cổ',
          },
          {
            name: 'Áo thun nữ ngắn tay có cổ',
          },
          {
            name: 'Áo thun nữ ngắn tay không cổ',
          },
        ],
      },
    ],
  },
  {
    name: 'Thời trang nam',
    children: [
      {
        name: 'Áo thun nam',
        children: [
          {
            name: 'Áo thun nam ngắn tay có cổ',
          },
          {
            name: 'Áo thun nam ngắn tay không cổ',
          },
          {
            name: 'Áo thun nam ba lỗ',
          },
          {
            name: 'Áo thun nam dài tay không cổ',
          },
          {
            name: 'Áo thun nam dài tay có cổ',
          },
        ],
      },
      {
        name: 'Áo sơ mi nam',
        children: [
          {
            name: 'Áo sơ mi nam tay dài',
          },
          {
            name: 'Áo sơ mi nam tay ngắn',
          },
          {
            name: 'Áo sơ mi nam cổ tàu',
          },
        ],
      },
      {
        name: 'Áo vest - Áo khoác nam',
        children: [
          {
            name: 'Áo khoác phao nam',
          },
          {
            name: 'Áo khoác da nam',
          },
          {
            name: 'Áo khoác gió',
          },
          {
            name: 'Áo khoác nỉ',
          },
          {
            name: 'Áo khoác bomber nam',
          },
          {
            name: 'Áo khoác jeans nam',
          },
          {
            name: 'Áo cardigan nam',
          },
          {
            name: 'Áo vest và Blazer nam',
          },
        ],
      },
      {
        name: 'Áo hoodie nam',
        children: [
          {
            name: 'Áo hoodies nam vải da cá',
          },
          {
            name: 'Áo hoodies nam vải nỉ',
          },
          {
            name: 'Áo hoodies nam vải cotton',
          },
        ],
      },
      {
        name: 'Áo nỉ - Áo len nam',
        children: [
          {
            name: 'Áo len dệt kim',
          },
          {
            name: 'Áo nỉ nam',
          },
        ],
      },
      {
        name: 'Quần dài nam',
        children: [
          {
            name: 'Quần tây nam',
          },
          {
            name: 'Quần jogger nam',
          },
          {
            name: 'Quần jeans nam',
          },
          {
            name: 'Quần kaki nam dài',
          },
          {
            name: 'Quần thun nam',
          },
        ],
      },
      {
        name: 'Đồ ngủ, đồ mặc nhà nam',
        children: [
          {
            name: 'Đồ mặc nhà nam – Bộ dài',
          },
          {
            name: 'Đồ mặc nhà nam – Bộ ngắn',
          },
        ],
      },
      {
        name: 'Đồ lót nam',
        children: [
          {
            name: 'Quần lót nam',
          },
          {
            name: 'Bộ đồ lót nam',
          },
          {
            name: 'Áo lót nam',
          },
          {
            name: 'Đồ lót giữ nhiệt nam',
          },
        ],
      },
      {
        name: 'Quần áo nam kích cỡ lớn',
        children: [
          {
            name: 'Bộ quần áo nam kích cỡ lớn',
          },
        ],
      },
      {
        name: 'Quần áo nam trung niên',
        children: [
          {
            name: 'Áo nam trung niên',
          },
        ],
      },
      {
        name: 'Đồ bơi - Đồ đi biển nam',
        children: [
          {
            name: 'Áo bơi - đi biển nam',
          },
          {
            name: 'Quần bơi - đi biển nam',
          },
        ],
      },
      {
        name: 'Bộ trang phục nam',
        children: [
          {
            name: 'Bộ trang phục ngành nghề cho nam',
          },
          {
            name: 'Bộ trang phục truyền thống nam',
          },
          {
            name: 'Đồ hóa trang nam',
          },
        ],
      },
      {
        name: 'Quần short nam',
        children: [
          {
            name: 'Quần short jean nam',
          },
          {
            name: 'Quần short kaki nam',
          },
          {
            name: 'Quần short thun nam',
          },
        ],
      },
    ],
  },
  {
    name: 'Giày - Dép nữ',
    children: [
      {
        name: 'Giày cao gót',
        children: [
          {
            name: 'Giày cao gót nhọn',
          },
          {
            name: 'Giày cao gót quai sau',
          },
          {
            name: 'Giày bít mũi quai ngang',
          },
          {
            name: 'Giày cao gót hở mũi',
          },
          {
            name: 'Giày cao gót sục',
          },
        ],
      },
      {
        name: 'Giày thể thao nữ',
        children: [
          {
            name: 'Giày thể thao cổ thấp',
          },
          {
            name: 'Giày thể thao cổ cao',
          },
        ],
      },
      {
        name: 'Giày sandals nữ',
        children: [
          {
            name: 'Giày sandals đế bằng',
          },
          {
            name: 'Giày sandals chiến binh',
          },
          {
            name: 'Giày sandals buộc dây',
          },
          {
            name: 'Giày sandals xỏ ngón',
          },
        ],
      },
      {
        name: 'Giày búp bê',
        children: [
          {
            name: 'Giày búp bê mũi nhọn',
          },
          {
            name: 'Giày búp bê mũi tròn',
          },
          {
            name: 'Giày búp bê mũi vuông',
          },
        ],
      },
      {
        name: 'Giày Đế xuồng nữ',
        children: [],
      },
      {
        name: 'Giày boots nữ',
        children: [
          {
            name: 'Giày boots nữ cổ ngắn',
          },
          {
            name: 'Giày boots nữ cổ cao',
          },
          {
            name: 'Giày boots nữ gót nhọn',
          },
        ],
      },
      {
        name: 'Dép - Guốc nữ',
        children: [
          {
            name: 'Dép xỏ ngón',
          },
          {
            name: 'Dép quai ngang',
          },
          {
            name: 'Dép đi trong nhà',
          },
        ],
      },
      {
        name: 'Giày lười nữ',
        children: [
          {
            name: 'Giày lười cao gót',
          },
          {
            name: 'Giày lười hở gót',
          },
          {
            name: 'Giày lười mũi vuông',
          },
          {
            name: 'Giày lười mũi nhọn',
          },
        ],
      },
      {
        name: 'Phụ kiện giày nữ',
        children: [
          {
            name: 'Miếng lót giày',
          },
          {
            name: 'Dụng cụ chăm sóc & làm sạch giày',
          },
          {
            name: 'Phụ kiện giày nữ khác',
          },
          {
            name: 'Dây giày',
          },
          {
            name: 'Khử mùi giày',
          },
          {
            name: 'Túi đựng giày',
          },
        ],
      },
    ],
  },
  {
    name: 'Phụ kiện thời trang',
    children: [
      {
        name: 'Mắt kính',
        children: [
          {
            name: 'Kính mát',
          },
          {
            name: 'Gọng kính',
          },
          {
            name: 'Kính áp tròng',
          },
          {
            name: 'Mắt kính trẻ em',
          },
          {
            name: 'Phụ kiện kính',
          },
        ],
      },
      {
        name: 'Phụ kiện thời trang nữ',
        children: [
          {
            name: 'Nón nữ',
          },
          {
            name: 'Khăn - Tất - Vớ nữ',
          },
          {
            name: 'Phụ kiện tóc nữ',
          },
          {
            name: 'Thắt lưng - Dây nịt nữ và phụ kiện',
          },
          {
            name: 'Phụ kiện cưới',
          },
          {
            name: 'Cài Áo',
          },
          {
            name: 'Phụ kiện thời trang nữ khác',
          },
          {
            name: 'Ô, dù',
          },
        ],
      },
      {
        name: 'Phụ kiện thời trang nam',
        children: [
          {
            name: 'Nón nam',
          },
          {
            name: 'Khăn nam',
          },
          {
            name: 'Tất, vớ nam',
          },
          {
            name: 'Thắt lưng, dây nịt nam',
          },
          {
            name: 'Hình xăm nam',
          },
          {
            name: 'Găng tay nam',
          },
          {
            name: 'Cà vạt, nơ cổ',
          },
          {
            name: 'Phụ kiện thời trang nam khác',
          },
        ],
      },
    ],
  },
  {
    name: 'Đồng hồ và Trang sức',
    children: [
      {
        name: 'Đồng hồ nam',
        children: [
          {
            name: 'Đồng hồ business nam',
          },
          {
            name: 'Đồng hồ thời trang, casual nam',
          },
          {
            name: 'Đồng hồ thể thao nam',
          },
          {
            name: 'Đồng hồ lộ máy',
          },
        ],
      },
      {
        name: 'Đồng hồ nữ',
        children: [
          {
            name: 'Đồng hồ dây da',
          },
          {
            name: 'Đồng hồ dây kim loại',
          },
          {
            name: 'Đồng hồ thể thao nữ',
          },
        ],
      },
      {
        name: 'Đồng hồ trẻ em',
        children: [
          {
            name: 'Đồng hồ bé trai',
          },
          {
            name: 'Đồng hồ bé gái',
          },
        ],
      },
      {
        name: 'Phụ kiện đồng hồ',
        children: [
          {
            name: 'Dây đồng hồ',
          },
          {
            name: 'Hộp đựng đồng hồ',
          },
          {
            name: 'Dụng cụ sửa đồng hồ',
          },
          {
            name: 'Pin đồng hồ',
          },
          {
            name: 'Phụ kiện đồng hồ khác',
          },
        ],
      },
      {
        name: 'Trang sức',
        children: [
          {
            name: 'Dây chuyền',
          },
          {
            name: 'Vòng tay',
          },
          {
            name: 'Bông tai',
          },
          {
            name: 'Nhẫn',
          },
          {
            name: 'Bộ trang sức',
          },
          {
            name: 'Các loại đá quý',
          },
          {
            name: 'Các loại trang sức khác',
          },
          {
            name: 'Lắc chân',
          },
          {
            name: 'Lắc tay',
          },
        ],
      },
    ],
  },
  {
    name: 'Túi thời trang nữ',
    children: [
      {
        name: 'Túi tote nữ',
        children: [
          {
            name: 'Túi tote có khóa',
          },
          {
            name: 'Túi tote không khóa',
          },
        ],
      },
      {
        name: 'Túi đeo chéo, túi đeo vai nữ',
        children: [
          {
            name: 'Túi đeo chéo công sở',
          },
          {
            name: 'Túi đeo chéo dạo phố',
          },
        ],
      },
      {
        name: 'Túi xách tay nữ',
        children: [
          {
            name: 'Túi xách to bản',
          },
          {
            name: 'Túi xách vừa và nhỏ',
          },
        ],
      },
      {
        name: 'Ví nữ',
        children: [
          {
            name: 'Ví ngắn',
          },
          {
            name: 'Ví dài',
          },
        ],
      },
      {
        name: 'Ví đi tiệc',
        children: [
          {
            name: 'Clutch ánh kim',
          },
          {
            name: 'Clutch da',
          },
        ],
      },
      {
        name: 'Phụ kiện túi',
        children: [
          {
            name: 'Dây, quai đeo túi',
          },
          {
            name: 'Phụ kiện cài túi',
          },
        ],
      },
    ],
  },
  {
    name: 'Túi thời trang nam',
    children: [
      {
        name: 'Túi xách công sở nam',
        children: [],
      },
      {
        name: 'Túi đeo chéo nam',
        children: [],
      },
      {
        name: 'Túi bao tử, túi đeo bụng',
        children: [],
      },
      {
        name: 'Ví nam',
        children: [
          {
            name: 'Ví nam ngang',
          },
          {
            name: 'Ví nam đứng',
          },
        ],
      },
    ],
  },
  {
    name: 'Giày - Dép nam',
    children: [
      {
        name: 'Giày thể thao nam',
        children: [
          {
            name: 'Giày thể thao nam cổ thấp',
          },
          {
            name: 'Giày thể thao nam cổ cao',
          },
        ],
      },
      {
        name: 'Giày lười nam',
        children: [
          {
            name: 'Giày lười vải nam',
          },
          {
            name: 'Giày lười da nam',
          },
        ],
      },
      {
        name: 'Giày tây nam',
        children: [
          {
            name: 'Giày tây nam có dây',
          },
          {
            name: 'Giày tây nam không dây',
          },
        ],
      },
      {
        name: 'Giày sandals nam',
        children: [
          {
            name: 'Giày sandals nam quai ngang',
          },
          {
            name: 'Giày sandals nam quai chéo',
          },
        ],
      },
      {
        name: 'Dép nam',
        children: [
          {
            name: 'Dép nam xỏ ngón',
          },
          {
            name: 'Dép nam quai ngang',
          },
          {
            name: 'Dép nam đi trong nhà',
          },
        ],
      },
      {
        name: 'Giày boots nam',
        children: [
          {
            name: 'Giày boots nam cổ cao',
          },
          {
            name: 'Giày boots nam cổ thấp',
          },
        ],
      },
      {
        name: 'Phụ kiện giày nam',
        children: [
          {
            name: 'Dụng cụ chăm sóc & làm sạch giày',
          },
          {
            name: 'Miếng lót giày nam',
          },
          {
            name: 'Phụ kiện giày nam khác',
          },
          {
            name: 'Dây giày',
          },
          {
            name: 'Khử mùi giày',
          },
          {
            name: 'Túi đựng giày',
          },
        ],
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

    // For child categories, manually regenerate slug with id and save again
    if (parent) {
      category.generateSlug();
      category = await repo.save(category);
    }
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
