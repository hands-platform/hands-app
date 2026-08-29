# Chat Evidence retention decision packet

- Status: **BLOCKED BY OWNER POLICY DECISION**
- Business timezone: `Asia/Ho_Chi_Minh`
- Scope: retained booking chat messages and attachments used by HANDS operations as Chat Evidence
- Automation state: **Do not enable automatic deletion before this decision is approved.**

## Ratification authority gate

This packet is prepared for decision, but it is not an approval record yet. Repository review on 2026-08-24 found no named HANDS policy owner, legal reviewer, or formally appointed personal-data protection person/department. Codex and the implementation team are not authorized to fill those roles or infer their decisions.

Approval requires all of the following fields and signatures:

| Authority evidence | Required value |
|---|---|
| Accountable policy owner | Legal name, title, employing entity, and written authority to approve HANDS records-retention policy |
| Personal-data protection reviewer | Legal name/title and the formal appointment or delegation reference |
| Legal reviewer | Legal name/title and written opinion or approval reference covering Vietnam law and applicable dispute/consumer obligations |
| Security/engineering reviewer | Legal name/title confirming feasibility only; this reviewer does not replace policy or legal approval |
| Approval record | Immutable decision/ticket/document ID, approval timestamp in `Asia/Ho_Chi_Minh`, effective date, and review date |

If the accountable policy owner cannot be identified and evidenced, the only valid decision is to keep GOV-01 blocked.

## Current Vietnam legal baseline — not an owner decision

This baseline was checked on 2026-08-24 and must be revalidated by the legal reviewer at approval time:

