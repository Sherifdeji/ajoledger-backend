import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  NombaWebhookPayload,
  NombaWebhookResult,
} from './interfaces/nomba-webhook-payload.interface';
import { NombaWebhookGuard } from './guards/nomba-webhook.guard';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('nomba')
  @UseGuards(NombaWebhookGuard)
  @HttpCode(HttpStatus.OK)
  async handleNombaWebhook(
    @Body() payload: NombaWebhookPayload,
  ): Promise<{ message: string; data: NombaWebhookResult }> {
    const data = await this.webhooksService.handleNombaWebhook(payload);
    return { message: 'Webhook received.', data };
  }
}
