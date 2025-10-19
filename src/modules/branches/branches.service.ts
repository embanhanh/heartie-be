import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch, BranchStatus } from './entities/branch.entity';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  create(dto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchRepository.create(dto);
    return this.branchRepository.save(branch);
  }

  findAll(): Promise<Branch[]> {
    return this.branchRepository.find();
  }

  async findOne(id: number): Promise<Branch> {
    const branch = await this.branchRepository.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async update(id: number, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findOne(id);
    const updated = this.branchRepository.merge(branch, dto);
    return this.branchRepository.save(updated);
  }

  async toggleStatus(id: number, isActive: boolean): Promise<Branch> {
    const branch = await this.findOne(id);
    branch.status = isActive ? BranchStatus.ACTIVE : BranchStatus.INACTIVE;
    return this.branchRepository.save(branch);
  }
}
