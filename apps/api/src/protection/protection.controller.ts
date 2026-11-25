import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../common/auth-context';
import type { AuthUser } from '../common/auth-context';
import { ProtectionService } from './protection.service';

/** Protected playback: the playlist and key for a live session, only for the signed-in person it belongs to. */
@Controller()
export class ProtectionController {
  constructor(private readonly svc: ProtectionService) {}

  @Get('playback/:sid/index.m3u8')
  @Header('Cache-Control', 'no-store')
  async manifest(@Param('sid') sid: string, @CurrentUser() u: AuthUser, @Res() res: Response) {
    const body = await this.svc.manifest(sid, u);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(body);
  }

  @Get('playback/:sid/key')
  @Header('Cache-Control', 'no-store')
  async key(@Param('sid') sid: string, @CurrentUser() u: AuthUser, @Res() res: Response) {
    const k = await this.svc.key(sid, u);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.end(k);
  }


  @Roles('admin') @Get('admin/playback/status')
  status() { return this.svc.status(); }
}
