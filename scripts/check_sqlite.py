import sqlite3
import sys
import os

DB = 'backend/dr_screening.db.bak_2026-04-28_14-18-17-834'
print('DB path:', DB, 'exists:', os.path.exists(DB))
if not os.path.exists(DB):
    sys.exit(2)

try:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 50;")
    rows = cur.fetchall()
    print('Tables (up to 50):')
    for r in rows:
        print('-', r[0])
    conn.close()
except Exception as e:
    print('ERROR:', e)
    sys.exit(1)

print('SQLite check: OK')
