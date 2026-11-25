import { Global, Module } from '@nestjs/common';
import { CoversController } from './covers.controller';
import { CoversService } from './covers.service';

@Global()
@Module({ controllers: [CoversController], providers: [CoversService], exports: [CoversService] })
export class CoversModule {}
