# Quality Gates

## Required Checks

Use the repo's existing commands:

```bash
bun run typecheck
bun run lint
```

If lint policy has shifted to Ultracite for the active branch, use:

```bash
bun run check
```

## Manual Verification

Minimum manual flow:

```text
1. open home page
2. open library page as public user
3. sign in as admin
4. create a work with a source URL
5. assign taxonomy terms
6. create a taxonomy relation that implies another term
7. confirm effective term filtering sees the work
8. update reading status/chapter/rating/notes
9. confirm reading_event rows exist
10. edit work/source/contributor fields
11. delete the entry
```

## Regression Checks

Search for these strings in active source after the cut:

```text
storyTaxonomyTerms
taxonomyAliases
libraryMaterializedView
libraryStatsMaterializedView
progresses
storyRouter
progressRouter
```

They should not remain in active V2 implementation code.

