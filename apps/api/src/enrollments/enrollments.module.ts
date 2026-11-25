import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ManualEnrollmentController } from './manual.controller';
import { ManualEnrollmentService } from './manual.service';

@Module({ imports: [AuthModule], controllers: [ManualEnrollmentController], providers: [ManualEnrollmentService], exports: [ManualEnrollmentService] })
export class EnrollmentsModule {}
