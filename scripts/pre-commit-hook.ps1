# Pre-commit hook to prevent secrets from being committed to GitHub (PowerShell)
#
# Installation:
#   1. Save this file as: .git\hooks\pre-commit.ps1 (or as pre-commit without extension)
#   2. Configure git to use this script: git config core.hooksPath .git/hooks
#   3. Make executable: icacls ".git\hooks\pre-commit" /grant:r "%USERNAME%:(F)"
#   4. Test by staging a file with a secret pattern

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Secret patterns to detect
$SecretPatterns = @(
    "MONGODB.*PASSWORD",
    "POSTGRES_PASSWORD",
    "JWT_SECRET.*=",
    "API_KEY",
    "API_SECRET",
    "REDIS_PASSWORD",
    "KAFKA_API_SECRET"
)

Write-Host "🔍 Checking for potential secrets..." -ForegroundColor Yellow

$foundSecrets = $false

# Get staged files
$stagedFiles = & git diff --cached --name-only 2>$null

foreach ($file in $stagedFiles) {
    # Skip example files and documentation
    if ($file -match '\.env\.example$' -or $file -match 'SECRETS\.md' -or $file -match 'README') {
        continue
    }

    # Check for .env files being committed
    if ($file -match '^\.env$' -or $file -match 'services/.*\.env$') {
        Write-Host "❌ ERROR: .env file detected in staged changes: $file" -ForegroundColor Red
        Write-Host "    These files contain actual credentials and should NEVER be committed." -ForegroundColor Yellow
        Write-Host "    Run: git reset HEAD <file> to unstage" -ForegroundColor Yellow
        $foundSecrets = $true
    }

    # Check for secret patterns in staged content
    try {
        $diff = & git diff --cached $file 2>$null
        foreach ($pattern in $SecretPatterns) {
            if ($diff -match $pattern) {
                Write-Host "⚠️  Warning: Possible secret pattern found in: $file" -ForegroundColor Yellow
                Write-Host "   Pattern: $pattern" -ForegroundColor Yellow
                if ($Verbose) {
                    Write-Host $diff -ForegroundColor Red
                }
            }
        }
    }
    catch {
        # Silently skip files that can't be diffed
    }
}

if ($foundSecrets) {
    Write-Host "`n❌ Commit blocked: .env file(s) detected!" -ForegroundColor Red
    Write-Host "`nTo fix:" -ForegroundColor Yellow
    Write-Host "  git reset HEAD <file>" -ForegroundColor Cyan
    Write-Host "  git commit  # Try again" -ForegroundColor Cyan
    Write-Host "`nTo bypass (use with caution):" -ForegroundColor Yellow
    Write-Host "  git commit --no-verify" -ForegroundColor Cyan
    exit 1
}

Write-Host "✓ No obvious secrets detected" -ForegroundColor Green
exit 0
