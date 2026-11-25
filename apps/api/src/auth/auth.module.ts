import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { SignInService } from './signin.service';

@Module({ controllers: [AuthController], providers: [AuthService, SignInService, OAuthService], exports: [AuthService, SignInService] })
export class AuthModule {}
