import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface NombaTokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
}

export interface NombaVirtualAccount {
  nombaAccountId: string; // Nomba's internal account ID
  bankAccountNumber: string;
  bankAccountName: string;
  bankName: string;
}

export interface NombaBankTransferResult {
  transactionRef: string;
  status: string; // SUCCESS | PENDING_BILLING | REFUND
}

/**
 * Adapter for the Nomba REST API.
 *
 * Responsibilities:
 *  - OAuth2 token lifecycle (issue + proactive refresh, in-memory cache)
 *  - Virtual account provisioning for group vaults
 *  - Bank transfer initiation for payouts
 *
 * All credentials are read exclusively from ConfigService — never hardcoded.
 * Always check response.code === '00' before trusting response.data (Nomba pattern).
 */
@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly accountId: string;

  /** In-memory token cache — sufficient for a single-instance hackathon server. */
  private tokenCache: NombaTokenCache | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.getOrThrow<string>('NOMBA_BASE_URL');
    this.clientId = this.configService.getOrThrow<string>('NOMBA_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'NOMBA_CLIENT_SECRET',
    );
    this.accountId = this.configService.getOrThrow<string>('NOMBA_ACCOUNT_ID');
  }

  // ─────────────────────────────────────────────────────────────
  // Token Management
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns a valid access token, issuing or refreshing as needed.
   * Refreshes proactively 60 seconds before expiry.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    const REFRESH_BUFFER_MS = 60_000;

    if (
      this.tokenCache &&
      now < this.tokenCache.expiresAt - REFRESH_BUFFER_MS
    ) {
      return this.tokenCache.accessToken;
    }

    if (this.tokenCache?.refreshToken) {
      try {
        return await this.refreshToken(this.tokenCache.refreshToken);
      } catch {
        this.logger.warn('Token refresh failed — re-issuing from credentials.');
      }
    }

    return this.issueToken();
  }

  private async issueToken(): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/v1/auth/token/issue`, {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      }),
    );

    this.assertNombaSuccess(response.data, 'token/issue');
    return this.cacheToken(response.data.data);
  }

  private async refreshToken(refreshToken: string): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/v1/auth/token/refresh`,
        { refreshToken },
        { headers: await this.authHeaders() },
      ),
    );

    this.assertNombaSuccess(response.data, 'token/refresh');
    return this.cacheToken(response.data.data);
  }

  private cacheToken(data: {
    access_token: string;
    refresh_token: string;
    expiresAt: number;
  }): string {
    this.tokenCache = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      // Nomba returns expiresAt in seconds — convert to ms
      expiresAt: data.expiresAt * 1000,
    };
    return this.tokenCache.accessToken;
  }

  // ─────────────────────────────────────────────────────────────
  // Virtual Account Provisioning
  // ─────────────────────────────────────────────────────────────

  /**
   * Creates a Nomba virtual account (static) to serve as a group's savings vault.
   * The account is static (no expiry) because groups receive contributions
   * across multiple rounds over time.
   *
   * @param accountRef  Unique, stable reference — we use the groupId.
   * @param accountName Human-readable name shown on the virtual account.
   */
  async createVirtualAccount(
    accountRef: string,
    accountName: string,
  ): Promise<NombaVirtualAccount> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/v1/accounts/virtual`,
        {
          accountRef,
          accountName,
          currency: 'NGN',
        },
        { headers: await this.authHeaders() },
      ),
    );

    this.assertNombaSuccess(response.data, 'accounts/virtual');

    const d = response.data.data;
    return {
      nombaAccountId: d.accountId,
      bankAccountNumber: d.bankAccountNumber,
      bankAccountName: d.bankAccountName,
      bankName: d.bankName,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Bank Transfer (Payout Disbursement)
  // ─────────────────────────────────────────────────────────────

  /**
   * Initiates a bank transfer from the group's virtual account to a beneficiary.
   * Uses v2 transfers endpoint with a unique merchantTxRef for idempotency.
   *
   * Status returned can be SUCCESS, PENDING_BILLING, or REFUND.
   * Callers must handle PENDING_BILLING by waiting for the payout_success webhook.
   */
  async initiateBankTransfer(params: {
    merchantTxRef: string;
    amount: number; // kobo
    destinationBankCode: string;
    destinationAccountNumber: string;
    destinationAccountName: string;
    narration: string;
  }): Promise<NombaBankTransferResult> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/v2/transfers/bank`,
        {
          amount: params.amount,
          currency: 'NGN',
          destinationBankCode: params.destinationBankCode,
          destinationAccountNumber: params.destinationAccountNumber,
          destinationAccountName: params.destinationAccountName,
          merchantTxRef: params.merchantTxRef,
          narration: params.narration,
        },
        {
          headers: {
            ...(await this.authHeaders()),
            'X-Idempotent-key': params.merchantTxRef,
          },
        },
      ),
    );

    this.assertNombaSuccess(response.data, 'transfers/bank');

    const d = response.data.data;
    return {
      transactionRef: d.transactionRef ?? params.merchantTxRef,
      status: d.status,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      accountId: this.accountId,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Nomba always returns HTTP 200 — the actual success/error signal
   * is the `code` field in the body. code === '00' means success.
   */
  private assertNombaSuccess(
    body: { code: string; description?: string },
    context: string,
  ): void {
    if (body.code !== '00') {
      this.logger.error(
        `Nomba API error [${context}]: code=${body.code} description=${body.description}`,
      );
      throw new InternalServerErrorException(
        `Payment provider error during ${context}. Please try again.`,
      );
    }
  }
}
