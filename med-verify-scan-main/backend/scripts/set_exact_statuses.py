#!/usr/bin/env python3
"""
Script to set the exact distribution of medicine approval statuses:
- 100 Approved
- 40 Rejected
- 25 Pending
Total: 165 medicines
"""

import sys
import os
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

def run():
    print("=" * 60)
    print("SETTING EXACT MEDICINE APPROVAL STATUS DISTRIBUTION")
    print("=" * 60)

    # 1. Update SQLite DB if present
    sqlite_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "local_medverify.db")
    if os.path.exists(sqlite_path):
        conn = sqlite3.connect(sqlite_path)
        cur = conn.cursor()
        
        # Get all medicine IDs ordered
        cur.execute("SELECT id FROM medicines ORDER BY rowid ASC")
        rows = cur.fetchall()
        print(f"SQLite DB found with {len(rows)} medicines.")
        
        if len(rows) >= 165:
            approved_ids = [r[0] for r in rows[:100]]
            rejected_ids = [r[0] for r in rows[100:140]]
            pending_ids = [r[0] for r in rows[140:165]]
            
            cur.executemany("UPDATE medicines SET approval_status = 'approved' WHERE id = ?", [(i,) for i in approved_ids])
            cur.executemany("UPDATE medicines SET approval_status = 'rejected' WHERE id = ?", [(i,) for i in rejected_ids])
            cur.executemany("UPDATE medicines SET approval_status = 'pending' WHERE id = ?", [(i,) for i in pending_ids])
            conn.commit()
            
            cur.execute("SELECT approval_status, COUNT(*) FROM medicines GROUP BY approval_status")
            print("SQLite Status Breakdown:", cur.fetchall())
        conn.close()

    # 2. Update PostgreSQL DB if accessible
    pg_url = os.getenv("DATABASE_URL")
    if pg_url and pg_url.startswith("postgresql"):
        try:
            import psycopg2
            pg_conn = psycopg2.connect(pg_url)
            pg_cur = pg_conn.cursor()
            pg_cur.execute("SELECT id FROM medicines ORDER BY created_at ASC, id ASC")
            pg_rows = pg_cur.fetchall()
            print(f"PostgreSQL DB connected with {len(pg_rows)} medicines.")
            if len(pg_rows) >= 165:
                app_ids = [r[0] for r in pg_rows[:100]]
                rej_ids = [r[0] for r in pg_rows[100:140]]
                pen_ids = [r[0] for r in pg_rows[140:165]]
                
                pg_cur.executemany("UPDATE medicines SET approval_status = 'approved' WHERE id = %s", [(i,) for i in app_ids])
                pg_cur.executemany("UPDATE medicines SET approval_status = 'rejected' WHERE id = %s", [(i,) for i in rej_ids])
                pg_cur.executemany("UPDATE medicines SET approval_status = 'pending' WHERE id = %s", [(i,) for i in pen_ids])
                pg_conn.commit()
                
                pg_cur.execute("SELECT approval_status, COUNT(*) FROM medicines GROUP BY approval_status")
                print("PostgreSQL Status Breakdown:", pg_cur.fetchall())
            pg_conn.close()
        except Exception as e:
            print(f"PostgreSQL update skipped or offline: {e}")

    print("=" * 60)

if __name__ == '__main__':
    run()
