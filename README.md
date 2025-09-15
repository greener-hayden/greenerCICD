# Greener CI/CD

Automated GitHub App for zero-infrastructure secret management in CI/CD pipelines.

## 🚀 Quick Start

### 1. Set Repository Secrets
Add these to your repository's secrets:
```
APP_ID=<your-app-id>
APP_PRIVATE_KEY=<contents-of-private-key.pem>
```

### 2. Install the App
Go to your [GitHub App installations](https://github.com/settings/installations/85948928) and add repositories.

### 3. Run Secret Sync
```bash
gh workflow run sync-app-secrets.yml
```

That's it! Your repositories now have CI/CD secrets.

## 📁 Structure

```
github-app/
├── README.md              # This file
├── app-config.yml         # App configuration reference
├── SIMPLE_SETUP.md        # Detailed setup guide
└── actions-handler.js     # Legacy webhook handler (optional)

.github/
├── workflows/
│   ├── sync-app-secrets.yml    # Main secret sync workflow
│   └── verify-app-config.yml   # Config verification workflow
└── app-installations.json       # Tracks configured repositories
```

## 🔐 How It Works

1. **No webhooks needed** - Uses GitHub Actions
2. **Automatic detection** - Finds all repos where app is installed
3. **Smart management** - Only configures new repos, rotates old secrets
4. **Unique secrets** - Each repository gets its own credentials
5. **~30 seconds** - Fast and efficient

## 📊 What Gets Created

Each repository automatically receives:
- `GREENER_CI_KEY` - Unique authentication key
- `GREENER_CI_SECRET` - Repository-specific secret
- `GREENER_API_TOKEN` - API access token
- `GREENER_APP_ID` - Your app ID
- `GREENER_INSTALLATION_ID` - Installation identifier

## 🔄 Secret Rotation

Secrets are automatically rotated:
- After 30 days (configurable)
- When manually triggered
- Tracked in `.github/app-installations.json`

## 📝 App Configuration

The GitHub App settings cannot be automated via API. Update manually at:
https://github.com/settings/apps/greener-cicd-app

Expected configuration is documented in `app-config.yml`.

## 🔍 Monitoring

```bash
# Check sync status
gh run list --workflow=sync-app-secrets.yml

# Verify app config
gh workflow run verify-app-config.yml

# View tracked installations
cat .github/app-installations.json | jq
```

## ❓ FAQ

**Q: Why does the client secret show "Never used"?**
A: Client secrets are only for OAuth flows. CI/CD uses the private key for authentication.

**Q: Can the app name/description be automated?**
A: No, GitHub doesn't provide an API for updating app metadata. Use the verify workflow to check configuration.

**Q: How often should I run the sync?**
A: It runs weekly automatically, or manually when you add new repositories.

## 🚨 Troubleshooting

If secrets aren't appearing:
1. Check the app has `secrets: write` permission
2. Verify the repository is in the installation
3. Run the sync workflow manually
4. Check workflow logs for errors

## 📜 License

MIT