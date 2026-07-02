> ## Documentation Index
> Fetch the complete documentation index at: https://developer.nomba.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Webhooks

> Learn how to interact with Nomba webhooks

## Overview

Webhooks allow your system to establish a communication channel with Nomba, usually via a public URL. When a payment event occurs on your account, Nomba will send a notification via this communication channel to notify you about this event.

Nomba will send a `POST`request to the public webhook URL containing the details of the event and header strictly for verifying that the webhook event originated from the Nomba system.

<Frame caption="Established webhook process flow">
  <img src="https://mintcdn.com/nombainc/VJp6uGRaVI4ms-qk/images/webhooks-1.png?fit=max&auto=format&n=VJp6uGRaVI4ms-qk&q=85&s=c18464f1d20d805a721f4748591b76bc" style={{ borderRadius: "0.5rem" }} loading="lazy" width="3840" height="3422" data-path="images/webhooks-1.png" />
</Frame>

This image shows an established communication via webhook URL between your system and Nomba.

<Note>
  It is good to note that, you must subscribe for the event type you want to get
  notified on.
</Note>

## Set up webhook event

To set up your webhooks, navigate to 'Developer' and click on 'Webhook Setup'. On this page you can set a live or test webhook URL and signature key. When you add a webhook URL, you can subscribe for the event you want to get notified on.

<Frame caption="Set up webhook on your dashboard">
  <img src="https://mintcdn.com/nombainc/dHZLqglLk2ofl5Fe/images/Webhook-setup.png?fit=max&auto=format&n=dHZLqglLk2ofl5Fe&q=85&s=79889c0b8312deaa1a5ac7fdd7765a45" style={{ borderRadius: "0.5rem" }} loading="lazy" width="2876" height="1716" data-path="images/Webhook-setup.png" />
</Frame>

<Note>
  Kindly ensure that your webhook URL is publicly available.
</Note>

## Supported Events

* **Payment Success** `payment_success` : Triggered when a payment is successfully credited to your Nomba account, e.g., Card transactions, Virtual account payments or  PayByTransfer.

* **Payout Success**  `payout_success` : Triggered when a payment is successfully debited from your account, e.g., funds transfer, bill payment.

* **Payment Failed** `payment_failed` : Triggered when a proposed payment attempt fails.

* **Payment Reversal**  `payment_reversal` : Triggered when a payment is reversed from your account back to the customer’s account.

* **Payout Failed**  `payout_failed` : Triggered when a payout transaction fails to process successfully and is not completed.

* **Payout Refund** `payout_refund` : Triggered when a payout is refunded back to your Nomba account.

### Webhook headers

Every webhook notification from Nomba includes special headers and a payload that matches the content of all supported event types. These headers will help you verify and process the request to ensure that it’s coming from Nomba, as a public URL can be accessed by anyone, so it’s to verify that all webhooks are from Nomba before giving value to your customers.

A typical webhook payload will come with the following Nomba-specific headers:

```http theme={null}
nomba-signature: 0zzATkAuEta5kpKVCExReupW/XglCk/re51P4jiDJ9c=
nomba-sig-value: 0zzATkAuEta5kpKVCExReupW/XglCk/re51P4jiDJ9c=
nomba-signature-algorithm: HmacSHA256
nomba-signature-version: 1.0.0
nomba-timestamp: 2023-03-31T05:56:47Z

```

| Header                      | Description                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `nomba-signature`           | A signature created using the signature key configured while creating the webhook on the Nomba dashboard                |
| `nomba-signature-algorithm` | The algorithm used to generate the signature. Value is always `HmacSHA256`                                              |
| `nomba-signature-version`   | The version of the signature used. Value is `1.0.0` at the moment. It will keep updating as the signing process updates |
| `nomba-timestamp`           | An `RFC-3339` timestamp that identifies when the payload was sent.                                                      |

<Tip>
  * The RFC-3339 format specifies that dates should be represented using the year,
    month, and day, separated by hyphens, followed by a "T" to separate the date
    from the time, and then the time represented in hours, minutes, and seconds,
    separated by colons, with an optional fractional second component. Example;
    2022-01-01T15:45:22Z
  * HTTP header names are case insensitive. Your client should convert all header
    names to a standardized lowercase or uppercase format before trying to
    determine the value of a header.
</Tip>

Since webhooks are simply HTTP POST requests, there’s a chance that malicious actors could try to send fake webhook events to your server. To protect you from this, Nomba signs each webhook payload using the signature key you set when creating the webhook. The generated signature is included in the request headers, so your server can verify that the request truly came from Nomba and not an attacker.

<Warning>
  We recommend configuring the signature key while creating a webhook URL. While
  this configuration is optional, it is important to configure the keys and
  verify the signature of the payloads in order to prevent DDoS or
  Man-in-the-Middle attacks.
</Warning>

### Webhook payload

The content of the payload is a JSON object and it gives details about the event that has been triggered.

| Field        | Type          | Description                                              |
| ------------ | ------------- | -------------------------------------------------------- |
| `event_type` | String        | The event type that was triggered                        |
| `request_id` | String (UUID) | A unique request identifier useful for tracking messages |
| `data`       | Object (JSON) | An object describing the details of the triggered event  |

