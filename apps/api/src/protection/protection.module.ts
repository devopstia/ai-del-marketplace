import { Global, Module } from '@nestjs/common';
import { ProtectionController } from './protection.controller';
import { ProtectionService } from './protection.service';

@Global()
@Module({ controllers: [ProtectionController], providers: [ProtectionService], exports: [ProtectionService] })
export class ProtectionModule {}
