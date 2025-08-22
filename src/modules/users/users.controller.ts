import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  NotFoundException,
  Patch,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-users.dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Tạo user mới
  @ApiOperation({ summary: 'Tạo user mới' })
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // Lấy user theo id
  @ApiOperation({ summary: 'Lấy user theo id' })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOneById(id);
    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với id ${id}`);
    }
    return user;
  }

  // Lấy user theo email
  @ApiOperation({ summary: 'Lấy user theo email' })
  @Get('email/:email')
  async findByEmail(@Param('email') email: string) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với email ${email}`);
    }
    return user;
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
