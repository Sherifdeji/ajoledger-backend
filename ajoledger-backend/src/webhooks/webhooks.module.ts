import { Module } from '@nestjs/common';
import { NombaModule } from '../nomba/nomba.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { NombaWebhookGuard } from './guards/nomba-webhook.guard';

@Module({
  imports: [NombaModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, NombaWebhookGuard],
})
export class WebhooksModule {}
