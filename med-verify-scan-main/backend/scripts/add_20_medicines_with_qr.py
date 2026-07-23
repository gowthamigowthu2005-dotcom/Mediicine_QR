#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add 20 medicines + generate QR code PNG images for each.
- Auto-creates an admin user if none exists
- Auto-creates an approved test seller if none exists
- Inserts 20 medicines (all pre-approved)
- Generates QR PNG images in: backend/qr_output/

Usage:
    cd backend
    python -X utf8 scripts/add_20_medicines_with_qr.py
"""

import sys
import os
import json
from datetime import datetime, timezone

# Fix Windows console encoding
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from database import init_db, execute_query
from database.models import Medicine, Seller, QRCode, User
from services.qr_signer import QRCodeSigner
from services.auth import hash_password

# Output folder for QR PNG images
QR_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "qr_output")
os.makedirs(QR_OUTPUT_DIR, exist_ok=True)

# ── 20 Sample medicines ───────────────────────────────────────────────────────
MEDICINES = [
    # Fever (4)
    {"name": "Crocin 500mg Tablet",      "batch_no": "MED-F001", "mfg_date": "2024-01-01", "expiry_date": "2027-01-01", "dosage": "Tablet",  "strength": "500mg",    "category": "Fever",               "description": "Paracetamol for fever and mild pain",            "stock_quantity": 200},
    {"name": "Dolo 650mg Tablet",         "batch_no": "MED-F002", "mfg_date": "2024-02-01", "expiry_date": "2027-02-01", "dosage": "Tablet",  "strength": "650mg",    "category": "Fever",               "description": "Paracetamol 650mg for high fever",               "stock_quantity": 180},
    {"name": "Ibuprofen 400mg Tablet",    "batch_no": "MED-F003", "mfg_date": "2024-03-01", "expiry_date": "2027-03-01", "dosage": "Tablet",  "strength": "400mg",    "category": "Fever",               "description": "Anti-inflammatory for fever and pain",           "stock_quantity": 150},
    {"name": "Meftal 500mg Tablet",       "batch_no": "MED-F004", "mfg_date": "2024-04-01", "expiry_date": "2027-04-01", "dosage": "Tablet",  "strength": "500mg",    "category": "Fever",               "description": "Mefenamic acid for pain and fever relief",       "stock_quantity": 120},
    # Diabetes (4)
    {"name": "Glycomet 500mg Tablet",     "batch_no": "MED-D001", "mfg_date": "2024-01-15", "expiry_date": "2027-01-15", "dosage": "Tablet",  "strength": "500mg",    "category": "Diabetes",            "description": "Metformin for type-2 diabetes management",       "stock_quantity": 160},
    {"name": "Amaryl 2mg Tablet",         "batch_no": "MED-D002", "mfg_date": "2024-02-15", "expiry_date": "2027-02-15", "dosage": "Tablet",  "strength": "2mg",      "category": "Diabetes",            "description": "Glimepiride for blood sugar control",            "stock_quantity": 100},
    {"name": "Januvia 100mg Tablet",      "batch_no": "MED-D003", "mfg_date": "2024-03-15", "expiry_date": "2027-03-15", "dosage": "Tablet",  "strength": "100mg",    "category": "Diabetes",            "description": "Sitagliptin DPP-4 inhibitor for diabetes",       "stock_quantity": 80},
    {"name": "Voglibose 0.3mg Tablet",    "batch_no": "MED-D004", "mfg_date": "2024-04-15", "expiry_date": "2027-04-15", "dosage": "Tablet",  "strength": "0.3mg",    "category": "Diabetes",            "description": "Alpha-glucosidase inhibitor for postprandial",   "stock_quantity": 90},
    # Heart Disease (3)
    {"name": "Aspirin 75mg Tablet",       "batch_no": "MED-H001", "mfg_date": "2024-05-01", "expiry_date": "2027-05-01", "dosage": "Tablet",  "strength": "75mg",     "category": "Heart Disease",       "description": "Antiplatelet for cardiac protection",            "stock_quantity": 250},
    {"name": "Atorvastatin 10mg Tablet",  "batch_no": "MED-H002", "mfg_date": "2024-06-01", "expiry_date": "2027-06-01", "dosage": "Tablet",  "strength": "10mg",     "category": "Heart Disease",       "description": "Statin for cholesterol and heart health",        "stock_quantity": 140},
    {"name": "Clopidogrel 75mg Tablet",   "batch_no": "MED-H003", "mfg_date": "2024-07-01", "expiry_date": "2027-07-01", "dosage": "Tablet",  "strength": "75mg",     "category": "Heart Disease",       "description": "Antiplatelet to prevent blood clots",            "stock_quantity": 110},
    # High Blood Pressure (3)
    {"name": "Amlodipine 5mg Tablet",     "batch_no": "MED-B001", "mfg_date": "2024-05-15", "expiry_date": "2027-05-15", "dosage": "Tablet",  "strength": "5mg",      "category": "High Blood Pressure", "description": "Calcium channel blocker for hypertension",      "stock_quantity": 130},
    {"name": "Lisinopril 10mg Tablet",    "batch_no": "MED-B002", "mfg_date": "2024-06-15", "expiry_date": "2027-06-15", "dosage": "Tablet",  "strength": "10mg",     "category": "High Blood Pressure", "description": "ACE inhibitor for blood pressure control",      "stock_quantity": 165},
    {"name": "Telmisartan 40mg Tablet",   "batch_no": "MED-B003", "mfg_date": "2024-07-15", "expiry_date": "2027-07-15", "dosage": "Tablet",  "strength": "40mg",     "category": "High Blood Pressure", "description": "ARB for hypertension and kidney protection",    "stock_quantity": 95},
    # Cough & Cold (3)
    {"name": "Cough DM Syrup 100ml",      "batch_no": "MED-C001", "mfg_date": "2024-08-01", "expiry_date": "2026-08-01", "dosage": "Syrup",   "strength": "10mg/5ml", "category": "Cough & Cold",        "description": "Cough suppressant for dry cough relief",         "stock_quantity": 80},
    {"name": "Cetirizine 10mg Tablet",    "batch_no": "MED-C002", "mfg_date": "2024-09-01", "expiry_date": "2027-09-01", "dosage": "Tablet",  "strength": "10mg",     "category": "Cough & Cold",        "description": "Antihistamine for allergy and cold symptoms",    "stock_quantity": 140},
    {"name": "Montelukast 10mg Tablet",   "batch_no": "MED-C003", "mfg_date": "2024-10-01", "expiry_date": "2027-10-01", "dosage": "Tablet",  "strength": "10mg",     "category": "Cough & Cold",        "description": "Leukotriene inhibitor for asthma and allergy",  "stock_quantity": 60},
    # Antibiotics (3)
    {"name": "Amoxicillin 500mg Capsule", "batch_no": "MED-A001", "mfg_date": "2024-08-15", "expiry_date": "2026-08-15", "dosage": "Capsule", "strength": "500mg",    "category": "Antibiotics",         "description": "Broad-spectrum antibiotic for infections",       "stock_quantity": 100},
    {"name": "Azithromycin 500mg Tablet", "batch_no": "MED-A002", "mfg_date": "2024-09-15", "expiry_date": "2026-09-15", "dosage": "Tablet",  "strength": "500mg",    "category": "Antibiotics",         "description": "Macrolide antibiotic for respiratory infections", "stock_quantity": 75},
    {"name": "Ciprofloxacin 500mg Tablet","batch_no": "MED-A003", "mfg_date": "2024-10-15", "expiry_date": "2026-10-15", "dosage": "Tablet",  "strength": "500mg",    "category": "Antibiotics",         "description": "Fluoroquinolone for UTI and bacterial infections","stock_quantity": 90},
]


def get_or_create_admin():
    """Get existing admin or create one"""
    result = execute_query("SELECT id FROM users WHERE role='admin' LIMIT 1", fetch_one=True)
    if result:
        print("  [OK] Admin user found")
        return str(result["id"])

    print("  [..] No admin found - creating admin user...")
    pw_hash = hash_password("Admin@1234")
    user = User.create("admin@medverify.com", pw_hash, role="admin", timezone="UTC")
    if user:
        print("  [OK] Admin created: admin@medverify.com / Admin@1234")
        return str(user["id"])
    raise RuntimeError("Failed to create admin user")


def get_or_create_seller(admin_id):
    """Get existing approved seller or create one directly"""
    sellers = Seller.get_all_approved()
    if sellers:
        s = sellers[0]
        print(f"  [OK] Approved seller found: {s['company_name']}")
        return str(s["id"])

    print("  [..] No approved seller - creating test seller account...")

    # Create a seller user
    seller_user = User.get_by_email("testseller@medverify.com")
    if not seller_user:
        pw_hash = hash_password("Seller@1234")
        seller_user = User.create("testseller@medverify.com", pw_hash, role="seller", timezone="UTC")
        print("  [OK] Seller user created: testseller@medverify.com / Seller@1234")
    else:
        print("  [OK] Seller user exists: testseller@medverify.com")

    seller_user_id = str(seller_user["id"])

    # Check if seller profile exists
    existing = Seller.get_by_user_id(seller_user_id)
    if existing:
        seller_id = str(existing["id"])
        # Approve it
        execute_query(
            "UPDATE sellers SET status='approved', approved_by=%s, approved_at=CURRENT_TIMESTAMP WHERE id=%s",
            (admin_id, seller_id)
        )
        print(f"  [OK] Existing seller profile approved (ID: {seller_id[:8]}...)")
        return seller_id

    # Create seller profile directly as approved
    query = """
        INSERT INTO sellers
          (user_id, company_name, license_number, license_type,
           license_expiry, gstin, address, authorized_person,
           authorized_person_contact, email, status, approved_by, approved_at)
        VALUES
          (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'approved', %s, CURRENT_TIMESTAMP)
        RETURNING id
    """
    row = execute_query(query, (
        seller_user_id,
        "MedVerify Test Pharma",
        "DL-TEST-MH-2024-001",
        "wholesale",
        "2027-12-31",
        "27AABCU9603R1ZX",
        "123 MG Road, Mumbai, Maharashtra - 400001",
        "Test Authorized Person",
        "9876543210",
        "testseller@medverify.com",
        admin_id,
    ), fetch_one=True)

    seller_id = str(row["id"])
    print(f"  [OK] Test seller created & approved: MedVerify Test Pharma")
    return seller_id


def generate_qr_image(payload_dict, medicine_name, batch_no):
    """Generate and save QR code PNG image"""
    safe_name = medicine_name.replace(" ", "_").replace("/", "-")
    filename = f"{batch_no}_{safe_name}.png"
    filepath = os.path.join(QR_OUTPUT_DIR, filename)

    try:
        import qrcode
        from PIL import Image, ImageDraw

        qr_content = json.dumps(payload_dict, sort_keys=True, ensure_ascii=False)

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
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
        draw.text((10, qr_h + 6),  medicine_name, fill="black")
        draw.text((10, qr_h + 26), f"Batch: {batch_no}", fill="#555555")
        final.save(filepath)
        return filepath

    except ImportError:
        # Fallback: save JSON payload
        json_path = filepath.replace(".png", ".json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(payload_dict, f, indent=2, ensure_ascii=False)
        return json_path
    except Exception as e:
        print(f"     [WARN] QR image error: {e}")
        return None


def run():
    print("\n" + "="*65)
    print("  ADD 20 MEDICINES + GENERATE QR CODES")
    print("="*65 + "\n")

    app = Flask(__name__)
    app.config["DATABASE_URL"] = os.getenv("DATABASE_URL")

    try:
        init_db(app)
        print("[DB] Connected successfully\n")
    except Exception as e:
        print(f"[ERROR] DB connection failed: {e}")
        sys.exit(1)

    # Setup admin + seller
    print("[STEP 1] Setting up admin user...")
    admin_id = get_or_create_admin()

    print("\n[STEP 2] Setting up approved seller...")
    seller_id = get_or_create_seller(admin_id)

    # Init QR signer
    private_key_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "keys", "seller_private_key.pem"
    )
    signer = QRCodeSigner(private_key_path if os.path.exists(private_key_path) else None)
    key_status = "loaded from file" if os.path.exists(private_key_path) else "generated (new)"
    print(f"\n[STEP 3] QR Signer ready ({key_status})")
    print(f"         QR images -> {QR_OUTPUT_DIR}\n")

    print("[STEP 4] Inserting 20 medicines + generating QR codes...\n")
    print("-"*65)

    inserted = 0
    skipped  = 0
    qr_count = 0
    qr_summary = []

    for i, med in enumerate(MEDICINES, 1):
        print(f"[{i:02d}/20] {med['name']}")

        # Check duplicate
        dup = execute_query(
            "SELECT id FROM medicines WHERE batch_no=%s",
            (med["batch_no"],), fetch_one=True
        )

        if dup:
            medicine_id = str(dup["id"])
            print(f"        Medicine already exists, reusing ID: {medicine_id[:8]}...")
            skipped += 1
        else:
            # Insert medicine
            insert_q = """
                INSERT INTO medicines
                  (seller_id, name, batch_no, mfg_date, expiry_date,
                   dosage, strength, category, description,
                   stock_quantity, delivery_status,
                   approval_status, approved_at, approved_by)
                VALUES
                  (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'in_stock','approved',CURRENT_TIMESTAMP,%s)
                RETURNING id
            """
            try:
                row = execute_query(insert_q, (
                    seller_id,
                    med["name"], med["batch_no"], med["mfg_date"], med["expiry_date"],
                    med["dosage"], med["strength"], med["category"], med["description"],
                    med["stock_quantity"], admin_id,
                ), fetch_one=True)
                medicine_id = str(row["id"])
                print(f"        Medicine inserted  (ID: {medicine_id[:8]}...)")
                inserted += 1
            except Exception as e:
                print(f"        [ERROR] Insert failed: {e}")
                skipped += 1
                print()
                continue

        # Build QR payload
        payload = {
            "medicine_id":   medicine_id,
            "medicine_name": med["name"],
            "batch_no":      med["batch_no"],
            "mfg_date":      med["mfg_date"],
            "expiry_date":   med["expiry_date"],
            "dosage":        med["dosage"],
            "strength":      med["strength"],
            "seller_id":     seller_id,
            "timestamp":     datetime.now(timezone.utc).isoformat(),
        }

        # Sign
        try:
            signature = signer.sign_payload(payload)
        except Exception:
            signature = "UNSIGNED_DEMO_MODE"

        # Save QR record to DB
        try:
            qr_row = QRCode.create(
                medicine_id=medicine_id,
                payload_json=payload,
                signature=signature,
                blockchain_tx=None,
                issued_by=admin_id,
            )
            qr_id = str(qr_row["id"])
            print(f"        QR record saved    (QR ID: {qr_id[:8]}...)")
        except Exception as e:
            print(f"        [WARN] QR DB save: {e}")
            qr_id = f"LOCAL-{i:03d}"

        # Add signature to payload for QR image content
        full_payload = dict(payload)
        full_payload["signature"] = signature
        full_payload["qr_id"] = qr_id

        # Generate PNG
        img_path = generate_qr_image(full_payload, med["name"], med["batch_no"])
        if img_path:
            print(f"        QR image saved     -> {os.path.basename(img_path)}")
            qr_count += 1
            qr_summary.append({
                "no": i,
                "medicine": med["name"],
                "batch": med["batch_no"],
                "category": med["category"],
                "file": os.path.basename(img_path),
            })
        print()

    # ── Final Summary ─────────────────────────────────────────────────────────
    print("="*65)
    print("  COMPLETED!")
    print(f"  Medicines inserted  : {inserted}")
    print(f"  Medicines reused    : {skipped}")
    print(f"  QR images created   : {qr_count}")
    print(f"  Output folder       : {QR_OUTPUT_DIR}")
    print("="*65)
    print()

    if qr_summary:
        print("QR IMAGES GENERATED:")
        print(f"  {'No':<4} {'Medicine':<35} {'Category':<22} {'File'}")
        print(f"  {'-'*4} {'-'*35} {'-'*22} {'-'*30}")
        for r in qr_summary:
            print(f"  {r['no']:<4} {r['medicine']:<35} {r['category']:<22} {r['file']}")
        print()

    print("HOW TO SCAN:")
    print("  1. Open the qr_output/ folder in File Explorer")
    print("  2. Open any PNG on screen (or print it)")
    print("  3. Login as USER -> User Dashboard -> 'Scan Medicine' tab")
    print("  4. Allow camera -> point at QR -> see VERIFIED result!")
    print()
    print("LOGIN CREDENTIALS CREATED:")
    print("  Admin  : admin@medverify.com    / Admin@1234")
    print("  Seller : testseller@medverify.com / Seller@1234")


if __name__ == "__main__":
    run()
