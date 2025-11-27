import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserCustomerGroupsService } from './user_customer_groups.service';
import { CreateUserCustomerGroupDto } from './dto/create-user-customer-group.dto';
import { FilterUserCustomerGroupDto } from './dto/filter-user-customer-group.dto';
import { UpdateUserCustomerGroupDto } from './dto/update-user-customer-group.dto';

@ApiTags('user-customer-groups')
@ApiBearerAuth()
@Controller('user-customer-groups')
export class UserCustomerGroupsController {
  constructor(private readonly service: UserCustomerGroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Assign a user to a customer group' })
  create(@Body() dto: CreateUserCustomerGroupDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user-customer group assignments' })
  findAll(@Query() filter: FilterUserCustomerGroupDto) {
    return this.service.findAll(filter);
  }

  @Get(':userId/:customerGroupId')
  @ApiOperation({ summary: 'Get an assignment detail' })
  findOne(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('customerGroupId', ParseIntPipe) customerGroupId: number,
  ) {
    return this.service.findOne(userId, customerGroupId);
  }

  @Patch(':userId/:customerGroupId')
  @ApiOperation({ summary: 'Update an assignment' })
  update(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('customerGroupId', ParseIntPipe) customerGroupId: number,
    @Body() dto: UpdateUserCustomerGroupDto,
  ) {
    return this.service.update(userId, customerGroupId, dto);
  }

  @Delete(':userId/:customerGroupId')
  @ApiOperation({ summary: 'Remove a user from a customer group' })
  remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('customerGroupId', ParseIntPipe) customerGroupId: number,
  ) {
    return this.service.remove(userId, customerGroupId);
  }
}
