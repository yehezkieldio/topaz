# Topaz Commit Message Guidelines

## 1. Format

- `type(scope): message`
- ≤ 50 chars, imperative, lowercase start
- Concise, direct, no reasoning or metadata

## 2. Types

- **feat:** new feature/module
- **fix:** bug/error fix
- **refactor:** structure change, no behavior change
- **docs:** docs only
- **style:** formatting/linting only
- **perf:** performance improvement
- **test:** tests only
- **ci:** CI/CD changes
- **chore:** maintenance/config/deps
- **revert:** undo commit
- **security:** security fix

## 3. Scopes

- `src/`: use module/component scope
- Non-`src/`: `chore`
- Deps: `chore(deps)`
- Common: `api`, `ui`, `auth`, `db`, `config`, `core`, `utils`, `deps`

## 4. Rules

1. Deps? → `chore(deps)`
2. Outside `src/`? → `chore`
3. New in `src/`? → `feat`
4. Fix in `src/`? → `fix`
5. Structure change in `src/`? → `refactor`
6. Pick most specific type

## 5. Principles

- State **what**, not why
- No filler/vague terms
- Active voice
- Self-explanatory without justification

## 6. Examples

✅ `feat(auth): add oauth2 login`
✅ `refactor(core): extract validation`
✅ `fix(api): handle empty response`
✅ `chore(deps): upgrade react v18`
✅ `perf: optimize image loading`