import { Module } from '@nestjs/common';
import { AdminPromotionsController, InstructorPromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({ controllers: [InstructorPromotionsController, AdminPromotionsController], providers: [PromotionsService] })
export class PromotionsModule {}
