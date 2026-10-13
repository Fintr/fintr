---
name: mobile-version-bump
description: Bumps the Fintr iOS and Android app versions (build number + marketing version) in apps/fintr-fe. Use when the user asks to bump versions, update iOS/Android versions, prepare a store build, or includes "bump versions" in a ship/merge flow.
---

# Mobile version bump (iOS + Android)

Read this instead of re-deriving the pattern from git history.

## The rule

Each platform has **one counter `N`**. A bump adds 1 to it. The marketing version is always `1.N`.

| Platform | File | Fields (both change together) |
|----------|------|-------------------------------|
| Android | `apps/fintr-fe/android/app/build.gradle` | `versionCode N` and `versionName "1.N"` |
| iOS | `apps/fintr-fe/ios/App/App.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION = N;` and `MARKETING_VERSION = 1.N;` — **two** build configs (Debug + Release), update both |

- Android and iOS counters are **independent** (e.g. Android 34 while iOS is 14). Never copy one platform's number to the other.
- "Bump versions" with no platform named = bump **both**, +1 each.
- Platform named (e.g. "bump Android") = bump only that one.
- `1.10` is correct after `1.9` (it is `1.N`, not semver).

## Steps

Run from the repo root.

1. Read current values:

```bash
cd apps/fintr-fe
rg -n "versionCode|versionName" android/app/build.gradle
rg -n "CURRENT_PROJECT_VERSION|MARKETING_VERSION" ios/App/App.xcodeproj/project.pbxproj
```

2. Bump (skip the block for a platform that should not change):

```bash
cd apps/fintr-fe

# Android
A=$(rg -o --replace '$1' 'versionCode (\d+)' android/app/build.gradle)
A_NEXT=$((A + 1))
sed -i '' -E \
  -e "s/versionCode $A\$/versionCode $A_NEXT/" \
  -e "s/versionName \"1\.$A\"/versionName \"1.$A_NEXT\"/" \
  android/app/build.gradle

# iOS (both Debug and Release)
I=$(rg -o --replace '$1' 'CURRENT_PROJECT_VERSION = (\d+);' ios/App/App.xcodeproj/project.pbxproj | head -1)
I_NEXT=$((I + 1))
sed -i '' -E \
  -e "s/CURRENT_PROJECT_VERSION = $I;/CURRENT_PROJECT_VERSION = $I_NEXT;/" \
  -e "s/MARKETING_VERSION = 1\.$I;/MARKETING_VERSION = 1.$I_NEXT;/" \
  ios/App/App.xcodeproj/project.pbxproj
```

3. Verify: rerun step 1. Expect Android `versionCode`/`versionName` = `N+1` / `"1.N+1"`, and iOS **two** lines each of `CURRENT_PROJECT_VERSION = N+1;` and `MARKETING_VERSION = 1.N+1;`. `git diff --stat` should show only those two files (plus `graphify-out/` after the commit hook).

4. Commit on the feature branch, as its own commit, before merging:

```bash
git add apps/fintr-fe/android/app/build.gradle apps/fintr-fe/ios/App/App.xcodeproj/project.pbxproj
git commit -m "[Chore] Bump iOS to 1.<I_NEXT> (<I_NEXT>) and Android to 1.<A_NEXT> (<A_NEXT>)"
```

## In a ship flow

When the user asks to "commit, push, create PR, bump versions, merge":

1. Commit the feature work.
2. Bump with this playbook and commit it on the **same branch** (it ships in the same PR).
3. Push, then create the PR (or push again if the PR already exists) so the bump is part of the merge.
4. Mention the new versions in the PR body and the final summary, e.g. "iOS 1.15 (15), Android 1.35 (35)".

## Gotchas

- Run `git` commands that commit **sequentially**, never in parallel. They share one index and the pre-commit hook (graphify + specs) takes ~20s, so parallel commits collide (`cannot lock ref 'HEAD'`) or swallow each other's staged files.
- If `main` already bumped past your branch's base, rebase first and bump from `main`'s numbers. Otherwise two PRs ship the same build number and the store rejects the second upload.
- Do not edit `ios/App/App/capacitor.config.json` or other generated native files for versions. Only the two files above hold version numbers.
