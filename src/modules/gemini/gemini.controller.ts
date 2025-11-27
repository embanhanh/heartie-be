import { Body, Controller, Post } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { CreateGeminiDto } from './dto/create-gemini.dto';

@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('chat')
  async chat(@Body() dto: CreateGeminiDto) {
    const reply = await this.geminiService.generateContent(
      '',
      dto.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        systemPrompt: dto.systemPrompt,
        model: dto.model,
        temperature: dto.temperature,
        maxOutputTokens: dto.maxOutputTokens,
      },
    );

    return { reply };
  }
}
