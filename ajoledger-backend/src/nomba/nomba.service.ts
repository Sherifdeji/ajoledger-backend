import {
  BadRequestException,
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

export interface NombaStaticVirtualAccount {
  accountReference: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
}

export interface NombaBankTransferResult {
  transactionRef: string;
  status: string; // SUCCESS | PENDING_BILLING | REFUND
}

interface NombaApiResponse<T> {
  code: string;
  description?: string;
  data: T;
}

interface NombaVirtualAccountResponseData {
  accountId?: string;
  accountReference?: string;
  accountRef?: string;
  bankAccountNumber?: string;
  accountNumber?: string;
  bankAccountName?: string;
  accountName?: string;
  bankName?: string;
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
  private readonly parentAccountId: string;
  private readonly teamSubAccountId: string;

  /** In-memory token cache — sufficient for a single-instance hackathon server. */
  private tokenCache: NombaTokenCache | null = null;

  /**
   * In-memory bank list cache.
   * Bank codes change at most a few times per year — a server restart clears
   * the cache, which is acceptable for a hackathon single-instance setup.
   */
  private cachedBanks: { bankCode: string; bankName: string }[] = [];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.getOrThrow<string>('NOMBA_BASE_URL');
    this.clientId = this.configService.getOrThrow<string>('NOMBA_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>(
      'NOMBA_CLIENT_SECRET',
    );
    this.parentAccountId = this.configService.getOrThrow<string>('NOMBA_PARENT_ACCOUNT_ID');
    this.teamSubAccountId = this.configService.getOrThrow<string>('NOMBA_SUB_ACCOUNT_ID');
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
    // accountId header is required on ALL Nomba requests, including token issuance.
    // Payload must use snake_case keys + grant_type per Nomba's OAuth 2.0 spec.
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v1/auth/token/issue`,
          {
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
          },
          {
            headers: {
              accountId: this.parentAccountId,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      this.assertNombaSuccess(response.data, 'token/issue');
      this.logger.log('Nomba access token issued successfully.');
      return this.cacheToken(response.data.data);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: unknown };
        message?: string;
      };
      this.logger.error(
        'Nomba token/issue failed:',
        axiosError.response?.data ?? axiosError.message ?? error,
      );
      throw error;
    }
  }

  private async refreshToken(refreshToken: string): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/v1/auth/token/refresh`,
        { refreshToken },
        { headers: this.parentAccountHeaders(this.tokenCache?.accessToken) },
      ),
    );

    this.assertNombaSuccess(response.data, 'token/refresh');
    return this.cacheToken(response.data.data);
  }

  private cacheToken(data: Record<string, unknown>): string {
    // Nomba may return either:
    //   expires_in  — seconds from now (standard OAuth 2.0)
    //   expiresAt   — absolute Unix seconds
    // Handle both defensively. Log whichever field we receive.
    let expiresAtMs: number;

    if (typeof data.expires_in === 'number') {
      expiresAtMs = Date.now() + data.expires_in * 1_000;
      this.logger.log(`Token expires_in=${data.expires_in}s`);
    } else if (typeof data.expiresAt === 'number') {
      expiresAtMs = data.expiresAt * 1_000;
      this.logger.log(`Token expiresAt=${data.expiresAt}`);
    } else {
      // Fallback: treat token as valid for 25 minutes (Nomba default is 30)
      this.logger.warn(
        'Nomba token response missing expiry field — defaulting to 25 min TTL.',
      );
      expiresAtMs = Date.now() + 25 * 60 * 1_000;
    }

    this.tokenCache = {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token ?? '') as string,
      expiresAt: expiresAtMs,
    };
    return this.tokenCache.accessToken;
  }



  /**
   * Creates a static virtual account for one membership inside a group vault.
   * The Nomba account reference is exactly the Membership.id so webhook
   * aliasAccountReference can route inflows without ambiguity.
   */
  async createStaticVirtualAccount(params: {
    membershipId: string;
    customerEmail: string;
    customerName: string;
    bvn?: string;
  }): Promise<NombaStaticVirtualAccount> {
    const response = await firstValueFrom(
      this.httpService.post<NombaApiResponse<NombaVirtualAccountResponseData>>(
        `${this.baseUrl}/v1/accounts/virtual/${this.teamSubAccountId}`,
        {
          accountRef: params.membershipId,
          accountName: params.customerName,
          email: params.customerEmail,
          phoneNumber: '08000000000', // Dummy phone number as AjoLedger doesn't store phone
          bvn: params.bvn ?? '22222222222', // Dummy BVN for sandbox
          currency: 'NGN',
        },
        { headers: await this.authHeaders() },
      ),
    );

    this.assertNombaSuccess(response.data, 'accounts/virtual/membership');

    const d = response.data.data;
    const returnedReference = d.accountReference ?? d.accountRef;

    if (returnedReference && returnedReference !== params.membershipId) {
      this.logger.error(
        `Nomba returned mismatched account reference. expected=${params.membershipId} actual=${returnedReference}`,
      );
      throw new InternalServerErrorException(
        'Payment provider returned an invalid virtual account reference.',
      );
    }

    return {
      accountReference: returnedReference ?? params.membershipId,
      accountNumber:
        d.bankAccountNumber ??
        d.accountNumber ??
        this.throwMissingNombaField('accountNumber'),
      accountName:
        d.bankAccountName ??
        d.accountName ??
        this.throwMissingNombaField('accountName'),
      bankName: d.bankName ?? this.throwMissingNombaField('bankName'),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Bank Utilities (List + Account Resolution)
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns the list of supported Nigerian banks with their CBN bank codes.
   * Result is cached in-memory after the first successful call to avoid
   * hitting Nomba rate limits on every app load.
   */
  async getBanks(): Promise<{ bankCode: string; bankName: string }[]> {
    if (this.cachedBanks.length > 0) {
      return this.cachedBanks;
    }

    // Nomba API: GET /v1/transfers/banks
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/v1/transfers/banks`, {
          headers: await this.authHeaders(),
        }),
      );

      this.assertNombaSuccess(response.data, 'transfers/banks');

      // Defensive extraction — Nomba's exact nesting depth varies between
      // environments. Try data.results first, then data[], then the payload root.
      const payload = response.data;
      const rawBanksArray =
        payload?.data?.results ?? payload?.data ?? payload ?? [];

      if (!Array.isArray(rawBanksArray)) {
        this.logger.error(
          `Nomba banks endpoint returned an unexpected structure: ${JSON.stringify(payload)}`,
        );
        // Return empty array — mobile app sees an empty list rather than a 500
        return [];
      }

      const banks: { bankCode: string; bankName: string }[] = (
        rawBanksArray as Array<Record<string, unknown>>
      ).map((b) => ({
        bankCode: String(b.code ?? ''),
        bankName: String(b.name ?? ''),
      }));

      this.cachedBanks = banks;
      this.logger.log(`Bank list cached. count=${banks.length}`);
      return banks;
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: unknown };
        message?: string;
      };
      this.logger.error(
        'Nomba transfers/banks failed:',
        axiosError.response?.data ?? axiosError.message ?? error,
      );
      throw error;
    }
  }

  /**
   * Resolves an account name from a bank code + NUBAN account number.
   * Throws BadRequestException if Nomba cannot find the account —
   * this is a user-input error, not a server fault.
   */
  async resolveAccount(bankCode: string, accountNumber: string): Promise<any> {
    const token = await this.getAccessToken();
    const payload = {
      accountNumber: String(accountNumber),
      bankCode: String(bankCode),
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/v1/transfers/bank/lookup`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              accountId: this.parentAccountId,
            },
          },
        ),
      );

      if (response.data.code !== '00') {
        this.logger.warn(
          `Account resolution failed. bankCode=${bankCode} account=${accountNumber} ` +
            `code=${response.data.code} description=${response.data.description ?? ''}`,
        );
        throw new BadRequestException(
          'Account not found. Check the bank code and account number and try again.',
        );
      }

      const responseData = response.data.data;
      const accountName =
        responseData?.accountName ?? responseData?.account_name;

      if (!accountName) {
        this.logger.error(
          `Nomba resolved account but returned no name. bankCode=${bankCode} account=${accountNumber} ` +
            `raw=${JSON.stringify(response.data.data)}`,
        );
        throw new InternalServerErrorException(
          'Payment provider resolved the account but did not return a name.',
        );
      }

      return responseData;
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: unknown; status?: number };
        message?: string;
      };
      if (axiosError.response?.status) {
        this.logger.error(
          `Nomba bank/lookup HTTP ${axiosError.response.status}:`,
          axiosError.response.data,
        );
      }
      throw error;
    }
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
        `${this.baseUrl}/v2/transfers/bank/${this.teamSubAccountId}`,
        {
          amount: this.koboToNombaAmount(params.amount),
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

  /**
   * Disburses an Ajo cycle payout to the round winner's bank account.
   *
   * Thin domain-named wrapper over initiateBankTransfer() — no logic duplication.
   * Callers must pass amountKobo AFTER the ₦20 (2000 kobo) network fee deduction.
   *
   * Returns status: SUCCESS | PENDING_BILLING | REFUND
   * - SUCCESS: transfer complete; webhook confirmation is advisory.
   * - PENDING_BILLING: transfer queued; wait for payout_success webhook to advance round.
   * - REFUND: transfer failed and refunded; safe to retry after investigation.
   */
  async disbursePayout(params: {
    merchantTxRef: string;
    amountKobo: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    narration: string;
  }): Promise<NombaBankTransferResult> {
    return this.initiateBankTransfer({
      merchantTxRef: params.merchantTxRef,
      amount: params.amountKobo,
      destinationBankCode: params.bankCode,
      destinationAccountNumber: params.accountNumber,
      destinationAccountName: params.accountName,
      narration: params.narration,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return this.parentAccountHeaders(token);
  }

  private parentAccountHeaders(token?: string): Record<string, string> {
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      accountId: this.parentAccountId,
      'Content-Type': 'application/json',
    };
  }

  koboToNombaAmount(amountKobo: number): number {
    if (!Number.isInteger(amountKobo) || amountKobo <= 0) {
      throw new InternalServerErrorException(
        'Invalid internal payment amount.',
      );
    }

    return Number((amountKobo / 100).toFixed(2));
  }

  nombaAmountToKobo(amount: number | string): number {
    if (typeof amount === 'string') {
      return this.decimalStringToKobo(amount);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InternalServerErrorException(
        'Invalid payment provider amount.',
      );
    }

    const amountKobo = Math.round(amount * 100);
    if (Math.abs(amount * 100 - amountKobo) > Number.EPSILON * 100) {
      throw new InternalServerErrorException(
        'Payment provider amount has invalid precision.',
      );
    }

    return amountKobo;
  }

  private decimalStringToKobo(amount: string): number {
    const normalized = amount.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      throw new InternalServerErrorException(
        'Payment provider amount has invalid precision.',
      );
    }

    const [nairaPart, koboPart = ''] = normalized.split('.');
    const amountKobo =
      Number(nairaPart) * 100 + Number(koboPart.padEnd(2, '0'));

    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
      throw new InternalServerErrorException(
        'Invalid payment provider amount.',
      );
    }

    return amountKobo;
  }

  private throwMissingNombaField(field: string): never {
    this.logger.error(`Nomba response missing required field: ${field}`);
    throw new InternalServerErrorException(
      'Payment provider returned an incomplete virtual account response.',
    );
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
