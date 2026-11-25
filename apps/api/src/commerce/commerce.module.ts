import { Global, Module } from '@nestjs/common';
import { CommerceController, WebhooksController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { ConnectService } from './connect.service';
import { FulfilmentService } from './fulfilment.service';
import { PaymentsProcessor, PaymentsScheduler } from './payments.processor';
import { PayoutsService } from './payouts.service';
import { FinanceService } from '../admin/finance.service';
import { RefundsService } from './refunds.service';
import { StripeService } from './stripe.service';
import { WebhooksService } from './webhooks.service';

@Global()
@Module({
  controllers: [CommerceController, WebhooksController],
  providers: [FinanceService, CommerceService, ConnectService, FulfilmentService, PayoutsService, PaymentsProcessor, PaymentsScheduler, RefundsService, StripeService, WebhooksService],
  exports: [FinanceService, CommerceService, FulfilmentService, PayoutsService, RefundsService, StripeService],
})
export class CommerceModule {}
