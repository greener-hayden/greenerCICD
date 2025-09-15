# Ultra-Simple Webhook Setup (<50 lines)

Set up automatic secret provisioning when repos are added to your GitHub App.

## How It Works

```
GitHub App → Webhook → GitHub Pages → Repository Dispatch → Sync Secrets
```

1. **You add/remove repos** in GitHub App settings
2. **GitHub sends webhook** to your Pages URL
3. **Webhook triggers** the sync workflow
4. **Secrets are created** automatically

## Setup (5 minutes)

### 1. Enable GitHub Pages

Go to Settings → Pages → Enable GitHub Pages on `main` branch

### 2. Deploy the webhook endpoint

```bash
gh workflow run pages-deploy.yml
```

This creates: `https://greener-hayden.github.io/dotfiles/github-app/`

### 3. Update GitHub App webhook URL

1. Go to: https://github.com/settings/apps/greener-cicd-app
2. Set Webhook URL to: `https://greener-hayden.github.io/dotfiles/github-app/`
3. Set Webhook secret (save it)
4. Enable webhook: ✅ Active

### 4. Add webhook secret to repository

```bash
gh secret set WEBHOOK_SECRET
gh secret set WEBHOOK_PROXY_TOKEN  # PAT with repo/workflow scope
```

### 5. Select webhook events

In GitHub App settings, subscribe to:
- ✅ Installation
- ✅ Installation repositories

## That's It!

Now when you:
- **Add repos** to the app → Secrets are created automatically
- **Remove repos** → Logged (secrets remain for security)

## Testing

1. Add a test repository to your app
2. Check Actions tab for workflow runs
3. Verify secrets in the test repository

## The Code

The entire webhook handler is under 50 lines:

- `webhook-simple.js` - 48 lines
- `webhook.html` - 35 lines of JavaScript
- `webhook-receiver.yml` - 30 lines

## Troubleshooting

If webhooks aren't working:

```bash
# Check webhook deliveries
open https://github.com/settings/apps/greener-cicd-app/advanced

# Check workflow runs
gh run list --workflow=webhook-receiver.yml

# Check secret sync
gh run list --workflow=sync-app-secrets.yml
```

## Alternative: Manual Trigger

If you prefer not to use webhooks, just run this after adding repos:

```bash
gh workflow run sync-app-secrets.yml
```

The webhook approach is automatic, but manual triggering works too!