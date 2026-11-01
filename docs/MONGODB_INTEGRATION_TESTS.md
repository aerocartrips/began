# MongoDB integration tests

Set `MONGODB_URI_TEST` to an isolated database (never production).

```bash
MONGODB_URI_TEST=mongodb://... npm test
```

Suites:

- `tests/integration/mongo.integration.test.js` — auth/pricing
- `tests/integration/admin-ops.integration.test.js` — settings defaults, helpful votes
- `tests/integration/support-chat.integration.test.js`: support chat API. Always runs, using an in-memory MongoDB (no `MONGODB_URI_TEST` needed)

The Atlas suites are skipped with a clear `skipIf(!testUri)` when `MONGODB_URI_TEST` is unset.
