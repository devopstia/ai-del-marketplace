import { Module } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { RevisionsService } from './revisions.service';

@Module({ controllers: [InstructorController], providers: [InstructorService, RevisionsService], exports: [InstructorService, RevisionsService] })
export class InstructorModule {}
