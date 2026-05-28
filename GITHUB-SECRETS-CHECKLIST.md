# GitHub Secret Prevention Checklist

Use this checklist to ensure no secrets are exposed in your GitHub repository.

## ✅ Pre-Push Verification

Before pushing to GitHub, complete these checks:

### 1. Verify .gitignore Excludes Secrets
```bash
# Check that .env files are ignored
git check-ignore services/.env
git check-ignore services/auth-user-service/.env
# Should output the file paths if properly ignored

# Check that .env.example files ARE tracked (safe)
git check-ignore services/.env.example
# Should output nothing (file is NOT ignored)
```

### 2. Scan Staged Files for Secrets
```bash
# See what you're about to commit
git diff --cached | grep -iE "(password|secret|token|api_key|api_secret)"

# If anything shows up, investigate before pushing
git status  # See staged files
git diff --cached <file>  # Review changes
```

### 3. Check Git History (Existing Repos)
```bash
# Look for secrets in recent commits
git log -p -n 20 | grep -iE "(password|secret|token|api_key)" | head -20

# Or use a dedicated tool
# Install: pip install truffleHog
truffleHog filesystem . --only-verified
```

## 🚨 If Secrets Were Committed

**Act immediately:**

1. **Do NOT push to GitHub** if you haven't already
   ```bash
   git reset HEAD~1 --soft  # Undo last commit, keep changes staged
   git reset HEAD <file>    # Unstage the secret file
   git checkout -- <file>   # Restore from clean version
   git commit -m "..."      # Recommit without secrets
   ```

2. **If already pushed, use BFG Repo-Cleaner:**
   ```bash
   # Install: brew install bfg (macOS) or download from GitHub
   
   # Remove file from history
   bfg --delete-files <filename> <repo-path>
   
   # Or remove patterns
   bfg --replace-text secrets.txt <repo-path>
   ```

3. **Rotate all exposed secrets:**
   - Change database passwords in MongoDB Atlas / PostgreSQL
   - Regenerate JWT secrets and update all services
   - Rotate API keys in Aiven, Redis, etc.
   - Update GitHub Actions Secrets if exposed

4. **Force push the cleaned history:**
   ```bash
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push --force-with-lease origin main
   ```

## 📋 Files That Should Be Ignored

These files contain secrets and **must** be in `.gitignore`:
- `services/.env` ✓ Already ignored
- `services/auth-user-service/.env` ✓ Already ignored
- `services/game-service/.env` ✓ Already ignored
- `services/purchase-service/.env` ✓ Already ignored
- `services/storage-service/.env` ✓ Already ignored
- `services/wishlist-service/.env` ✓ Already ignored
- `services/gateway/.env` ✓ Already ignored
- `services/notification-service/.env` ✓ Already ignored
- Any `.env` files ✓ Pattern: `.env` already in `.gitignore`

## ✅ Files That Should Be Tracked

These files are SAFE to commit (they contain only placeholders):
- `services/.env.example` ✓
- `services/auth-user-service/.env.example` ✓
- `services/game-service/.env.example` ✓
- `services/purchase-service/.env.example` ✓
- `services/storage-service/.env.example` ✓
- `services/wishlist-service/.env.example` ✓
- `services/gateway/.env.example` ✓
- `services/notification-service/.env.example` ✓
- `SECRETS.md` ✓ (documentation)
- `.gitignore` ✓

## 🔧 Enabling Pre-commit Hooks

Automatic secret detection on every commit:

```bash
# Setup hooks (Windows - PowerShell)
git config core.hooksPath .git/hooks
New-Item -ItemType Directory -Path .git/hooks -Force
Copy-Item scripts/pre-commit-hook.ps1 -Destination .git/hooks/pre-commit

# Setup hooks (macOS/Linux - Bash)
git config core.hooksPath .git/hooks
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

See [scripts/PRE-COMMIT-SETUP.md](PRE-COMMIT-SETUP.md) for detailed setup instructions.

## 📚 References

- [GitHub - Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [GitHub - Removing Sensitive Data from Repository](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [git-secrets Tool](https://github.com/awslabs/git-secrets)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

## ✨ Current Status

Run this to verify your current setup:

```bash
# Check .gitignore for .env patterns
echo "=== .gitignore status ==="
grep -E "\.env|secrets" .gitignore || echo "⚠️ Missing .env in .gitignore!"

# Verify .env files are ignored
echo "=== Checking ignored files ==="
git check-ignore -v services/.env services/.env.example

# Check what would be committed
echo "=== Staged files (no secrets should appear) ==="
git diff --cached --name-only | grep -v "\.env\.example"

echo "✅ Setup verification complete"
```
