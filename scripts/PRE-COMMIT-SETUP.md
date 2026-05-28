# Git Pre-commit Hook Setup Guide

This directory contains scripts to prevent secrets from being accidentally committed to GitHub.

## Quick Setup (Windows)

### Step 1: Enable Git Hooks
```powershell
cd Game-SpotLight
git config core.hooksPath .git/hooks
```

### Step 2: Copy Pre-commit Hook
```powershell
# Create .git/hooks directory if it doesn't exist
New-Item -ItemType Directory -Path .git/hooks -Force | Out-Null

# Copy the Windows PowerShell hook
Copy-Item scripts/pre-commit-hook.ps1 -Destination .git/hooks/pre-commit
```

### Step 3: Make Executable (Git for Windows)
```powershell
# For git-bash/Git for Windows (auto-executable)
# No additional step needed
```

### Step 4: Verify Installation
```powershell
# Test the hook by staging a file with a secret pattern
echo "JWT_SECRET=my-secret" > test.txt
git add test.txt
# Should see: ❌ Commit blocked: Possible secret pattern found
# Then: git reset HEAD test.txt
# And remove the test file
```

## Quick Setup (macOS / Linux)

### Step 1: Enable Git Hooks
```bash
cd Game-SpotLight
git config core.hooksPath .git/hooks
```

### Step 2: Copy and Make Executable
```bash
# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy the bash hook
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit

# Make it executable
chmod +x .git/hooks/pre-commit
```

### Step 3: Verify Installation
```bash
# Test the hook
echo "JWT_SECRET=my-secret" > test.txt
git add test.txt
git commit -m "test"  # Should be blocked
git reset HEAD test.txt
rm test.txt
```

## How It Works

The pre-commit hook runs BEFORE each commit and:

1. ✓ Scans all staged files for secret patterns
2. ✓ Checks if `.env` files are being committed (they shouldn't be)
3. ✓ Flags suspicious patterns (password, API_KEY, token, etc.)
4. ✓ Blocks the commit if secrets are detected

### What It Allows
- ✓ `.env.example` files (placeholders only)
- ✓ `SECRETS.md` (documentation)
- ✓ README files with examples using `<placeholder>` syntax

### What It Blocks
- ✗ `.env` files with real credentials
- ✗ Files containing `PASSWORD=actual_value`
- ✗ Files containing `API_SECRET=...` (without angle brackets)

## Bypassing the Hook (Use with Caution!)

If you need to commit a file the hook flags (e.g., a test fixture with dummy secrets):

```bash
# Bypass the hook for a single commit
git commit --no-verify -m "commit message"

# Or disable all hooks temporarily
git config core.hooksPath ""  # Disables
git config core.hooksPath .git/hooks  # Re-enables
```

## Troubleshooting

### Hook Not Running

**On Windows (Git Bash):**
```bash
# Make sure hook has .ps1 extension and is named correctly
ls -la .git/hooks/pre-commit
# If missing, copy again: cp scripts/pre-commit-hook.ps1 .git/hooks/pre-commit
```

**On macOS/Linux:**
```bash
# Check if hook is executable
ls -la .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Check if core.hooksPath is set
git config core.hooksPath
# Should output: .git/hooks
```

### False Positives

If a legitimate file is flagged:

1. Review the flagged content — is it really a secret?
2. If it's an example, use angle brackets: `JWT_SECRET=<your-secret-here>`
3. If it's a test file, add it to the exception list in the hook script
4. Or commit with: `git commit --no-verify`

## Additional Security Recommendations

### 1. GitHub Token Security
- Never commit GitHub personal access tokens
- Use `gh auth token` locally, not `GITHUB_TOKEN` in files
- Store tokens in `~/.config/gh/hosts.yml` (GitHub CLI default)

### 2. Production Secrets
- Store in AWS Secrets Manager, GitHub Secrets, or HashiCorp Vault
- Never check in production credentials
- Rotate secrets regularly

### 3. Before Pushing
```bash
# Double-check what you're about to push
git log -p origin/main..HEAD | grep -i "password\|secret\|token"

# If secrets are found, use git filter-branch or BFG Repo-Cleaner to remove
```

### 4. Scanning Existing Repository
If you're worried secrets may already be in your repo history:

```bash
# Install TruffleHog (Python)
pip install truffleHog

# Scan entire repo
truffleHog filesystem . --debug

# Or use git-secrets
brew install git-secrets
git secrets --install
git secrets --scan-history
```

## References

- [GitHub - Security Best Practices](https://docs.github.com/en/code-security/secret-scanning)
- [Pre-commit Hooks Documentation](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) (for removing secrets from history)
- [TruffleHog](https://trufflesecurity.com/) (secret scanning tool)
