"""
Database initialization and connection management with automatic PostgreSQL-to-SQLite fallback.
Allows the application to run completely offline without internet or Neon DB issues.
"""
from flask import current_app
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
import sqlite3
import os
import uuid
from contextlib import contextmanager
import logging
import json

logger = logging.getLogger(__name__)

# Global variables
_pool = None
_dsn = None
_is_sqlite = False
_sqlite_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "local_medverify.db")

def _get_dsn(database_url):
    """Ensure DSN includes keepalive parameters for resilient cloud connections"""
    if database_url and database_url.startswith("postgresql"):
        sep = "&" if "?" in database_url else "?"
        params = []
        if "connect_timeout" not in database_url:
            params.append("connect_timeout=10")
        if "keepalives" not in database_url:
            params.append("keepalives=1")
            params.append("keepalives_idle=30")
            params.append("keepalives_interval=10")
            params.append("keepalives_count=5")
        if params:
            database_url += sep + "&".join(params)
    return database_url

def _init_sqlite():
    """Initialize local SQLite database schema and seed default credentials"""
    global _is_sqlite
    _is_sqlite = True
    logger.info("Initializing offline SQLite database...")
    os.makedirs(os.path.dirname(_sqlite_db_path), exist_ok=True)
    
    conn = sqlite3.connect(_sqlite_db_path)
    cur = conn.cursor()
    
    # Create tables
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        timezone TEXT DEFAULT 'UTC',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        last_login TIMESTAMP
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS sellers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        license_number TEXT UNIQUE NOT NULL,
        license_type TEXT,
        license_expiry TEXT,
        gstin TEXT,
        address TEXT,
        authorized_person TEXT,
        authorized_person_contact TEXT,
        email TEXT,
        company_website TEXT,
        status TEXT DEFAULT 'pending',
        public_key TEXT,
        docs_url TEXT,
        documents TEXT,
        document_checksums TEXT,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by TEXT
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        name TEXT NOT NULL,
        batch_no TEXT NOT NULL,
        mfg_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        dosage TEXT,
        strength TEXT,
        category TEXT,
        description TEXT,
        image_url TEXT,
        approval_status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at TIMESTAMP,
        stock_quantity INTEGER DEFAULT 0,
        delivery_status TEXT DEFAULT 'in_stock',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS qr_codes (
        id TEXT PRIMARY KEY,
        medicine_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        signature TEXT NOT NULL,
        blockchain_tx TEXT,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked INTEGER DEFAULT 0,
        revoked_at TIMESTAMP,
        revoked_reason TEXT,
        issued_by TEXT NOT NULL
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS revoked_keys (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        public_key TEXT NOT NULL,
        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        revoked_by TEXT
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS scan_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        qr_id TEXT,
        raw_payload TEXT,
        result TEXT NOT NULL,
        details TEXT,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Seed default user accounts
    from services.auth import hash_password
    users_to_seed = [
        ("admin@medverify.com", hash_password("Admin@1234"), "admin"),
        ("seller@medverify.com", hash_password("Seller@1234"), "seller"),
        ("user@medverify.com", hash_password("User@1234"), "user"),
        ("testseller@medverify.com", hash_password("Seller@1234"), "seller")
    ]
    
    for email, pw_hash, role in users_to_seed:
        cur.execute("SELECT id FROM users WHERE email = ?", (email,))
        if not cur.fetchone():
            user_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO users (id, email, password_hash, role, is_active)
                VALUES (?, ?, ?, ?, 1)
            """, (user_id, email, pw_hash, role))
            
            # If seller, create approved seller profile
            if role == "seller":
                seller_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO sellers (id, user_id, company_name, license_number, status)
                    VALUES (?, ?, ?, ?, 'approved')
                """, (seller_id, user_id, "MedVerify Local Pharma", "LIC-LOCAL-" + user_id[:6].upper()))
                
    conn.commit()
    conn.close()
    logger.info("Offline SQLite database successfully prepared with seed accounts.")

def init_db(app):
    """Initialize database connection pool or fallback to local SQLite"""
    global _pool, _dsn, _is_sqlite
    database_url = app.config.get('DATABASE_URL') or os.getenv('DATABASE_URL')
    
    if not database_url or not database_url.startswith("postgresql"):
        logger.warning("No PostgreSQL URL provided. Falling back to SQLite.")
        _init_sqlite()
        return

    _dsn = _get_dsn(database_url)
    
    try:
        if _pool:
            try:
                _pool.closeall()
            except Exception:
                pass
        
        # Test connection first to verify name resolution and host availability
        test_conn = psycopg2.connect(_dsn)
        test_conn.close()
        
        _pool = SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=_dsn
        )
        _is_sqlite = False
        app.logger.info("Resilient PostgreSQL connection pool initialized successfully.")
    except Exception as e:
        app.logger.error(f"PostgreSQL connection failed ({e}). Falling back to local offline SQLite database.")
        _init_sqlite()

