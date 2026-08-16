# Tax Policy smoke ACTIVE replacement runbook

## Purpose

Replace the currently referenced smoke/fixture ACTIVE withholding policy with a verified production policy without editing retained financial history. This runbook is a controlled production procedure, not permission to activate a policy.

## Required owners and evidence

Complete every field before starting.

| Control | Assigned value |
| --- | --- |
| Change ticket | `<required>` |
| Legal source owner | `<required>` |
| Maker (policy author) | `<required>` |
| Independent checker | `<required; must differ from maker>` |
| Finance incident commander | `<required>` |
| Planned activation · Asia/Ho_Chi_Minh | `<required>` |
| Rollback decision owner | `<required>` |
| Evidence folder | `<required>` |
| Previous ACTIVE policy ID/hash | `<required>` |
| Candidate policy ID/hash | `<required after draft creation>` |

## Hard preconditions

Stop before any write unless all conditions are true.

1. The operator session is a verified production Admin identity, not a smoke, fixture, test, or shared account.
2. Maker and checker are separate verified Finance operators with the required Tax Policy capability.
3. Both operators have enforceable MFA. The acting operator has a verified MFA challenge receipt and recent password confirmation for each high-risk action.
4. The legal source is authoritative, uses HTTPS, has a promulgated date, and supports every entered rate and scope.
5. The candidate is a clean production draft. Do not clone the smoke policy's rate, legal free text, fixture provenance, or test identifiers as an authoritative source.
6. A database backup or equivalent recovery point has been verified according to the production recovery procedure.
7. The current ACTIVE smoke policy remains intact and referenced until the replacement activation is verified.
8. The Tax Policy Integrity view and withholding settlement health have been reviewed. Existing integrity gaps have an owner and are not worsening.
9. The activation window and rollback owner are confirmed in Vietnam time.

## Controlled replacement sequence

Complete these steps in order. A stop condition ends the procedure; do not skip ahead or improvise a database update.

1. **Back up and inventory (read-only).** Record the recovery point, current ACTIVE policy ID/hash, lifecycle state, source provenance, all referencing earnings, and retained evidence counts. The current baseline includes five tax logs and five immutable snapshots that must remain queryable. **Stop** if the backup cannot be verified, the inventory is incomplete, or the retained counts do not reconcile.
2. **Assign the authoritative evidence owner.** The `<required legal/accounting evidence owner>` must provide the authoritative Vietnam source package and identify the owner of every rule boundary. **Stop** if the source is missing, non-HTTPS, ambiguous, unowned, or not independently reviewable.
3. **Create a clean production draft.** The `<required production maker>` creates a new draft from blank production inputs. Smoke, fixture, test, and legacy values are reference-only and must not be silently cloned. **Stop** if the actor is not a verified production operator, the source lineage is non-production, or clean-source acknowledgement is false.
4. **Review lineage and rule boundaries.** Compare every scope, threshold, rate, date boundary, fallback, and legal reference with the source package. Save the candidate ID/hash and review evidence. **Stop** on any unsupported value, ambiguous boundary, hash mismatch, or unknown provenance.
5. **Complete maker/checker control.** The `<required production checker>` must be a separate verified Finance operator and review the exact candidate ID/hash. **Stop** if maker and checker are the same identity, either capability is unavailable, or MFA/re-authentication assurance is not verifiable.
6. **Schedule Vietnam effective time.** Record the approved Asia/Ho_Chi_Minh effective time, activation window, job ID, policy ID, and content hash. **Stop** if the time is ambiguous, outside the approved window, or a competing activation is already pending.
7. **Verify one ACTIVE immediately before and after activation.** Immediately before the window, verify exactly one existing ACTIVE policy. Immediately after the scheduled transition, verify exactly one ACTIVE policy and that its ID/hash match the approved candidate. **Abort** if the count is zero or greater than one, or the candidate does not match.
8. **Verify calculations and immutable snapshots.** Run the approved controlled calculation sample and compare rule selection, withholding result, and immutable snapshot content with the reviewed candidate. **Abort** if results differ or any historical earning, tax log, snapshot, or settlement changed.
9. **Verify approval and activation evidence.** Retain the approval receipt, reviewed payload hash, schedule event, activation event, actor IDs, and server timestamps. **Abort** if any receipt, event, exact ID, or hash is missing or inconsistent.
10. **Use a corrective version for problems.** Never edit or delete the current or prior policy in place. Prepare and govern a new corrective version through the same maker/checker and scheduled lifecycle. **Stop** if recovery would require direct row edits or destructive cleanup.
11. **Preserve smoke references.** Keep the previous smoke policy, its five tax logs, and its five immutable snapshots as retained historical evidence. Do not run destructive fixture cleanup during replacement. **Stop** if any retained reference becomes unreadable or is selected for deletion.
12. **Close out or escalate.** Reconcile one-ACTIVE state, calculation evidence, audit trail, integrity queues, and retained-reference counts. Record either governed completion or a Finance incident owner and recovery decision. **Abort release** if any check remains unavailable, partial, or unowned.

## Preflight and dry run

