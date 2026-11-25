import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EmailProcessor } from './email.processor';
import { VideoProcessor } from './video.processor';
import { HlsBackfill } from './hls-backfill';

@Module({ imports: [CommonModule], providers: [VideoProcessor, EmailProcessor, HlsBackfill] })
export class WorkerModule {}
