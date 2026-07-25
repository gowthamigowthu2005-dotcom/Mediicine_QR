#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to regenerate QR code PNG images from existing database records.
Saves PNGs to: backend/qr_output/
"""

import sys
import os
import json

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import psycopg2
from psycopg2.extras import RealDictCursor

QR_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "qr_output")
os.makedirs(QR_OUTPUT_DIR, exist_ok=True)

def run():
    print("=" * 60)
    print("REGENERATING QR CODE IMAGES FROM DATABASE")
    print("=" * 60)
    
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("Error: DATABASE_URL is not set.")
        sys.exit(1)
        
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Query existing QR codes joined with medicine name
        query = """
            SELECT 
                q.id as qr_id,
                q.payload_json,
                q.signature,
                m.name as medicine_name,
                m.batch_no
            FROM qr_codes q
            JOIN medicines m ON q.medicine_id = m.id
            ORDER BY q.issued_at DESC
        """
        cur.execute(query)
        rows = cur.fetchall()
        
        print(f"Found {len(rows)} QR code records in database.")
        
        if not rows:
            print("No records found to generate.")
            return

        import qrcode
        from PIL import Image, ImageDraw
        
        generated_count = 0
        for i, row in enumerate(rows, 1):
            qr_id = str(row['qr_id'])
            med_name = row['medicine_name'] or "Unknown"
            batch_no = row['batch_no'] or "Unknown"
            
            # Reconstruct full payload including signature and qr_id
            payload = {}
            if isinstance(row['payload_json'], dict):
                payload.update(row['payload_json'])
            elif isinstance(row['payload_json'], str):
                try:
                    payload.update(json.loads(row['payload_json']))
                except Exception:
                    pass
            
            payload['signature'] = row['signature']
            payload['qr_id'] = qr_id
            
            # Generate filename
            safe_name = med_name.replace(" ", "_").replace("/", "-").replace("%", "pct")
            filename = f"{batch_no}_{safe_name}.png"
            filepath = os.path.join(QR_OUTPUT_DIR, filename)
            
            # Generate QR Code
            qr_content = json.dumps(payload, sort_keys=True, ensure_ascii=False)
            qr = qrcode.QRCode(
                version=None,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=4
            )
            qr.add_data(qr_content)
            qr.make(fit=True)
            
            qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
            qr_w, qr_h = qr_img.size
            
            # Add text label below
            label_h = 55
            final_img = Image.new("RGB", (qr_w, qr_h + label_h), "white")
            final_img.paste(qr_img, (0, 0))
            
            draw = ImageDraw.Draw(final_img)
            draw.text((12, qr_h + 5), med_name[:35], fill="black")
            draw.text((12, qr_h + 25), f"Batch: {batch_no}", fill="#555555")
            
            final_img.save(filepath)
            generated_count += 1
            if i <= 20 or i % 50 == 0 or i == len(rows):
                print(f"[{i}/{len(rows)}] Generated QR Image: {filename}")
                
        print("-" * 60)
        print(f"Successfully generated {generated_count} QR Code PNG files.")
        print(f"Output directory: {QR_OUTPUT_DIR}")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == '__main__':
    run()
