import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { NombaWebhookPayload } from '../interfaces/nomba-webhook-payload.interface';

interface RequestWithWebhookBody extends Request {
  body: NombaWebhookPayload;
}

@Injectable()
export class NombaWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithWebhookBody>();

    const signature = this.getSingleHeader(request, 'nomba-signature');
    const timestamp = this.getSingleHeader(request, 'nomba-timestamp');

    if (!signature || !timestamp) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const expectedSignature = this.generateSignature(
      request.body,
      this.configService.getOrThrow<string>('NOMBA_WEBHOOK_SECRET'),
      timestamp,
    );

    if (!this.signaturesMatch(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    return true;
  }

  private generateSignature(
    payload: NombaWebhookPayload,
    secret: string,
    timestamp: string,
  ): string {
    const merchant = payload.data?.merchant;
    const transaction = payload.data?.transaction;
    let transactionResponseCode = this.safe(transaction?.responseCode);

    if (transactionResponseCode.toLowerCase() === 'null') {
      transactionResponseCode = '';
    }

    const hashingPayload = [
      this.safe(payload.event_type),
      this.safe(payload.requestId),
      this.safe(merchant?.userId),
      this.safe(merchant?.walletId),
      this.safe(transaction?.transactionId),
      this.safe(transaction?.type),
      this.safe(transaction?.time),
      transactionResponseCode,
      timestamp,
    ].join(':');

    return crypto
      .createHmac('sha256', secret)
      .update(hashingPayload)
      .digest('base64');
  }

  private signaturesMatch(received: string, expected: string): boolean {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    return (
      receivedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    );
  }

  private getSingleHeader(request: Request, name: string): string | undefined {
    const value = request.headers[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  private safe(value: string | null | undefined): string {
    return value ?? '';
  }
}
