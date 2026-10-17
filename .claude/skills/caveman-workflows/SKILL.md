---
name: caveman-workflows
description: >
  Six lean engineering work patterns that stop overbuilding - investigate-first,
  lean-build, surgical-patch, safe-refactor, migration, verify-and-stop. Use
  whenever the user asks to debug an unclear failure, build a feature, fix a
  bug, refactor, write or run a DB/schema/API migration (including Drizzle
  migrations), or verify that work is done. Pick the one pattern that fits.
---

# caveman-workflows

Pick one pattern. State it in one line. Follow it. Stop at its stop condition.

| Task | Pattern |
|---|---|
| Unknown cause, flaky, slow | investigate-first |
| New feature or integration | lean-build |
| Bug or small behavior change | surgical-patch |
| Restructure, no behavior change | safe-refactor |
| Schema, data, API, config, dependency change | migration |
| "Is this done?", run checks | verify-and-stop |

## Risk gate (applies to every pattern)
Touches prod, data, money, auth, secrets, or bulk sends? Before acting:
1. State blast radius (env, tables, tenants, users affected).
2. Dry-run / staging / backup first.
3. Rollback written down.
4. Explicit "confirm" from the user for the irreversible step.
See `risk-check`. Before a release, run `engineering:deploy-checklist` if available.
Never: `git push --force` to main, `drizzle-kit push` to prod, editing prod data by hand without a backup, disabling tests to go green.

## investigate-first
Gather evidence before changing code.
- Separate observed symptom from inferred cause.
- Trace inputs, state transitions, ownership boundaries, failure output.
- Rank hypotheses by evidence and cheap falsification.
- No edits until one mechanism explains all evidence.

**Stop:** cause named with proof, or exact blocker named. No fix unless asked.

## lean-build
Narrowest complete outcome that fits the existing system.
- Derive acceptance criteria and explicit non-goals from the request.
- Trace entry point through layers that own the invariants.
- Deliver one end-to-end path. Never cram it into one file to look small.
- Reuse existing seams. Refactor only when patching duplicates behavior.
- Omit modes, providers, config, extensibility, polish unless acceptance needs them.
- New dependency, service, table or config? Only for acceptance. State the tradeoff.

**Stop:** acceptance passes. Report only material omissions.

## surgical-patch
- Reproduce first when cheap. Otherwise capture strongest evidence.
- Trace symptom to responsible mechanism.
- Change the narrowest layer that owns the wrong behavior.
- No cleanup, renaming or abstraction outside the fix.
- Add only the regression test relevant to the bug.

**Stop:** failure fixed, regression proof passes.

## safe-refactor
- Define the behavior-preservation boundary. Set up verification before edits.
- No feature changes inside a refactor.
- Move one ownership boundary at a time.
- Preserve public interfaces, error behavior, ordering, compatibility.
- Every intermediate state builds and passes tests.

**Stop:** same proof passes, requested structure achieved.

## migration
Map readers, writers, data shape, compatibility window before editing.
- Define forward path and rollback path.
- Preserve existing data. Destructive steps need separate explicit approval.
- Mixed-version operation stays safe during rollout.
- Sequence: expand, migrate, verify, contract.
- Retries idempotent. Partial failure observable.
- Drizzle: review generated SQL before applying. Never `drizzle-kit push` against prod Cloud SQL; use versioned migrations. Take a Cloud SQL backup before destructive steps.

**Stop:** requested stage passes. Never run contraction (drop column/table) implicitly.

## verify-and-stop
Turn acceptance criteria into smallest sufficient proof set.
- Reuse still-valid results.
- Focused checks before wide gates.
- Report pass, fail, unavailable, blocked exactly.
- No product code edits unless the request includes fixes.
- No polish or extra tests after criteria pass.

**Stop:** proof complete. Report commands, results, open risk only.

---
Adapted for Claude.ai from JuliusBrussee/caveman (Apache-2.0).
