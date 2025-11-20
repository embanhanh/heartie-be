import { PartialType } from '@nestjs/swagger';
import { CreateUserCustomerGroupDto } from './create-user-customer-group.dto';

export class UpdateUserCustomerGroupDto extends PartialType(CreateUserCustomerGroupDto) {}
