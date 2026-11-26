import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoversModule } from '../covers/covers.module';
import { InstructorModule } from '../instructor/instructor.module';
import { AgentApiController } from '../agents/agent-api.controller';
import { AgentCoursesService } from '../agents/agent-courses.service';
import { AgentTokensService } from '../agents/agent-tokens.service';
import { AgentUploadsService } from '../agents/agent-uploads.service';
import { AgentsAdminController } from '../agents/agents-admin.controller';
import { SupportSessionController } from './support-session.controller';
import { SupportSessionService } from './support-session.service';

/** Support sessions + AI agent access (docs/SUPPORT_SESSIONS_AND_AGENTS.md). */
@Module({
  imports: [AuthModule, InstructorModule, CoversModule],
  controllers: [SupportSessionController, AgentsAdminController, AgentApiController],
  providers: [SupportSessionService, AgentTokensService, AgentUploadsService, AgentCoursesService],
})
export class AssistModule {}
