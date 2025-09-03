# Changelog

All notable changes to this project will be documented in this file.

**NOTE:** Changes are ordered by date, starting with the most oldest to the most recent.

> This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and uses [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.

## topaz@0.2.6 (September 3, 2025)

### <!-- 2 -->🧩 Dependencies Updates
- [`362b863`](https://github.com/yehezkieldio/topaz/commit/362b863fd557817f0d3638d3f32aab3305706094) deps: Update dependency tw-animate-css to ^1.3.8 ([#41](https://github.com/yehezkieldio/topaz/issues/41)) by renovate[bot]

### <!-- 3 -->🚀 New Features
- [`dbd73e8`](https://github.com/yehezkieldio/topaz/commit/dbd73e8232d2844b010678780c7692014c3fe60e) progress: Add new statuses to progress tracking
- [`679b2fa`](https://github.com/yehezkieldio/topaz/commit/679b2fa4e738668c7f51911a7a83a9167411d01f) db: Add reading and story status values
## topaz@0.2.5 (September 3, 2025)

### <!-- 2 -->🧩 Dependencies Updates
- [`d0c6233`](https://github.com/yehezkieldio/topaz/commit/d0c623399e8cf18e39bd719dea3b66adfdb8b5e4) deps: Update tanstack-query monorepo ([#39](https://github.com/yehezkieldio/topaz/issues/39)) by renovate[bot]
- [`13a48d8`](https://github.com/yehezkieldio/topaz/commit/13a48d836bc28ceb14e3c6d8378ccfe87d98a475) deps: Update tanstack-query monorepo to ^5.85.9 ([#40](https://github.com/yehezkieldio/topaz/issues/40)) by renovate[bot]
- [`d50e227`](https://github.com/yehezkieldio/topaz/commit/d50e2270f82c34dafdb5869f27d401861b5b233c) deps: Add idb-keyval dependency

### <!-- 3 -->🚀 New Features
- [`16c5267`](https://github.com/yehezkieldio/topaz/commit/16c52674882b5687bd6818a5baf1039744a3e85d) trpc: Implement async storage persister with IndexedDB

### <!-- 4 -->🐛 Bug Fixes
- [`5c3cc4b`](https://github.com/yehezkieldio/topaz/commit/5c3cc4b3bb7ad13329ef87da3696c8b422587b8a) cache: Improve redis error handling logic
## topaz@0.2.4 (September 1, 2025)

### <!-- 2 -->🧩 Dependencies Updates
- [`46c35e8`](https://github.com/yehezkieldio/topaz/commit/46c35e83652c2a393ece23a799aa4ca95fa446aa) deps: Update dependency nuqs to v2.5.2 ([#37](https://github.com/yehezkieldio/topaz/issues/37)) by renovate[bot]
- [`721d158`](https://github.com/yehezkieldio/topaz/commit/721d15898cdcb3e0b5e1ab2f9a8207beb4b67046) deps: Update tanstack-query monorepo to ^5.85.6 ([#38](https://github.com/yehezkieldio/topaz/issues/38)) by renovate[bot]

### <!-- 3 -->🚀 New Features
- [`e1ecc26`](https://github.com/yehezkieldio/topaz/commit/e1ecc26f78a60c6951ad0537e2e7f2d1539fce7e) ui: Add tooltip popover component for ratings
## topaz@0.2.3 (August 30, 2025)

### <!-- 2 -->🧩 Dependencies Updates
- [`1a94dcd`](https://github.com/yehezkieldio/topaz/commit/1a94dcdf10504ba5e0c6aa0b95fea9951f30ab33) deps: Add zustand dependency

### <!-- 3 -->🚀 New Features
- [`5efe091`](https://github.com/yehezkieldio/topaz/commit/5efe09182044a772b8fba2ddc3def3ff0f126f70) library: Add library create sheet store
- [`ae17ea2`](https://github.com/yehezkieldio/topaz/commit/ae17ea26643a63024a83dab4d74fb810dea9d3c5) library: Implement keyboard shortcut for sheet open

### <!-- 4 -->🐛 Bug Fixes
- [`f782404`](https://github.com/yehezkieldio/topaz/commit/f7824043f85586efa0c454a5e1c24419a2ba2a3a) ui: Remove maximum rating display from tooltip
- [`a5e2d4c`](https://github.com/yehezkieldio/topaz/commit/a5e2d4cda865e3fe90ae0513d5d3d23ac1484af7) ui: Increase maximum fandoms to show
- [`c78dcb3`](https://github.com/yehezkieldio/topaz/commit/c78dcb3ad3105635e9255ee61e2f4c5c82a9b22e) ui: Adjust chapter display logic for mobile
- [`2da8fe6`](https://github.com/yehezkieldio/topaz/commit/2da8fe657fce6091918a478ac40c494006033378) ui: Update current chapter display format

### <!-- 5 -->📚 Documentation
- [`3bd4414`](https://github.com/yehezkieldio/topaz/commit/3bd44141c70ad0484bfd59edd6e8b94626bd90ce) copilot: Update state management section in instructions
## topaz@0.2.2 (August 30, 2025)

### <!-- 3 -->🚀 New Features
- [`41ee73e`](https://github.com/yehezkieldio/topaz/commit/41ee73e5ea6efd285b72345173bdfa5cb7c8a474) ui: Add tooltip for library item rating

### <!-- 4 -->🐛 Bug Fixes
- [`30f40f5`](https://github.com/yehezkieldio/topaz/commit/30f40f5f9bae0434033407f388dd138ec7a95265) utils: Update NovelBin regex patterns
- [`8953161`](https://github.com/yehezkieldio/topaz/commit/8953161063bdc7ddf1c19a1d7c8a3b23d08cdfb4) library: Remove condition for detected source
- [`829ba52`](https://github.com/yehezkieldio/topaz/commit/829ba52bc9cfd66044f8de7dd221e202f6e45bf1) ui: Trim input value on search action
- [`9d64f8b`](https://github.com/yehezkieldio/topaz/commit/9d64f8b1a82a0c5b0a73593fc0a4b19ce97287ec) ui: Prevent rendering of rating for zero or less

### <!-- 7 -->🚜 Refactor
- [`533d69d`](https://github.com/yehezkieldio/topaz/commit/533d69dcdbaee4943ac6291cdb7c6cb9ffd840e4) ui: Rename selection and action handlers
## topaz@0.2.1 (August 29, 2025)

### <!-- 3 -->🚀 New Features
- [`662a76f`](https://github.com/yehezkieldio/topaz/commit/662a76f0a133dcf503a03b6c7d8e7ade760def8c) api: Enhance search functionality with normalization
## topaz@0.2.0 (August 29, 2025)

### <!-- 17 -->🛠️ Miscellaneous
- [`ad9fa9d`](https://github.com/yehezkieldio/topaz/commit/ad9fa9d8d35e95483aa765a640af51dddbc10c5f) biome: Disable noMagicNumbers rule

### <!-- 3 -->🚀 New Features
- [`f703330`](https://github.com/yehezkieldio/topaz/commit/f70333029f8ff4c30280149205055cacb8161650) library-view-item-sheet: Add fandoms and tags handling
- [`3d6bd7e`](https://github.com/yehezkieldio/topaz/commit/3d6bd7e2bdb499e7c8b795cb8bf8d0555c75d87d) library-view-item-sheet: Add reading progress handling
- [`ad5b3f2`](https://github.com/yehezkieldio/topaz/commit/ad5b3f2d01f90c130be7c53ec728c944fc3bf79f) trpc: Add caller for appRouter context
- [`717109d`](https://github.com/yehezkieldio/topaz/commit/717109d248981895caeaf24fc2e6899cb2d5c078) ui: Add library stats component to home page
- [`527e982`](https://github.com/yehezkieldio/topaz/commit/527e982f1233ac5e060c07be3ee9ddc6fca23179) api: Change getStats to publicProcedure

### <!-- 4 -->🐛 Bug Fixes
- [`a4bbdfa`](https://github.com/yehezkieldio/topaz/commit/a4bbdfa3f07e8f0d7fb21a0273cb6384425e3061) library-view-item-sheet: Adjust textarea height handling
## topaz@0.1.1-beta.8 (August 29, 2025)

### <!-- 11 -->🛠️ Miscellaneous
- [`5ff0b8f`](https://github.com/yehezkieldio/topaz/commit/5ff0b8fa4b0c7b79e7bc72acdcc53ec85c8ea365) biome: Increase maxLines limit per function from 150 to 200 in biome config

### <!-- 2 -->🧩 Dependencies Updates
- [`1cb5f98`](https://github.com/yehezkieldio/topaz/commit/1cb5f98c9d5fb94b871fdb2e6a3c639b2b06493b) deps: Update dependency @types/react-dom to ^19.1.9 ([#35](https://github.com/yehezkieldio/topaz/issues/35)) by renovate[bot]
- [`f03d3f4`](https://github.com/yehezkieldio/topaz/commit/f03d3f4e12f82bda060d4f374504a33b6305dd3f) deps: Update dependency zod to ^4.1.5 ([#36](https://github.com/yehezkieldio/topaz/issues/36)) by renovate[bot]

### <!-- 3 -->🚀 New Features
- [`08dee7d`](https://github.com/yehezkieldio/topaz/commit/08dee7db2d357e754743382343b016d87da156ee) utils: Add URL validation and source detection based on known patterns
- [`71c6af3`](https://github.com/yehezkieldio/topaz/commit/71c6af3ec13c57bc71e43827803985046ea6d91d) library-story-info-form: Auto-detect and set source when pasting valid URLs
## topaz@0.1.1-beta.7 (August 29, 2025)

### <!-- 2 -->🧩 Dependencies Updates
- [`2becfbf`](https://github.com/yehezkieldio/topaz/commit/2becfbfe01e3fb76f94cc7ba3d501dc744ef0933) deps: Update dependency @yehezkieldio/firefly to ^2.1.5 ([#16](https://github.com/yehezkieldio/topaz/issues/16)) by renovate[bot]
- [`ec07a8d`](https://github.com/yehezkieldio/topaz/commit/ec07a8de328fada065edb6c5794905274a1e6ea5) deps: Update dependency next to v15.5.0 ([#17](https://github.com/yehezkieldio/topaz/issues/17)) by renovate[bot]
- [`daf3c5f`](https://github.com/yehezkieldio/topaz/commit/daf3c5f3bc265904d4db1dbeeb4e2c02f42c461f) deps: Update trpc monorepo to ^11.5.0 ([#18](https://github.com/yehezkieldio/topaz/issues/18)) by renovate[bot]
- [`9bdf5b2`](https://github.com/yehezkieldio/topaz/commit/9bdf5b2fa205138ea2e6d0d35f3eb9d60026180f) deps: Update dependency nuqs to v2.5.0-beta.7 ([#19](https://github.com/yehezkieldio/topaz/issues/19)) by renovate[bot]
- [`69ee19f`](https://github.com/yehezkieldio/topaz/commit/69ee19fbf47c758f42452403b1e9ed7ee6355c7c) deps: Update dependency lucide-react to ^0.541.0 ([#20](https://github.com/yehezkieldio/topaz/issues/20)) by renovate[bot]
- [`c58ba91`](https://github.com/yehezkieldio/topaz/commit/c58ba91ef21ea7568abdb56c0ea35d06b9ba610c) deps: Update dependency @types/react to ^19.1.11 ([#21](https://github.com/yehezkieldio/topaz/issues/21)) by renovate[bot]
- [`5ea4818`](https://github.com/yehezkieldio/topaz/commit/5ea4818efc3c8a694d47b535c9a5b3d007b10528) deps: Update dependency nuqs to v2.5.0 ([#22](https://github.com/yehezkieldio/topaz/issues/22)) by renovate[bot]
- [`3d56079`](https://github.com/yehezkieldio/topaz/commit/3d56079122c7d5fc2caa38c002346b164ac39f77) deps: Update dependency zod to ^4.1.0 ([#23](https://github.com/yehezkieldio/topaz/issues/23)) by renovate[bot]
- [`882b276`](https://github.com/yehezkieldio/topaz/commit/882b276b21dcbec5c073410bdbebdd7d865c8b0b) deps: Update dependency @biomejs/biome to v2.2.2 ([#24](https://github.com/yehezkieldio/topaz/issues/24)) by renovate[bot]
- [`d5ffcf4`](https://github.com/yehezkieldio/topaz/commit/d5ffcf4fcfdf539bd076c7d17ecde8dfa76b12e1) deps: Update dependency zod to ^4.1.1 ([#25](https://github.com/yehezkieldio/topaz/issues/25)) by renovate[bot]
- [`57e9890`](https://github.com/yehezkieldio/topaz/commit/57e98905f307c2c7b753a6cab1c4069a794ea831) deps: Update dependency drizzle-orm to ^0.44.5 ([#26](https://github.com/yehezkieldio/topaz/issues/26)) by renovate[bot]
- [`bcf25bf`](https://github.com/yehezkieldio/topaz/commit/bcf25bf48989367e466776328b691f293ec0f7e7) deps: Update dependency nuqs to v2.5.1 ([#27](https://github.com/yehezkieldio/topaz/issues/27)) by renovate[bot]
- [`e482900`](https://github.com/yehezkieldio/topaz/commit/e4829005bae7dd216838448f3dbac43be6337305) deps: Update dependency zod to ^4.1.3 ([#28](https://github.com/yehezkieldio/topaz/issues/28)) by renovate[bot]
- [`cdb971e`](https://github.com/yehezkieldio/topaz/commit/cdb971ec3d5c0e98e121be74325623b4f3aa0077) deps: Update dependency @types/react-dom to ^19.1.8 ([#29](https://github.com/yehezkieldio/topaz/issues/29)) by renovate[bot]
- [`5d6499a`](https://github.com/yehezkieldio/topaz/commit/5d6499a5490aaaac4a5b5799fb000491bb9696fe) deps: Update dependency lucide-react to ^0.542.0 ([#30](https://github.com/yehezkieldio/topaz/issues/30)) by renovate[bot]
- [`4468635`](https://github.com/yehezkieldio/topaz/commit/4468635d1e34054854db7b8b0771c3c9442c4aa6) deps: Update dependency next to v15.5.1 ([#31](https://github.com/yehezkieldio/topaz/issues/31)) by renovate[bot]
- [`6ee251a`](https://github.com/yehezkieldio/topaz/commit/6ee251adda43bd39d244710ef5e3cf98b7b75774) deps: Update dependency next to v15.5.2 ([#32](https://github.com/yehezkieldio/topaz/issues/32)) by renovate[bot]
- [`7d355c2`](https://github.com/yehezkieldio/topaz/commit/7d355c25fa65312fa5e27d1d27f4784946347db7) deps: Update dependency @types/react to ^19.1.12 ([#33](https://github.com/yehezkieldio/topaz/issues/33)) by renovate[bot]
- [`e60c806`](https://github.com/yehezkieldio/topaz/commit/e60c806fb0f5d8bc9608f3e5745d2b223d89cd97) deps: Update dependency zod to ^4.1.4 ([#34](https://github.com/yehezkieldio/topaz/issues/34)) by renovate[bot]

### <!-- 3 -->🚀 New Features
- [`a6a955b`](https://github.com/yehezkieldio/topaz/commit/a6a955b6bdd43d011098acc55356dc6b7f890cc9) library-item-tags: Add expandable fandoms and tags
- [`0c2421b`](https://github.com/yehezkieldio/topaz/commit/0c2421b21c31fad8ea06b58ba816bcfc81d1ada0) library-item-tags: Add intersection observer for tags
## topaz@0.1.1-beta.6 (August 19, 2025)

### <!-- 2 -->🧩 Dependencies Updates
- [`43582dc`](https://github.com/yehezkieldio/topaz/commit/43582dc999df7599f497385bb2e24730f718dc37) deps: Update dependency @types/node to ^20.19.11 ([#3](https://github.com/yehezkieldio/topaz/issues/3)) by renovate[bot]
- [`89c5429`](https://github.com/yehezkieldio/topaz/commit/89c5429ecddda5ef5afdc09d0d809ccf28489a9f) deps: Update dependency nuqs to v2.5.0-beta.5 ([#4](https://github.com/yehezkieldio/topaz/issues/4)) by renovate[bot]
- [`bd05436`](https://github.com/yehezkieldio/topaz/commit/bd05436a7fef35d2c6d206037c0bbda6bbc11f2e) deps: Update dependency @yehezkieldio/firefly to ^2.1.3 ([#5](https://github.com/yehezkieldio/topaz/issues/5)) by renovate[bot]
- [`de5c1b4`](https://github.com/yehezkieldio/topaz/commit/de5c1b46596a7caa54c0b77276941bffce26d4f0) deps: Update tanstack-query monorepo to ^5.85.3 ([#6](https://github.com/yehezkieldio/topaz/issues/6)) by renovate[bot]
- [`e6c0742`](https://github.com/yehezkieldio/topaz/commit/e6c0742661b3d4204a62ef2bd1ce9847da5d836d) deps: Update dependency tw-animate-css to ^1.3.7 ([#7](https://github.com/yehezkieldio/topaz/issues/7)) by renovate[bot]
- [`a99ef57`](https://github.com/yehezkieldio/topaz/commit/a99ef579f97d7dfa2f2c5eb089d6e44109528ea8) deps: Update dependency @types/react-dom to ^19.1.7 ([#8](https://github.com/yehezkieldio/topaz/issues/8)) by renovate[bot]
- [`b011ede`](https://github.com/yehezkieldio/topaz/commit/b011ede63f615f870d23042701a775ec24b86aa9) deps: Update tailwindcss monorepo to ^4.1.12 ([#9](https://github.com/yehezkieldio/topaz/issues/9)) by renovate[bot]
- [`a314d42`](https://github.com/yehezkieldio/topaz/commit/a314d425e121155be1d24900dfdc2d01810d2070) deps: Update dependency @yehezkieldio/firefly to ^2.1.4 ([#11](https://github.com/yehezkieldio/topaz/issues/11)) by renovate[bot]
- [`4e80ae7`](https://github.com/yehezkieldio/topaz/commit/4e80ae7dcea4440f4ce69e7f3e043c0f14c46935) deps: Update dependency nuqs to v2.5.0-beta.6 ([#12](https://github.com/yehezkieldio/topaz/issues/12)) by renovate[bot]
- [`8d4a0fd`](https://github.com/yehezkieldio/topaz/commit/8d4a0fd0c41190655927454f8b8f886985a03877) deps: Update dependency lucide-react to ^0.540.0 ([#13](https://github.com/yehezkieldio/topaz/issues/13)) by renovate[bot]
- [`ac18054`](https://github.com/yehezkieldio/topaz/commit/ac18054def9e050a396d8950e06e141be8973d29) deps: Update dependency next to v15.4.7 ([#14](https://github.com/yehezkieldio/topaz/issues/14)) by renovate[bot]
- [`ffde5c8`](https://github.com/yehezkieldio/topaz/commit/ffde5c8f849f1e2bbf6af2c22906a2d332ac4f42) deps: Update tanstack-query monorepo to ^5.85.5 ([#15](https://github.com/yehezkieldio/topaz/issues/15)) by renovate[bot]

### <!-- 4 -->🐛 Bug Fixes
- [`6fe5ba8`](https://github.com/yehezkieldio/topaz/commit/6fe5ba8e2e37db56f2154a8cc7ab9b0bcda7cf65) api: Reset search query on story creation and edit
- [`a2634ac`](https://github.com/yehezkieldio/topaz/commit/a2634ac5b614e768ec25982f818040f9ca3b463d) library: Handle paste input in story form fields

### <!-- 9 -->🎨 Code Styling
- [`d88f7c1`](https://github.com/yehezkieldio/topaz/commit/d88f7c16040a9cd2cacd510bc910e2254676c97c) library: Remove unnecessary class from notes container
## topaz@0.1.1-beta.5 (August 16, 2025)

### <!-- 11 -->🛠️ Miscellaneous
- [`d448f2a`](https://github.com/yehezkieldio/topaz/commit/d448f2a202b7ba74a2a34b6795fee473467906ef) docker-compose: Update volume names

### <!-- 4 -->🐛 Bug Fixes
- [`16ff663`](https://github.com/yehezkieldio/topaz/commit/16ff663d846e14c0abe37320276491d30eb7d918) api: Update refetch behavior and stale time

### <!-- 5 -->📚 Documentation
- [`5fda0b7`](https://github.com/yehezkieldio/topaz/commit/5fda0b784e5983b9968473a27389a3cbe11c496a) copilot: Update commit message generation instructions
- [`ba87a6d`](https://github.com/yehezkieldio/topaz/commit/ba87a6d388bda4276a8773bc8c562d048277beeb) copilot: Update title of development instructions

### <!-- 7 -->🚜 Refactor
- [`f2e074f`](https://github.com/yehezkieldio/topaz/commit/f2e074f6fa51a90c6a1fff17a4f91fe7a939f4a2) ui: Remove unused library refetch functionality
## topaz@0.1.1-beta.4 (August 15, 2025)

### <!-- 3 -->🚀 New Features
- [`a6913c6`](https://github.com/yehezkieldio/topaz/commit/a6913c68518f81ada1c53d23f6e014d3802d76ff) ui: Add cache invalidation button in library filter
- [`d12024c`](https://github.com/yehezkieldio/topaz/commit/d12024c18e2e53fc74d6fded11bb3824a532691f) api: Add refetch interval for library data
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
