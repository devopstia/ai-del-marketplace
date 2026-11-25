import { Module } from '@nestjs/common';
import { InstructorModule } from '../instructor/instructor.module';
import { AuthModule } from '../auth/auth.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({ imports: [InstructorModule, AuthModule], controllers: [AdminController, PeopleController], providers: [AdminService, PeopleService] })
export class AdminModule {}
