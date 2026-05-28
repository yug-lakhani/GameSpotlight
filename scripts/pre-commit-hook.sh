#!/bin/bash
# Pre-commit hook to prevent secrets from being committed to GitHub
# 
# Installation:
#   1. Save this file as: .git/hooks/pre-commit
#   2. Make it executable: chmod +x .git/hooks/pre-commit
#   3. Test by trying to stage a file with a secret pattern

set -e

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Patterns to detect potential secrets
SECRET_PATTERNS=(
  "MONGODB.*PASSWORD"
  "POSTGRES_PASSWORD"
  "JWT_SECRET.*="
  "API_KEY"
  "API_SECRET"
  "REDIS_PASSWORD"
  "KAFKA_API_SECRET"
  "password.*[=:].*[^<]"
  "secret.*[=:].*[^<]"
  "token.*[=:].*[^<]"
  "\.env$"
)

# Check for secrets in staged files
echo -e "${YELLOW}🔍 Checking for potential secrets...${NC}"

FOUND_SECRETS=0

for file in $(git diff --cached --name-only); do
  # Skip example files and documentation
  if [[ $file == *.env.example ]] || [[ $file == SECRETS.md ]] || [[ $file == *README* ]]; then
    continue
  fi

  # Check for secret patterns in staged content
  if git diff --cached "$file" | grep -iE "(password|secret|token|key|api_secret|api_key)" | grep -v "^[+-].*<.*>" > /dev/null; then
    echo -e "${RED}❌ Possible secret found in: $file${NC}"
    FOUND_SECRETS=1
  fi
done

# Explicitly check if .env files are being committed
if git diff --cached --name-only | grep -E "^\.env$|services/.*\.env$" | grep -v "\.env\.example"; then
  echo -e "${RED}❌ ERROR: .env file(s) detected in staged changes!${NC}"
  echo -e "${YELLOW}    These files contain actual credentials and should NEVER be committed.${NC}"
  echo -e "${YELLOW}    Run: git reset HEAD <file> to unstage${NC}"
  FOUND_SECRETS=1
fi

if [ $FOUND_SECRETS -eq 1 ]; then
  echo -e "${RED}${NC}"
  echo -e "${RED}Commit blocked: Potential secrets detected.${NC}"
  echo -e "${YELLOW}${NC}"
  echo -e "${YELLOW}If this is a false positive:${NC}"
  echo -e "${YELLOW}  1. Review the flagged content${NC}"
  echo -e "${YELLOW}  2. Use placeholders (e.g., <password>) in examples${NC}"
  echo -e "${YELLOW}  3. Or bypass with: git commit --no-verify (use with caution)${NC}"
  exit 1
fi

echo -e "${GREEN}✓ No obvious secrets detected${NC}"
exit 0
