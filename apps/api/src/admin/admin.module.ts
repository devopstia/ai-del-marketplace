import { Module } from '@nestjs/common';
import { InstructorModule } from '../instructor/instructor.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [InstructorModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