- [Personal Data Protection Law 91/2025/QH15](https://thuvienso.quochoi.vn/handle/11742/103334) took effect on 2026-01-01.
- [Decree 356/2025/NĐ-CP](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=187276) took effect on 2026-01-01 and repealed Decree 13/2023/NĐ-CP.
- Decree 356 requires an organization to appoint its personal-data protection person or department by formal written instrument stating duties and authority.
- For a procedurally valid deletion request, Decree 356 requires an initial response within 2 working days and completion within 20 days; where a processor or third party must act, the stated period is 30 days. A necessary extension is limited to one extension of up to 20 days with notice and justification.
- Where personal data is transferred, Decree 356 requires the agreement to state the processing term and deletion/destruction requirements after the transfer purpose is completed.

These rules do not select a general Chat Evidence retention duration and do not prove that a particular dispute, legal claim, consumer complaint, or law-enforcement matter permits or requires continued storage. The legal reviewer must document the applicable basis for each hold category and for the normal retention period.

## Owner ratification worksheet

The actual policy owner must complete every blank below. “TBD”, verbal approval, a chat message without an immutable reference, or an implementation-team decision is not approval.

### A. Normal retention

| Decision | Owner-approved value |
|---|---|
| Retention duration | ___ days/months/years |
| Retention clock starts at | ___ |
| Records covered | Message body: ___ / attachments: ___ / search audit: ___ |
| Documented purpose | ___ |
| Legal/contractual basis | ___ |
| Customer/Partner notice reference | ___ |
| Review cadence | ___ |

### B. Legal hold

| Decision | Owner-approved value |
|---|---|
| Hold entry triggers | ___ |
| Roles allowed to place a hold | ___ |
| Required evidence and case ID | ___ |
| Minimum scope keys | Booking: ___ / room: ___ / message: ___ / customer: ___ / Partner: ___ |
| Roles allowed to release a hold | ___ |
| Independent release evidence | ___ |
| Hold review cadence and expiry behavior | ___ |
| Incident/dispute deletion-stop authority | ___ |

### C. Deletion approval

| Decision | Owner-approved value |
|---|---|
| Requester role | ___ |
| Independent approver role | ___ |
| Executor service or operator role | ___ |
| Two-person rule | ___ |
| Approval validity window | ___ |
| Maximum batch size | ___ |
| Mandatory dry-run/sample threshold | ___ |
| Legal-hold exclusion proof | ___ |
| Backup/restore handling | ___ |
| Immutable audit record ID and required fields | ___ |
| Emergency stop and recovery authority | ___ |

### D. Sign-off

| Signatory | Name/title | Signature or immutable approval reference | Time (`Asia/Ho_Chi_Minh`) |
|---|---|---|---|
| Accountable policy owner | ___ | ___ | ___ |
| Personal-data protection reviewer | ___ | ___ | ___ |
| Legal reviewer | ___ | ___ | ___ |
| Security/engineering reviewer | ___ | ___ | ___ |

GOV-01 can move from `BLOCKED BY OWNER POLICY DECISION` to `APPROVED FOR IMPLEMENTATION DESIGN` only after every required field is complete and all four approval references are verifiable. Approval of this packet still does not authorize deletion execution; implementation, dry-run evidence, and production activation require separate changes and approvals.

## Owner decisions required

| Decision | Required owner answer |
|---|---|
| Retention period | **OWNER DECISION REQUIRED** — define the normal retention period and its legal/contractual basis. |
| Legal hold entry | **OWNER DECISION REQUIRED** — define which incident, dispute, regulatory, or litigation states place a booking chat under hold. |
| Legal hold release | **OWNER DECISION REQUIRED** — name the role allowed to release a hold and the evidence required for release. |
| Export requester | **OWNER DECISION REQUIRED** — name the roles allowed to request Chat Evidence export. |
| Export approver | **OWNER DECISION REQUIRED** — name an independent approver and any separation-of-duty rule. |
| Export format | **OWNER DECISION REQUIRED** — select supported format, timestamp/timezone representation, attachment handling, and integrity metadata. |
| Export redaction | **OWNER DECISION REQUIRED** — define phone, address, location, file, identity, and free-text redaction rules by request purpose. |
| Deletion executor | **OWNER DECISION REQUIRED** — name the controlled service or operator role allowed to execute deletion. |
| Deletion approval | **OWNER DECISION REQUIRED** — define two-person confirmation, authorization expiry, and batch-size limits. |
| Deletion audit | **OWNER DECISION REQUIRED** — define immutable request, approval, dry-run, execution, exception, and completion event fields. |
| Backup relationship | **OWNER DECISION REQUIRED** — define whether deleted production evidence ages out of backups or requires backup-level deletion. |
| Restore relationship | **OWNER DECISION REQUIRED** — define how a restore prevents deleted evidence from silently becoming active again. |

## Incident and dispute stop procedure

Before any deletion is authorized, the owner must define:

1. the event that pauses scheduled and manual Chat Evidence deletion;
2. who can issue and revoke the pause;
3. how affected booking, customer, Partner, room, and message identifiers are scoped;
4. how operators confirm that queued batches were stopped before processing;
5. which audit event records the pause, scope changes, rejected deletions, and release;
6. how an incident commander verifies that no held evidence was removed.

Until those answers are approved, an incident or dispute must be treated as a deletion stop, not as permission to infer a retention period.

## Required dry-run and evidence before activation

Any later implementation proposal must remain a separate approved change and produce all of the following before an apply mode exists:

- read-only candidate count grouped by age, booking state, legal-hold state, and attachment presence;
- sampled candidate records reviewed by the policy owner and privacy/security approver;
- explicit exclusion evidence for active incidents, disputes, and legal holds;
- proposed batch limits, idempotency behavior, failure/retry behavior, and stop control;
- restore drill showing how deletion state is preserved after database and object-storage restore;
- rollback or recovery evidence for an interrupted batch without recreating intentionally deleted data;
- audit event samples for request, approval, dry-run, execution, skip, failure, and completion;
- production-like rehearsal with no customer, Partner, booking, payment, or settlement mutation.

## Current decision boundary

- No retention duration is selected by this document.
- No delete job, queue, cron schedule, schema field, migration, or automatic archive is authorized.
- Existing Chat Evidence and Partner Notes remain separate records and workflows.
- Existing smoke-fixture cleanup scripts are not a production retention policy.
- GOV-01 must remain **blocked by owner policy decision** until every required owner answer above is approved and recorded.
