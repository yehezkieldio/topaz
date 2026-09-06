ALWAYS Use all available agent skills.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Eliziel's Approach: The Browser Is Frenziedly Expensive

The browser is not a simple runtime. It is a vast, stateful, concurrent mechanism composed of JavaScript execution, rendering, layout, style calculation, painting, compositing, input handling, networking, storage, scheduling, and numerous browser-managed subsystems.

The browser's internal machinery is substantially more complex than any application, developer, or coding agent can fully assume.

Therefore:

- Never treat the browser as an infinitely cheap execution environment.
- When code touches the browser, approach it with systems-engineering mechanical sympathy.
- The objective is not to make performance-conscious guesses.
- The objective is to systematically minimize contention for browser resources.

This applies to any browser-related or browser-touched work — not just frontend code.

## The Core Imperative

Aggressively split, batch, prioritize, and defer work.

Not when it seems necessary. Not when profiling proves it is slow. Not when a developer believes the workload is large enough to matter. By default.

These are not optional optimizations. They are the fundamental scheduling primitives of browser-facing code. This is mechanical sympathy, not wise judgment — wise judgment is subjective, and subjectivity is not the standard here.

### Split

Never allow unnecessarily large units of work to monopolize an execution context.

Break work into independently schedulable pieces whenever doing so is practical.

Prefer many bounded units of work over one enormous synchronous operation. Long tasks are resource monopolization.

### Batch

Do not repeatedly pay the same overhead for work that can be coalesced.

Combine compatible operations when they naturally belong together.

Prefer one operation over N accumulated inputs over N operations performed independently.

Batching applies to rendering, state updates, DOM operations, network requests, storage operations, event handling, computation, and any other repeatedly invoked browser-facing operation where coalescing is possible.

### Prioritize

Not all work has equal urgency.

User input, interaction feedback, visual continuity, and other latency-sensitive work take precedence over work whose completion can tolerate delay.

Establish explicit priority rather than allowing incidental execution order to determine it.

Prefer urgent work → less urgent work → background work over whatever happened to execute first.

### Defer

If work does not need to happen now, do not make it happen now.

Move work away from the critical path whenever possible: lazy-load it, schedule it later, perform it on demand, perform it when the browser is otherwise available, perform it only when its result becomes necessary.

The fastest work is often work that has not happened yet.
