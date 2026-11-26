import { Global, Module } from '@nestjs/common';
import { CommerceController, WebhooksController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { ConnectService } from './connect.service';
import { FulfilmentService } from './fulfilment.service';
import { PaymentsProcessor, PaymentsScheduler } from './payments.processor';
import { PayoutsService } from './payouts.service';
import { FinanceService } from '../admin/finance.service';
import { RefundsService } from './refunds.service';
import { RefundPolicyService } from './refund-policy.service';
import { StripeService } from './stripe.service';
import { PaymentsConfigController } from './payments-config.controller';
import { PaymentsConfigService } from './payments-config.service';
import { AuthModule } from '../auth/auth.module';
import { WebhooksService } from './webhooks.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [CommerceController, WebhooksController, PaymentsConfigController],
  providers: [FinanceService, CommerceService, ConnectService, FulfilmentService, PayoutsService, PaymentsProcessor, PaymentsScheduler, RefundsService, RefundPolicyService, StripeService, WebhooksService, PaymentsConfigService],
  exports: [FinanceService, CommerceService, FulfilmentService, PayoutsService, RefundsService, RefundPolicyService, StripeService],
})
export class CommerceModule {}
