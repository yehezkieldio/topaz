# Changelog

All notable changes to this project will be documented in this file.

**NOTE:** Changes are ordered by date, starting with the most oldest to the most recent.

> This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.

## topaz@0.1.1-beta.3 (August 15, 2025)

### <!-- 11 -->🛠️ Miscellaneous
- [`dc97838`](https://github.com/yehezkieldio/topaz/commit/dc97838a0cbf61a3862485dbdaa99f199e274933) biome: Enhance linter configuration
- [`658eecb`](https://github.com/yehezkieldio/topaz/commit/658eecb6e2ebda0ef6010ce029eff94cc8438e6d) biome: Disable useAwait rule
- [`669fe96`](https://github.com/yehezkieldio/topaz/commit/669fe9679ce025cb9f877d5ae8d3ce14fe9fa0fd) biome: Lint fix
- [`8571ac4`](https://github.com/yehezkieldio/topaz/commit/8571ac4d74e70e8331fcd5a0e9667c9d9a33cf31) biome: Update useMaxParams rule to to 5 max
- [`0f284d3`](https://github.com/yehezkieldio/topaz/commit/0f284d33ae6c8dc95e734586badbd13bcf66d69d) biome: Remove useConsistentTypeDefinitions rule

### <!-- 16 -->🤖 CI/CD
- [`9ce26b4`](https://github.com/yehezkieldio/topaz/commit/9ce26b4708eccd7d7acd673be2d2b602ebc32619)  Ignore stable branch for push and pull requests

### <!-- 17 -->🛠️ Miscellaneous
- [`7bea6a0`](https://github.com/yehezkieldio/topaz/commit/7bea6a0ee650a3d6cf80b017638386e004aea270) biome: Remove noSolidDestructuredProps rule

### <!-- 7 -->🚜 Refactor
- [`7925c8e`](https://github.com/yehezkieldio/topaz/commit/7925c8e3d4bda6188d0bac3eae776fa32e0b9132) library: Change interface to type for props
- [`3f70634`](https://github.com/yehezkieldio/topaz/commit/3f70634e6166eb2bac57da420fa8ebca894f0b80) populate: Replace magic numbers with constants
- [`e45c198`](https://github.com/yehezkieldio/topaz/commit/e45c19838ec7d5cecf6760ad246103853c656066) migration: Simplify commit block check
- [`72d1fc6`](https://github.com/yehezkieldio/topaz/commit/72d1fc6208b81db3c3e60ebd8840115d435bf874) ui: Rename increment and decrement props
- [`38c03e3`](https://github.com/yehezkieldio/topaz/commit/38c03e36b81a9766f585b6f834920ee86533bff2) ui: Use constant for max progress percentage
- [`16dbd60`](https://github.com/yehezkieldio/topaz/commit/16dbd605db540b7a9da658601c34798d85b416a6) trpc: Replace gcTime with constant for clarity
- [`3ef95eb`](https://github.com/yehezkieldio/topaz/commit/3ef95eb59b572528e301b7b009bd0bd292fb666d) trpc: Define DEFAULT_PORT for base URL
- [`d491578`](https://github.com/yehezkieldio/topaz/commit/d4915783760bce9f1c7b3b30a133febdf143109b) utils: Replace magic numbers with constants
- [`f48cf51`](https://github.com/yehezkieldio/topaz/commit/f48cf51ae4f6bcf64f43253a5a58feeb81f30f60) api: Replace magic numbers with constants
- [`a66a4df`](https://github.com/yehezkieldio/topaz/commit/a66a4df56219b66cbe48bbc7dab93e7eb281c2a3) db: Simplify getSortColumn using sortColumnMap
- [`aeb6257`](https://github.com/yehezkieldio/topaz/commit/aeb62572941665c772808aca6bd381c5d116978d) db: Replace magic numbers with constants for rating
- [`b3cd097`](https://github.com/yehezkieldio/topaz/commit/b3cd097f86fad38f828fed56ace144724ec5dddd) copilot: Add guideline for extracting complex expressions
- [`80dd270`](https://github.com/yehezkieldio/topaz/commit/80dd27078f05db5ebaa5c16c0003e7bd7af9b293) cache: Reorganize constants and improve readability
- [`c9babe2`](https://github.com/yehezkieldio/topaz/commit/c9babe2c8e56b316096273451f3e694e596e59ba) auth: Change type declarations to interfaces
- [`d322dba`](https://github.com/yehezkieldio/topaz/commit/d322dba13223a06f3c86c3e88400e71cd9914f12) db: Update SQL type declarations for clarity
- [`2d6e269`](https://github.com/yehezkieldio/topaz/commit/2d6e2695f8c25942c1b39f8f2e4ff31eda7f2ec8) api: Extract magic numbers to constants
- [`c5aae41`](https://github.com/yehezkieldio/topaz/commit/c5aae41e52b733b3e96dddd8ec8d88cb277649a3) library: Extract magic number to constant
- [`e0d9493`](https://github.com/yehezkieldio/topaz/commit/e0d9493a47e20fb9b904c9878778bc856ba1337d) ui: Rename onFandomsChange to onFandomsChangeAction
- [`a16d113`](https://github.com/yehezkieldio/topaz/commit/a16d113b39a6ac72199a9aa030f975a9e2a8a881) ui: Rename onTagsChange to onTagsChangeAction
- [`e3162db`](https://github.com/yehezkieldio/topaz/commit/e3162dbbde6de65f00769de9fe0a0390b22c0d8a) library: Rename onClose to onCloseAction
- [`05fccb9`](https://github.com/yehezkieldio/topaz/commit/05fccb9b68a89f9d3761b48d3836797dbfeccf93) library: Replace magic numbers with constants
- [`053ee7d`](https://github.com/yehezkieldio/topaz/commit/053ee7d108bc025a77516f3cf30ffe29f4bb43ba) copilot: Simplify commit message guidelines

### <!-- 9 -->🎨 Code Styling
- [`2ac7408`](https://github.com/yehezkieldio/topaz/commit/2ac7408eef6c504b63f93a5ce23af47f8964d198) biome: Format includes and options for consistency
## topaz@0.1.1-beta.2 (August 15, 2025)

### <!-- 16 -->🤖 CI/CD
- [`eb28d2a`](https://github.com/yehezkieldio/topaz/commit/eb28d2a1cda0d0e641d0a55b5b70870a428255ec)  Update permissions and sync stable branch
## topaz@0.1.1-beta.1 (August 15, 2025)

### <!-- 16 -->🤖 CI/CD
- [`8393c3e`](https://github.com/yehezkieldio/topaz/commit/8393c3e88142ed7e743bb13f2894c0e138c3a2c2)  Add continuous integration workflow

### <!-- 3 -->🚀 New Features
- [`a318eff`](https://github.com/yehezkieldio/topaz/commit/a318eff4bbca416bbb624e287313d3be08f64799) layout: Add analytics and speed insights components

### <!-- 4 -->🐛 Bug Fixes
- [`800b590`](https://github.com/yehezkieldio/topaz/commit/800b590d99e349ef05f022971e7005c6778a6a39) env: Correct redis URL assignment in runtime environment
## topaz@0.1.1-beta.0 (August 15, 2025)

### <!-- 11 -->🛠️ Miscellaneous
- [`047a29e`](https://github.com/yehezkieldio/topaz/commit/047a29ec4c8f25b66a7def8ee1ee966f1f7b0e34)  Initial commit
- [`6258554`](https://github.com/yehezkieldio/topaz/commit/6258554cf6987055d44900a33de5c8ebd8417403) auth: Remove debug option from auth config
- [`1843be6`](https://github.com/yehezkieldio/topaz/commit/1843be60fdc434c07724d83ef2dde2c60f6f7913) config: Update next.config.ts with new settings
- [`16a1264`](https://github.com/yehezkieldio/topaz/commit/16a12649773ca807f9699ae000c50e05b4cd674d) config: Update .env.example with default values

### <!-- 3 -->🚀 New Features
- [`4c37a42`](https://github.com/yehezkieldio/topaz/commit/4c37a42e935228e20470b760fa5e8aee65c10332)  Add shadcn/ui components
- [`228b3a9`](https://github.com/yehezkieldio/topaz/commit/228b3a988ed3fab228bc3bf6cc33f74d5c7d09a5)  Add useDebounce and useIsMobile hooks
- [`3ba7f36`](https://github.com/yehezkieldio/topaz/commit/3ba7f36492dce268dd478fafd5b9ff9b225c4808) library: Add fandom, story, and tag search hooks
- [`894051d`](https://github.com/yehezkieldio/topaz/commit/894051d5759728b83cdc46a96a254709ee22d1a6) library: Add hooks for library filtering and item values
- [`f84bdc8`](https://github.com/yehezkieldio/topaz/commit/f84bdc8f34f1d883334998289f1f05ce9b772a30)  Add library
- [`e442079`](https://github.com/yehezkieldio/topaz/commit/e4420794890f0a67d40c9237a955bb46c98f8242) db: Add script for populating and depopulating database
- [`188cf66`](https://github.com/yehezkieldio/topaz/commit/188cf6600f52cf12c6284072894b0a641d70a2e7) layout: Add playfair display font
- [`3b9c981`](https://github.com/yehezkieldio/topaz/commit/3b9c9811edc8bce61d9e80057b9e2b201ec81568) ui: Enhance home page with badges and links
- [`319322d`](https://github.com/yehezkieldio/topaz/commit/319322d9faca69017daf17900afbd49a684d7686) library: Implement LibraryClientProvider component

### <!-- 5 -->📚 Documentation
- [`7ea8a2e`](https://github.com/yehezkieldio/topaz/commit/7ea8a2ee9a1e94dae31c65cdb6bfb7032eb99076)  Update README with project description

### <!-- 7 -->🚜 Refactor
- [`fa5735d`](https://github.com/yehezkieldio/topaz/commit/fa5735d37555d4f5cea48021c1c8dc581e3076b6) api: Export ProgressQueryResult type

### <!-- 9 -->🎨 Code Styling
- [`f5f6669`](https://github.com/yehezkieldio/topaz/commit/f5f666925898197be852c70e8100b208e8f214f5) library: Remove font-serif from headings
- [`332ce9e`](https://github.com/yehezkieldio/topaz/commit/332ce9ec627347b4434ebd8bde4a680509a991d7) library: Update background and gradient styles
- [`b4ca2eb`](https://github.com/yehezkieldio/topaz/commit/b4ca2ebec35571bb585d6157e6a63d541e5dc594) auth: Update font style for authentication headers
- [`3c2a3fd`](https://github.com/yehezkieldio/topaz/commit/3c2a3fd0c21c7082ca02c40b540df058ce2c2de1) ui: Update link button hover effect
- [`df69b9c`](https://github.com/yehezkieldio/topaz/commit/df69b9c5ab073de69f9ab5b6ff57b9c3501ac40e) sheet: Remove unused comment in Sheet component
