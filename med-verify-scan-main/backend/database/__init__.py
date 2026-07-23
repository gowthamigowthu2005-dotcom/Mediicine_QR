"""
Database initialization and connection management.
Uses a robust reconnect strategy compatible with Neon serverless PostgreSQL,
which drops idle connections after a period of inactivity.
"""
import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor
import os
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Store the DSN globally so we can create fresh connections on demand
_database_url = None


def init_db(app):
    """Store the database URL for later use."""
    global _database_url
    _database_url = app.config.get('DATABASE_URL') or os.getenv('DATABASE_URL')

    if not _database_url:
        raise ValueError("DATABASE_URL not set in environment or app config")

    # Verify connectivity at startup
    try:
        conn = _new_connection()
        conn.close()
        app.logger.info("Database connection verified successfully")
    except Exception as e:
        app.logger.error(f"Failed to connect to database: {e}")
        raise


def _new_connection():
    """Open a fresh psycopg2 connection with keepalive options."""
    return psycopg2.connect(
        _database_url,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
        connect_timeout=10,
    )


def get_db_connection():
    """Return a fresh database connection. Caller must close it."""
    if _database_url is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")
    return _new_connection()


def return_db_connection(conn):
    """Close a connection (replaces pool putconn for compatibility)."""
    try:
        if conn and not conn.closed:
            conn.close()
    except Exception:
        pass


@contextmanager
def get_db():
    """Context manager for database connections."""
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
    """Execute a database query with automatic reconnection on failure."""
    conn = get_db_connection()
    try:
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
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise e
    finally:
        return_db_connection(conn)


def close_pool():
    """No-op — kept for API compatibility."""
    pass
