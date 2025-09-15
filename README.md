# Greener CI/CD
Automated GitHub App for zero-infrastructure secret management in CI/CD pipelines.
Install: Add APP_ID and APP_PRIVATE_KEY to repository secrets.
Configure: Install app at github.com/settings/installations/85948928.
Run: Execute `gh workflow run sync-app-secrets.yml` to sync secrets.
Monitor: Check status with `gh run list --workflow=sync-app-secrets.yml`.
MIT License.