<CodeGroup>
  ```json expandable Payment Success  theme={null}
  {
    "event_type": "payment_success",
    "requestId": "49e11b44-909b-4f83-82b4-9a83aXXXXXX",
    "data": {
      "merchant": {
        "walletId": "693e907aad9ea59616XXXX",
        "walletBalance": 539.4,
        "userId": "613bb620-c8e5-45f6-9c00-XXXXXXXX"
      },
      "terminal": {},
      "transaction": {
        "aliasAccountNumber": "967913XXX",
        "fee": 0.6,
        "sessionId": "1000042602061021531516XXXXXX",
        "type": "vact_transfer",
        "transactionId": "API-VACT_TRA-613BB-eeae578a-cdd4-459c-8bd5-XXXXXX",
        "aliasAccountName": "Peter/Peter Enterprise",
        "responseCode": "",
        "originatingFrom": "api",
        "transactionAmount": 120,
        "narration": "Transfer from JOHN GRASS",
        "time": "2026-02-06T10:21:56Z",
        "aliasAccountReference": "122320250916PM",
        "aliasAccountType": "VIRTUAL"
      },
      "customer": {
        "bankCode": "305",
        "senderName": "JOHN GRASS",
        "bankName": "Paycom (Opay)",
        "accountNumber": "81689XXX"
      }
    }
  }
  ```

  ```json expandable Payout Success theme={null}
  {
    "event_type": "payout_success",
    "requestId": "76a7df87-4819-493c-90ee-XXXXXXX",
    "data": {
      "merchant": {
        "walletId": "693e907aad9ea59XXXXX",
        "walletBalance": 420,
        "userId": "613bb620-c8e5-45f6-9c00-XXXXXXXX"
      },
      "terminal": {},
      "transaction": {
        "fee": 20,
        "sessionId": "09FG260206111644XXXXXX",
        "type": "transfer",
        "transactionId": "API-TRANSFER-057A0-21e353c0-4168-4275-8355-XXXXXX",
        "responseCode": "",
        "originatingFrom": "api",
        "merchantTxRef": "20260212130PM",
        "transactionAmount": 50,
        "narration": "For API Test ",
        "time": "2026-02-06T10:16:30Z"
      },
      "customer": {
        "bankCode": "011",
        "senderName": "Peter Okins",
        "recipientName": "JOHN GRASS",
        "bankName": "First Bank of Nigeria",
        "accountNumber": "31107XXXX"
      }
    }
  }
  ```

  ```json expandable Payment Failed theme={null}
  {
      "event_type": "payment_failed",
      "requestId": "7b28d6d1-f91e-46c3-b312-89e9XXXXXXX",
      "data": {
          "merchant": {
              "userId": "usr_71kd89e9XXXXXXX"
          },
          "terminal": {
              "terminalLabel": "IKEJA MALL",
              "terminalId": "3PLQXXX"
          },
          "transaction": {
              "fee": 150,
              "type": "purchase",
              "transactionId": "POS-PURCHASE-71KD9-ae67-91fe-4b6a-a45b-689e9XXXXXXX",
              "responseCodeMessage": "Insufficient Funds",
              "rrn": "2510089e9XXXXXXX5",
              "cardIssuer": "MASTERCARD",
              "responseCode": "51",
              "originatingFrom": "pos",
              "terminalSerialNumber": "91230989e9XXXXXXX",
              "cardBank": "058",
              "transactionAmount": 25000,
              "time": "2025-10-06T17:38:45Z"
          },
          "customer": {
              "productId": "058",
              "cardPan": "539983 **** **** 4297"
          }
      }
  }
  ```

  ```json expandable Payout Refund theme={null}
  {
      "event_type": "payout_refund",
      "requestId": "062bbb0f-ecaa-481a-9ae5-12f73fXXXXXX",
      "data": {
          "merchant": {
              "walletId": "67khagklfXXXXXX",
              "walletBalance": 45000,
              "userId": "e5e6987d-32ea-4d04-8c49-13fXXXXXX"
          },
          "terminal": {},
          "transaction": {
              "fee": 7,
              "sessionId": "090645251008183142932001fXXXXXX",
              "type": "transfer",
              "transactionId": "API-TRANSFER-9772C-bf28b3d1-e18f-4ecd-a33c-4fXXXXXX",
              "responseCode": "",
              "originatingFrom": "api",
              "merchantTxRef": "5TDL0CL7CP",
              "transactionAmount": 45000,
              "narration": "From Bidemi O",
              "time": "2025-10-08T19:00:33Z"
          },
          "customer": {
              "bankCode": "327",
              "senderName": "Test",
              "recipientName": "Test Technology Limited - MAKANJU FEMI",
              "bankName": "Paga",
              "accountNumber": "07937890XX"
          }
      }
  } 
  ```
</CodeGroup>

## Webhook signature verification

To make sure a webhook truly comes from Nomba and hasn’t been altered, each request we send includes a signature in the header. This signature is generated using your webhook payload and the secret key you set on your dashboard.

On your end, verification is straightforward:

1. **Re-create the signature** :
   Use the same secret key and payload to generate a hash - HMAC signature.

