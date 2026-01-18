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
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto';
import { UserSafe } from './types/user-safe.type';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { FilterUserDto } from './dto/filter-users.dto';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile as UploadedFileType } from 'src/common/types/uploaded-file.type';
import { createModuleMulterOptions } from 'src/common/utils/upload.util';

const userImageUploadOptions = createModuleMulterOptions({
  moduleName: 'users',
  allowedMimeTypes: ['image/*'],
});

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private mapToResponseDto(user: UserSafe): UserResponseDto {
    return UserResponseDto.from(user);
  }

  // Tạo user mới
  @ApiOperation({ summary: 'Tạo user mới' })
  @ApiCreatedResponse({ type: () => UserResponseDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar', userImageUploadOptions))
  @Roles(UserRole.ADMIN)
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() avatar?: UploadedFileType,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto, avatar);
    return this.mapToResponseDto(user);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  @ApiOkResponse({ type: () => UserResponseDto })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('avatar', userImageUploadOptions))
  @Roles(
    UserRole.ADMIN,
    UserRole.CUSTOMER,
    UserRole.SHOP_OWNER,
    UserRole.BRANCH_MANAGER,
    UserRole.STAFF,
  )
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() avatar?: UploadedFileType,
  ): Promise<UserResponseDto> {
    const requester = req.user as { id?: number } | undefined;

    console.log('avatar:', avatar);

    if (!requester?.id) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    const updatedUser = await this.usersService.update(id, updateUserDto, requester.id, avatar);
    return this.mapToResponseDto(updatedUser);
  }

  @ApiOperation({ summary: 'Danh sách user với phân trang và bộ lọc' })
  @ApiOkResponse({ type: () => UserResponseDto, isArray: false })
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
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
  @Roles(UserRole.ADMIN)
  @Delete(':id/remove-refresh-token')
  async removeRefreshToken(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.removeRefreshToken(id);
    return { message: 'Refresh token đã được xóa' };
  }

  @ApiOperation({ summary: 'Lấy danh sách gợi ý sản phẩm' })
  @Get('me/recommendations')
  async getRecommendations(@Req() req: Request) {
    const user = req.user as { id: number } | undefined;
    const recommendations = await this.usersService.getRecommendations(user!.id);
    return recommendations;
  }

  @ApiOperation({
    summary: 'Lấy gợi ý sản phẩm real-time dựa trên tương tác gần đây',
    description:
      'Query TẤT CẢ interactions trong time window (cross-session), kết hợp ALS với short-term intent',
  })
  @Post('me/recommendations/realtime')
  async getRealtimeRecommendations(
    @Req() req: Request,
    @Body()
    body: {
      time_window_minutes?: number; // Default: 30 minutes
      k?: number; // Default: 10 recommendations
    },
  ) {
    const user = req.user as { id: number } | undefined;
    if (!user?.id) {
      throw new UnauthorizedException('Authenticated user is required');
    }

    const result = await this.usersService.getRealtimeRecommendations(
      user.id,
      body.time_window_minutes ?? 30,
      body.k ?? 10,
    );

    return result;
  }
}
