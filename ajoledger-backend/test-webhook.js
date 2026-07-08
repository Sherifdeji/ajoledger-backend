const crypto = require('crypto');
const http = require('http'); // Use 'https' if testing Render URL

// 1. Setup your target and secrets
const BASE_URL = 'http://localhost:3000'; // Change to your Render URL if testing production
const WEBHOOK_SECRET = 'NombaHackathon2026'; // Must match your .env NOMBA_WEBHOOK_SECRET

// 2. Pass the membershipId you want to mark as PAID
const membershipId = process.argv[2];

if (!membershipId) {
  console.error('\n❌ Please provide a membershipId as an argument.');
  console.error('Example: node test-webhook.js 966a0d0d-ec61-4c1c-a1ba-21e1d0dfa02b\n');
  process.exit(1);
}

const timestamp = new Date().toISOString();
const transactionId = `TEST-TX-${Date.now()}`;

// 3. Create the exact payload Nomba sends
const payload = {
  event_type: 'payment_success',
  requestId: `TEST-REQ-${Date.now()}`,
  data: {
    merchant: {
      userId: 'TEST-MERCHANT-ID',
      walletId: 'TEST-WALLET-ID'
    },
    transaction: {
      transactionId: transactionId,
      type: 'vact_transfer',
      time: timestamp,
      responseCode: '00',
      transactionAmount: 50000, // Naira (will be converted to 5,000,000 Kobo by backend)
      aliasAccountReference: membershipId // This routes the payment to the correct user!
    }
  }
};

// 4. Generate the HMAC SHA256 Signature
const hashingPayload = [
  payload.event_type,
  payload.requestId,
  payload.data.merchant.userId,
  payload.data.merchant.walletId,
  payload.data.transaction.transactionId,
  payload.data.transaction.type,
  payload.data.transaction.time,
  payload.data.transaction.responseCode,
  timestamp
].join(':');

const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(hashingPayload)
  .digest('base64');

// 5. Send the POST Request
const payloadString = JSON.stringify(payload);

const options = {
  hostname: BASE_URL.replace('http://', '').replace('https://', '').split(':')[0],
  port: BASE_URL.includes('localhost') ? 3000 : 443,
  path: '/api/v1/webhooks/nomba',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadString),
    'nomba-signature': signature,
    'nomba-timestamp': timestamp
  }
};

const req = (BASE_URL.includes('https') ? require('https') : http).request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`\n✅ Webhook Sent!`);
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response: ${data}\n`);
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Error sending webhook: ${e.message}\n`);
});

req.write(payloadString);
req.end();
