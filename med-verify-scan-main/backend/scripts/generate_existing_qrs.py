#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to regenerate QR code PNG images from existing database records (PostgreSQL or SQLite fallback).
If the database has no medicines (such as a fresh offline SQLite database), it auto-seeds 20 medicines.
Saves PNGs to: backend/qr_output/
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
from services.auth import hash_password
from services.qr_signer import QRCodeSigner

# 20 Sample medicines
MEDICINES = [
    # Fever (4)
    {"name": "Crocin 500mg Tablet",      "batch_no": "F001", "mfg_date": "2024-01-01", "expiry_date": "2027-01-01", "dosage": "Tablet",  "strength": "500mg",    "category": "Fever",               "description": "Paracetamol for fever and mild pain",            "stock_quantity": 200},
    {"name": "Dolo 650mg Tablet",         "batch_no": "F002", "mfg_date": "2024-02-01", "expiry_date": "2027-02-01", "dosage": "Tablet",  "strength": "650mg",    "category": "Fever",               "description": "Paracetamol 650mg for high fever relief",              "stock_quantity": 180},
    {"name": "Ibuprofen 400mg Tablet",    "batch_no": "F003", "mfg_date": "2024-03-01", "expiry_date": "2027-03-01", "dosage": "Tablet",  "strength": "400mg",    "category": "Fever",               "description": "Anti-inflammatory for fever and pain",           "stock_quantity": 150},
    {"name": "Meftal 500mg Tablet",       "batch_no": "F004", "mfg_date": "2024-04-01", "expiry_date": "2027-04-01", "dosage": "Tablet",  "strength": "500mg",    "category": "Fever",               "description": "Mefenamic acid for pain and fever relief",       "stock_quantity": 120},
    # Diabetes (4)
    {"name": "Glycomet 500mg Tablet",     "batch_no": "D001", "mfg_date": "2024-01-15", "expiry_date": "2027-01-15", "dosage": "Tablet",  "strength": "500mg",    "category": "Diabetes",            "description": "Metformin for type-2 diabetes management",       "stock_quantity": 160},
    {"name": "Amaryl 2mg Tablet",         "batch_no": "D002", "mfg_date": "2024-02-15", "expiry_date": "2027-02-15", "dosage": "Tablet",  "strength": "2mg",      "category": "Diabetes",            "description": "Glimepiride for blood sugar control",            "stock_quantity": 100},
    {"name": "Januvia 100mg Tablet",      "batch_no": "D003", "mfg_date": "2024-03-15", "expiry_date": "2027-03-15", "dosage": "Tablet",  "strength": "100mg",    "category": "Diabetes",            "description": "Sitagliptin DPP-4 inhibitor for diabetes",       "stock_quantity": 80},
    {"name": "Voglibose 0.3mg Tablet",    "batch_no": "D004", "mfg_date": "2024-04-15", "expiry_date": "2027-04-15", "dosage": "Tablet",  "strength": "0.3mg",    "category": "Diabetes",            "description": "Alpha-glucosidase inhibitor for postprandial",   "stock_quantity": 90},
    # Heart Disease (3)
    {"name": "Aspirin 75mg Tablet",       "batch_no": "H001", "mfg_date": "2024-05-01", "expiry_date": "2027-05-01", "dosage": "Tablet",  "strength": "75mg",     "category": "Heart Disease",       "description": "Antiplatelet for cardiac protection",            "stock_quantity": 250},
    {"name": "Atorvastatin 10mg Tablet",  "batch_no": "H002", "mfg_date": "2024-06-01", "expiry_date": "2027-06-01", "dosage": "Tablet",  "strength": "10mg",     "category": "Heart Disease",       "description": "Statin for cholesterol and heart health",        "stock_quantity": 140},
    {"name": "Clopidogrel 75mg Tablet",   "batch_no": "H003", "mfg_date": "2024-07-01", "expiry_date": "2027-07-01", "dosage": "Tablet",  "strength": "75mg",     "category": "Heart Disease",       "description": "Antiplatelet to prevent blood clots",            "stock_quantity": 110},
    # High Blood Pressure (3)
    {"name": "Amlodipine 5mg Tablet",     "batch_no": "B001", "mfg_date": "2024-05-15", "expiry_date": "2027-05-15", "dosage": "Tablet",  "strength": "5mg",      "category": "High Blood Pressure", "description": "Calcium channel blocker for hypertension",      "stock_quantity": 130},
    {"name": "Lisinopril 10mg Tablet",    "batch_no": "B002", "mfg_date": "2024-06-15", "expiry_date": "2027-06-15", "dosage": "Tablet",  "strength": "10mg",     "category": "High Blood Pressure", "description": "ACE inhibitor for blood pressure control",      "stock_quantity": 165},
    {"name": "Telmisartan 40mg Tablet",   "batch_no": "B003", "mfg_date": "2024-07-15", "expiry_date": "2027-07-15", "dosage": "Tablet",  "strength": "40mg",     "category": "High Blood Pressure", "description": "ARB for hypertension and kidney protection",    "stock_quantity": 95},
    # Cough & Cold (3)
    {"name": "Cough DM Syrup 100ml",      "batch_no": "C001", "mfg_date": "2024-08-01", "expiry_date": "2026-08-01", "dosage": "Syrup",   "strength": "10mg/5ml", "category": "Cough & Cold",        "description": "Cough suppressant for dry cough relief",         "stock_quantity": 80},
    {"name": "Cetirizine 10mg Tablet",    "batch_no": "C002", "mfg_date": "2024-09-01", "expiry_date": "2027-09-01", "dosage": "Tablet",  "strength": "10mg",     "category": "Cough & Cold",        "description": "Antihistamine for allergy and cold symptoms",    "stock_quantity": 140},
    {"name": "Montelukast 10mg Tablet",   "batch_no": "C003", "mfg_date": "2024-10-01", "expiry_date": "2027-10-01", "dosage": "Tablet",  "strength": "10mg",     "category": "Cough & Cold",        "description": "Leukotriene inhibitor for asthma and allergy",  "stock_quantity": 60},
    # Antibiotics (3)
    {"name": "Amoxicillin 500mg Capsule", "batch_no": "A001", "mfg_date": "2024-08-15", "expiry_date": "2026-08-15", "dosage": "Capsule", "strength": "500mg",    "category": "Antibiotics",         "description": "Broad-spectrum antibiotic for infections",       "stock_quantity": 100},
    {"name": "Azithromycin 500mg Tablet", "batch_no": "A002", "mfg_date": "2024-09-15", "expiry_date": "2026-09-15", "dosage": "Tablet",  "strength": "500mg",    "category": "Antibiotics",         "description": "Macrolide antibiotic for respiratory infections", "stock_quantity": 75},
    {"name": "Ciprofloxacin 500mg Tablet","batch_no": "A003", "mfg_date": "2024-10-15", "expiry_date": "2026-10-15", "dosage": "Tablet",  "strength": "500mg",    "category": "Antibiotics",         "description": "Fluoroquinolone for UTI and bacterial infections","stock_quantity": 90},
]

