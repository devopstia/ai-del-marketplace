import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { OAuthConfigController } from './oauth-config.controller';
import { OAuthConfigService } from './oauth-config.service';
import { SignInService } from './signin.service';

@Module({ controllers: [AuthController, OAuthConfigController], providers: [AuthService, SignInService, OAuthService, OAuthConfigService], exports: [AuthService, SignInService] })
export class AuthModule {}