def _new_connection():
    """Create a fresh connection based on mode"""
    if _is_sqlite:
        conn = sqlite3.connect(_sqlite_db_path)
        conn.row_factory = sqlite3.Row
        return conn
        
    if not _dsn:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise RuntimeError("DATABASE_URL environment variable is missing")
        return psycopg2.connect(_get_dsn(database_url))
    return psycopg2.connect(_dsn)

def get_db_connection():
    """Get verified active database connection"""
    global _pool
    if _is_sqlite:
        return _new_connection()
        
    if _pool is None:
        database_url = os.getenv('DATABASE_URL')
        if database_url and database_url.startswith("postgresql"):
            try:
                _dsn = _get_dsn(database_url)
                _pool = SimpleConnectionPool(minconn=1, maxconn=10, dsn=_dsn)
            except Exception:
                _init_sqlite()
                return _new_connection()
        else:
            _init_sqlite()
            return _new_connection()
    
    for _ in range(3):
        try:
            conn = _pool.getconn()
            if conn.closed != 0:
                _pool.putconn(conn, close=True)
                continue
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
            return conn
        except Exception as err:
            logger.warning(f"Discarding stale connection: {err}")
            try:
                if 'conn' in locals() and conn:
                    _pool.putconn(conn, close=True)
            except Exception:
                pass

    logger.info("Creating a fresh direct connection...")
    try:
        return _new_connection()
    except Exception:
        _init_sqlite()
        return _new_connection()

def return_db_connection(conn):
    """Return database connection back to the pool safely"""
    if _is_sqlite:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        return
        
    if _pool is None or conn is None:
        if conn and conn.closed == 0:
            try:
                conn.close()
            except Exception:
                pass
        return
    
    try:
        if conn.closed != 0:
            _pool.putconn(conn, close=True)
        else:
            _pool.putconn(conn)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass

@contextmanager
def get_db():
    """Context manager for database connections"""
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise e
    finally:
        return_db_connection(conn)

def _sqlite_dict_factory(cursor, row):
    """Format SQLite row as dictionary like PostgreSQL RealDictCursor"""
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """Execute a query with PostgreSQL or SQLite support & automatic fallback"""
    global _is_sqlite
    
    # ── SQLITE MODE ──────────────────────────────────────────────────────────
    if _is_sqlite:
        # Pre-process query to match SQLite query placeholder syntax
        processed_query = query.replace('%s', '?').replace('::jsonb', '')
        
        # Remove RETURNING clauses from insert/update queries
        returning_field = None
        if "RETURNING" in processed_query:
            parts = processed_query.split("RETURNING")
            processed_query = parts[0].strip()
            returning_field = parts[1].strip().replace("*", "").strip()
            
        conn = None
        try:
            conn = sqlite3.connect(_sqlite_db_path)
            conn.row_factory = _sqlite_dict_factory
            cur = conn.cursor()
            
            # Map parameters
            sqlite_params = []
            if params:
                for p in params:
                    # SQLite does not support native dict parameter binding, cast JSON to string
                    if isinstance(p, dict) or isinstance(p, list):
                        sqlite_params.append(json.dumps(p))
                    else:
                        sqlite_params.append(p)
            
            cur.execute(processed_query, sqlite_params)
            
            if fetch_one:
                result = cur.fetchone()
                # Handle RETURNING fallback
                if not result and returning_field == "id" and cur.lastrowid:
                    result = {"id": cur.lastrowid}
                conn.commit()
                return result
            elif fetch_all:
                result = cur.fetchall()
                conn.commit()
                return result
            else:
                conn.commit()
                if returning_field == "id" and cur.lastrowid:
                    return {"id": cur.lastrowid}
                return cur.rowcount
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()

    # ── POSTGRESQL MODE ──────────────────────────────────────────────────────
    max_retries = 2
    for attempt in range(max_retries):
        conn = None
        try:
            conn = get_db_connection()
            # If get_db_connection fell back to SQLite, rerun in SQLite mode
            if _is_sqlite:
                return execute_query(query, params, fetch_one, fetch_all)
                
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                if fetch_one:
                    result = cur.fetchone()
                    conn.commit()
                    return result
                elif fetch_all:
                    result = cur.fetchall()
                    conn.commit()
                    return result
                else:
                    conn.commit()
                    return cur.rowcount
        except (psycopg2.OperationalError, psycopg2.InterfaceError, psycopg2.DatabaseError) as e:
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
                return_db_connection(conn)
                conn = None
            
            if attempt < max_retries - 1:
                logger.warning(f"Database query failed ({e}). Retrying...")
                continue
            else:
                logger.error(f"PostgreSQL query failed. Activating SQLite fallback: {e}")
                _init_sqlite()
                return execute_query(query, params, fetch_one, fetch_all)
        except Exception as e:
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
                return_db_connection(conn)
            raise e
        finally:
            if conn:
                return_db_connection(conn)

def close_pool():
    """Close all database connections in the pool"""
    global _pool
    if _pool:
        try:
            _pool.closeall()
        except Exception:
            pass
        _pool = None
