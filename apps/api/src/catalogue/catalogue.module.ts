import { Module } from '@nestjs/common';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';
import { RelatedCoursesController } from './related-courses.controller';
import { RelatedCoursesService } from './related-courses.service';

@Module({ controllers: [CatalogueController, RelatedCoursesController], providers: [CatalogueService, RelatedCoursesService], exports: [RelatedCoursesService] })
export class CatalogueModule {}
