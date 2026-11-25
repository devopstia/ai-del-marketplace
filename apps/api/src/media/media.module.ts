import { Global, Module } from '@nestjs/common';
import { LocalVideoProvider } from './local-video.provider';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MuxVideoProvider } from './mux-video.provider';

@Global()
@Module({
  controllers: [MediaController],
  providers: [MediaService, LocalVideoProvider, MuxVideoProvider],
  exports: [MediaService, MuxVideoProvider],
})
export class MediaModule {}
