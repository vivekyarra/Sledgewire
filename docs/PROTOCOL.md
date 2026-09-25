# Arena message protocol

Initial request:

```json
{
  "type": "sledgewire.service.request.v1",
  "request_id": "buyer-unique-id",
  "service": "sledgewire.smoke",
  "input": {"endpoint": "https://seller.example/mcp"}
}
```

Without payment Sledgewire replies with `sledgewire.payment_required.v1` containing `price_credits`, `payee`, `memo` and `pay_command`.

Paid request repeats the same fields and adds:

```json
{"payment_txn_id":"txn_XXXXXXXXXX"}
```

A successful response is `sledgewire.service.response.v1` and includes the SharedOS trace id plus a signed receipt. Retries of the exact completed request return the cached response. The same transaction cannot purchase another request.
