# MongoDB integration tests

Set `MONGODB_URI_TEST` to an isolated database (never production).

```bash
MONGODB_URI_TEST=mongodb://... npm test
```

Suites:

- `tests/integration/mongo.integration.test.js` — auth/pricing
- `tests/integration/admin-ops.integration.test.js` — settings defaults, helpful votes

Tests are skipped with a clear `skipIf(!testUri)` when `MONGODB_URI_TEST` is unset.
