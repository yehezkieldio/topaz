---
name: code-time-discipline
description: Decide whether a software task is code time or not code time, then execute with evidence-backed restraint. Use when asked to optimize, refactor, clean up, harden, review, fix, or improve code; when a request could tempt speculative edits; when deciding whether to patch now, measure first, report findings only, or stop because the change would weaken correctness, contracts, security, or maintainability.
---

# Code Time Discipline

Use this skill as a gate before editing code. The goal is not to avoid work; it is to edit only when the code path, cost model, and correctness boundary justify it.

## Decision Gate

Classify the task before changing files:

- **Code time**: source inspection shows a real bug, scaling risk, repeated cost, missing guardrail, unsafe lifecycle, inefficient I/O, or clear contract drift, and a focused correctness-preserving patch is available.
- **Measure first**: the suspected issue is non-trivial, performance-sensitive, concurrency-sensitive, or contract-sensitive, and source inspection alone is not enough. Use existing tests, benchmarks, profiles, logs, query plans, or small reproducible checks before editing.
- **Report only**: the finding is plausible but speculative, the path is cold, the savings are tiny, the code would become harder to reason about, or the fix needs product/contract input.
- **Not code time**: the request is answered by explanation, docs, command output, configuration guidance, or review findings; or the edit would weaken validation, authorization, security, transactionality, ordering, public API contracts, or maintainability.

If the classification is not code time, say so directly and provide the next useful action.

## Required Inspection

Before editing, read the relevant source and its immediate boundaries:

- Call sites and public exports.
- Tests, fixtures, benchmarks, profiles, logs, or query-plan tooling if present.
- Data schemas, route handlers, workers, jobs, UI render paths, lifecycle ownership, and external I/O boundaries touched by the change.
- Project docs and local agent instructions that define behavior.

Do not infer hotness from file names alone. Decide whether the path is hot, warm, cold, boundary, or pure logic.

## Evidence Standard

Every acted-on finding needs:

- **Location**: file, function, route, query, worker, component, or code path.
- **Trigger**: when it runs.
- **Cost**: CPU, memory, allocation, I/O, network, database, render, lock contention, scheduling, startup, or build.
- **Growth**: constant, linear, `O(n log n)`, quadratic, unbounded, input-dependent, concurrency-dependent, or dataset-dependent.
- **Evidence**: proven, strongly likely, plausible, or speculative.
- **Recommendation**: concrete action that preserves correctness and maintainability.
- **Priority**: `P0` actual bottleneck or unsafe scaling, `P1` likely production issue, `P2` cleanup only if already touching the code.

Act on `P0` and justified `P1` findings. Avoid `P2` edits unless they fall out naturally from the same patch.

## Editing Rules

- Prefer removing unnecessary work over adding caching, memoization, batching, parallelism, queues, workers, or dependencies.
- Prefer better data access, explicit limits, and bounded concurrency over hiding bad shapes behind caches.
- Preserve validation, authorization, tenant/user/role boundaries, transaction semantics, ordering, idempotency, public API behavior, and readable control flow.
- Do not add compatibility branches, fallback logic, or workaround paths unless the external boundary requires them.
- Keep changes scoped to one coherent responsibility. Do not mix style-only cleanup with functional work.
- Work with existing user changes in the tree. Do not revert unrelated edits.

## Verification

After code time, run the smallest meaningful gate set that protects the touched behavior:

- Unit or integration tests for the package/app touched.
- Typecheck and lint for typed code.
- Format check when formatting is enforced.
- Benchmark, profile, query plan, or load check when the improvement is non-trivial and tooling exists.
- Build when public exports, bundling, app startup, or runtime packaging could be affected.

If a gate cannot run, state the exact blocker. Do not claim a change is verified without a passing gate or a clear reason why verification was impossible.

## Final Response

Lead with what changed and why. Include the performance finding format for acted-on work. Mention verification. Call out unrelated dirty worktree files when relevant.
