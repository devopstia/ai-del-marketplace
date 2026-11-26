import { Module } from '@nestjs/common';
import { anthropicLearningAi } from '../study/ai-client';
import { CaptionIndexService } from '../study/caption-index.service';
import { StudyController } from '../study/study.controller';
import { StudyService } from '../study/study.service';
import { LEARNING_AI, StudyNotesService } from '../study/study-notes.service';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { NotificationsController } from './notifications.controller';

/** The learning view, plus search inside videos, the course assistant and study notes (docs/AI_LEARNING.md). */
@Module({
  controllers: [LearningController, StudyController, NotificationsController],
  providers: [LearningService, StudyService, CaptionIndexService, StudyNotesService, { provide: LEARNING_AI, useValue: anthropicLearningAi }],
})
export class LearningModule {}
