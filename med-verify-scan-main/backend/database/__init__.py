"""
Database initialization and connection management with automatic reconnection and keepalives
"""
from flask import current_app
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
import os
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

# Global Connection Pool and DSN
_pool = None
_dsn = None

def _get_dsn(database_url):
    """Ensure DSN includes keepalive parameters for resilient cloud connections"""
    # Parse or append keepalive parameters if using PostgreSQL
    if database_url and database_url.startswith("postgresql"):
        sep = "&" if "?" in database_url else "?"
        # Add connect_timeout and TCP keepalive parameters if not already present
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

def init_db(app):
    """Initialize database connection pool with resilient settings"""
    global _pool, _dsn
    database_url = app.config.get('DATABASE_URL') or os.getenv('DATABASE_URL')
    
    if not database_url:
        raise ValueError("DATABASE_URL not set in environment or app config")
    
    _dsn = _get_dsn(database_url)
    
    try:
        if _pool:
            try:
                _pool.closeall()
            except Exception:
                pass
        
        _pool = SimpleConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=_dsn
        )
        app.logger.info("Database connection pool initialized with resilient keepalives")
    except Exception as e:
        app.logger.error(f"Failed to initialize database pool: {e}")
        raise

def _new_connection():
    """Create a fresh direct connection if pool fails or is unavailable"""
    if not _dsn:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise RuntimeError("DATABASE_URL environment variable is missing")
        return psycopg2.connect(_get_dsn(database_url))
    return psycopg2.connect(_dsn)

def get_db_connection():
    """Get a verified, active database connection from the pool"""
    global _pool
    if _pool is None:
        # Auto-initialize if possible
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            _dsn = _get_dsn(database_url)
            _pool = SimpleConnectionPool(minconn=1, maxconn=10, dsn=_dsn)
        else:
            raise RuntimeError("Database pool not initialized. Call init_db() first.")
    
    # Try getting connection from pool and verify it's working
    for _ in range(3):
        try:
            conn = _pool.getconn()
            if conn.closed != 0:
                _pool.putconn(conn, close=True)
                continue
            
            # Quick ping test to ensure connection wasn't closed by server (Neon idle timeout / SSL reset)
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
            return conn
        except (psycopg2.OperationalError, psycopg2.InterfaceError, psycopg2.DatabaseError) as err:
            logger.warning(f"Discarding stale connection due to: {err}")
            try:
                if 'conn' in locals() and conn:
                    _pool.putconn(conn, close=True)
            except Exception:
                pass

    # If pool connection checks keep failing, return a fresh direct connection
    logger.info("Creating a fresh direct connection...")
    return _new_connection()

def return_db_connection(conn):
    """Return a database connection to the pool safely"""
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

def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """Execute a database query with automatic retry on connection drops"""
    max_retries = 2
    for attempt in range(max_retries):
        conn = None
        try:
            conn = get_db_connection()
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
                logger.warning(f"Database query failed ({e}). Retrying with fresh connection...")
                continue
            else:
                raise e
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
