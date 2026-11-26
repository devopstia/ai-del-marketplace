import { Module } from '@nestjs/common';
import { AdminPathsController, MyPathsController, PathsController } from './paths.controller';
import { PathsService } from './paths.service';

/** Career paths (owner 2026-11-26, idea 4; docs/CAREER_PATHS.md). */
@Module({ controllers: [PathsController, MyPathsController, AdminPathsController], providers: [PathsService] })
export class PathsModule {}
