import re

with open('backend/routers/admin.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace hardcoded ISO string
content = content.replace('\"2026-05-28T00:00:00Z\"', 'PROD_START_ISO')

# Replace local PROD_START_DATE redeclarations
content = content.replace('    PROD_START_DATE = datetime(2026, 5, 28, tzinfo=timezone.utc)\n', '')

# Replace redundant DB queries for dev users
pattern = r'dev_users_res = await _sb\(sc\.supabase\.table\(\"users\"\)\.select\(\"id\"\)\.in_\(\"email\", DEV_EMAILS\)\)\s*dev_user_ids = \[u\[\"id\"\] for u in \(dev_users_res\.data or \[\]\)\]'
content = re.sub(pattern, 'dev_user_ids = await get_dev_user_ids()', content)

with open('backend/routers/admin.py', 'w', encoding='utf-8') as f:
    f.write(content)
