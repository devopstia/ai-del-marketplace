import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { EmailProcessor } from './email.processor';
import { VideoProcessor } from './video.processor';

@Module({ imports: [CommonModule], providers: [VideoProcessor, EmailProcessor] })
export class WorkerModule {}