2. **Compare signatures** :
   Match your generated hash with the nomba-signature header we sent. If they’re the same, you can trust the webhook.

The tab below contains sample code demonstrating how to calculate the HMAC signature and compare it with the signature sent via the webhook.

<Tabs>
  <Tab title="GoLang">
    ```go expandable CalculateHMAC.go theme={null}
          package main

          import (
              "crypto/hmac"
              "crypto/sha256"
              "encoding/base64"
              "encoding/json"
              "fmt"
              "log"
              "strings"
          )

          // --- Struct Definitions for JSON Mapping ---

          type Payload struct {
              EventType string `json:"event_type"`
              RequestID string `json:"requestId"`
              Data      Data   `json:"data"`
          }

          type Data struct {
              Merchant    Merchant    `json:"merchant"`
              Terminal    map[string]interface{} `json:"terminal"`
              Transaction Transaction `json:"transaction"`
              Customer    Customer    `json:"customer"`
          }

          type Merchant struct {
              WalletID       string  `json:"walletId"`
              WalletBalance  float64 `json:"walletBalance"`
              UserID         string  `json:"userId"`
          }

          type Transaction struct {
              AliasAccountNumber   string  `json:"aliasAccountNumber"`
              Fee                  float64 `json:"fee"`
              SessionID            string  `json:"sessionId"`
              Type                 string  `json:"type"`
              TransactionID        string  `json:"transactionId"`
              AliasAccountName     string  `json:"aliasAccountName"`
              ResponseCode         string  `json:"responseCode"`
              OriginatingFrom      string  `json:"originatingFrom"`
              TransactionAmount    float64 `json:"transactionAmount"`
              Narration            string  `json:"narration"`
              Time                 string  `json:"time"`
              AliasAccountReference string `json:"aliasAccountReference"`
              AliasAccountType     string  `json:"aliasAccountType"`
          }

          type Customer struct {
              BankCode     string `json:"bankCode"`
              SenderName   string `json:"senderName"`
              BankName     string `json:"bankName"`
              AccountNumber string `json:"accountNumber"`
          }

          // --- Core Logic ---

          func main() {
              hooksCron2()
          }

          func hooksCron2() {
              payloadJSON := `
              {
              "event_type": "payment_success",
              "requestId": "45f2dc2d-d559-4773-bba3-2d5ec17b2e20",
              "data": {
                  "merchant": {
                  "walletId": "6756ff80aafe04a795f18b38",
                  "walletBalance": 6052,
                  "userId": "b7b10e81-e57d-41d0-8fdc-f4e23a132bbf"
                  },
                  "terminal": {},
                  "transaction": {
                  "aliasAccountNumber": "5343270516",
                  "fee": 5,
                  "sessionId": "IFAP-TRANSFER-46501-e0339485-1a2f-4b43-9bd5-fec9649e5928",
                  "type": "vact_transfer",
                  "transactionId": "API-VACT_TRA-B7B10-0435b274-807a-4bc7-8abe-9dbb4548fd7a",
                  "aliasAccountName": "ZAXBOX/EZENNA NWACHUKWU",
                  "responseCode": "",
                  "originatingFrom": "api",
                  "transactionAmount": 10,
                  "narration": "Habiblahi Hamzat Transfer 10.00 To ZAXBOX/EZENNA NWACHUKWU - Nomba",
                  "time": "2025-09-29T10:51:44Z",
                  "aliasAccountReference": "654f7c80bd4a510c90fb7f92",
                  "aliasAccountType": "VIRTUAL"
                  },
                  "customer": {
                  "bankCode": "090645",
                  "senderName": "Habiblahi Hamzat",
                  "bankName": "Nombank",
                  "accountNumber": "9617811496"
                  }
              }
              }`

              signatureValue := "Kt9095hQxfgmVbx6iz7G2tPhHdbdXgLlyY/mf35sptw="
              nombaTimeStamp := "2025-09-29T10:51:44Z"
              secret := "HkatexKDZg7CLWy96q5sfrVHSvtoz92B"

              mySig, err := generateSignature(payloadJSON, secret, nombaTimeStamp)
              if err != nil {
                  log.Fatalf("Error generating signature: %v", err)
              }

              log.Printf("Generated signature [%s]", mySig)
              log.Printf("Expected signature [%s]", signatureValue)

              if strings.EqualFold(signatureValue, mySig) {
                  log.Println(">>>>>>> Signatures match <<<<<<<<<")
              } else {
                  log.Println("<<<<<<<<< Signatures did not match >>>>>>>>>")
              }
          }

          func generateSignature(payloadJSON, secret, timeStamp string) (string, error) {
              var payload Payload
              if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
                  return "", fmt.Errorf("error parsing JSON payload: %w", err)
              }

              transaction := payload.Data.Transaction
              merchant := payload.Data.Merchant

              transactionResponseCode := transaction.ResponseCode
              if transactionResponseCode == "null" {
                  transactionResponseCode = ""
              }

              // Construct the exact signature payload as in Java
              hashingPayload := fmt.Sprintf(
                  "%s:%s:%s:%s:%s:%s:%s:%s:%s",
                  payload.EventType,
                  payload.RequestID,
                  merchant.UserID,
                  merchant.WalletID,
                  transaction.TransactionID,
                  transaction.Type,
                  transaction.Time,
                  transactionResponseCode,
                  timeStamp,
              )

              log.Printf("::: payload to hash --> [%s] :::", hashingPayload)

              // Generate HMAC SHA256 and encode Base64
              h := hmac.New(sha256.New, []byte(secret))
              h.Write([]byte(hashingPayload))
              hash := h.Sum(nil)

              return base64.StdEncoding.EncodeToString(hash), nil
          }
    ```
  </Tab>

  <Tab title="Python">
    ```python expandable CalculateHMAC.py theme={null}
        import json
        import hmac
        import hashlib
        import base64
        import logging

        logging.basicConfig(level=logging.INFO, format="%(message)s")

        def hooks_cron2():
            try:
                payload = """
                {
                "event_type": "payment_success",
                "requestId": "45f2dc2d-d559-4773-bba3-2XXXXXXXXXX",
                "data": {
                    "merchant": {
                    "walletId": "6756ff80aafe04a795f18b3XXXXXXXXXX",
                    "walletBalance": 6052,
                    "userId": "b7b10e81-e57d-41d0-8XXXXXXXXXX"
                    },
                    "terminal": {},
                    "transaction": {
                    "aliasAccountNumber": "5343270516",
                    "fee": 5,
                    "sessionId": "IFAP-TRANSFER-46501-e0339485-1a2f-4b43-9bXXXXXXXXXX",
                    "type": "vact_transfer",
                    "transactionId": "API-VACT_TRA-B7B10-0435b274-807a-4bc7-8abe-9dbXXXXXXXXXX",
                    "aliasAccountName": "SAMPLE/JOHN DOE",
                    "responseCode": "",
                    "originatingFrom": "api",
                    "transactionAmount": 10,
                    "narration": "John Doe Transfer 10.00 To ZAXBOX/EZENNA NWACHUKWU - Nomba",
                    "time": "2025-09-29T10:51:44Z",
                    "aliasAccountReference": "654f7c80bd4**10c90fb7f92",
                    "aliasAccountType": "VIRTUAL"
                    },
                    "customer": {
                    "bankCode": "090645",
                    "senderName": "John Doe",
                    "bankName": "Nombank",
                    "accountNumber": "0000000000"
                    }
                }
                }
                """

                signature_value = "Kt9095hQxfgmVbx6iz7G2tPhHdbdXgLlyY/mf35sptw="
                nomba_timestamp = "2025-09-29T10:51:44Z"
                secret = "sampleScret"

                my_sig = generate_signature(payload, secret, nomba_timestamp)

                logging.info(f"Generated signature [{my_sig}]")
                logging.info(f"Expected signature [{signature_value}]")

                if signature_value.lower() == my_sig.lower():
                    logging.info(">>>>>>> Signatures match <<<<<<<<<")
                else:
                    logging.info("<<<<<<<<< Signatures did not match >>>>>>>>>")

            except Exception as ex:
                logging.error(f"Error occurred while generating signature: {ex}")

        def generate_signature(payload: str, secret: str, timestamp: str) -> str:
            request_payload = json.loads(payload)

            data = request_payload.get("data", {})
            merchant = data.get("merchant", {})
            transaction = data.get("transaction", {})

            event_type = request_payload.get("event_type", "")
            request_id = request_payload.get("requestId", "")
            user_id = merchant.get("userId", "")
            wallet_id = merchant.get("walletId", "")
            transaction_id = transaction.get("transactionId", "")
            transaction_type = transaction.get("type", "")
            transaction_time = transaction.get("time", "")
            transaction_response_code = transaction.get("responseCode", "")

            if transaction_response_code == "null":
                transaction_response_code = ""

            # Construct the same hashing payload as in Java/Go
            hashing_payload = f"{event_type}:{request_id}:{user_id}:{wallet_id}:{transaction_id}:{transaction_type}:{transaction_time}:{transaction_response_code}:{timestamp}"

            logging.info(f"::: payload to hash --> [{hashing_payload}] :::")

            # Compute HMAC-SHA256 and Base64 encode it
            digest = hmac.new(secret.encode(), hashing_payload.encode(), hashlib.sha256).digest()
            signature = base64.b64encode(digest).decode()

            return signature

        if __name__ == "__main__":
            hooks_cron2()
    ```
  </Tab>

  <Tab title="Javascript">
    ```javascript expandable CalculateHMAC.js theme={null}
        import crypto from "crypto";

        async function hooksCron2() {
        try {
            const payload = `
            {
            "event_type": "payment_success",
            "requestId": "45f2dc2d-d559-4773-bba3-2XXXXXXXXXX",
            "data": {
                "merchant": {
                "walletId": "6756ff80aafe04XXXXXXXXXX",
                "walletBalance": 6052,
                "userId": "b7b10e81-**-**-**-f4e23a132bbf"
                },
                "terminal": {},
                "transaction": {
                "aliasAccountNumber": "5343270516",
                "fee": 5,
                "sessionId": "IFAP-TRANSFER-46501-e0339485-1a2f-4b43-9bd5-XXXXXXXXXX",
                "type": "vact_transfer",
                "transactionId": "API-VACT_TRA-B7B10-0435b274-807a-4bc7-8abe-9XXXXXXXXXX",
                "aliasAccountName": "SAMPLE/JOHN DOE",
                "responseCode": "",
                "originatingFrom": "api",
                "transactionAmount": 10,
                "narration": "John Does Transfer 10.00 To SAMPLE/JOHN DOE - Nomba",
                "time": "2025-09-29T10:51:44Z",
                "aliasAccountReference": "sampleAccountReference",
                "aliasAccountType": "VIRTUAL"
                },
                "customer": {
                "bankCode": "090645",
                "senderName": "John Does",
                "bankName": "Nombank",
                "accountNumber": "0000000000"
                }
            }
            }`;

            const signatureValue = "Kt9095hQxfgmVbx6iz7G2tPhHdbdXgLlyY/mf35sptw=";
            const nombaTimeStamp = "2025-09-29T10:51:44Z";
            const secret = "sampleSecret";

            const mySig = generateSignature(payload, secret, nombaTimeStamp);

            console.log(`Generated signature [${mySig}]`);
            console.log(`Expected signature [${signatureValue}]`);

            if (signatureValue.toLowerCase() === mySig.toLowerCase()) {
            console.log(">>>>>>> Signatures match <<<<<<<<<<<");
            } else {
            console.log("<<<<<<<<< Signatures did not match >>>>>>>>>");
            }
        } catch (ex) {
            console.error("Error occurred while generating signature:", ex.message);
        }
        }

        function generateSignature(payload, secret, timeStamp) {
        const requestPayload = JSON.parse(payload);
        const data = requestPayload.data || {};
        const merchant = data.merchant || {};
        const transaction = data.transaction || {};

        const eventType = requestPayload.event_type || "";
        const requestId = requestPayload.requestId || "";
        const userId = merchant.userId || "";
        const walletId = merchant.walletId || "";
        const transactionId = transaction.transactionId || "";
        const transactionType = transaction.type || "";
        const transactionTime = transaction.time || "";
        let transactionResponseCode = transaction.responseCode || "";

        if (transactionResponseCode === "null") {
            transactionResponseCode = "";
        }


        const hashingPayload = `${eventType}:${requestId}:${userId}:${walletId}:${transactionId}:${transactionType}:${transactionTime}:${transactionResponseCode}:${timeStamp}`;

        console.log(`::: payload to hash --> [${hashingPayload}] :::`);

        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(hashingPayload);
        const hash = hmac.digest("base64");

        return hash;
        }

        // Run
        hooksCron2();
    ```
  </Tab>

  <Tab title="Java">
    ```java expandable CalculateHMAC.java theme={null}
    import com.fasterxml.jackson.annotation.JsonProperty;
    import com.fasterxml.jackson.core.JsonProcessingException;
    import com.fasterxml.jackson.databind.ObjectMapper;
    import lombok.Data;
    import lombok.extern.slf4j.Slf4j;

    import javax.crypto.Mac;
    import javax.crypto.spec.SecretKeySpec;
    import java.util.Base64;

    @Slf4j
    public class NombaHooksRefactored {

        private static final ObjectMapper objectMapper = new ObjectMapper();

        public static void main(String[] args) throws Exception {
            new NombaHooksRefactored().hooksCron2();
        }

        public void hooksCron2() {
            try {
                String payload = """
                    {
                    "event_type": "payment_success",
                    "requestId": "45f2dc2d-d559-4773-bba3-2XXXXXXXXXX",
                    "data": {
                        "merchant": {
                        "walletId": "6756ff80aafe04aXXXXXXXXXX",
                        "walletBalance": 6052,
                        "userId": "b7b10e81-**-**-**-f4e23a132bbf"
                        },
                        "terminal": {},
                        "transaction": {
                        "aliasAccountNumber": "5343270516",
                        "fee": 5,
                        "sessionId": "IFAP-TRANSFER-46501-***-1a2f-4b43-9bd5-fec964XXXXXXXXXX28",
                        "type": "vact_transfer",
                        "transactionId": "API-VACT_TRA-B7B10-0435b274-807a-4bc7-8XXXXXXXXXX",
                        "aliasAccountName": "SAMPLE/JOHN DOE",
                        "responseCode": "",
                        "originatingFrom": "api",
                        "transactionAmount": 10,
                        "narration": "John Doe Transfer 10.00 To ZAXBOX/EZENNA NWACHUKWU - Nomba",
                        "time": "2025-09-29T10:51:44Z",
                        "aliasAccountReference": "654f7c80bd4***0c90fb7f92",
                        "aliasAccountType": "VIRTUAL"
                        },
                        "customer": {
                        "bankCode": "090645",
                        "senderName": "John Doe",
                        "bankName": "Nombank",
                        "accountNumber": "0000000000"
                        }
                    }
                    }
                    """;

                String signatureValue = "Kt9095hQxfgmVbx6iz7G2tPhHdbdXgLlyY/mf35sptw=";
                String nombaTimeStamp = "2025-09-29T10:51:44Z";
                String secret = "HkatexKDZg7CLWy96q5sfrVHSvtXXXXXXXXXXB";

                HookPayload hookPayload = objectMapper.readValue(payload, HookPayload.class);

                String mySig = generateSignature(hookPayload, secret, nombaTimeStamp);

                log.info("Generated signature [{}]", mySig);
                log.info("Expected signature [{}]", signatureValue);

                if (signatureValue.equalsIgnoreCase(mySig)) {
                    log.info(">>>>>>> Signatures match <<<<<<<<<");
                } else {
                    log.info("<<<<<<<<< Signatures did not match >>>>>>>>>");
                }

            } catch (Exception ex) {
                log.error("Error occurred while generating signature. Error message [{}]", ex.getMessage(), ex);
            }
        }

        public String generateSignature(HookPayload payload, String secret, String timeStamp) throws Exception {
            var data = payload.getData();
            var merchant = data.getMerchant();
            var transaction = data.getTransaction();

            String eventType = safe(payload.getEventType());
            String requestId = safe(payload.getRequestId());
            String userId = safe(merchant.getUserId());
            String walletId = safe(merchant.getWalletId());
            String transactionId = safe(transaction.getTransactionId());
            String transactionType = safe(transaction.getType());
            String transactionTime = safe(transaction.getTime());
            String transactionResponseCode = safe(transaction.getResponseCode());

            if ("null".equalsIgnoreCase(transactionResponseCode)) {
                transactionResponseCode = "";
            }

            String hashingPayload = String.format(
                    "%s:%s:%s:%s:%s:%s:%s:%s:%s",
                    eventType, requestId, userId, walletId,
                    transactionId, transactionType, transactionTime,
                    transactionResponseCode, timeStamp
            );

            log.info("::: payload to hash --> [{}] :::", hashingPayload);

            Mac sha256HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(), "HmacSHA256");
            sha256HMAC.init(secretKey);

            byte[] hash = sha256HMAC.doFinal(hashingPayload.getBytes());
            return Base64.getEncoder().encodeToString(hash);
        }

        private String safe(String value) {
            return value == null ? "" : value;
        }
    }

    // POJO Models (Strongly Typed Payload Classes)

    import com.fasterxml.jackson.annotation.JsonProperty;
    import lombok.Data;

    @Data
    public class HookPayload {
        @JsonProperty("event_type")
        private String eventType;

        @JsonProperty("requestId")
        private String requestId;

        @JsonProperty("data")
        private HookData data;
    }

    @Data
    class HookData {
        private Merchant merchant;
        private Transaction transaction;
        private Customer customer;
        private Object terminal;
    }

    @Data
    class Merchant {
        private String walletId;
        private Double walletBalance;
        private String userId;
    }

    @Data
    class Transaction {
        private String transactionId;
        private String type;
        private String time;
        private String responseCode;
    }

    @Data
    class Customer {
        private String bankCode;
        private String senderName;
        private String bankName;
        private String accountNumber;
    }
    ```
  </Tab>

  <Tab title="C#">
    ```csharp expandable CalculateHMAC.cs theme={null}
        using System;
        using System.Text;
        using System.Text.Json;
        using System.Text.Json.Serialization;
        using System.Security.Cryptography;

        public class HooksCron
        {
            public static void Main()
            {
                try
                {
                    var payload = @"
                    {
                    ""event_type"": ""payment_success"",
                    ""requestId"": ""45f2dc2d-d559-4773-bba3-2XXXXXXXXXX"",
                    ""data"": {
                        ""merchant"": {
                        ""walletId"": ""6756ff80aafe04a7XXXXXXXXXX"",
                        ""walletBalance"": 6052,
                        ""userId"": ""b7b10e81-e57d-41d0-8fdc-f4XXXXXXXXXX""
                        },
                        ""terminal"": {},
                        ""transaction"": {
                        ""aliasAccountNumber"": ""5343270516"",
                        ""fee"": 5,
                        ""sessionId"": ""IFAP-TRANSFER-46501-e0339485-1a2f-4b43-9bd5-feXXXXXXXXXX28"",
                        ""type"": ""vact_transfer"",
                        ""transactionId"": ""API-VACT_TRA-B7B10-0435b274-807a-4bc7-8abe-XXXXXXXXXXd7a"",
                        ""aliasAccountName"": ""ZAXBOX/EZENNA NWACHUKWU"",
                        ""responseCode"": """",
                        ""originatingFrom"": ""api"",
                        ""transactionAmount"": 10,
                        ""narration"": ""Habiblahi Hamzat Transfer 10.00 To ZAXBOX/EZENNA NWACHUKWU - Nomba"",
                        ""time"": ""2025-09-29T10:51:44Z"",
                        ""aliasAccountReference"": ""654XXXXXXXXXX92"",
                        ""aliasAccountType"": ""VIRTUAL""
                        },
                        ""customer"": {
                        ""bankCode"": ""090645"",
                        ""senderName"": ""Habiblahi Hamzat"",
                        ""bankName"": ""Nombank"",
                        ""accountNumber"": ""9617811496""
                        }
                    }
                    }";

                    var signatureValue = "Kt9095hQxfgmVbx6iz7G2tPhHdbdXgLlyY/mf35sptw=";
                    var nombaTimestamp = "2025-09-29T10:51:44Z";
                    var secret = "HkatexKDZg7CLWy96q5sfrVH92B";

                    // Deserialize payload into object model
                    var requestPayload = JsonSerializer.Deserialize<HookPayload>(payload);

                    var mySig = GenerateSignature(requestPayload, secret, nombaTimestamp);

                    Console.WriteLine($"Generated signature [{mySig}]");
                    Console.WriteLine($"Expected signature [{signatureValue}]");

                    if (string.Equals(signatureValue, mySig, StringComparison.OrdinalIgnoreCase))
                    {
                        Console.WriteLine(">>>>>>> Signatures match <<<<<<<<<");
                    }
                    else
                    {
                        Console.WriteLine("<<<<<<<<< Signatures did not match >>>>>>>>>");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error occurred while generating signature. Error: {ex.Message}");
                }
            }

            public static string GenerateSignature(HookPayload payload, string secret, string timestamp)
            {
                var data = payload.Data;
                var merchant = data.Merchant;
                var transaction = data.Transaction;

                string eventType = payload.EventType ?? "";
                string requestId = payload.RequestId ?? "";
                string userId = merchant?.UserId ?? "";
                string walletId = merchant?.WalletId ?? "";
                string transactionId = transaction?.TransactionId ?? "";
                string transactionType = transaction?.Type ?? "";
                string transactionTime = transaction?.Time ?? "";
                string transactionResponseCode = transaction?.ResponseCode ?? "";

                if (transactionResponseCode == "null")
                {
                    transactionResponseCode = "";
                }

                var hashingPayload = $"{eventType}:{requestId}:{userId}:{walletId}:{transactionId}:{transactionType}:{transactionTime}:{transactionResponseCode}:{timestamp}";
                Console.WriteLine($"::: payload to hash --> [{hashingPayload}] :::");

                using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
                var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(hashingPayload));
                var signature = Convert.ToBase64String(hash);

                return signature;
            }
        }

        #region Models

        public class HookPayload
        {
            [JsonPropertyName("event_type")]
            public string? EventType { get; set; }

            [JsonPropertyName("requestId")]
            public string? RequestId { get; set; }

            [JsonPropertyName("data")]
            public HookData Data { get; set; } = new();
        }

        public class HookData
        {
            [JsonPropertyName("merchant")]
            public Merchant? Merchant { get; set; }

            [JsonPropertyName("transaction")]
            public Transaction? Transaction { get; set; }

            [JsonPropertyName("customer")]
            public Customer? Customer { get; set; }

            [JsonPropertyName("terminal")]
            public object? Terminal { get; set; }
        }

        public class Merchant
        {
            [JsonPropertyName("walletId")]
            public string? WalletId { get; set; }

            [JsonPropertyName("walletBalance")]
            public decimal? WalletBalance { get; set; }

            [JsonPropertyName("userId")]
            public string? UserId { get; set; }
        }

        public class Transaction
        {
            [JsonPropertyName("transactionId")]
            public string? TransactionId { get; set; }

            [JsonPropertyName("type")]
            public string? Type { get; set; }

            [JsonPropertyName("time")]
            public string? Time { get; set; }

            [JsonPropertyName("responseCode")]
            public string? ResponseCode { get; set; }
        }

        public class Customer
        {
            [JsonPropertyName("bankCode")]
            public string? BankCode { get; set; }

            [JsonPropertyName("senderName")]
            public string? SenderName { get; set; }

            [JsonPropertyName("bankName")]
            public string? BankName { get; set; }

            [JsonPropertyName("accountNumber")]
            public string? AccountNumber { get; set; }
        }

        #endregion     
    ```
  </Tab>

  <Tab title="php">
    <Note>
      This code samples is supported in php
    </Note>

    ```php expandable CalculateHMAC.php theme={null}
        <?php

        function hooksCron2() {
            try {
                $payload = <<<JSON
                {
                "event_type": "payment_success",
                "requestId": "45f2dc2d-d559-4773-bba3-2XXXXXXXXXX",
                "data": {
                    "merchant": {
                    "walletId": "6756ff80aafe04a7XXXXXXXXXX",
                    "walletBalance": 6052,
                    "userId": "b7b10e81-***-41d0-***-f4e23a132bbf"
                    },
                    "terminal": {},
                    "transaction": {
                    "aliasAccountNumber": "5343270516",
                    "fee": 5,
                    "sessionId": "IFAP-TRANSFER-46501-e0339485-1a2f-4b43-9bd5-XXXXXXXXXX8",
                    "type": "vact_transfer",
                    "transactionId": "API-VACT_TRA-B7B10-0435b274-807a-4bc7-8abe-XXXXXXXXXX",
                    "aliasAccountName": "SAMPLE/JOHN DOE",
                    "responseCode": "",
                    "originatingFrom": "api",
                    "transactionAmount": 10,
                    "narration": "Joh Doe Transfer 10.00 To SAMPLE/JOHN DOE - Nomba",
                    "time": "2025-09-29T10:51:44Z",
                    "aliasAccountReference": "654f7c80b****510c90f***2",
                    "aliasAccountType": "VIRTUAL"
                    },
                    "customer": {
                    "bankCode": "090645",
                    "senderName": "John Doe",
                    "bankName": "Nombank",
                    "accountNumber": "0000000000"
                    }
                }
                }
                JSON;

                $signatureValue = "Kt9095hQxfgmVbx6iz7G2tPhHdbdXgLlyY/mf35sptw=";
                $nombaTimeStamp = "2025-09-29T10:51:44Z";
                $secret = "SampleSecret";

                $mySig = generateSignature($payload, $secret, $nombaTimeStamp);

                echo "Generated signature [{$mySig}]\n";
                echo "Expected signature [{$signatureValue}]\n";

                if (strcasecmp($signatureValue, $mySig) === 0) {
                    echo ">>>>>>> Signatures match <<<<<<<<<\n";
                } else {
                    echo "<<<<<<<<< Signatures did not match >>>>>>>>>\n";
                }
            } catch (Exception $ex) {
                echo "Error occurred while generating signature: {$ex->getMessage()}\n";
            }
        }

        function generateSignature($payload, $secret, $timeStamp) {
            $requestPayload = json_decode($payload, true);

            $data = $requestPayload['data'] ?? [];
            $merchant = $data['merchant'] ?? [];
            $transaction = $data['transaction'] ?? [];

            $eventType = $requestPayload['event_type'] ?? '';
            $requestId = $requestPayload['requestId'] ?? '';
            $userId = $merchant['userId'] ?? '';
            $walletId = $merchant['walletId'] ?? '';
            $transactionId = $transaction['transactionId'] ?? '';
            $transactionType = $transaction['type'] ?? '';
            $transactionTime = $transaction['time'] ?? '';
            $transactionResponseCode = $transaction['responseCode'] ?? '';

            if ($transactionResponseCode === "null") {
                $transactionResponseCode = '';
            }

            // Construct payload string same as Java's String.format(SIG_FORMAT, data, timeStamp)
            $hashingPayload = sprintf(
                "%s:%s:%s:%s:%s:%s:%s:%s:%s",
                $eventType,
                $requestId,
                $userId,
                $walletId,
                $transactionId,
                $transactionType,
                $transactionTime,
                $transactionResponseCode,
                $timeStamp
            );

            echo "::: payload to hash --> [{$hashingPayload}] :::\n";

            // Generate HMAC SHA256 and encode in Base64
            $hash = hash_hmac('sha256', $hashingPayload, $secret, true);
            return base64_encode($hash);
        }

        // Run
        hooksCron2();
    ```
  </Tab>
