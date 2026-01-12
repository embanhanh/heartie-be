import { Module, Global } from '@nestjs/common';
import { VisionService } from './vision.service';

@Global()
@Module({
  providers: [VisionService],
  exports: [VisionService],
})
export class VisionModule {}
