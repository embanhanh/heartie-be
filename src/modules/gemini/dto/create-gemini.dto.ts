import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeminiChatRole } from '../gemini.service';

export class GeminiMessageDto {
  @IsEnum(GeminiChatRole)
  role: GeminiChatRole;

  @IsString()
  @MinLength(1)
  content: string;
}

export class CreateGeminiDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GeminiMessageDto)
  messages: GeminiMessageDto[];

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(8192)
  maxOutputTokens?: number;
}
