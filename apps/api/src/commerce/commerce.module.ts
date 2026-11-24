import { Global, Module } from '@nestjs/common';
import { CommerceController, WebhooksController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { ConnectService } from './connect.service';
import { FulfilmentService } from './fulfilment.service';
import { RefundsService } from './refunds.service';
import { StripeService } from './stripe.service';
import { WebhooksService } from './webhooks.service';

@Global()
@Module({
  controllers: [CommerceController, WebhooksController],
  providers: [CommerceService, ConnectService, FulfilmentService, RefundsService, StripeService, WebhooksService],
  exports: [FulfilmentService, RefundsService, StripeService],
})
export class CommerceModule {}
