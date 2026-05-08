---
name: branch-rebase
description: Rebases one or more Git branches onto a configurable base (default main), pushes updated branches, and optionally merges matching GitHub PRs via gh. Use when syncing feature branches with main, clearing merge conflicts before merge, bulk-updating PRs, or when the user mentions rebase, branch-rebase, or updating branches against main/develop.
---

# Branch rebase (Git + GitHub CLI)

## Purpose

Keep remote feature branches up to date by rebasing them onto a **base branch** (often `main`), then push. Optionally identify PRs by changed paths (e.g. GitHub Actions under `.github/`) and merge them with `gh` after the branch is current.

## Prerequisites

- [GitHub CLI](https://cli.github.com/) (`gh`) authenticated: `gh auth status`
- Clean working tree on the machine running commands (stash or commit first)

## Parameters (adapt this workflow)

| Concept | Default | How to change |
|--------|---------|----------------|
| Base branch to rebase onto | `main` | Set `BASE=develop` (or any branch) in commands below |
| Remote | `origin` | Replace `origin` if you use another remote |
| Path filter for “which PRs” | `.github/` (workflows & Actions) | Change the prefix or use labels/title search with `gh pr list` |

## 1. Find PRs to process

Open PRs targeting the base branch, then filter by files **or** use explicit PR numbers.

**PRs that touch GitHub Actions / workflows** (any path under `.github/`):

```bash
BASE=main
gh pr list --state open --base "$BASE" --json number,title,headRefName,files \
  | ruby -rjson -e '
    prs = JSON.parse(STDIN.read)
    prs.each do |p|
      next unless p["files"].any? { |f| f["path"].start_with?(".github/") }
      puts %(#{p["number"]}\t#{p["headRefName"]}\t#{p["title"]})
    end
  '
```

**Explicit branches** (skip discovery):

```bash
BRANCHES=(feature/ci-fix other-branch)
```

**Explicit PR numbers**:

```bash
PR_NUMBERS=(42 43)
# Resolve branch names:
for n in "${PR_NUMBERS[@]}"; do
  gh pr view "$n" --json headRefName --jq .headRefName
done
```

Adjust `.github/` to match other areas (e.g. `apps/fintr-be/` only).

## 2. Rebase each branch onto the base branch

For each **feature branch** `BRANCH` (the PR head ref, not the base):

```bash
BASE=main
REMOTE=origin
BRANCH=<feature-branch-name>

git fetch "$REMOTE" "$BRANCH"
git checkout "$BRANCH"
git pull --rebase "$REMOTE" "$BASE"
```

Resolve conflicts if Git stops; continue with `git rebase --continue` until done.

## 3. Push the rebased branch (not the base)

After a rebase, history may diverge from the remote branch. Push the **same branch name** you checked out:

```bash
git push "$REMOTE" "$BRANCH" --force-with-lease
```

**Important:** Do **not** run `git push origin main` as part of updating a feature branch—that updates `main` on the remote from your local `main`, which is unrelated to publishing the rebased feature branch.

## 4. Merge PRs with GitHub CLI (optional)

After the branch is pushed and CI is green:

```bash
gh pr merge <number> --merge
# or: --squash / --rebase per team preference
```

Bulk merge (only after verifying each PR):

```bash
for n in 42 43; do gh pr merge "$n" --merge; done
```

Use `--auto` if your repo enables merge queues and you want GitHub to merge when checks pass.

## 5. Return to the base branch

```bash
git checkout "$BASE"
git pull "$REMOTE" "$BASE"
```

## Agent checklist

1. Confirm `BASE` and path filter (or explicit PRs/branches) with the task.
2. Ensure working tree is clean.
3. `git fetch "$REMOTE" "$BASE"` before rebasing each branch.
4. On conflict: help resolve, never force-push `main` unless the user explicitly requested that dangerous operation.
5. Prefer `--force-with-lease` over `--force` when pushing rebased branches.

## Example: one branch end-to-end

```bash
REMOTE=origin
BASE=main
BRANCH=fix-ci-workflow

git fetch "$REMOTE" "$BASE" "$BRANCH"
git checkout "$BRANCH"
git pull --rebase "$REMOTE" "$BASE"
git push "$REMOTE" "$BRANCH" --force-with-lease
gh pr view --json number --jq .number   # or pass PR number
gh pr merge 123 --merge
git checkout "$BASE" && git pull "$REMOTE" "$BASE"
```
