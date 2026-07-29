"""
Utility helper functions
"""
import uuid
from datetime import datetime
from typing import Dict, Any

def generate_uuid() -> str:
    """Generate a UUID string"""
    return str(uuid.uuid4())

def get_current_timestamp() -> datetime:
    """Get current UTC timestamp"""
    return datetime.utcnow()

def format_datetime(dt) -> str:
    """Format datetime or string timestamp to ISO string safely"""
    if dt:
        if isinstance(dt, str):
            return dt
        if hasattr(dt, 'isoformat'):
            return dt.isoformat()
        return str(dt)
    return None

def sanitize_dict(data: Dict[str, Any], exclude_keys: list = None) -> Dict[str, Any]:
    """
    Remove sensitive keys from dictionary
    """
    if exclude_keys is None:
        exclude_keys = ['password', 'password_hash', 'private_key', 'secret']
    
    sanitized = {}
    for key, value in data.items():
        if key not in exclude_keys:
            sanitized[key] = value
    return sanitized

def validate_date_string(date_str: str, date_format: str = '%Y-%m-%d') -> bool:
    """Validate date string format"""
    try:
        datetime.strptime(date_str, date_format)
        return True
    except ValueError:
        return False

def parse_json_safe(json_str: str) -> Dict[str, Any]:
    """Safely parse JSON string"""
    try:
        import json
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return {}
