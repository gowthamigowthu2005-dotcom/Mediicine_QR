#!/usr/bin/env python3
"""
Script to restore ALL medicines in database to 'approved' status.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from database import execute_query

def run():
    print("=" * 60)
    print("RESTORING ALL MEDICINES TO APPROVED STATUS")
    print("=" * 60)

    count = execute_query("UPDATE medicines SET approval_status = 'approved'")
    print(f"Updated {count} medicines to 'approved' status.")

    breakdown = execute_query("SELECT approval_status, COUNT(*) as count FROM medicines GROUP BY approval_status", fetch_all=True)
    print("Current Database Breakdown:")
    for row in breakdown:
        print(f"  - {row['approval_status'].capitalize()}: {row['count']}")
    print("=" * 60)

if __name__ == '__main__':
    run()
