# ADR-0003: better-auth with Role-Based Admin

## Status

Accepted.

## Decision

Auth is better-auth, using its native Drizzle adapter and admin plugin. Authorization is a real `role` field on the user record (`additionalFields`, `input: false` so it can't be client-assigned), checked explicitly in every mutation via a shared `requireAdmin()` helper.

## Context

A single-user app is tempting to authorize implicitly -- "only one person can ever sign in, so anyone who's signed in is the admin." That reasoning is fragile: it conflates authentication (who are you) with authorization (what can you do), and it produces authorization checks that look real but duplicate an already-guaranteed condition. better-auth's admin plugin makes the distinction explicit and cheap: a genuine role field, a dedicated `set-role` admin endpoint, and a native Drizzle adapter that doesn't require conforming to a third-party adapter table shape.

## Consequences

```text
- Every mutation Server Action calls requireAdmin(session) explicitly at the top
  of its body -- there is no procedure middleware to inherit this from (see ADR-0002).
- A sign-in-time invite gate (allow-listed OAuth account) may still exist to
  control who can ever obtain a session at all, but it is not the authorization
  mechanism -- role is.
- No multi-tenant/org features are adopted despite being available in the plugin
  -- see 01_principles/02_non_goals.md.
```
