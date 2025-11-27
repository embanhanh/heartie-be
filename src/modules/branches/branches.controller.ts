import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('branches')
@ApiBearerAuth()
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new branch' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all branches' })
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch detail' })
  findOne(@Param('id') id: number) {
    return this.branchesService.findOne(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a branch' })
  update(@Param('id') id: number, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(Number(id), dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle branch status' })
  toggleStatus(@Param('id') id: number, @Query('active') active = 'true') {
    return this.branchesService.toggleStatus(Number(id), active === 'true');
  }
}
