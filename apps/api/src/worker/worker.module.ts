import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { anthropicLearningAi } from '../study/ai-client';
import { CaptionIndexService } from '../study/caption-index.service';
import { LEARNING_AI, StudyNotesService } from '../study/study-notes.service';
import { CaptionBackfill } from './caption-backfill';
import { EmailProcessor } from './email.processor';
import { HlsProcessor, VideoProcessor } from './video.processor';
import { HlsBackfill } from './hls-backfill';

@Module({
  imports: [CommonModule],
  providers: [VideoProcessor, HlsProcessor, EmailProcessor, HlsBackfill, CaptionIndexService, StudyNotesService, CaptionBackfill, { provide: LEARNING_AI, useValue: anthropicLearningAi }],
})
export class WorkerModule {}
