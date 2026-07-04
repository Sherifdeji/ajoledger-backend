export interface NombaWebhookPayload {
  event_type?: string;
  requestId?: string;
  data?: NombaWebhookData;
}

export interface NombaWebhookData {
  merchant?: NombaWebhookMerchant;
  transaction?: NombaWebhookTransaction;
  customer?: NombaWebhookCustomer;
  terminal?: Record<string, unknown>;
}

export interface NombaWebhookMerchant {
  walletId?: string;
  walletBalance?: number;
  userId?: string;
}

export interface NombaWebhookTransaction {
  aliasAccountNumber?: string;
  fee?: number;
  sessionId?: string;
  type?: string;
  transactionId?: string;
  aliasAccountName?: string;
  responseCode?: string | null;
  originatingFrom?: string;
  transactionAmount?: number | string;
  narration?: string;
  time?: string;
  aliasAccountReference?: string;
  aliasAccountType?: string;
  merchantTxRef?: string;
}

export interface NombaWebhookCustomer {
  bankCode?: string;
  senderName?: string;
  bankName?: string;
  accountNumber?: string;
  recipientName?: string;
}

export interface NombaWebhookResult {
  status: 'processed' | 'ignored' | 'duplicate';
  reason?: string;
  paymentId?: string;
  contributionId?: string;
  payoutId?: string;
}