</Tabs>

## Idempotency in Nomba

Nomba allows you to pass an idempotency key using the `X-Idempotent-key` header. This helps prevent duplicate requests when the first request fails due to issues like network interruptions.

Although our system already handles idempotency internally, we recommend that you include an idempotency key when calling endpoints such as Bank Transfer.

For example, if a bank transfer request succeeds but the confirmation is lost, resending the same request with the same idempotency key ensures that:

* Only the first request is processed.

* A duplicate request will either return the original response if identical or throw an error if different.

This keeps your transactions safe and predictable by avoiding accidental duplicate transfers.

<Warning>
  Always use a unique idempotency key for each request. This is best practice to ensure consistent behavior.
</Warning>

The following examples show how to generate a unique keys in popular programming languages.

<CodeGroup>
  ```go unique_key.go theme={null}
  package main

  import (
  	"fmt"
  	"github.com/google/uuid"
  )

  func main() {
  	idempotentKey := uuid.New().String()
  	fmt.Println(idempotentKey)
  }
  ```

  ```javascript unique_key.js theme={null}
  const { v4: uuidv4 } = require('uuid');
  const idempotentKey = uuidv4();
  console.log(idempotentKey);
  ```

  ```python unique_key.py theme={null}
  import uuid
  idempotent_key = str(uuid.uuid4())
  print(idempotent_key)
  ```

  ```java unique_key.java theme={null}
  import java.util.UUID;
  String idempotentKey = UUID.randomUUID().toString();
  System.out.println(idempotentKey);
  ```

  ```cs unique_key.cs theme={null}
  using System;

  string idempotentKey = Guid.NewGuid().ToString();
  Console.WriteLine(idempotentKey);
  ```
</CodeGroup>

## Retrying Failed Webhooks

When a webhook fails to deliver because the receiving server does not return a `2XX` status code, Nomba automatically retries the request using an exponential backoff policy. This approach spaces out retries with increasing delays, preventing your server from being overwhelmed while still ensuring delivery. Both `4XX` client errors and `5XX` server errors will trigger this retry flow. After the first failed attempt, Nomba will make up to five additional attempts to re-deliver the webhook.

The table below gives proper perspective into how failed webhooks would be retried.

| No of Retries | WaitTime (in Seconds) | WaitTime (in Mins) |
| ------------- | --------------------- | ------------------ |
| 1             | `120 secs`            | `2 mins`           |
| 2             | `280 secs`            | `~ 5 mins`         |
| 3             | `640 secs`            | `~ 11 mins`        |
| 4             | `1440 secs`           | `24 mins`          |
| 5             | `3200 secs`           | `~ 53 mins`        |
