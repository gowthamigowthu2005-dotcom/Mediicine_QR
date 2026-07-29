#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to regenerate QR code PNG images from database records.
- Saves Approved Medicine QR codes in: backend/qr_output/ (Scans as Authentic/Verified)
- Saves Rejected/Unapproved Medicine QR codes in: backend/qr_output/counterfeit_rejected/ (Scans as Counterfeit/Unverified)
"""

import sys
import os
import json
import uuid
from datetime import datetime, timezone

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from database import init_db, execute_query
from database.models import User, Seller, Medicine, QRCode

QR_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "qr_output")
REJECTED_DIR = os.path.join(QR_OUTPUT_DIR, "counterfeit_rejected")
os.makedirs(QR_OUTPUT_DIR, exist_ok=True)
os.makedirs(REJECTED_DIR, exist_ok=True)

def generate_qr_image(qr_id, medicine_name, batch_no, is_approved=True):
    """Generate low-density QR code PNG image"""
    safe_name = medicine_name.replace(" ", "_").replace("/", "-").replace("%", "pct")
    filename = f"{batch_no}_{safe_name}.png"
    
    target_dir = QR_OUTPUT_DIR if is_approved else REJECTED_DIR
    filepath = os.path.join(target_dir, filename)

    try:
        import qrcode
        from PIL import Image, ImageDraw

        qr_content = json.dumps({"qr_id": qr_id})

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_content)
        qr.make(fit=True)

        qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        qr_w, qr_h = qr_img.size

        # Add white label strip at bottom
        label_h = 55
        final = Image.new("RGB", (qr_w, qr_h + label_h), "white")
        final.paste(qr_img, (0, 0))
        draw = ImageDraw.Draw(final)
        draw.text((10, qr_h + 6),  medicine_name[:35], fill="black")
        status_label = f"Batch: {batch_no} | {'AUTHENTIC' if is_approved else 'UNVERIFIED'}"
        draw.text((10, qr_h + 26), status_label, fill="#2b8a3e" if is_approved else "#c92a2a")
        final.save(filepath)
        return filepath
    except Exception as e:
        print(f"     [WARN] QR image error: {e}")
        return None

def run():
    print("="*60)
    print("REGENERATING QR CODES (APPROVED VS COUNTERFEIT/REJECTED)")
    print("="*60)
    
    from flask import Flask
    app = Flask(__name__)
    app.config["DATABASE_URL"] = os.getenv("DATABASE_URL")
    
    try:
        init_db(app)
    except Exception as e:
        print(f"DB Init Warning: {e}")

    query = """
        SELECT 
            q.id as qr_id,
            q.payload_json,
            m.name as medicine_name,
            m.batch_no,
            m.approval_status
        FROM qr_codes q
        JOIN medicines m ON q.medicine_id = m.id
        ORDER BY m.approval_status ASC, q.issued_at DESC
    """
    rows = execute_query(query, fetch_all=True) or []
    print(f"Found {len(rows)} QR code records in database.")
    
    app_count = 0
    rej_count = 0
    for i, row in enumerate(rows, 1):
        qr_id = str(row['qr_id'])
        med_name = row['medicine_name'] or "Unknown"
        batch_no = row['batch_no'] or "Unknown"
        status = row.get('approval_status', 'approved')
        is_approved = (status == 'approved')
        
        img = generate_qr_image(qr_id, med_name, batch_no, is_approved=is_approved)
        if img:
            if is_approved:
                app_count += 1
            else:
                rej_count += 1
            
        if i <= 10 or i % 50 == 0 or i == len(rows):
            print(f"[{i}/{len(rows)}] Generated QR ({status.upper()}): {batch_no}_{med_name.replace(' ', '_')}.png")
            
    print("-" * 60)
    print(f"Successfully generated {app_count} Authentic Approved QR codes in backend/qr_output/")
    print(f"Successfully generated {rej_count} Counterfeit/Rejected QR codes in backend/qr_output/counterfeit_rejected/")
    print("=" * 60)

if __name__ == '__main__':
    run()
