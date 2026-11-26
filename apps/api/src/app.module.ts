import { ReviewsModule } from './reviews/reviews.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { ContactModule } from './contact/contact.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AssistModule } from './assist/assist.module';
import { AssistAuditInterceptor } from './assist/assist-audit.interceptor';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { PromotionsModule } from './promotions/promotions.module';
import { CoversModule } from './covers/covers.module';
import { SupportModule } from './support/support.module';
import { ProtectionModule } from './protection/protection.module';
import { HelpModule } from './help/help.module';
import { AuthGuard } from './common/auth.guard';
import { CommonModule } from './common/common.module';
import { CsrfCookieMiddleware, CsrfGuard } from './common/csrf';
import { AllExceptionsFilter } from './common/exception.filter';
import { CommerceModule } from './commerce/commerce.module';
import { InstructorModule } from './instructor/instructor.module';
import { LearningModule } from './learning/learning.module';
import { MediaModule } from './media/media.module';
import { PathsModule } from './paths/paths.module';

@Module({
  imports: [
    ContactModule,
    ReviewsModule,
    EnrollmentsModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    CommonModule,
    MediaModule,
    AuthModule,
    CatalogueModule,
    PromotionsModule,
    CoversModule,
    SupportModule,
    ProtectionModule,
    HelpModule,
    CommerceModule,
    LearningModule,
    InstructorModule,
    AdminModule,
    PathsModule,
    AssistModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: CSRF first (cheap, no DB), then session/roles.
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    // Support sessions and AI agents: every state-changing request is audited (docs/SUPPORT_SESSIONS_AND_AGENTS.md).
    { provide: APP_INTERCEPTOR, useClass: AssistAuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfCookieMiddleware).forRoutes('*path');
  }
}