QR_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "qr_output")
os.makedirs(QR_OUTPUT_DIR, exist_ok=True)

def generate_qr_image(payload_dict, medicine_name, batch_no):
    """Generate and save QR code PNG image"""
    safe_name = medicine_name.replace(" ", "_").replace("/", "-").replace("%", "pct")
    filename = f"{batch_no}_{safe_name}.png"
    filepath = os.path.join(QR_OUTPUT_DIR, filename)

    try:
        import qrcode
        from PIL import Image, ImageDraw

        qr_content = json.dumps(payload_dict, sort_keys=True, ensure_ascii=False)

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
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
        draw.text((10, qr_h + 26), f"Batch: {batch_no}", fill="#555555")
        final.save(filepath)
        return filepath
    except Exception as e:
        print(f"     [WARN] QR image error: {e}")
        return None

def run():
    print("="*60)
    print("REGENERATING QR CODE IMAGES (POSTGRES / SQLITE FALLBACK)")
    print("="*60)
    
    from flask import Flask
    app = Flask(__name__)
    app.config["DATABASE_URL"] = os.getenv("DATABASE_URL")
    
    try:
        init_db(app)
    except Exception as e:
        print(f"DB Init Warning: {e}")

    # Check if medicines exist
    meds_count = execute_query("SELECT COUNT(*) as count FROM medicines", fetch_one=True)
    count_val = meds_count.get('count') if meds_count else 0
    
    if count_val == 0:
        print("Database is empty. Seeding 20 medicines and generating QR codes...")
        
        # Get admin
        admin_row = execute_query("SELECT id FROM users WHERE role='admin' LIMIT 1", fetch_one=True)
        admin_id = str(admin_row['id']) if admin_row else str(uuid.uuid4())
        
        # Get seller
        seller_row = execute_query("SELECT id FROM sellers LIMIT 1", fetch_one=True)
        seller_id = str(seller_row['id']) if seller_row else str(uuid.uuid4())
        
        signer = QRCodeSigner()
        
        for i, med in enumerate(MEDICINES, 1):
            med_id = str(uuid.uuid4())
            
            # Insert medicine
            execute_query("""
                INSERT INTO medicines (id, seller_id, name, batch_no, mfg_date, expiry_date,
                                       dosage, strength, category, description, stock_quantity, approval_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'approved')
            """, (med_id, seller_id, med['name'], med['batch_no'], med['mfg_date'], med['expiry_date'],
                  med['dosage'], med['strength'], med['category'], med['description'], med['stock_quantity']))
            
            payload = {
                "medicine_id": med_id,
                "medicine_name": med['name'],
                "batch_no": med['batch_no'],
                "mfg_date": med['mfg_date'],
                "expiry_date": med['expiry_date'],
                "dosage": med['dosage'],
                "strength": med['strength'],
                "seller_id": seller_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            
            try:
                signature = signer.sign_payload(payload)
            except Exception:
                signature = "UNSIGNED_DEMO_MODE"
                
            qr_id = str(uuid.uuid4())
            execute_query("""
                INSERT INTO qr_codes (id, medicine_id, payload_json, signature, issued_by)
                VALUES (%s, %s, %s, %s, %s)
            """, (qr_id, med_id, json.dumps(payload), signature, admin_id))
            
            full_payload = dict(payload)
            full_payload["signature"] = signature
            full_payload["qr_id"] = qr_id
            
            generate_qr_image(full_payload, med['name'], med['batch_no'])
            print(f"[{i:02d}/20] Seeded & Generated QR: {med['name']}")
            
        print("Seeding complete.")
        return

    # Regular regeneration
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
    rows = execute_query(query, fetch_all=True) or []
    print(f"Found {len(rows)} QR code records in database.")
    
    generated_count = 0
    for i, row in enumerate(rows, 1):
        qr_id = str(row['qr_id'])
        med_name = row['medicine_name'] or "Unknown"
        batch_no = row['batch_no'] or "Unknown"
        
        payload = {}
        payload_data = row['payload_json']
        if isinstance(payload_data, str):
            try:
                payload.update(json.loads(payload_data))
            except Exception:
                pass
        elif isinstance(payload_data, dict):
            payload.update(payload_data)
            
        payload['signature'] = row['signature']
        payload['qr_id'] = qr_id
        
        img = generate_qr_image(payload, med_name, batch_no)
        if img:
            generated_count += 1
            
        if i <= 20 or i % 50 == 0 or i == len(rows):
            print(f"[{i}/{len(rows)}] Generated QR: {batch_no}_{med_name.replace(' ', '_')}.png")
            
    print("-" * 60)
    print(f"Successfully generated {generated_count} QR Code PNG files.")
    print("=" * 60)

if __name__ == '__main__':
    run()
