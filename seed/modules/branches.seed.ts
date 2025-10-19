import { DataSource } from 'typeorm';
import { Branch, BranchStatus } from '../../src/modules/branches/entities/branch.entity';

type BranchSeed = {
  name: string;
  address: string;
  phone: string;
  isMainBranch: boolean;
  lat: number;
  lng: number;
  status: BranchStatus;
};

const branchSeeds: BranchSeed[] = [
  {
    name: 'Chi nhánh chính - Trung tâm TP.HCM',
    address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
    phone: '0901234567',
    isMainBranch: true,
    lat: 10.776889,
    lng: 106.700806,
    status: BranchStatus.ACTIVE,
  },
  {
    name: 'Chi nhánh Hà Nội',
    address: '45 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
    phone: '0912345678',
    isMainBranch: false,
    lat: 21.028511,
    lng: 105.804817,
    status: BranchStatus.ACTIVE,
  },
  {
    name: 'Chi nhánh Đà Nẵng',
    address: '56 Nguyễn Văn Linh, Hải Châu, Đà Nẵng',
    phone: '0923456789',
    isMainBranch: false,
    lat: 16.054407,
    lng: 108.202167,
    status: BranchStatus.ACTIVE,
  },
];

export async function seedBranches(dataSource: DataSource) {
  const repo = dataSource.getRepository(Branch);

  for (const seed of branchSeeds) {
    const existing = await repo.findOne({ where: { name: seed.name } });

    if (existing) {
      continue;
    }

    const branch = repo.create(seed);
    await repo.save(branch);
  }

  console.log('✅ Branch seed data inserted successfully.');
}
