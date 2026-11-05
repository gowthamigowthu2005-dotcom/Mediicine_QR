import seedData from './seedData.json';

const STORAGE_KEY = 'medverify_mock_db_v2';

function getDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse mock DB from localStorage, resetting:', e);
  }
  const initial = JSON.parse(JSON.stringify(seedData));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveDb(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save mock DB:', e);
  }
}

// Generate simple mock JWT
function makeToken(user) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  );
  return `${header}.${payload}.mockSignature`;
}

function getCurrentUserFromToken(authHeader) {
  const db = getDb();
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Default fallback to first active user if in mock mode
    return db.users[0];
  }
  try {
    const token = authHeader.replace('Bearer ', '').trim();
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1]));
      const user = db.users.find((u) => u.id === payload.sub || u.email === payload.email);
      if (user) return user;
    }
  } catch (e) {
    // ignore
  }
  return db.users[0];
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function setupMockServer() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === 'string' ? input : input?.url || '';
    const method = (init?.method || 'GET').toUpperCase();

    // Check if this is an API call meant for the backend
    const isApiCall =
      urlStr.includes('/auth/') ||
      urlStr.includes('/medicine') ||
      urlStr.includes('/scan') ||
      urlStr.includes('/seller') ||
      urlStr.includes('/admin') ||
      urlStr.includes('5000') ||
      urlStr.includes('onrender.com') ||
      urlStr.includes('railway');

    if (!isApiCall) {
      return originalFetch(input, init);
    }

    // Try real backend first if on localhost, otherwise fallback to mock
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      try {
        const response = await originalFetch(input, init);
        return response;
      } catch (err) {
        console.warn('[MockServer] Local backend unreachable, falling back to in-browser Mock DB:', urlStr);
      }
    }

    // Handle mock API request
    try {
      const parsedUrl = new URL(urlStr, window.location.origin);
      const pathname = parsedUrl.pathname.replace(/^\/Mediicine_QR/, ''); // handle gh-pages subpath if any
      const searchParams = parsedUrl.searchParams;

      let body = {};
      if (init.body) {
        if (typeof init.body === 'string') {
          try {
            body = JSON.parse(init.body);
          } catch (e) {
            body = {};
          }
        } else if (init.body instanceof FormData) {
          body = {};
          for (let [k, v] of init.body.entries()) {
            body[k] = v;
          }
        }
      }

      const headers = new Headers(init.headers || {});
      const authHeader = headers.get('Authorization') || '';
      const db = getDb();

      // ==========================================
      // 1. AUTH ENDPOINTS
      // ==========================================
      if (pathname.endsWith('/auth/login') && method === 'POST') {
        const email = (body.email || '').trim().toLowerCase();
        const password = (body.password || '').trim();

        // Check demo accounts
        const demoPasswords = {
          'admin@medverify.com': 'Admin@1234',
          'seller@medverify.com': 'Seller@1234',
          'user@medverify.com': 'User@1234',
        };

        let user = db.users.find((u) => u.email.toLowerCase() === email);

        if (!user && demoPasswords[email]) {
          const role = email.split('@')[0];
          user = {
            id: `usr_${Date.now()}`,
            email,
            role,
            is_active: 1,
            timezone: 'UTC',
          };
          db.users.push(user);
          saveDb(db);
        }

        const isDemoMatch = demoPasswords[email] && (password === demoPasswords[email] || password === 'Demo@1234' || password === '12345678');
        if (!user || (!isDemoMatch && password !== 'Admin@1234' && password !== 'Seller@1234' && password !== 'User@1234' && password.length < 6)) {
          return jsonResponse({ error: 'Invalid email or password' }, 401);
        }

        const token = makeToken(user);
        let sellerStatus = null;
        if (user.role === 'seller') {
          const seller = db.sellers?.find((s) => s.user_id === user.id) || {
            id: 'seller-profile-1',
            status: 'approved',
            company_name: 'MedVerify Verified Seller',
          };
          sellerStatus = seller.status || 'approved';
        }

        return jsonResponse({
          message: 'Login successful',
          data: {
            access_token: token,
            refresh_token: token,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              is_active: true,
            },
            seller_status: sellerStatus,
          },
        });
      }

      if (pathname.endsWith('/auth/register') && method === 'POST') {
        const email = (body.email || '').trim().toLowerCase();
        const role = body.role || 'user';
        let existing = db.users.find((u) => u.email.toLowerCase() === email);
        if (existing) {
          return jsonResponse({ error: 'User with this email already exists' }, 409);
        }

        const newUser = {
          id: `usr_${Date.now()}`,
          email,
          role,
          is_active: 1,
          timezone: body.timezone || 'UTC',
        };
        db.users.push(newUser);

        if (role === 'seller') {
          db.sellers = db.sellers || [];
          db.sellers.push({
            id: `seller_${Date.now()}`,
            user_id: newUser.id,
            company_name: body.company_name || 'My Pharma Co',
            license_number: body.license_number || 'LIC-12345',
            status: 'approved',
          });
        }
        saveDb(db);

        const token = makeToken(newUser);
        return jsonResponse(
          {
            message: 'User registered successfully',
            data: {
              access_token: token,
              refresh_token: token,
              user: newUser,
            },
          },
          201
        );
      }

      if (pathname.endsWith('/auth/me')) {
        const user = getCurrentUserFromToken(authHeader);
        return jsonResponse({
          data: {
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              is_active: true,
            },
          },
        });
      }

      if (pathname.endsWith('/auth/refresh')) {
        const user = getCurrentUserFromToken(authHeader);
        const token = makeToken(user);
        return jsonResponse({
          data: {
            access_token: token,
          },
        });
      }

      if (pathname.endsWith('/auth/logout')) {
        return jsonResponse({ message: 'Logged out successfully' });
      }

      // ==========================================
      // 2. MEDICINE ENDPOINTS
      // ==========================================
      if (pathname.includes('/medicine/all')) {
        return jsonResponse({
          medicines: db.medicines,
          data: db.medicines,
        });
      }

      if (pathname.includes('/medicine/search')) {
        const q = (searchParams.get('q') || '').toLowerCase();
        const filtered = db.medicines.filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.batch_no?.toLowerCase().includes(q) ||
            m.category?.toLowerCase().includes(q) ||
            m.description?.toLowerCase().includes(q)
        );
        return jsonResponse({
          medicines: filtered,
          data: filtered,
        });
      }

      if (pathname.includes('/medicine/alternatives') || pathname.includes('/medicine-info')) {
        const name = (searchParams.get('name') || '').toLowerCase();
        const category = (searchParams.get('category') || '').toLowerCase();
        const alternatives = db.medicines
          .filter((m) => m.category?.toLowerCase() === category && !m.name?.toLowerCase().includes(name))
          .slice(0, 5);
        return jsonResponse({
          alternatives: alternatives.length ? alternatives : db.medicines.slice(0, 4),
          data: alternatives.length ? alternatives : db.medicines.slice(0, 4),
        });
      }

      // ==========================================
      // 3. SELLER ENDPOINTS
      // ==========================================
      if (pathname.includes('/seller/status')) {
        const sellerObj = {
          id: 'seller-profile-1',
          status: 'approved',
          is_approved: true,
          company_name: 'PharmaCorp Industries',
          license_number: 'PHARM-2024-001',
          email: 'seller@medverify.com',
          phone: '+1 (555) 123-4567',
          address: '123 Pharma Way, Medical District, Boston, MA 02115',
          tax_id: 'XX-XXXXXXX',
          registration_number: 'REG-2024-8899',
          authorized_person: 'Dr. Robert Smith',
          authorized_person_contact: '+1 (555) 123-4567',
        };
        return jsonResponse({
          status: 'approved',
          is_approved: true,
          company_name: 'PharmaCorp Industries',
          data: sellerObj,
        });
      }

      if (pathname.includes('/seller/history')) {
        const qrCount = (db.qr_codes && db.qr_codes.length > 0) ? db.qr_codes.length : 214;
        return jsonResponse({
          total_qrs: qrCount,
          medicines: db.medicines,
          data: {
            total_qrs: qrCount,
            history: db.medicines.slice(0, 20),
          },
        });
      }

      if (pathname.includes('/seller/medicine') && method === 'GET') {
        return jsonResponse({
          medicines: db.medicines,
          data: db.medicines,
        });
      }

      if (pathname.includes('/seller/medicine') && method === 'POST') {
        const newMed = {
          id: `med_${Date.now()}`,
          name: body.name || 'New Medicine',
          batch_no: body.batch_no || `B${Math.floor(100 + Math.random() * 900)}`,
          mfg_date: body.mfg_date || new Date().toISOString().split('T')[0],
          expiry_date: body.expiry_date || '2028-12-31',
          dosage: body.dosage || 'Tablet',
          strength: body.strength || '500mg',
          category: body.category || 'General',
          description: body.description || 'Added via MedVerify Seller Portal',
          approval_status: 'approved',
          stock_quantity: parseInt(body.stock_quantity) || 100,
          created_at: new Date().toISOString(),
        };
        db.medicines.unshift(newMed);
        saveDb(db);
        return jsonResponse(
          {
            message: 'Medicine added successfully',
            data: newMed,
          },
          201
        );
      }

      if (
        pathname.includes('/seller/issue-qr') ||
        pathname.includes('/seller/generate-qr') ||
        pathname.includes('/seller/qr/generate') ||
        pathname.includes('/qr/generate')
      ) {
        const med = db.medicines.find((m) => m.id === body.medicine_id || m.batch_no === body.medicine_id) || db.medicines[0];
        const qrId = `QR_${Date.now().toString().slice(-6)}`;
        const qrPayloadObj = {
          qr_id: qrId,
          medicine_id: med.id,
          name: med.name,
          batch_no: med.batch_no,
          mfg_date: med.mfg_date,
          expiry_date: med.expiry_date,
          dosage: med.dosage,
          strength: med.strength,
          category: med.category,
          status: 'verified',
        };
        const qrPayloadStr = JSON.stringify(qrPayloadObj);
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayloadStr)}`;

        const newQr = {
          id: qrId,
          qr_id: qrId,
          medicine_id: med.id,
          medicine_name: med.name,
          batch_no: med.batch_no,
          mfg_date: med.mfg_date,
          expiry_date: med.expiry_date,
          qr_image: qrImageUrl,
          payload: btoa(qrPayloadStr),
          created_at: new Date().toISOString(),
          revoked: false,
        };
        db.qr_codes = db.qr_codes || [];
        db.qr_codes.unshift(newQr);
        saveDb(db);

        return jsonResponse({
          message: 'QR code generated successfully',
          data: {
            qr_id: qrId,
            medicine_id: med.id,
            medicine_name: med.name,
            batch_no: med.batch_no,
            expiry_date: med.expiry_date,
            qr_image: qrImageUrl,
            payload: btoa(qrPayloadStr),
          },
        });
      }

      if (pathname.includes('/download')) {
        // Return 1x1 transparent PNG data for downloads
        const binaryString = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new Response(bytes, {
          status: 200,
          headers: { 'Content-Type': pathname.includes('pdf') ? 'application/pdf' : 'image/png' },
        });
      }

      // ==========================================
      // 4. SCAN & VERIFICATION ENDPOINTS
      // ==========================================
      if (pathname.includes('/scan/batch/')) {
        const batchNo = decodeURIComponent(pathname.split('/scan/batch/')[1] || '').trim().toUpperCase();
        let med = db.medicines.find((m) => m.batch_no?.trim().toUpperCase() === batchNo);

        if (!med) {
          // Check by medicine ID or partial name
          med = db.medicines.find((m) => m.id === batchNo || m.name?.toUpperCase().includes(batchNo));
        }

        if (!med) {
          return jsonResponse({
            error: `No registered medicine found for batch or code: ${batchNo}`,
            data: {
              verified: false,
              result: 'counterfeit',
              status: 'counterfeit',
              medicine: { name: 'Unknown Medicine', batch_no: batchNo }
            }
          }, 404);
        }

        const isApproved = med.approval_status === 'approved';
        const statusStr = isApproved ? 'verified' : (med.approval_status === 'pending' ? 'pending' : 'rejected');

        return jsonResponse({
          message: isApproved ? 'Medicine verified' : `Medicine status: ${statusStr.toUpperCase()}`,
          data: {
            verified: isApproved,
            result: statusStr,
            status: statusStr,
            qr_id: `qr-${med.batch_no}`,
            medicine: {
              ...med,
              manufacturer: med.manufacturer || 'MedVerify Certified Pharma',
            },
            seller: {
              company_name: med.manufacturer || 'MedVerify Certified Pharma',
              status: isApproved ? 'approved' : 'pending',
            },
            ai_summary: {
              description: `${med.name} (Batch ${med.batch_no}) - Category: ${med.category || 'General'}`,
              dosage_instructions: med.dosage || 'Take as prescribed by doctor',
              side_effects: ['Follow doctor instructions', 'Store in cool and dry place'],
              contraindications: ['Keep out of reach of children'],
            },
          },
        });
      }

      if (pathname.includes('/scan/verify-qr/')) {
        const qrId = decodeURIComponent(pathname.split('/scan/verify-qr/')[1] || '').trim();
        const qr = db.qr_codes?.find((q) => q.id === qrId);
        let med = qr ? db.medicines.find((m) => m.id === qr.medicine_id) : null;
        
        if (!med) {
          // Extract batch if qrId is like qr-uuid-F001 or qr-F001
          const bMatch = qrId.match(/([A-Z]{1,3}\d{3,4})/i);
          if (bMatch) {
            med = db.medicines.find((m) => m.batch_no?.toUpperCase() === bMatch[1].toUpperCase());
          }
        }

        if (!med) {
          med = db.medicines[0];
        }

        const isApproved = med.approval_status === 'approved';
        const statusStr = isApproved ? 'verified' : (med.approval_status === 'pending' ? 'pending' : 'rejected');

        return jsonResponse({
          message: isApproved ? 'Medicine verified' : `Medicine status: ${statusStr.toUpperCase()}`,
          data: {
            verified: isApproved,
            result: statusStr,
            status: statusStr,
            qr_id: qrId,
            medicine: {
              ...med,
              manufacturer: med.manufacturer || 'MedVerify Certified Pharma',
            },
            seller: {
              company_name: med.manufacturer || 'MedVerify Certified Pharma',
              status: isApproved ? 'approved' : 'pending',
            },
            ai_summary: {
              description: `${med.name} (Batch ${med.batch_no}) - Category: ${med.category || 'General'}`,
              dosage_instructions: med.dosage || 'Take as prescribed by doctor',
              side_effects: ['Follow doctor instructions', 'Store in cool and dry place'],
              contraindications: ['Keep out of reach of children'],
            },
          },
        });
      }

      if (pathname.endsWith('/scan/image') && method === 'POST') {
        const file = body.file;
        let filename = '';
        if (typeof file === 'string') filename = file;
        else if (file && file.name) filename = file.name;

        // 1. Try batch extraction from filename: e.g. F001, A007, B001
        let matchedMed = null;
        const match = filename.match(/([A-Z]{1,3}\d{3,4})/i);
        if (match) {
          const batch = match[1].toUpperCase();
          matchedMed = db.medicines.find((m) => m.batch_no?.toUpperCase() === batch);
        }

        // 2. Try medicine name match
        if (!matchedMed && filename) {
          const cleanName = filename.toLowerCase().replace(/[_\-\.]/g, ' ');
          matchedMed = db.medicines.find((m) => m.name && cleanName.includes(m.name.toLowerCase().trim()));
        }

        // 3. If still not matched, check if filename matches any qr_codes record
        if (!matchedMed && filename) {
          const foundQr = db.qr_codes?.find((q) => filename.includes(q.id));
          if (foundQr) {
            matchedMed = db.medicines.find((m) => m.id === foundQr.medicine_id);
          }
        }

        if (!matchedMed) {
          matchedMed = db.medicines[0]; // fallback to first medicine
        }

        const isApproved = matchedMed.approval_status === 'approved';
        const statusStr = isApproved ? 'verified' : (matchedMed.approval_status === 'pending' ? 'pending' : 'rejected');

        return jsonResponse({
          message: 'QR code scanned successfully',
          name: matchedMed.name,
          manufacturer: matchedMed.manufacturer || 'MedVerify Certified Pharma',
          batch_number: matchedMed.batch_no,
          manufacture_date: matchedMed.mfg_date,
          expiry_date: matchedMed.expiry_date,
          category: matchedMed.category,
          dosage: matchedMed.dosage,
          strength: matchedMed.strength,
          description: matchedMed.description,
          usage: matchedMed.usage,
          qr_id: `qr-${matchedMed.batch_no}`,
          approval_status: matchedMed.approval_status,
          verified: isApproved,
          result: statusStr,
          status: statusStr,
          ai_summary: {
            description: `${matchedMed.name} (Batch ${matchedMed.batch_no}) - Category: ${matchedMed.category || 'General'}`,
            dosage_instructions: matchedMed.dosage || 'Take 1 tablet daily after food',
            side_effects: ['Store in cool dry place', 'Consult physician if allergic'],
            contraindications: ['Keep out of reach of children'],
          },
        });
      }

      // ==========================================
      // 5. ADMIN ENDPOINTS
      // ==========================================
      if (pathname.includes('/admin/analytics')) {
        return jsonResponse({
          message: 'Analytics retrieved successfully',
          data: {
            scan_counts: {
              verified: 184,
              counterfeit: 12,
              unverified: 5,
            },
            total_sellers: db.sellers?.length || 3,
            total_medicines: db.medicines?.length || 214,
            total_qr_codes: db.qr_codes?.length || 201,
            revoked_qr_codes: 0,
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (pathname.includes('/admin/sellers')) {
        return jsonResponse({
          message: 'Sellers retrieved successfully',
          data: db.sellers || [
            {
              id: 'seller-profile-1',
              company_name: 'MedVerify Official Pharma',
              license_number: 'LIC-789012',
              status: 'approved',
              created_at: '2026-01-01',
            },
          ],
        });
      }

      if (pathname.includes('/admin/medicines')) {
        return jsonResponse({
          message: 'Medicines retrieved successfully',
          data: db.medicines,
        });
      }

      if (pathname.includes('/admin/audit-logs')) {
        return jsonResponse({
          message: 'Audit logs retrieved successfully',
          data: db.audit_logs?.length
            ? db.audit_logs
            : [
                {
                  id: 'log-1',
                  action: 'SYSTEM_BOOT',
                  user_id: 'admin-1',
                  entity_type: 'system',
                  created_at: new Date().toISOString(),
                },
                {
                  id: 'log-2',
                  action: 'MEDICINE_VERIFIED',
                  user_id: 'user-1',
                  entity_type: 'medicine',
                  created_at: new Date(Date.now() - 3600000).toISOString(),
                },
              ],
        });
      }

      if (pathname.includes('/admin/qr-codes')) {
        return jsonResponse({
          message: 'QR codes retrieved successfully',
          data: db.qr_codes || [],
        });
      }

      if (pathname.includes('/admin/revoked-keys')) {
        return jsonResponse({
          message: 'Revoked keys retrieved successfully',
          data: db.revoked_keys || [],
        });
      }

      // Fallback 404
      return jsonResponse({ error: 'Endpoint not found in mock server' }, 404);
    } catch (e) {
      console.error('[MockServer Error]', e);
      return jsonResponse({ error: e.message || 'Mock Server Error' }, 500);
    }
  };

  console.log('🚀 [MedVerify] In-browser Mock Backend activated. All features ready offline & online!');
}
