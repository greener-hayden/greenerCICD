# Simple GitHub App Secret Sync Setup

The easiest way to manage secrets for your GitHub App installations - just 50 lines of YAML!

## How It Works

1. **Update repositories** in your GitHub App installation settings
2. **Run the workflow** manually or wait for weekly sync
3. **Secrets are automatically set** in all repositories

That's it! No webhooks, no external services, no complexity.

## One-Time Setup (5 minutes)

### Step 1: Add These Secrets to Your Repository

Go to Settings → Secrets and variables → Actions, and add:

```
APP_ID=<your-github-app-id>
APP_PRIVATE_KEY=<your-private-key.pem-contents>
APP_INSTALLATION_ID=85948928
```

### Step 2: Run the Workflow

```bash
# Using GitHub CLI
gh workflow run sync-app-secrets.yml

# Or via GitHub UI
# Go to Actions → Sync GitHub App Secrets → Run workflow
```

## What Gets Created

Each repository in your installation automatically gets:

- `GREENER_CI_KEY` - Unique authentication key
- `GREENER_CI_SECRET` - Secure secret for CI/CD
- `GREENER_APP_ID` - Your app ID for reference

## Usage in Your Workflows

Once synced, any workflow in those repos can use:

```yaml
name: CI Pipeline
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          echo "Authenticated with key: ${{ secrets.GREENER_CI_KEY }}"
          # Your CI/CD logic here
```

## Updating Repositories

When you add/remove repositories from your GitHub App:

1. Go to: https://github.com/settings/installations/85948928
2. Update repository access
3. Run the sync workflow again
4. All repositories now have the secrets!

## Schedule Options

The workflow runs:
- **Manually**: Whenever you trigger it
- **Weekly**: Every Sunday at midnight (optional)

To disable automatic sync, remove the `schedule` section from the workflow.

## Monitoring

Check sync status:
```bash
# View latest run
gh run list --workflow=sync-app-secrets.yml --limit=1

# View logs
gh run view --log
```

## FAQ

**Q: How long does it take?**
A: Usually 20-30 seconds for up to 50 repositories

**Q: Are secrets unique per repo?**
A: The example generates the same secrets for all repos, but you can customize this in the workflow

**Q: Can I use different secrets per environment?**
A: Yes, modify the workflow to create environment-specific secrets

**Q: Is this secure?**
A: Yes! Uses GitHub's native secret encryption and the secrets never leave GitHub

## That's It!

No complex setup, no external dependencies, just a simple workflow that keeps your secrets in sync. 🎉