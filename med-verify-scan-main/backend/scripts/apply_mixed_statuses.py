import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('backend/.env')
pg_url = os.getenv('DATABASE_URL')
if pg_url:
    conn = psycopg2.connect(pg_url)
    cur = conn.cursor()
    cur.execute("SELECT id, name, batch_no FROM medicines ORDER BY id ASC")
    rows = cur.fetchall()
    
    app_rows = rows[:100]
    rej_rows = rows[100:140]
    pen_rows = rows[140:]
    
    cur.executemany("UPDATE medicines SET approval_status = 'approved' WHERE id = %s", [(r[0],) for r in app_rows])
    cur.executemany("UPDATE medicines SET approval_status = 'rejected' WHERE id = %s", [(r[0],) for r in rej_rows])
    cur.executemany("UPDATE medicines SET approval_status = 'pending' WHERE id = %s", [(r[0],) for r in pen_rows])
    conn.commit()
    
    cur.execute("SELECT approval_status, COUNT(*) FROM medicines GROUP BY approval_status")
    print("New Status Breakdown:", cur.fetchall())
    
    print("\n--- SAMPLE APPROVED MEDICINES ---")
    for r in app_rows[:3]:
        print(f"Name: {r[1]}, Batch No: {r[2]}")
        
    print("\n--- SAMPLE REJECTED (COUNTERFEIT) MEDICINES ---")
    for r in rej_rows[:3]:
        print(f"Name: {r[1]}, Batch No: {r[2]}")

    print("\n--- SAMPLE PENDING (UNVERIFIED) MEDICINES ---")
    for r in pen_rows[:3]:
        print(f"Name: {r[1]}, Batch No: {r[2]}")
        
    conn.close()
