import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserSafe } from '../types/user-safe.type';

class ConversationParticipantInfo {
  @ApiProperty({ example: 1 })
  conversationId: number;

  @ApiPropertyOptional({ example: 1, description: 'ID của user liên kết (nếu có)' })
  userId?: number | null;
}

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({ enum: ['CUSTOMER', 'SHOP_OWNER', 'ADMIN', 'BRANCH_MANAGER', 'STAFF'] })
  role: string;

  @ApiProperty({ description: 'Associated branch id', nullable: true })
  branchId?: number | null;

  @ApiProperty({ description: 'Active flag', default: true })
  isActive: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({
    description: 'ID of the conversation participant associated with the user',
    nullable: true,
  })
  participants?: ConversationParticipantInfo[];

  static from(user: UserSafe): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.email = user.email;
    dto.phoneNumber = user.phoneNumber;
    dto.role = user.role;
    dto.branchId = user.branchId ?? null;
    dto.isActive = user.isActive;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    const participants = Array.isArray(user.participants) ? user.participants : [];
    dto.participants = participants.map((participant) => {
      const info = new ConversationParticipantInfo();
      info.conversationId = participant.conversationId;
      info.userId = participant.userId;
      return info;
    });
    return dto;
  }
}
