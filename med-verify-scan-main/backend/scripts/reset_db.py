import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
pg_url = os.getenv('DATABASE_URL')
if pg_url:
    conn = psycopg2.connect(pg_url)
    cur = conn.cursor()
    cur.execute("UPDATE medicines SET approval_status = 'approved'")
    conn.commit()
    print("All medicines restored to approved!")
    conn.close()
