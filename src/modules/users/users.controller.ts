import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto';
import { UserSafe } from './types/user-safe.type';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { FilterUserDto } from './dto/filter-users.dto';
import { PaginatedResult } from 'src/common/dto/pagination.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private mapToResponseDto(user: UserSafe): UserResponseDto {
    return UserResponseDto.from(user);
  }

  // Tạo user mới
  @ApiOperation({ summary: 'Tạo user mới' })
  @ApiCreatedResponse({ type: () => UserResponseDto })
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return this.mapToResponseDto(user);
  }

  @ApiOperation({ summary: 'Danh sách user với phân trang và bộ lọc' })
  @ApiOkResponse({ type: () => UserResponseDto, isArray: false })
  @Get()
  async findAll(@Query() query: FilterUserDto): Promise<PaginatedResult<UserResponseDto>> {
    const result = await this.usersService.findAll(query);
    return {
      data: result.data.map((user) => this.mapToResponseDto(user)),
      meta: result.meta,
    };
  }

  // Lấy user theo id
  @ApiOperation({ summary: 'Lấy user theo id' })
  @ApiOkResponse({ type: () => UserResponseDto })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    const user = await this.usersService.findOneById(id);
    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với id ${id}`);
    }
    return this.mapToResponseDto(user);
  }

  // Lấy user theo email
  @ApiOperation({ summary: 'Lấy user theo email' })
  @ApiOkResponse({ type: () => UserResponseDto })
  @Get('email/:email')
  async findByEmail(@Param('email') email: string): Promise<UserResponseDto> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với email ${email}`);
    }
    return this.mapToResponseDto(user);
  }

  // Set refresh token cho user (ví dụ gọi trong AuthService)
  @ApiOperation({ summary: 'Set refresh token cho user' })
  @Patch(':id/set-refresh-token')
  async setRefreshToken(
    @Param('id', ParseIntPipe) id: number,
    @Body('refreshToken') refreshToken: string,
  ) {
    await this.usersService.setCurrentRefreshToken(refreshToken, id);
    return { message: 'Refresh token đã được lưu' };
  }

  // Xóa refresh token của user
  @ApiOperation({ summary: 'Xóa refresh token của user' })
  @Delete(':id/remove-refresh-token')
  async removeRefreshToken(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.removeRefreshToken(id);
    return { message: 'Refresh token đã được xóa' };
  }
}
