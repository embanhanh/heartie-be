import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../src/modules/users/entities/user.entity';
import { Branch } from '../../src/modules/branches/entities/branch.entity';

const DEFAULT_PASSWORD = 'Fashia@123';

interface UserSeedDefinition {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: UserRole;
  branchName?: string;
}

const userSeeds: UserSeedDefinition[] = [
  {
    email: 'admin@fashia.vn',
    firstName: 'Fi',
    lastName: 'Admin',
    phoneNumber: '0900000001',
    role: UserRole.ADMIN,
  },
  {
    email: 'owner@fashia.vn',
    firstName: 'Fi',
    lastName: 'Owner',
    phoneNumber: '0900000002',
    role: UserRole.SHOP_OWNER,
  },
  {
    email: 'manager.hcm@fashia.vn',
    firstName: 'Chi',
    lastName: 'Nhanh',
    phoneNumber: '0900000003',
    role: UserRole.BRANCH_MANAGER,
    branchName: 'Chi nhánh chính - Trung tâm TP.HCM',
  },
  {
    email: 'staff.danang@fashia.vn',
    firstName: 'Da',
    lastName: 'Nang',
    phoneNumber: '0900000004',
    role: UserRole.STAFF,
    branchName: 'Chi nhánh Đà Nẵng',
  },
  {
    email: 'customer.demo@fashia.vn',
    firstName: 'Demo',
    lastName: 'Customer',
    phoneNumber: '0900000005',
    role: UserRole.CUSTOMER,
  },
];

export async function seedUsers(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User);
  const branchRepository = dataSource.getRepository(Branch);

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const seed of userSeeds) {
    const existing = await userRepository.findOne({ where: { email: seed.email } });

    if (existing) {
      continue;
    }

    let branchId: number | null = null;
    if (seed.branchName) {
      const branch = await branchRepository.findOne({ where: { name: seed.branchName } });
      if (!branch) {
        console.warn(
          `⚠️  Branch "${seed.branchName}" not found. User ${seed.email} will be created without branch assignment.`,
        );
      } else {
        branchId = branch.id;
      }
    }

    const user = userRepository.create({
      email: seed.email,
      firstName: seed.firstName,
      lastName: seed.lastName,
      phoneNumber: seed.phoneNumber,
      role: seed.role,
      password: hashedPassword,
      branchId,
      isActive: true,
    });

    await userRepository.save(user);
  }

  console.log(
    `✅ User seed data inserted successfully. Default password for seeded accounts: ${DEFAULT_PASSWORD}`,
  );
}
