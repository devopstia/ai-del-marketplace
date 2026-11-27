import { Module } from '@nestjs/common';
import { InstructorModule } from '../instructor/instructor.module';
import { AuthModule } from '../auth/auth.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CourseAdminService } from './course-admin.service';
import { UserAdminService } from './user-admin.service';
import { SystemService } from './system.service';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({ imports: [InstructorModule, AuthModule], controllers: [AdminController, PeopleController], providers: [AdminService, PeopleService, UserAdminService, CourseAdminService, SystemService, AdminDashboardService] })
export class AdminModule {}
