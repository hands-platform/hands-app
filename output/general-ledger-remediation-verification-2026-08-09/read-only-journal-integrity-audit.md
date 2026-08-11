# Journal Batch Integrity Read-only Audit

- Audited at: 2026-08-10T08:30:24Z
- Scope: all 472 journal batches, fetched in five read-only pages
- Data mutation: none
- Integrity states: CLEAR 441, BLOCKED 31, UNKNOWN 0
- Blocker occurrences: HEADER_ENTRY_MISMATCH 30, POSTED_WITHOUT_ENTRIES 29, FORMULA_DELTA 26
- Maximum discrepancy: 400,000 VND on `cmr3a1fxp0o1tvyjg8rj5fy6y`
- Oldest blocker: `seed-finance-smoke-journal-batch`, created 2026-07-01T06:15:48.687Z

## Regression Evidence

`seed-finance-smoke-reversal-journal-batch` is now `BLOCKED`.

| Check | Value |
| --- | ---: |
| Header debit | 500,000 VND |
| Header credit | 500,000 VND |
| Entry debit | 390,000 VND |
| Entry credit | 390,000 VND |
| Formula delta | 12,000 VND |
| Maximum discrepancy | 110,000 VND |
| Blockers | `HEADER_ENTRY_MISMATCH`, `FORMULA_DELTA` |
| Integrity checked at | 2026-08-10T08:30:23.716Z |

The audit used the same Admin accounting-journal API integrity contract as the list, summary, detail, and monthly-close gate. It did not repair, reseed, or otherwise alter accounting records.
