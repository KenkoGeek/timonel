# [3.0.0-beta.1](https://github.com/KenkoGeek/timonel/compare/v2.14.0-beta.1...v3.0.0-beta.1) (2025-12-01)

- feat!: rename ChartFactory to Rutter (maritime pilot concept) ([b0a7a33](https://github.com/KenkoGeek/timonel/commit/b0a7a3361e761a5b20ff2c203d55bdfab35323af))

### Bug Fixes

- address all security vulnerabilities from code review ([bf3165b](https://github.com/KenkoGeek/timonel/commit/bf3165b2198ea7b67e653df9a1b47ed25b1129b1))
- **aws:** update Karpenter API versions and add disruption/scheduling helpers ([#77](https://github.com/KenkoGeek/timonel/issues/77)) ([d03fb5f](https://github.com/KenkoGeek/timonel/commit/d03fb5f580810204905ad3ec95a0165f4e4339c1))
- change imports to use 'timonel' package instead of relative paths ([ac77265](https://github.com/KenkoGeek/timonel/commit/ac772651a85ed4f45426e4f603091939560f669a))
- **ci:** add comprehensive test suite with unit and integration tests ([#38](https://github.com/KenkoGeek/timonel/issues/38)) ([ad782c1](https://github.com/KenkoGeek/timonel/commit/ad782c1597469ffc98054a0b66f8091b6f2a1e0b))
- **ci:** add mandatory CI status verification to beta release ([6b4083c](https://github.com/KenkoGeek/timonel/commit/6b4083c478c41415b5767cb311a7006f817f0bb7))
- **ci:** and beside or ([401c06a](https://github.com/KenkoGeek/timonel/commit/401c06acf05d8fb60a34faf2991756d4b317b9e6))
- **ci:** change CodeQL build-mode to 'none' for JavaScript/TypeScript ([e47c97a](https://github.com/KenkoGeek/timonel/commit/e47c97acf6670007c5dbdbc90a197aa438095694))
- **ci:** clean up workflows and fix CodeQL configuration ([1dd7b62](https://github.com/KenkoGeek/timonel/commit/1dd7b6242e9ea5d3d98443965704d84bfca18a4a))
- **ci:** configure GitHub App token for semantic-release bypass - Use RELEASE_TOKEN from npm-prd environment for checkout and semantic-release ([ab4eea3](https://github.com/KenkoGeek/timonel/commit/ab4eea394d98227ed330091f0a3972eee903de9a))
- **ci:** correct CodeQL workflow configuration ([c6f9b53](https://github.com/KenkoGeek/timonel/commit/c6f9b53eb641a47c2c8723405c54f7119f0d0be8))
- **ci:** correct CodeQL workflow name in release.yaml ([09db750](https://github.com/KenkoGeek/timonel/commit/09db750692a26e9195f03ea459acbd1549a9087f))
- **ci:** correct job dependencies and summary references ([27a5d97](https://github.com/KenkoGeek/timonel/commit/27a5d9748a3a7d4fbe2b120830fd94c16f957336))
- **ci:** disable body-max-line-length for semantic-release compatibility - Set body-max-line-length to 0 (disabled) to allow long changelog entries - Fixes semantic-release commit validation failures - Maintains other commitlint rules for developer commits ([cf2e199](https://github.com/KenkoGeek/timonel/commit/cf2e19972b31f30a8d681d5f540b02b6c381e04b))
- **ci:** disable footer line length limit for semantic-release commits ([143d512](https://github.com/KenkoGeek/timonel/commit/143d512a8a41881c3cf84868a72b478598678c53))
- **ci:** disable footer-leading-blank for semantic-release compatibility - Set footer-leading-blank to 0 (disabled) to allow semantic-release footer format ([b14b45c](https://github.com/KenkoGeek/timonel/commit/b14b45c4435b9bfecb20fa4e270d36994a942241))
- **ci:** ensure real release on main branch ([fb898e6](https://github.com/KenkoGeek/timonel/commit/fb898e667d499bdc52166d6beb82c566f3c39eb1))
- **ci:** lint errors ([210d0e2](https://github.com/KenkoGeek/timonel/commit/210d0e242a80568cb3a2a99fe9544bbc466aedd8))
- **ci:** Q gate not needed ([7d809e0](https://github.com/KenkoGeek/timonel/commit/7d809e0cbb12f9d90d889537f8c8e2dff67d8343))
- **ci:** Q gate not needed ([a6e1faf](https://github.com/KenkoGeek/timonel/commit/a6e1fafbc4c9a82b8b119d91d72b50970b2cd852))
- **ci:** remove explicit pnpm version from CodeQL workflow ([8e947ee](https://github.com/KenkoGeek/timonel/commit/8e947eefd39ab050c6830fa21eb26141bf6ba4dc))
- **ci:** remove explicit pnpm version from workflows ([22ff6d7](https://github.com/KenkoGeek/timonel/commit/22ff6d7f031f4d82449430d038c0b03cf0c1d670))
- **ci:** remove npm-prd environment from beta release ([4cc4e77](https://github.com/KenkoGeek/timonel/commit/4cc4e77c066b1a39b0f6aa23d4b113cbeee0459e))
- **ci:** remove pnpm cache from setup-node to prevent executable error ([349a87b](https://github.com/KenkoGeek/timonel/commit/349a87b2407374b6fa1da6a36df393465a6a4fc3))
- **ci:** remove redundant publish workflow and configure release token ([4ac7597](https://github.com/KenkoGeek/timonel/commit/4ac75970bea9ca503af9d940b06f7ecb4ceb0bea))
- **ci:** reorder pnpm setup before Node.js in CodeQL workflow ([6b806c8](https://github.com/KenkoGeek/timonel/commit/6b806c85f68aefd4531a5a20093a7f277da06fde))
- **ci:** replace CodeQL with security check in release validation ([#15](https://github.com/KenkoGeek/timonel/issues/15)) ([6a3df07](https://github.com/KenkoGeek/timonel/commit/6a3df076d07bbf548a6acb86eea97a6e83441af8))
- **ci:** resolve pnpm version conflict in workflows ([4d041ed](https://github.com/KenkoGeek/timonel/commit/4d041ede0716975efc65ce18b1656e4358ca8441))
- **ci:** resolve release workflow issues ([#16](https://github.com/KenkoGeek/timonel/issues/16)) ([46a9581](https://github.com/KenkoGeek/timonel/commit/46a9581bc84c70bbb8b39cd4fbc0e3a15f4bfc13))
- **ci:** restore release.yml workflow from v2.7.3 ([7d14a52](https://github.com/KenkoGeek/timonel/commit/7d14a522a913532a8bc214c1bc1b67596b2811d9))
- **ci:** restore working release workflow from v2.7.3 ([e3540ac](https://github.com/KenkoGeek/timonel/commit/e3540acd65a84f1a06f8ded068c7431d39b35e51))
- **ci:** simple but effective release ([20b439d](https://github.com/KenkoGeek/timonel/commit/20b439dd5d21e4fc43de662bb3f6ea21248b7498))
- **ci:** simple but effective release, security.md updated ([45a0085](https://github.com/KenkoGeek/timonel/commit/45a00850f0653bcc41cca8b75050b5011551f7e4))
- **ci:** specify explicit semantic-release config file ([8b7e5dc](https://github.com/KenkoGeek/timonel/commit/8b7e5dca2a357dcd55e206a512ef9b0428d928ad))
- **ci:** use exact pnpm version 10.15.0 in workflows ([a91d38d](https://github.com/KenkoGeek/timonel/commit/a91d38d0690fb9e01235f5d44b6147ce0da4b286))
- **ci:** use working semantic-release config from v2.7.3 ([bc23629](https://github.com/KenkoGeek/timonel/commit/bc23629a2fb0c9f174cded6964beeb2b309db359))
- **cli:** consolidate path validation and improve error handling ([a46a5eb](https://github.com/KenkoGeek/timonel/commit/a46a5ebd6f27a23ac2d71b5d98dd371adfbec070))
- **cli:** enable TypeScript execution with enhanced security and strict mode validation ([8dd9e4c](https://github.com/KenkoGeek/timonel/commit/8dd9e4c8c2f555707aea2fc53c9e5161b82c0b4b))
- **cli:** handle flags after positional arguments ([#142](https://github.com/KenkoGeek/timonel/issues/142)) ([bea408f](https://github.com/KenkoGeek/timonel/commit/bea408fe88011185541acf9b102910321ff79642))
- **cli:** harden flag handling and path validation ([#130](https://github.com/KenkoGeek/timonel/issues/130)) ([569f445](https://github.com/KenkoGeek/timonel/commit/569f445735626db50d68c4be88c2e805d390286f))
- **cli:** improve version display and fallback handling ([#117](https://github.com/KenkoGeek/timonel/issues/117)) ([5d34db0](https://github.com/KenkoGeek/timonel/commit/5d34db0bfe092b640635e7edb0866359f6e8eb93))
- **cli:** new feature for cli ([14f3a4a](https://github.com/KenkoGeek/timonel/commit/14f3a4afc3454bf27427c36a423ee234940e25e3))
- **cli:** resolve ES modules \_\_dirname and scaffold import paths ([#80](https://github.com/KenkoGeek/timonel/issues/80)) ([8f1157f](https://github.com/KenkoGeek/timonel/commit/8f1157fa34d4b95c628961fc779661f747410859))
- **cli:** resolve incorrect syntax in conditional Helm templates, ensuring namespace and ingress conditions work correctly ([86a9215](https://github.com/KenkoGeek/timonel/commit/86a9215dc782c01731ce7bdfd9c010b0c9f96523))
- **cli:** resolve timonel module not found error in umbrella.ts ([c5e66fc](https://github.com/KenkoGeek/timonel/commit/c5e66fc815f8754f6592dc0bc407ce8515072f3d))
- **core:** addIngress already normalized with NGINX best practices ([1107e44](https://github.com/KenkoGeek/timonel/commit/1107e441ad9e4b04007f494891840ef94acafc28))
- **core:** correct StorageClass API structure for Kubernetes 1.32+ compatibility ([48ba6ca](https://github.com/KenkoGeek/timonel/commit/48ba6ca17ea104b894efc904786a41510fc6482e)), closes [#58](https://github.com/KenkoGeek/timonel/issues/58) [#58](https://github.com/KenkoGeek/timonel/issues/58)
- **core:** correct TypeScript errors and improve version handling ([9ade121](https://github.com/KenkoGeek/timonel/commit/9ade121516c1c04e7b0d939e46b82cd76366fea4))
- **core:** ensure Timonel header appears in all YAML files ([7d93d4e](https://github.com/KenkoGeek/timonel/commit/7d93d4ec9fbba703af9436c0b2e23acc3ef540ad))
- **core:** implement CLI-focused security validations and centralized input sanitization ([0568d38](https://github.com/KenkoGeek/timonel/commit/0568d38eac2ba69b5cdccdc5f735e635a092f8e9))
- **core:** resolve critical issues [#52](https://github.com/KenkoGeek/timonel/issues/52)-[#56](https://github.com/KenkoGeek/timonel/issues/56) and security vulnerabilities ([9c86e55](https://github.com/KenkoGeek/timonel/commit/9c86e5512716b686afa04e7b033652633cc340f7))
- **core:** resolve issue [#114](https://github.com/KenkoGeek/timonel/issues/114) - invalid Helm template generation ([b958d45](https://github.com/KenkoGeek/timonel/commit/b958d454b49e8ab61be0f9bcddcb96a831c5298d))
- **core:** resolve splitDocs removing Timonel headers from YAML ([7335025](https://github.com/KenkoGeek/timonel/commit/73350253d73f4adaa616b5290e35573b29702bf4))
- **core:** TypeScript interfaces for GCP Artifact Registry and Karpenter helpers ([#72](https://github.com/KenkoGeek/timonel/issues/72)) ([914e6fa](https://github.com/KenkoGeek/timonel/commit/914e6fa04d286533255a9987802c60deae3e878c))
- correct Helm template expression formatting for include and inline conditionals ([927d6a3](https://github.com/KenkoGeek/timonel/commit/927d6a353bd8b5fb8b2afa8cb6738a55fa36b3e9))
- **deps:** merge conflict solved [skip ci] ([8931abd](https://github.com/KenkoGeek/timonel/commit/8931abd5c800fe85fa7cda0a06d2ea183f54e185))
- **deps:** merge conflicts ([a0dd0bd](https://github.com/KenkoGeek/timonel/commit/a0dd0bdecf603fd43335721fc2e201f81bede2d1))
- **deps:** merge conflicts ([0f2d49f](https://github.com/KenkoGeek/timonel/commit/0f2d49ff6316f9e76c4eb18f39ae78599b19475b))
- **deps:** upgrade timonel version [skip ci] ([20cae6f](https://github.com/KenkoGeek/timonel/commit/20cae6fa57a61bc44a18d9c7af8e7ad8970d7af9))
- **docs:** apply prettier formatting to README.md ([bc9c00b](https://github.com/KenkoGeek/timonel/commit/bc9c00be41167296ef5852e26547975aea7c9cc7))
- **docs:** use published npm package imports in example instead of local src ([80e19f4](https://github.com/KenkoGeek/timonel/commit/80e19f40acf9d0073db15d6d576a9e0776dbdc62))
- **docs:** valuesRef and lib imported example ([72bc785](https://github.com/KenkoGeek/timonel/commit/72bc7858b615cbf5652cca81b45d9d2d799d913c))
- **examples:** update timonel dependency to ^1.0.0 ([b9e8e19](https://github.com/KenkoGeek/timonel/commit/b9e8e19bf7cf942c675b9116efa6de5b8c7ba36c))
- exclude examples from main lint script ([5ba6ea8](https://github.com/KenkoGeek/timonel/commit/5ba6ea8670459c53fd053e8938430ec8f180188b))
- exclude examples from security linting ([5761d41](https://github.com/KenkoGeek/timonel/commit/5761d410471137b1655d624162a9921818ce2597))
- format CHANGELOG.md with prettier ([b382ea0](https://github.com/KenkoGeek/timonel/commit/b382ea0d4dfacf1c3ffcd05648c762a9d4202938))
- **helm:** implement Helm-aware YAML serializer ([#112](https://github.com/KenkoGeek/timonel/issues/112)) ([fdf7cd9](https://github.com/KenkoGeek/timonel/commit/fdf7cd90c86dbeff2136e618b20a9f86e0f8b51d))
- **helm:** remove automatic numbering from template files ([#20](https://github.com/KenkoGeek/timonel/issues/20)) ([e21b1cf](https://github.com/KenkoGeek/timonel/commit/e21b1cf2bc62a73b3f2ab84514b6fa415452a725))
- **helm:** remove debug logs from helmChartWriter ([63870a7](https://github.com/KenkoGeek/timonel/commit/63870a715db0c05e03a9b496b619284a3e34c848))
- **helm:** trying to make it work ([3ce69d5](https://github.com/KenkoGeek/timonel/commit/3ce69d56969468260f159870abc5b3f089bad9ab))
- ignore node_modules MDs ([fda76c4](https://github.com/KenkoGeek/timonel/commit/fda76c497ad7197195287aa5b47e8ee000bcc03e))
- ignore node_modules MDs ([8804860](https://github.com/KenkoGeek/timonel/commit/88048609d155883b4c473ddc85ab276d368cf0a8))
- **network:** Ingress API with TLS validation and security defaults ([#88](https://github.com/KenkoGeek/timonel/issues/88)) ([348ee2d](https://github.com/KenkoGeek/timonel/commit/348ee2dcf27d8b44064245f89279d0cfe9aa4973))
- **release:** align required checks with ruleset configuration ([d912f3c](https://github.com/KenkoGeek/timonel/commit/d912f3c0229eb78f0fc927421007b8eb5347b8b9))
- **release:** update required checks in release workflow ([ba2712e](https://github.com/KenkoGeek/timonel/commit/ba2712e2cc95cb55588fcf583a84da365acd84a7))
- resolve ESLint sonarjs plugin compatibility for CI ([48c16e6](https://github.com/KenkoGeek/timonel/commit/48c16e641bbd0984df00268360a873e7bd5d58c9))
- resolve Helm chart YAML generation issues ([5e8c779](https://github.com/KenkoGeek/timonel/commit/5e8c7794fcbfb3bddef1f2136ba78103b28ab62b))
- resolve issue [#114](https://github.com/KenkoGeek/timonel/issues/114) - Helm template generation bug and enhance documentation ([#116](https://github.com/KenkoGeek/timonel/issues/116)) ([65d4f26](https://github.com/KenkoGeek/timonel/commit/65d4f26c1449135704e59eb8acf71268f4f660d0))
- resolve markdown linting issues ([8a817ef](https://github.com/KenkoGeek/timonel/commit/8a817ef2836fb8289f612ad171e4aaf010904f53))
- resolve prettier formatting issues and enhance CI checks ([648b35c](https://github.com/KenkoGeek/timonel/commit/648b35cbe55889b855bb56c652b6a4b8c3021bf1))
- resolve remaining eslint errors ([64f60e5](https://github.com/KenkoGeek/timonel/commit/64f60e5967676f2b651967e9c53b6c083a18d69b))
- resolve TypeScript module resolution error in CLI validation ([41ad96e](https://github.com/KenkoGeek/timonel/commit/41ad96e2e7dc2366f7fec189a0d9e551da3466ad))
- resolve TypeScript strict optional types errors ([2906889](https://github.com/KenkoGeek/timonel/commit/2906889e352d94eae8070a5f99734ca1f5d35767))
- resolve umbrella chart validation issues ([48206b6](https://github.com/KenkoGeek/timonel/commit/48206b660eb2998bb31f326e420ba2f4d3ceb89b))
- **umbrella:** remove unused \_subchartInstance variables ([ee07f96](https://github.com/KenkoGeek/timonel/commit/ee07f96c49a032289654f57a407e9bfba7ebc171))
- update examples versions and resolve security vulnerability ([68fad19](https://github.com/KenkoGeek/timonel/commit/68fad195baaac65085ca8634d1d7f62d8c1c1361))
- update pnpm-lock.yaml after removing cdk8s-plus-28 ([ff1b929](https://github.com/KenkoGeek/timonel/commit/ff1b9298e068df7e0fc715f21dc7d4150eccc2c3))
- update WordPress example imports to use timonel package ([19a36a6](https://github.com/KenkoGeek/timonel/commit/19a36a6e010abe2276268dbe64b27bb6144ae16e))

### Features

- add --set flag for dynamic value overrides ([36ae842](https://github.com/KenkoGeek/timonel/commit/36ae8422b4db34a2ded90eeede04d39a0ffe7b98))
- add AWS ALB Ingress helper ([f9c7009](https://github.com/KenkoGeek/timonel/commit/f9c70095796db9147d8bc9a6bf513ebe4ae7eb46))
- add AWS EBS CSI storage helpers ([dae2258](https://github.com/KenkoGeek/timonel/commit/dae2258b4beb1735430112f7f16b5ac7d0f17a83))
- add AWS EFS CSI storage helpers ([343e5f8](https://github.com/KenkoGeek/timonel/commit/343e5f831855bc40a081d982eebc3b051d27ac99))
- add AWS Secrets Manager and Parameter Store support ([c17cfe1](https://github.com/KenkoGeek/timonel/commit/c17cfe1f6b3d90619148f64e1db612946e305a32))
- add CHANGELOG and GitHub templates following npm best practices ([51448cc](https://github.com/KenkoGeek/timonel/commit/51448cc00c47eaa1f5a6f9627c88249f734d3377))
- add comprehensive AWS 2048 game example ([2f9ac11](https://github.com/KenkoGeek/timonel/commit/2f9ac1115fd7980ba581fc9b1ca0adbedab11aa4))
- add comprehensive IRSA ServiceAccount support ([eec3337](https://github.com/KenkoGeek/timonel/commit/eec333735fae2431aab9307f012ede01604462b2))
- add custom manifest naming support ([4d70c8e](https://github.com/KenkoGeek/timonel/commit/4d70c8e70a6bb6d4b0b61bc15bfd3b15a7e8a30b))
- add custom manifest naming support ([a631e06](https://github.com/KenkoGeek/timonel/commit/a631e065165c35f68e2ed39d97550fc9c52e5f38))
- add custom manifest naming to all examples ([f3d1880](https://github.com/KenkoGeek/timonel/commit/f3d188096b74242c10317592fc09ba463ff43631))
- add HorizontalPodAutoscaler support ([7b43d1b](https://github.com/KenkoGeek/timonel/commit/7b43d1b96f8b4dd50d64f4f3830de7c9b6f7c638))
- add manual release workflow with GitHub Actions ([e45aaad](https://github.com/KenkoGeek/timonel/commit/e45aaad56d965a1337cede8fbda30d3a442f56be))
- add NetworkPolicy helpers for Zero Trust network security ([#13](https://github.com/KenkoGeek/timonel/issues/13)) ([f80f23e](https://github.com/KenkoGeek/timonel/commit/f80f23e940f282715e2e0ef90f0a8224ddad0ea6))
- add PodDisruptionBudget support ([2b8b14c](https://github.com/KenkoGeek/timonel/commit/2b8b14c697ec7d45763b0b0cda3adbcea6c462a6))
- add umbrella charts support ([c37a366](https://github.com/KenkoGeek/timonel/commit/c37a3664e2ce5242ff4749ed72e7b0f0555a7f91))
- add version command to CLI ([4d11f20](https://github.com/KenkoGeek/timonel/commit/4d11f20b0a3f1e560f862f3afa8d5a66321db4b0))
- add VerticalPodAutoscaler support ([5f11343](https://github.com/KenkoGeek/timonel/commit/5f11343580e6ee3712098bfed7a71e3b4a3e7380))
- add WordPress with MySQL example chart ([4971b61](https://github.com/KenkoGeek/timonel/commit/4971b61e7821e7ecc4a8ab1a529326198243400c))
- **ci:** add automatic beta release workflow for main branch ([89fa5d2](https://github.com/KenkoGeek/timonel/commit/89fa5d2e5da4ef2d44a874371d485d25bdc4ba69))
- **ci:** add automatic CHANGELOG.md formatting to semantic-release ([babe71f](https://github.com/KenkoGeek/timonel/commit/babe71f93e8e0344ea0239082fa4a327246c7b48))
- **ci:** add beta releases on main with quality gates [skip ci] ([8b6b7da](https://github.com/KenkoGeek/timonel/commit/8b6b7da31901b954aa8eba1cd027c98a9a505109))
- **ci:** add required status checks validation to release workflow ([#14](https://github.com/KenkoGeek/timonel/issues/14)) ([5f4e89d](https://github.com/KenkoGeek/timonel/commit/5f4e89df8c72f8d487cd95ce12789510cba29ce6))
- **ci:** configure dual release strategy ([b114395](https://github.com/KenkoGeek/timonel/commit/b114395b820bfea5c1354e4b1229337db878af29))
- **ci:** implement automated semantic release with conventional commits ([81dc9d4](https://github.com/KenkoGeek/timonel/commit/81dc9d4d266d90a5e70cabb67eabfd42a5069e69))
- **ci:** implement automated semantic release with conventional commits ([3fb9abd](https://github.com/KenkoGeek/timonel/commit/3fb9abdd7fac413882737577a59eb5c5b13cddbf))
- **ci:** optimize GitHub workflows with enhanced performance and reliability ([7e1b409](https://github.com/KenkoGeek/timonel/commit/7e1b409776f3e63ac79493630e70eb04fb5f416d))
- **ci:** simplify to beta releases only ([e5aed20](https://github.com/KenkoGeek/timonel/commit/e5aed206d5247c7d11cba15c13d49904ef31c22e))
- **cli:** add Helm helpers (helmIf, helmWith) to templates and new release ([#201](https://github.com/KenkoGeek/timonel/issues/201)) ([e3f1cf8](https://github.com/KenkoGeek/timonel/commit/e3f1cf885d8f8fa4263013179144d51ac99afa0f))
- **core:** add Azure Application Gateway Ingress Controller (AGIC) support ([#19](https://github.com/KenkoGeek/timonel/issues/19)) ([2d3cbdd](https://github.com/KenkoGeek/timonel/commit/2d3cbddda3b4206f5d465632d45ecd1dd9cf60ae))
- **core:** add Azure Disk StorageClass helper for AKS ([#18](https://github.com/KenkoGeek/timonel/issues/18)) ([f88dac1](https://github.com/KenkoGeek/timonel/commit/f88dac1a79369227d85a0a7e90e2718192e4f9b4))
- **core:** add comprehensive Azure helpers for AKS integration with enhanced security ([eb460b4](https://github.com/KenkoGeek/timonel/commit/eb460b483597ab9c72fc98df00df2cee54a125ed))
- **core:** add GKE Workload Identity ServiceAccount, AWS ECR ServiceAccount helpers. implement modular architecture. add Role resource support for RBAC. with resource providers. add DaemonSet resource support. add StatefulSet resource support. add ClusterRole resource support for cluster-wide RBAC. add RoleBinding resource support for RBAC ([#33](https://github.com/KenkoGeek/timonel/issues/33)) ([6c6204e](https://github.com/KenkoGeek/timonel/commit/6c6204e1664912125a1cd22dc931cb4189ec066e))
- **core:** add Job and CronJob helpers for batch workloads ([#21](https://github.com/KenkoGeek/timonel/issues/21)) ([b14d886](https://github.com/KenkoGeek/timonel/commit/b14d88654ef114fc0010487ded11953ca186dcd7))
- **core:** add Karpenter integration with 5 methods, fix performance issues, and update security docs ([#31](https://github.com/KenkoGeek/timonel/issues/31)) ([9660467](https://github.com/KenkoGeek/timonel/commit/9660467512540e35cbeb55b0a212fd6ae0ac5c6b))
- **core:** add NetworkPolicy helpers for Zero Trust network security ([df3b344](https://github.com/KenkoGeek/timonel/commit/df3b344172f9b60402bc8172e343023194ed6b57))
- **core:** Add NetworkPolicy, ServiceAccount, CronJob, HPA, VPA, Ingress, and Karpenter resources ([8804102](https://github.com/KenkoGeek/timonel/commit/8804102d20ce430457db3674f11b41464a6ba360))
- **core:** add reusable pod template helpers with security profiles, workload optimization, sidecar patterns, and health checks ([9c7acfc](https://github.com/KenkoGeek/timonel/commit/9c7acfcc370da34457d6f6f1bb15ba15883bc8bd))
- **core:** add security helpers - sanitizeEnvVar, validateImageTag, generateSecretName ([#43](https://github.com/KenkoGeek/timonel/issues/43)) ([247bb57](https://github.com/KenkoGeek/timonel/commit/247bb57ea775014c2a3debef89ebda1551412d13))
- **core:** add Whatever tomorrow brings Ill be there ([51cb023](https://github.com/KenkoGeek/timonel/commit/51cb023d8dcded034a3b25774d7010f00bb94733))
- **core:** Add with open arms and open eyes, yeah ([a6e6a68](https://github.com/KenkoGeek/timonel/commit/a6e6a681d7ca66069312089276f3cf1d917ee9f2))
- **core:** enhance ChartProps for better flexibility ([49919c2](https://github.com/KenkoGeek/timonel/commit/49919c2cb6bd1361243e6eb5735dbf89972338b5))
- **core:** exporting createHelmExpression() from helmYamlSerializer ([#196](https://github.com/KenkoGeek/timonel/issues/196)) ([d99b5b6](https://github.com/KenkoGeek/timonel/commit/d99b5b6276cf074bb400d8ef3209e337264a74b1))
- **core:** refactor addConditionalManifest to manage helm templates ([cd38ca1](https://github.com/KenkoGeek/timonel/commit/cd38ca144fdfabc7e41220eea9783a5a189046da))
- **core:** restore v2.3.0 functionality with modern architecture ([4dfa2c9](https://github.com/KenkoGeek/timonel/commit/4dfa2c928f90fa3fc3d927484c6e6baabe106f3f)), closes [#34](https://github.com/KenkoGeek/timonel/issues/34) [#35](https://github.com/KenkoGeek/timonel/issues/35) [#36](https://github.com/KenkoGeek/timonel/issues/36)
- **docs:** update references and CLI [skip ci] ([7d236c8](https://github.com/KenkoGeek/timonel/commit/7d236c8aa142aa98b60fa9275deb3017fb5dda3e))
- **docs:** update references and CLI [skip ci] ([75238c6](https://github.com/KenkoGeek/timonel/commit/75238c6ecd15e3c900d255338efb12fc1205f845))
- enhance AWS 2048 example with production-ready AWS features ([5a6c3ea](https://github.com/KenkoGeek/timonel/commit/5a6c3eabc9df7ae9554e742c5e3855540a6fcd0e))
- enhance CLI with CI/CD support commands and flags ([ddb2cc7](https://github.com/KenkoGeek/timonel/commit/ddb2cc75bbd8e7fb2db1f9d6e09ce77b48db5f75))
- enhance validate command with helm lint and installation detection ([62d56a9](https://github.com/KenkoGeek/timonel/commit/62d56a9c2b86d94fbe9c01b2a4a399b72b9c4b84))
- **helm:** add comprehensive helm helpers with Helm template validation ([#123](https://github.com/KenkoGeek/timonel/issues/123)) ([29c4934](https://github.com/KenkoGeek/timonel/commit/29c4934e79a50b3b2f86d38eb15a5e613502ef3c))
- **helm:** adding new and typesafe helpers ([7b1e951](https://github.com/KenkoGeek/timonel/commit/7b1e951df5c0550889e56f0f2e18fb6bfb97ed79))
- **network:** enhance NGINX Ingress support with cert-manager integration and security enhanced ([#91](https://github.com/KenkoGeek/timonel/issues/91)) ([feec4d1](https://github.com/KenkoGeek/timonel/commit/feec4d1cea93f261b7e302aafbb2a700d6885812))
- rename example to examples and document in README ([490fbe8](https://github.com/KenkoGeek/timonel/commit/490fbe89d33e56612804b66399be6191cdfb038b))
- update examples package.json for v0.3.0 ([bcd4a2e](https://github.com/KenkoGeek/timonel/commit/bcd4a2e6ec85e29ca98f81597199353d3fcf8bc4))
- update TypeScript to Node16 module resolution ([ab3e347](https://github.com/KenkoGeek/timonel/commit/ab3e347e66fb71c772a09346803c699785db29a4))

### Performance Improvements

- **ci:** homogenize CI/CD workflows and optimize release pipeline ([#17](https://github.com/KenkoGeek/timonel/issues/17)) ([787e85c](https://github.com/KenkoGeek/timonel/commit/787e85cd91ff78ed90394b98d99cc6c558365a42))

### Reverts

- **ci:** restore original release workflow ([4660b1e](https://github.com/KenkoGeek/timonel/commit/4660b1e5298ad86b9b37b1b814b07ea0f090cdb8))

### BREAKING CHANGES

- **helm:** Template files no longer have automatic numbering prefixes

- refactor(helm): unify template naming strategy and add breaking change notice

* Simplify file naming logic with unified approach
* Use consistent naming strategy for single and multiple documents
* Add breaking change warning in README for numbered filename dependencies
* Improve code maintainability with cleaner implementation

Addresses PR review feedback for better consistency and user awareness.

- **ci:** ESLint configuration migrated to flat config format
- **ci:** ESLint configuration migrated to flat config format
- ChartFactory class renamed to Rutter

* Rename ChartFactory class to Rutter across all files
* Update examples to use new Rutter class
* Update README and documentation
* Rename ChartFactory.ts to Rutter.ts
* All tests pass, linting and security checks pass
* Bump version to 0.1.7

# [2.14.0-beta.1](https://github.com/KenkoGeek/timonel/compare/v2.13.0...v2.14.0-beta.1) (2025-11-28)

### Features

- **cli:** add Helm helpers (helmIf, helmWith) to templates and new release ([#201](https://github.com/KenkoGeek/timonel/issues/201)) ([b5ecb0f](https://github.com/KenkoGeek/timonel/commit/b5ecb0f29b207f7ff225b971c6e698bbc2d26073))

# [2.13.0](https://github.com/KenkoGeek/timonel/compare/v2.12.2...v2.13.0) (2025-11-24)

### Features

- **core:** exporting createHelmExpression() from helmYamlSerializer ([#196](https://github.com/KenkoGeek/timonel/issues/196)) ([e9ee2d0](https://github.com/KenkoGeek/timonel/commit/e9ee2d08b6ad305e0652c53e7756240793987861))

# [2.13.0-beta.1](https://github.com/KenkoGeek/timonel/compare/v2.12.2...v2.13.0-beta.1) (2025-11-24)

### Features

- **core:** exporting createHelmExpression() from helmYamlSerializer ([#196](https://github.com/KenkoGeek/timonel/issues/196)) ([e9ee2d0](https://github.com/KenkoGeek/timonel/commit/e9ee2d08b6ad305e0652c53e7756240793987861))

## [2.12.2](https://github.com/KenkoGeek/timonel/compare/v2.12.1...v2.12.2) (2025-11-22)

### Bug Fixes

- **cli:** handle flags after positional arguments ([#142](https://github.com/KenkoGeek/timonel/issues/142)) ([36ac024](https://github.com/KenkoGeek/timonel/commit/36ac024fa7c2a454a184394337a65ebae46a65f9))
- **deps:** merge conflicts ([3f4e054](https://github.com/KenkoGeek/timonel/commit/3f4e054f89d121e59e6df90950223ec9a6019cae))
- **deps:** merge conflicts ([063294e](https://github.com/KenkoGeek/timonel/commit/063294e0a81bee12997cdeef75229e482a896329))

## [2.12.2-beta.1](https://github.com/KenkoGeek/timonel/compare/v2.12.1...v2.12.2-beta.1) (2025-10-04)

### Bug Fixes

- **cli:** handle flags after positional arguments ([#142](https://github.com/KenkoGeek/timonel/issues/142)) ([36ac024](https://github.com/KenkoGeek/timonel/commit/36ac024fa7c2a454a184394337a65ebae46a65f9))

## [2.12.1](https://github.com/KenkoGeek/timonel/compare/v2.12.0...v2.12.1) (2025-09-28)

### Bug Fixes

- **cli:** new feature for cli ([a8c5326](https://github.com/KenkoGeek/timonel/commit/a8c532617616bfedada20d28bcc4fe94ea165321))

# [2.12.0](https://github.com/KenkoGeek/timonel/compare/v2.11.0...v2.12.0) (2025-09-28)

### Bug Fixes

- **cli:** harden flag handling and path validation ([#130](https://github.com/KenkoGeek/timonel/issues/130)) ([2186d88](https://github.com/KenkoGeek/timonel/commit/2186d886428752025e7bf531c4a6541dade683a6))

### Features

- **docs:** update references and CLI [skip ci] ([23704d3](https://github.com/KenkoGeek/timonel/commit/23704d3164cfbb92d183af40c70e27a32b566d06))
- **docs:** update references and CLI [skip ci] ([be4bcdc](https://github.com/KenkoGeek/timonel/commit/be4bcdca62cb3a9339e5ad70efc0ba31a6d9d5be))

# [2.11.0](https://github.com/KenkoGeek/timonel/compare/v2.10.2...v2.11.0) (2025-09-26)

### Features

- **helm:** add comprehensive helm helpers with Helm template validation ([#123](https://github.com/KenkoGeek/timonel/issues/123)) ([bda8115](https://github.com/KenkoGeek/timonel/commit/bda811546d308eaa3ee5aec7fd8356b4a508940e))

## [2.10.2](https://github.com/KenkoGeek/timonel/compare/v2.10.1...v2.10.2) (2025-09-20)

### Bug Fixes

- **cli:** consolidate path validation and improve error handling ([239a50f](https://github.com/KenkoGeek/timonel/commit/239a50fb30be451301d2af6a586b77748a3db6ec))

## [2.10.1](https://github.com/KenkoGeek/timonel/compare/v2.10.0...v2.10.1) (2025-09-20)

### Bug Fixes

- **cli:** improve version display and fallback handling ([#117](https://github.com/KenkoGeek/timonel/issues/117)) ([7ad67e2](https://github.com/KenkoGeek/timonel/commit/7ad67e23f936edcc6e9e7d886c257046ca4dccc6))
- **helm:** remove debug logs from helmChartWriter ([742e1c9](https://github.com/KenkoGeek/timonel/commit/742e1c94f2858ec1afaf90cf5f2955b692e18f6b))

# [2.10.0](https://github.com/KenkoGeek/timonel/compare/v2.9.2...v2.10.0) (2025-09-20)

### Bug Fixes

- **ci:** and beside or ([2901953](https://github.com/KenkoGeek/timonel/commit/2901953363ff81c03ad95e57fbf61129bffe4138))
- **ci:** change CodeQL build-mode to 'none' for JavaScript/TypeScript ([017ec93](https://github.com/KenkoGeek/timonel/commit/017ec930940780fca9e6f93e02372067f899675f))
- **ci:** clean up workflows and fix CodeQL configuration ([4c3ac55](https://github.com/KenkoGeek/timonel/commit/4c3ac55e04210d77ad694aef1fab261482a7f5e9))
- **ci:** correct CodeQL workflow configuration ([25813d3](https://github.com/KenkoGeek/timonel/commit/25813d3b4ce649da5fa3b1cf29f825369c17b196))
- **ci:** correct CodeQL workflow name in release.yaml ([cb38608](https://github.com/KenkoGeek/timonel/commit/cb3860881b527f5016dcdc891f848c22ea464868))
- **ci:** correct job dependencies and summary references ([d37cc9c](https://github.com/KenkoGeek/timonel/commit/d37cc9ccf05407f28b85bd7eeb5710b2460b72ef))
- **ci:** ensure real release on main branch ([c06a5f7](https://github.com/KenkoGeek/timonel/commit/c06a5f7f9d0d45261c95e677f04382e0e20de58d))
- **ci:** lint errors ([08fbb64](https://github.com/KenkoGeek/timonel/commit/08fbb645b3661a2bc4e6bf33b309ab88cd707fef))
- **ci:** remove explicit pnpm version from CodeQL workflow ([25a8a6c](https://github.com/KenkoGeek/timonel/commit/25a8a6cd9556ae614bb84bfcc147aadb17850f48))
- **ci:** remove explicit pnpm version from workflows ([b517e1e](https://github.com/KenkoGeek/timonel/commit/b517e1eb35b3ab57673428c7d80fa25d427bf046))
- **ci:** reorder pnpm setup before Node.js in CodeQL workflow ([904579c](https://github.com/KenkoGeek/timonel/commit/904579ca507ef2cad5f11887e35431e6a15a59f5))
- **ci:** resolve pnpm version conflict in workflows ([a2ee153](https://github.com/KenkoGeek/timonel/commit/a2ee153934c5710e58f8e5bd85da6ea70e1c8959))
- **ci:** simple but effective release ([a6b2014](https://github.com/KenkoGeek/timonel/commit/a6b201476903cedf8e1d1dd7bbf36c2f02fa750b))
- **ci:** simple but effective release, security.md updated ([6911d21](https://github.com/KenkoGeek/timonel/commit/6911d2131971787d8afce1123ed4969e0ae8e077))
- **ci:** use exact pnpm version 10.15.0 in workflows ([2634e7d](https://github.com/KenkoGeek/timonel/commit/2634e7d30b58dcea182605a52a1e34daca0cf6bb))
- **core:** correct TypeScript errors and improve version handling ([3945d8b](https://github.com/KenkoGeek/timonel/commit/3945d8b6e3f84141579e0a08b48bdfd480e64168))
- **core:** resolve issue [#114](https://github.com/KenkoGeek/timonel/issues/114) - invalid Helm template generation ([eac0bdb](https://github.com/KenkoGeek/timonel/commit/eac0bdbbe4946e0dcf29346b956451f4d1f4a016))
- **docs:** apply prettier formatting to README.md ([0ad15aa](https://github.com/KenkoGeek/timonel/commit/0ad15aa8add475268b6b7c9af9bdcd3b6a82bb80))
- **release:** align required checks with ruleset configuration ([1b4d1dd](https://github.com/KenkoGeek/timonel/commit/1b4d1dd245974f80d3fb00096d48dbaaa79419f1))
- **release:** update required checks in release workflow ([1811247](https://github.com/KenkoGeek/timonel/commit/1811247fa1562885b8bd43909bd2127e23de225d))
- resolve issue [#114](https://github.com/KenkoGeek/timonel/issues/114) - Helm template generation bug and enhance documentation ([#116](https://github.com/KenkoGeek/timonel/issues/116)) ([92782f8](https://github.com/KenkoGeek/timonel/commit/92782f840571e036cc235d1b7739b00d8ac8d56c))
- **umbrella:** remove unused \_subchartInstance variables ([73b3a8a](https://github.com/KenkoGeek/timonel/commit/73b3a8a99b30ef4576f60331f66b30164bd8213e))

### Features

- **ci:** optimize GitHub workflows with enhanced performance and reliability ([09d0470](https://github.com/KenkoGeek/timonel/commit/09d04700b011e8dc4ae3875c4a46d835b88bb13d)), closes [#114](https://github.com/KenkoGeek/timonel/issues/114)
- **core:** enhance ChartProps for better flexibility ([385f966](https://github.com/KenkoGeek/timonel/commit/385f96607c27a1dd58ff8e4ceb60d8a56ece8422))

### Reverts

- **ci:** restore original release workflow ([f2f9b27](https://github.com/KenkoGeek/timonel/commit/f2f9b27e1950e8c9496f0faf6b874c0be5ad02e9))

## [2.9.2](https://github.com/KenkoGeek/timonel/compare/v2.9.1...v2.9.2) (2025-09-19)

### Bug Fixes

- **helm:** implement Helm-aware YAML serializer ([#112](https://github.com/KenkoGeek/timonel/issues/112)) ([daf4276](https://github.com/KenkoGeek/timonel/commit/daf427618eea73db832682f6b37287a9176bc31e))

## [2.9.1](https://github.com/KenkoGeek/timonel/compare/v2.9.0...v2.9.1) (2025-09-19)

### Bug Fixes

- **deps:** merge conflict solved [skip ci] ([3422464](https://github.com/KenkoGeek/timonel/commit/3422464ddee4a1408019ba4617b6f8e6f6c8fd12))
- **deps:** upgrade timonel version [skip ci] ([63901ef](https://github.com/KenkoGeek/timonel/commit/63901ef4277a1ebf702fc55337ed1eb7f6b226ea))

# [2.9.0](https://github.com/KenkoGeek/timonel/compare/v2.8.3...v2.9.0) (2025-09-17)

### Features

- **core:** refactor addConditionalManifest to manage helm templates ([520aae1](https://github.com/KenkoGeek/timonel/commit/520aae10e634f40ecdbda5e4a87b7b40b9733053))

## [2.8.3](https://github.com/KenkoGeek/timonel/compare/v2.8.2...v2.8.3) (2025-09-15)

### Bug Fixes

- **cli:** resolve incorrect syntax in conditional Helm templates, ensuring namespace and ingress conditions work correctly ([20363b8](https://github.com/KenkoGeek/timonel/commit/20363b8a997a87114b78cf3b4118f9d05eda0686))

## [2.8.1](https://github.com/KenkoGeek/timonel/compare/v2.8.0...v2.8.1) (2025-09-15)

### Bug Fixes

- **cli:** resolve timonel module not found error in umbrella.ts ([2dfb19c](https://github.com/KenkoGeek/timonel/commit/2dfb19c7dd4fcc2de9a342c6953133e6601cf74e))

# [2.8.0](https://github.com/KenkoGeek/timonel/compare/v2.7.3...v2.8.0) (2025-09-14)

### Bug Fixes

- **ci:** add mandatory CI status verification to beta release ([02af416](https://github.com/KenkoGeek/timonel/commit/02af41689a4efbee2f215bcce1c9c6a5e59878cd))
- **ci:** Q gate not needed ([9fcb210](https://github.com/KenkoGeek/timonel/commit/9fcb210c056d68af549e0f763331dffd094e2fa4))
- **ci:** Q gate not needed ([162b53f](https://github.com/KenkoGeek/timonel/commit/162b53f2310361c596d1369edb77044c757581df))
- **ci:** remove npm-prd environment from beta release ([50076de](https://github.com/KenkoGeek/timonel/commit/50076de8734066b181c5fc5f28b03fcde0959efc))
- **ci:** restore release.yml workflow from v2.7.3 ([cabb8bf](https://github.com/KenkoGeek/timonel/commit/cabb8bff765cad790b1c27a2d6749c0ddac6e24d))
- **ci:** restore working release workflow from v2.7.3 ([bed9146](https://github.com/KenkoGeek/timonel/commit/bed9146fd772a3d1f45e9cef5a316375351b1912))
- **ci:** specify explicit semantic-release config file ([ac95d51](https://github.com/KenkoGeek/timonel/commit/ac95d51469a20df289e63665e5e8572fbcf86e35))
- **ci:** use working semantic-release config from v2.7.3 ([5261eda](https://github.com/KenkoGeek/timonel/commit/5261edab43d05670f3803fca222d1e01f29d2f57))
- **core:** addIngress already normalized with NGINX best practices ([33fd0ae](https://github.com/KenkoGeek/timonel/commit/33fd0aee20db1c65a92bf36cbdc683b7028c80f8))
- **core:** ensure Timonel header appears in all YAML files ([ebee72e](https://github.com/KenkoGeek/timonel/commit/ebee72e9bc5b54eb56f871786e08bef36caad45a))
- **core:** resolve splitDocs removing Timonel headers from YAML ([951db75](https://github.com/KenkoGeek/timonel/commit/951db7553da57b48880b964551975411517e4218))
- **network:** Ingress API with TLS validation and security defaults ([#88](https://github.com/KenkoGeek/timonel/issues/88)) ([b1397b1](https://github.com/KenkoGeek/timonel/commit/b1397b1fa51a01f84f8cf4bbe41efa27f5636ac7))

### Features

- **ci:** add automatic beta release workflow for main branch ([72b553b](https://github.com/KenkoGeek/timonel/commit/72b553b8c530368478e430abdeeaef3aa1e6b310))
- **ci:** add beta releases on main with quality gates [skip ci] ([81c4dd0](https://github.com/KenkoGeek/timonel/commit/81c4dd062015a1bc2e62730c7f94f23fcfdfe2ed))
- **ci:** configure dual release strategy ([b11aeae](https://github.com/KenkoGeek/timonel/commit/b11aeaef175603787cd27a0af83d6ab6f8acb8f7))
- **ci:** simplify to beta releases only ([4f9704d](https://github.com/KenkoGeek/timonel/commit/4f9704dfe9fa63b7bd3cc2bb458256f47514d1ed))
- **core:** add Whatever tomorrow brings Ill be there ([fcbeb06](https://github.com/KenkoGeek/timonel/commit/fcbeb067a9835bca5315569bb7fab1d992a15d3d))
- **core:** Add with open arms and open eyes, yeah ([5be5d32](https://github.com/KenkoGeek/timonel/commit/5be5d32fcc2287ac562b4422212a1e37775ebcda))
- **network:** enhance NGINX Ingress support with cert-manager integration and security enhanced ([#91](https://github.com/KenkoGeek/timonel/issues/91)) ([be223dd](https://github.com/KenkoGeek/timonel/commit/be223ddfd2a387c2ff60cb7c8411ef893c45b7d3))

## [2.7.3](https://github.com/KenkoGeek/timonel/compare/v2.7.2...v2.7.3) (2025-09-13)

### Bug Fixes

- **cli:** resolve ES modules \_\_dirname and scaffold import paths ([#80](https://github.com/KenkoGeek/timonel/issues/80)) ([117c064](https://github.com/KenkoGeek/timonel/commit/117c064c3bae705a50de6d237b1bd7bf9340c7dd))

## [2.7.2](https://github.com/KenkoGeek/timonel/compare/v2.7.1...v2.7.2) (2025-09-13)

### Bug Fixes

- **aws:** update Karpenter API versions and add disruption/scheduling helpers ([#77](https://github.com/KenkoGeek/timonel/issues/77)) ([59fabbd](https://github.com/KenkoGeek/timonel/commit/59fabbd19481e694f4ff4e26e50ef57bb724717a))

## [2.7.1](https://github.com/KenkoGeek/timonel/compare/v2.7.0...v2.7.1) (2025-09-13)

### Bug Fixes

- **core:** TypeScript interfaces for GCP Artifact Registry and Karpenter helpers ([#72](https://github.com/KenkoGeek/timonel/issues/72)) ([b91d270](https://github.com/KenkoGeek/timonel/commit/b91d270c7662327861d8f1216966dd00677c857b))

# [2.7.0](https://github.com/KenkoGeek/timonel/compare/v2.6.2...v2.7.0) (2025-09-13)

### Features

- **core:** Add NetworkPolicy, ServiceAccount, CronJob, HPA, VPA, Ingress, and Karpenter resources ([0bda471](https://github.com/KenkoGeek/timonel/commit/0bda47158eab41878a956105fb311b83411a2846))

## [2.6.2](https://github.com/KenkoGeek/timonel/compare/v2.6.1...v2.6.2) (2025-09-13)

### Bug Fixes

- **core:** correct StorageClass API structure for Kubernetes 1.32+ compatibility ([2acb406](https://github.com/KenkoGeek/timonel/commit/2acb406c29b201e71dffc1263f5f2099c71376d4)), closes [#58](https://github.com/KenkoGeek/timonel/issues/58) [#58](https://github.com/KenkoGeek/timonel/issues/58)

## [2.6.1](https://github.com/KenkoGeek/timonel/compare/v2.6.0...v2.6.1) (2025-09-13)

### Bug Fixes

- **core:** resolve critical issues [#52](https://github.com/KenkoGeek/timonel/issues/52)-[#56](https://github.com/KenkoGeek/timonel/issues/56) and security vulnerabilities ([4018f06](https://github.com/KenkoGeek/timonel/commit/4018f06012e65dffc7780fc6da20ee25fd9f0a2d))

# [2.6.0](https://github.com/KenkoGeek/timonel/compare/v2.5.1...v2.6.0) (2025-09-13)

### Features

- **core:** add security helpers - sanitizeEnvVar, validateImageTag, generateSecretName ([#43](https://github.com/KenkoGeek/timonel/issues/43)) ([323c9ae](https://github.com/KenkoGeek/timonel/commit/323c9ae3243dead04dacc6daf4e98e8af1a8d98b))

## [2.5.1](https://github.com/KenkoGeek/timonel/compare/v2.5.0...v2.5.1) (2025-09-12)

### Bug Fixes

- **ci:** add comprehensive test suite with unit and integration tests ([#38](https://github.com/KenkoGeek/timonel/issues/38)) ([ffae52f](https://github.com/KenkoGeek/timonel/commit/ffae52fe357a8324959d74c5dd88594b21dafde1))

# [2.5.0](https://github.com/KenkoGeek/timonel/compare/v2.4.0...v2.5.0) (2025-09-12)

### Features

- **core:** add reusable pod template helpers with security profiles, workload optimization, sidecar patterns, and health checks ([a1372fa](https://github.com/KenkoGeek/timonel/commit/a1372fa2d9ac32a2655faf0f94302eb04aca4898))
- **core:** restore v2.3.0 functionality with modern architecture ([836d0e0](https://github.com/KenkoGeek/timonel/commit/836d0e0ede36d11059c125a612690c16e069e7c8)), closes [#34](https://github.com/KenkoGeek/timonel/issues/34) [#35](https://github.com/KenkoGeek/timonel/issues/35) [#36](https://github.com/KenkoGeek/timonel/issues/36)

# [2.4.0](https://github.com/KenkoGeek/timonel/compare/v2.3.0...v2.4.0) (2025-09-11)

### Features

- **core:** add GKE Workload Identity ServiceAccount, AWS ECR ServiceAccount helpers. implement modular architecture. add Role resource support for RBAC. with resource providers. add DaemonSet resource support. add StatefulSet resource support. add ClusterRole resource support for cluster-wide RBAC. add RoleBinding resource support for RBAC ([#33](https://github.com/KenkoGeek/timonel/issues/33)) ([eabe972](https://github.com/KenkoGeek/timonel/commit/eabe9729865ea56ce45480a60510704f28704367))

# [2.3.0](https://github.com/KenkoGeek/timonel/compare/v2.2.0...v2.3.0) (2025-09-10)

### Bug Fixes

- **core:** implement CLI-focused security validations and centralized input sanitization ([f0a8144](https://github.com/KenkoGeek/timonel/commit/f0a8144c9aeaa510f4bcf999ca6b1697deca31ae))

### Features

- **core:** add Karpenter integration with 5 methods, fix performance issues, and update security docs ([#31](https://github.com/KenkoGeek/timonel/issues/31)) ([fb69f33](https://github.com/KenkoGeek/timonel/commit/fb69f338fd27a01aa8eae04de9ea9962fb840a0b))

# [2.2.0](https://github.com/KenkoGeek/timonel/compare/v2.1.1...v2.2.0) (2025-09-09)

### Features

- **core:** add comprehensive Azure helpers for AKS integration with enhanced security ([870d1cd](https://github.com/KenkoGeek/timonel/commit/870d1cd3f81781d2f312f37e9dbd4dcc103e3ab8))

## [2.1.1](https://github.com/KenkoGeek/timonel/compare/v2.1.0...v2.1.1) (2025-09-09)

### Bug Fixes

- **cli:** enable TypeScript execution with enhanced security and strict mode validation ([cf468d2](https://github.com/KenkoGeek/timonel/commit/cf468d2c402359827f7678dcac49f38b8afa4052))

# [2.1.0](https://github.com/KenkoGeek/timonel/compare/v2.0.0...v2.1.0) (2025-09-08)

### Features

- **core:** add Job and CronJob helpers for batch workloads ([#21](https://github.com/KenkoGeek/timonel/issues/21)) ([0f375d2](https://github.com/KenkoGeek/timonel/commit/0f375d214e1cb3a2791522c530230757c15b2dee))

# [2.0.0](https://github.com/KenkoGeek/timonel/compare/v1.0.0...v2.0.0) (2025-09-07)

### Bug Fixes

- **ci:** remove redundant publish workflow and configure release token ([fcea159](https://github.com/KenkoGeek/timonel/commit/fcea15914617e372a2aafc8a30001cc54ec8bff6))
- **examples:** update timonel dependency to ^1.0.0 ([3d1f692](https://github.com/KenkoGeek/timonel/commit/3d1f6922448648c7efe57cc1fdde9a5808e04d7e))
- **helm:** remove automatic numbering from template files ([#20](https://github.com/KenkoGeek/timonel/issues/20)) ([f75748a](https://github.com/KenkoGeek/timonel/commit/f75748aee974a254f576807f26396b026262b42c))

### Features

- **ci:** add automatic CHANGELOG.md formatting to semantic-release ([6846b4d](https://github.com/KenkoGeek/timonel/commit/6846b4de2cfd411b7b9b9724d67830cf192ad2b9))
- **core:** add Azure Application Gateway Ingress Controller (AGIC) support ([#19](https://github.com/KenkoGeek/timonel/issues/19)) ([75bbb99](https://github.com/KenkoGeek/timonel/commit/75bbb998981ca6492b09ad12c54e03050b307c27))
- **core:** add Azure Disk StorageClass helper for AKS ([#18](https://github.com/KenkoGeek/timonel/issues/18)) ([5fb29de](https://github.com/KenkoGeek/timonel/commit/5fb29de260c4cabf6732520b0834cf0d0421a33a))

### BREAKING CHANGES

- **helm:** Template files no longer have automatic numbering prefixes

- refactor(helm): unify template naming strategy and add breaking change notice

* Simplify file naming logic with unified approach
* Use consistent naming strategy for single and multiple documents
* Add breaking change warning in README for numbered filename dependencies
* Improve code maintainability with cleaner implementation

Addresses PR review feedback for better consistency and user awareness.

# [1.0.0](https://github.com/KenkoGeek/timonel/compare/v0.4.0...v1.0.0) (2025-09-07)

### Bug Fixes

- **ci:** configure GitHub App token for semantic-release bypass - Use RELEASE_TOKEN from npm-prd environment for checkout and semantic-release ([0d385d1](https://github.com/KenkoGeek/timonel/commit/0d385d1084a45de3ab731094e87196239811e6fb))
- **ci:** disable body-max-line-length for semantic-release compatibility - Set body-max-line-length to 0 (disabled) to allow long changelog entries - Fixes semantic-release commit validation failures - Maintains other commitlint rules for developer commits ([b215f65](https://github.com/KenkoGeek/timonel/commit/b215f65bccb69a1cfca79084e6a9c96954fb478a))
- **ci:** disable footer line length limit for semantic-release commits ([d5ae4dc](https://github.com/KenkoGeek/timonel/commit/d5ae4dc83e68f8fade4a8289d1ce4e2bae5046dd))
- **ci:** disable footer-leading-blank for semantic-release compatibility - Set footer-leading-blank to 0 (disabled) to allow semantic-release footer format ([2f8c6c8](https://github.com/KenkoGeek/timonel/commit/2f8c6c863c6aabd1d3f3d8022b43fefecb02f010))
- **ci:** replace CodeQL with security check in release validation ([#15](https://github.com/KenkoGeek/timonel/issues/15)) ([b8cecea](https://github.com/KenkoGeek/timonel/commit/b8cecea1eaf0bb6af3e6fd2f6bc38c2fb2c09f4d))
- **ci:** resolve release workflow issues ([#16](https://github.com/KenkoGeek/timonel/issues/16)) ([ed5dc9b](https://github.com/KenkoGeek/timonel/commit/ed5dc9b3d86b531d4495d4d05dd913340333322c))

### Features

- add manual release workflow with GitHub Actions ([1035b2e](https://github.com/KenkoGeek/timonel/commit/1035b2e18fbb808e57438353c865ecd129d9e04d))
- add NetworkPolicy helpers for Zero Trust network security ([#13](https://github.com/KenkoGeek/timonel/issues/13)) ([cee3b58](https://github.com/KenkoGeek/timonel/commit/cee3b5876de839ca3cf16dd6ca6e3b76626392ce))
- **ci:** add required status checks validation to release workflow ([#14](https://github.com/KenkoGeek/timonel/issues/14)) ([7f8665f](https://github.com/KenkoGeek/timonel/commit/7f8665fa908215cc92a4dbefb7fec00de98464bb))
- **ci:** implement automated semantic release with conventional commits ([02ce189](https://github.com/KenkoGeek/timonel/commit/02ce18943efd8019168b5f9af29be0140a9e1524))
- **ci:** implement automated semantic release with conventional commits ([bb94fda](https://github.com/KenkoGeek/timonel/commit/bb94fda3e80bf3e010e7b53bdd1794f88060408a))
- **core:** add NetworkPolicy helpers for Zero Trust network security ([34ac6bd](https://github.com/KenkoGeek/timonel/commit/34ac6bda3956e5fe326b72e9831bd4bb8bc660da))

### Performance Improvements

- **ci:** homogenize CI/CD workflows and optimize release pipeline ([#17](https://github.com/KenkoGeek/timonel/issues/17)) ([4622d11](https://github.com/KenkoGeek/timonel/commit/4622d113e5753a5ff69c82a1e3784ecf61c34689))

### BREAKING CHANGES

- **ci:** ESLint configuration migrated to flat config format
- **ci:** ESLint configuration migrated to flat config format

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2025-09-06

### Added (0.4.0)

- **Custom Manifest Naming**: Complete implementation for customizable Kubernetes
  manifest file names
  - `manifestName` option in RutterProps to specify custom base names for manifest
    files
  - `singleManifestFile` option to combine all resources into a single manifest
    file
  - Enhanced file organization with descriptive names instead of generic numbered
    files
  - Support for both single file mode (`application.yaml`) and separate files mode
    (`0000-my-app-deployment-web.yaml`)
  - Backward compatibility maintained - default behavior unchanged when options not
    specified

### Enhanced (0.4.0)

- **HelmChartWriter**: Added `singleFile` property to SynthAsset interface for
  improved file handling
- **Documentation**: Comprehensive Custom Manifest Naming section added to README
  with examples
- **Examples**: All examples updated with custom manifest naming demonstrations
  - **AWS 2048 Game**: Enhanced with production-ready AWS features
    - AWS ALB Ingress with health checks and SSL support
    - HorizontalPodAutoscaler (HPA) for CPU-based auto-scaling
    - PodDisruptionBudget (PDB) for high availability during updates
    - Custom manifest naming with `manifestName: 'game-2048'`
    - Multi-environment configuration (dev/staging/prod)
  - **WordPress**: Updated to showcase `manifestName: 'wordpress-app'` and `singleManifestFile: true`
    - Comprehensive AWS integration examples (EBS, EFS, IRSA, Secrets Manager)
    - Auto-scaling with HPA and VPA configurations
    - Production-ready deployment patterns
  - **WordPress Umbrella**: Subcharts updated with custom manifest naming
    - MySQL subchart: `manifestName: 'mysql-database'`, `singleManifestFile: true`
    - WordPress subchart: `manifestName: 'wordpress-app'`, `singleManifestFile: false`
- **Example Documentation**: All example READMEs enhanced with custom manifest naming references
  and comprehensive deployment instructions
- **Auto-scaling Features**: Properly documented existing production-ready capabilities
  - HorizontalPodAutoscaler (HPA) with CPU/memory metrics and custom behavior policies
  - VerticalPodAutoscaler (VPA) with resource policies and update modes
  - PodDisruptionBudget (PDB) for high availability during updates
- **AWS Multi-Cloud Support**: Comprehensive documentation of EKS integration features
  - AWS IRSA ServiceAccount for secure IAM role assumption with regional STS endpoints
  - AWS EBS StorageClass with GP3, IO1, IO2 support, encryption, and IOPS configuration
  - AWS EFS StorageClass for shared storage across pods with access points
  - AWS ALB Ingress with health checks, SSL certificates, and advanced routing
  - AWS Secrets Manager and Parameter Store integration via SecretProviderClass
  - Multi-cloud ServiceAccount with workload identity (AWS IRSA, Azure, GCP)

## [0.3.0] - 2025-09-02

### Added (0.3.0)

- **Umbrella Charts Support**: Complete implementation for managing multiple subcharts
  - `UmbrellaRutter` class for coordinating multiple Rutter instances
  - `createUmbrella()` helper function for easy umbrella chart creation
  - CLI commands: `tl umbrella init`, `tl umbrella add`, `tl umbrella synth`
  - Automatic Chart.yaml generation with dependencies
  - Support for environment-specific values in umbrella charts
  - Example templates for umbrella and subchart scaffolding
- **WordPress Umbrella Example**: Complete example separating MySQL and WordPress into subcharts
  - MySQL subchart with persistent storage and secrets
  - WordPress subchart with database connectivity
  - Multi-environment configuration (dev/prod)
  - Comprehensive documentation and deployment guide

### Changed (0.3.0)

- Updated CLI usage to include umbrella chart commands
- Enhanced example generation with subchart support

### Removed

- **BREAKING**: Removed unused `cdk8s-plus-28` dependency
  - Project uses `ApiObject` directly for better control
  - No impact on functionality, only dependency cleanup

## [0.2.1] - 2025-09-02

### Fixed

- Updated examples package.json versions to 0.2.0 for consistency
- Fixed examples imports to use relative paths instead of 'timonel' package
- Updated dependencies to resolve brace-expansion security vulnerability
- Examples now work correctly with CLI after v0.2.0 breaking changes

### Security

- Updated dependencies to latest versions
- Resolved brace-expansion vulnerability in transitive dependencies

## [0.2.0] - 2025-09-02

### BREAKING CHANGES

- **API Change**: Renamed `ChartFactory` class to `Rutter` (maritime pilot concept)
- **Import Change**: `import { ChartFactory }` → `import { Rutter }`
- **Constructor Change**: `new ChartFactory()` → `new Rutter()`
- **File Renamed**: `ChartFactory.ts` → `Rutter.ts`

### Migration Guide

```typescript
// Before v0.2.0
import { ChartFactory } from 'timonel';
const factory = new ChartFactory({ meta: { name: 'my-app' } });

// After v0.2.0
import { Rutter } from 'timonel';
const rutter = new Rutter({ meta: { name: 'my-app' } });
```

### Implementation

- Updated all examples and documentation to use `Rutter` terminology
- Updated CLI template generation and --set flag integration
- Updated package.json description: 'chart factory' → 'chart generator'
- Eliminated all factory references from codebase
- Enhanced maritime theme consistency (Timonel + Rutter)

## [0.1.7] - 2025-09-01

### Breaking Changes

- **BREAKING**: Renamed `ChartFactory` class to `Rutter` (maritime pilot concept)
- Updated all examples and documentation to use `Rutter` instead of `ChartFactory`
- Renamed `ChartFactory.ts` to `Rutter.ts` for consistency
- Updated API: `new Rutter()` instead of `new ChartFactory()`

## [0.1.6] - 2025-09-01

### Structure

- Renamed `example/` directory to `examples/` for better clarity
- Updated linting ignore patterns to use `examples/**`
- Added Examples section to README documenting available examples

## [0.1.5] - 2025-08-31

### Linting

- Excluded example directories from main lint script to resolve CI errors
- Ensure both lint and security:lint scripts ignore example imports

## [0.1.4] - 2025-08-31

### Updated

- Updated TypeScript configuration to use Node16 module and moduleResolution
- Resolved deprecated moduleResolution warning for TypeScript 7.0 compatibility
- Modernized module resolution while maintaining CommonJS compatibility

### CI

- Excluded example directories from security linting to resolve CI import errors

## [0.1.3] - 2025-08-31

### Bug Fixes 0.1.3

- Fixed Helm chart generation issues with numeric values in YAML
- Corrected environment variable handling for complex objects
- Fixed PersistentVolumeClaim volume references
- Resolved Service port type casting issues
- Updated examples to use literal numeric values instead of numberRef for critical fields

### Changed

- Simplified WordPress example to use string environment variables instead of valueFrom objects
- Updated AWS 2048 example to use literal ports and replicas
- Improved README documentation with corrected deployment examples
- Removed redundant DEPLOYMENT.md file from aws-game-2048 example

### Documentation

- Enhanced main README with better examples and troubleshooting
- Updated example READMEs with working deployment commands
- Added notes about numeric value handling in Helm templates

## [0.1.2] - 2025-08-30

### Added

- Enhanced `validate` command to generate chart and run `helm lint` for proper validation
- Helm installation detection with clear installation instructions
- Automatic cleanup of temporary validation directories

### Bug Fixes 0.1.2

- Fixed example chart to use valid Helm template syntax for annotations
- Improved error messages with installation links for missing Helm binary

## [0.1.1] - 2025-08-30

### Resolved

- Fixed TypeScript module resolution error in CLI when validating charts
- Added explicit ts-node configuration to prevent module resolution error
- Added `exports` field to package.json to support subpath imports like `timonel/lib/helm`

## [0.1.0] - 2025-08-30

### Initial

- Initial release of Timonel - TypeScript library for programmatic Helm chart generation
- ChartFactory class with support for Deployments, Services, Ingress, ConfigMaps, Secrets
- PersistentVolume and PersistentVolumeClaim support with multi-cloud optimization
- ServiceAccount with workload identity support (AWS IRSA, Azure, GCP)
- Multi-environment values support (dev, staging, prod)
- CLI tool (`tl`) with commands: init, synth, validate, diff, deploy, package
- CI/CD integration with --dry-run, --silent, --env flags
- Dynamic value overrides with --set flag and dot notation support
- Helm templating helpers with programmatic \_helpers.tpl generation
- Type-safe API with cdk8s constructs and Helm placeholder preservation
- Comprehensive AWS 2048 game example with EKS deployment
- Security-focused development with ESLint security plugin and audit pipeline
- GitHub Actions workflows for CI/CD with provenance-enabled publishing

### Security Features

- ESLint security plugin with 12+ vulnerability detection rules
- Automated dependency scanning via Dependabot
- CodeQL analysis for code security
- Security audit in CI/CD pipeline
- Provenance-enabled npm publishing

[Unreleased]: https://github.com/KenkoGeek/timonel/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.4.0
[0.3.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.3.0
[0.2.1]: https://github.com/KenkoGeek/timonel/releases/tag/v0.2.1
[0.2.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.2.0
[0.1.7]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.7
[0.1.6]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.6
[0.1.5]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.5
[0.1.4]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.4
[0.1.3]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.3
[0.1.2]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.2
[0.1.1]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.1
[0.1.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.0
