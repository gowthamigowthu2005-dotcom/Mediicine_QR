import os
import bcrypt
import psycopg2
import sqlite3
from dotenv import load_dotenv

load_dotenv('backend/.env')

def hash_pw(pw):
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

users_to_set = [
    ('admin@medverify.com', 'Password123', 'admin'),
    ('seller@medverify.com', 'Password123', 'seller'),
    ('user@medverify.com', 'Password123', 'user')
]

# 1. Update PostgreSQL
pg_url = os.getenv('DATABASE_URL')
if pg_url:
    try:
        conn = psycopg2.connect(pg_url)
        cur = conn.cursor()
        for email, password, role in users_to_set:
            pw_hash = hash_pw(password)
            cur.execute("SELECT id FROM users WHERE LOWER(email) = %s", (email,))
            row = cur.fetchone()
            if row:
                cur.execute("UPDATE users SET password_hash = %s, role = %s WHERE id = %s", (pw_hash, role, row[0]))
            else:
                cur.execute("INSERT INTO users (email, password_hash, role) VALUES (%s, %s, %s)", (email, pw_hash, role))
        conn.commit()
        conn.close()
        print("PostgreSQL credentials updated successfully!")
    except Exception as e:
        print("PostgreSQL error:", e)

# 2. Update SQLite if present
sqlite_path = os.path.join("backend", "database", "local_medverify.db")
if os.path.exists(sqlite_path):
    try:
        import uuid
        conn = sqlite3.connect(sqlite_path)
        cur = conn.cursor()
        for email, password, role in users_to_set:
            pw_hash = hash_pw(password)
            cur.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
            row = cur.fetchone()
            if row:
                cur.execute("UPDATE users SET password_hash = ?, role = ? WHERE id = ?", (pw_hash, role, row[0]))
            else:
                cur.execute("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)", (str(uuid.uuid4()), email, pw_hash, role))
        conn.commit()
        conn.close()
        print("SQLite credentials updated successfully!")
    except Exception as e:
        print("SQLite error:", e)
