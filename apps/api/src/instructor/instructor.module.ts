import { Module } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InsightsService } from './insights.service';
import { InstructorService } from './instructor.service';
import { RevisionsService } from './revisions.service';

@Module({ controllers: [InstructorController], providers: [InstructorService, RevisionsService, InsightsService], exports: [InstructorService, RevisionsService] })
export class InstructorModule {}
