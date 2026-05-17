# Repository Rulesets

GitHub rulesets are enforced by GitHub after they are created in the repository settings or through the GitHub API. Keeping this folder in the repo documents the intended policy, but the JSON file is not applied automatically by GitHub just because it is committed.

## Intended Policy

- Protect the `main` branch.
- Contributors must use pull requests.
- Pull requests require at least one approval.
- Review threads must be resolved before merge.
- The `build` GitHub Actions check must pass.
- Branch deletion and force pushes are blocked.
- Repository admins can bypass the rules and commit directly.

## Apply In GitHub UI

1. Open the repository on GitHub.
2. Go to `Settings` > `Rules` > `Rulesets`.
3. Create a new branch ruleset named `Protect main`.
4. Target `main`.
5. Enable pull request requirements and require one approval.
6. Require status check `build`.
7. Block deletion and non-fast-forward updates.
8. Add bypass for repository admins.
9. Set enforcement to active.

## Apply With GitHub API

Use `main-branch-protection.json` as the body for the repository rulesets API after replacing any fields GitHub asks you to adjust for your account or plan.