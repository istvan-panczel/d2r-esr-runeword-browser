#!/bin/sh
# Pre-commit: rejects staged files that should never be in this public repo:
# - save and stash files (.d2s/.d2i/.sss), logs, and env files other than the three committed ones
# - files over 2 MB outside the generated public/game-data/ bundles
# Bypass once (only if you are sure): git commit --no-verify
max_bytes=2097152
status=0
staged=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$staged" ] && exit 0
# One path per line (paths may contain spaces).
IFS='
'
for file in $staged; do
  case "$file" in
    .env.example | .env.development | .env.production) ;;
    .env* | */.env*)
      echo "Refusing to commit env file: $file (secrets belong in the git-ignored .env.local)"
      status=1
      ;;
    *.d2s | *.d2i | *.sss | *.log)
      echo "Refusing to commit save/stash file or log: $file"
      status=1
      ;;
  esac
  case "$file" in
    public/game-data/*) ;;
    *)
      size=$(git cat-file -s ":$file" 2>/dev/null || echo 0)
      if [ "$size" -gt "$max_bytes" ]; then
        echo "Refusing to commit large file: $file ($size bytes, limit $max_bytes outside public/game-data/)"
        status=1
      fi
      ;;
  esac
done
exit $status
