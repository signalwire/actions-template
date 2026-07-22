# Changelog

## [1.0.0](https://github.com/signalwire/actions-template/compare/v0.1.0...v1.0.0) (2026-07-22)


### ⚠ BREAKING CHANGES

* this repo now requires Conventional Commits going forward — commits that don't use feat:/fix:/etc. prefixes will no longer trigger a release-please release PR. Also requires org setup this repo can't provide on its own: a GitHub App for release-please auth (repo variable RELEASE_PLEASE_APP_ID, secret RELEASE_PLEASE_APP_PRIVATE_KEY).

### Features

* add release-please for this repo ([#424](https://github.com/signalwire/actions-template/issues/424)) ([13ce621](https://github.com/signalwire/actions-template/commit/13ce621726988a8388da9d2e99272b24026fc843))
* install sops by default ([#400](https://github.com/signalwire/actions-template/issues/400)) ([21aab73](https://github.com/signalwire/actions-template/commit/21aab733952242a8bd43fdaeab98b72ec78e49ab))


### Bug Fixes

* container start test ([#275](https://github.com/signalwire/actions-template/issues/275)) ([f649a2e](https://github.com/signalwire/actions-template/commit/f649a2e1517687b04f23de901c014df776b0190f))
* **dotnet:** adds config options to fix input threading ([#413](https://github.com/signalwire/actions-template/issues/413)) ([6142cc2](https://github.com/signalwire/actions-template/commit/6142cc2a03db8a49ea296653db9b4da4d3b1097a))
* Remove colons from branch names ([#357](https://github.com/signalwire/actions-template/issues/357)) ([1dc2ff9](https://github.com/signalwire/actions-template/commit/1dc2ff9e928a00d695df7ff4329c4b11d22b7b57))
* Separate GHA and bash substitution ([#356](https://github.com/signalwire/actions-template/issues/356)) ([b691eb8](https://github.com/signalwire/actions-template/commit/b691eb80582594b96a250df406caae0e771bcf78))
* To use GitHub CLI in a GitHub Actions workflow, set the GH_TOKEN ([#360](https://github.com/signalwire/actions-template/issues/360)) ([556f9f2](https://github.com/signalwire/actions-template/commit/556f9f2a345ddfe6bafbcec70ca8fa1bd99b95ac))
* Use the token input or env ([#361](https://github.com/signalwire/actions-template/issues/361)) ([847303d](https://github.com/signalwire/actions-template/commit/847303df1dc3a4230bdd8d69b9fc881b917a9d12))
