import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TestVeoDto {
  @ApiProperty({
    example: 'A cinematic shot of a coffee cup on a wooden table, 4k, photorealistic',
    description: 'Prompt generating video',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;
}
