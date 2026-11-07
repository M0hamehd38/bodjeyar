#!/usr/bin/env bash
# استقرار بودجه‌یار — فقط این فایل با کلید استقرار CI اجرا می‌شود (command= در authorized_keys).
# بسته (app/ = خروجی standalone ساخته‌شده در GitHub Actions) از stdin می‌آید. پیش از جایگزینی
# پشتیبان دیتابیس گرفته می‌شود؛ اگر نسخه‌ی تازه سالم بالا نیامد، نسخه‌ی قبل برمی‌گردد.
set -uo pipefail
BASE=/opt/bodjeyar
cd "$BASE" || exit 1
exec 9>"$BASE/.deploy.lock"; flock -n 9 || { echo "✖ استقرار دیگری در حال اجراست"; exit 1; }
say() { echo "[deploy] $*"; }
TMP=$(mktemp -d "$BASE/.incoming.XXXX")
trap 'rm -rf "$TMP"' EXIT
tar -xzf - -C "$TMP" || { say "✖ بسته خراب است"; exit 1; }
[ -f "$TMP/app/server.js" ] && [ -d "$TMP/app/.next/static" ] || { say "✖ بسته ناقص است"; exit 1; }
VERSION=$(cat "$TMP/VERSION" 2>/dev/null || echo unknown)
say "نسخه: $VERSION"
if docker ps -q -f name=^bodjeyar-web$ | grep -q . && [ -f data/budgetyar.db ]; then
  stamp=$(date +%Y%m%d-%H%M%S)
  docker exec bodjeyar-web node -e "const {DatabaseSync}=require(\"node:sqlite\");new DatabaseSync(\"/data/budgetyar.db\").exec(\"VACUUM INTO \x27/data/backups/pre-deploy-$stamp.db\x27\")" 2>/dev/null \
    && say "پشتیبان: data/backups/pre-deploy-$stamp.db" || { say "✖ پشتیبان‌گیری ناموفق؛ استقرار متوقف شد"; exit 1; }
  ls -1t data/backups/pre-deploy-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
fi
rm -rf app.prev; [ -d app ] && mv app app.prev
mv "$TMP/app" app && chown -R 1000:1000 app
docker tag bodjeyar:latest bodjeyar:previous 2>/dev/null || true
docker compose up -d --build >/dev/null 2>&1
for _ in $(seq 1 40); do
  st=$(docker inspect -f "{{.State.Health.Status}}" bodjeyar-web 2>/dev/null || echo none)
  [ "$st" = healthy ] && { echo "$VERSION" > CURRENT_VERSION; say "سالم ✔ — نسخه $VERSION"; docker image prune -f >/dev/null 2>&1; exit 0; }
  sleep 3
done
say "✖ ناسالم — بازگشت به نسخه‌ی قبل"
docker logs --tail 30 bodjeyar-web 2>&1 | sed "s/^/    /"
rm -rf app && [ -d app.prev ] && mv app.prev app
docker tag bodjeyar:previous bodjeyar:latest 2>/dev/null && docker compose up -d --no-build >/dev/null 2>&1
exit 1
