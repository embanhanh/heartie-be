import { PartialType } from '@nestjs/mapped-types';
import { CreateChatGatewayDto } from './create-chat_gateway.dto';

export class UpdateChatGatewayDto extends PartialType(CreateChatGatewayDto) {
  id: number;
}
