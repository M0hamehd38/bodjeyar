#!/usr/bin/env bash
# پشتیبان روزانه‌ی پایگاه داده‌ی بودجه‌یار (VACUUM INTO = نسخه‌ی سازگار حتی با برنامه‌ی در حال کار)؛ ۱۴ نسخه‌ی آخر می‌ماند.
set -euo pipefail
cd /opt/bodjeyar
stamp=$(date +%Y%m%d-%H%M)
docker exec bodjeyar-web node -e "const {DatabaseSync}=require(\"node:sqlite\");new DatabaseSync(\"/data/budgetyar.db\").exec(\"VACUUM INTO \x27/data/backups/budgetyar-$stamp.db\x27\")" 2>/dev/null
ls -1t data/backups/budgetyar-*.db 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "$(date -Is) backup budgetyar-$stamp.db"