1. Open `Tax Policy Control > Current policy` and record the current policy ID, provenance, content hash, effective time, legal-source state, and approval receipt state.
2. Open `Drafts & scheduled`. Confirm the capability panel reports a production identity, MFA and recent reauthentication, and a separate checker. Any blocker means stop.
3. Run the fixture cleanup utility in dry-run/check mode only. Confirm the active smoke policy and all referenced policies are retained for manual review. Do not execute cleanup in this procedure.
4. Open `History > Production history` and `History > Test / legacy evidence`. Confirm production and fixture provenance are separated.
5. Open `Audit & integrity`. Record the 30-day population and every non-zero independent queue count. Save evidence before proceeding.
6. Confirm there is exactly one current ACTIVE policy. If there are zero or multiple ACTIVE policies, stop and open an incident.

## Create the clean production draft

Maker actions:

1. Select `Create new draft`.
2. Enter the production policy name, Vietnam effective time, promulgated date, legal-source title and HTTPS URL, tax subject, change summary, and operator rationale.
3. Add only rules supported by the legal source. Leave the fallback rate empty if no authoritative fallback has been approved.
4. Acknowledge the clean-source declaration only after confirming no smoke or fixture source was copied.
5. Submit once. Save the resulting policy ID, policy content hash, source lineage, audit event ID, and server timestamp.
6. Reopen the exact policy by ID and verify the rendered values and hash match the submitted source. A mismatch means stop.

## Independent checker review

Checker actions:

1. Sign in with the independent verified Finance account and complete fresh MFA and password confirmation.
2. Open the exact candidate policy ID. Do not approve from an aggregate queue without matching the ID and content hash.
3. Compare every rule, effective time, legal URL, promulgated date, and tax subject against the legal source.
4. Record a review rationale and approve the exact candidate.
5. Save the approval receipt, checker identity, reviewed content hash, audit event ID, and server timestamp.
6. Confirm the receipt hash equals the current candidate hash. Any mismatch, missing receipt, or maker/checker identity collision means stop.

## Schedule and activate

1. Maker or authorized scheduler completes fresh MFA and password confirmation.
2. Schedule the exact approved candidate for the agreed Vietnam time. Do not activate it ad hoc outside the change window.
3. Save the schedule audit event, activation job ID, policy ID, content hash, and Vietnam effective time.
4. Monitor the existing activation job. Do not create a second schedule or manually retry while the first job is unresolved.
5. After the effective time, verify all of the following:
   - exactly one policy is ACTIVE;
   - the ACTIVE policy ID and hash equal the approved candidate;
   - the previous smoke policy is no longer ACTIVE but remains in immutable history;
   - one controlled, non-customer-impacting verification calculation uses the expected rule;
   - no retained earning, tax log, immutable snapshot, or prior settlement record changed;
   - audit records exist for create, submit, approve, schedule, and activation;
   - integrity queue counts did not regress unexpectedly.

## Stop and abort conditions

Stop immediately and do not retry blindly when any condition occurs:

- production identity, capability, MFA, recent reauthentication, or independent-checker verification fails;
- the legal source is missing, non-HTTPS, ambiguous, or inconsistent with a rule;
- the candidate source lineage is smoke/test/fixture or the clean-source acknowledgement is untrue;
- the policy ID or content hash changes between authoring, review, schedule, and activation;
- the approval receipt, audit event, or activation job is missing;
- zero or multiple ACTIVE policies are observed;
- the active smoke policy would be edited, deleted, or cleaned before replacement verification;
- withholding output differs from the approved candidate;
- historical earnings, tax logs, immutable snapshots, or settlements appear mutated;
- integrity failures increase, the API becomes unavailable, or activation state cannot be read reliably.

## Rollback and recovery

1. Declare a Finance incident and freeze further Tax Policy writes.
2. Preserve the candidate, previous policy, approval receipts, activation job, audit events, API responses, and screenshots. Do not delete evidence.
3. Use only the existing authorized policy lifecycle to schedule an approved recovery policy. Do not directly edit an ACTIVE row or historical earning records.
4. Recovery requires the same independent checker, MFA, recent reauthentication, exact content-hash verification, and audit evidence as the forward change.
5. If the system has zero or multiple ACTIVE policies, or the lifecycle cannot produce a safe recovery, stop automated settlement/withholding processing according to the Finance incident procedure and escalate to the database recovery owner.
6. After recovery, verify exactly one ACTIVE policy, expected withholding output, immutable history, and integrity counts before resuming Finance operations.

## Evidence checklist and closeout

Capture and retain:

- current policy before and after;
- candidate draft and exact content hash;
- legal source reference and review record;
- maker submission and independent approval receipt;
- MFA/reauth capability result without exposing credentials or tokens;
- schedule event and activation job result;
- one controlled verification calculation;
- audit timeline and integrity counts before and after;
- rollback decision or explicit statement that rollback was not required.

Do not run destructive fixture cleanup during activation. Cleanup remains a separate, dry-run-first activity. Referenced or ACTIVE policies must be retained, and any deletion requires a separately approved manifest and recovery plan.
