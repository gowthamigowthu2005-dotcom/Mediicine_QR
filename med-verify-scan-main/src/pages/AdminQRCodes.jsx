import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getAuthHeader } from '@/lib/auth';
import { QrCode, ArrowLeft, RefreshCw, Search, CheckCircle2, XCircle, Package, Building2 } from 'lucide-react';

export default function AdminQRCodes() {
  const [qrs, setQrs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/admin/qr-codes', {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        setQrs(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load QR codes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQRCodes();
  }, []);

  const filteredQrs = qrs.filter(q =>
    (q.medicine_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (q.batch_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (q.seller_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 px-4 max-w-7xl pt-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" onClick={() => navigate('/admin/dashboard')} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <QrCode className="h-8 w-8 text-purple-600" /> QR Code System &amp; Registry
            </h1>
            <p className="text-muted-foreground">Monitor all issued QR codes, ECDSA signatures, and medicine links</p>
          </div>
          <Button onClick={fetchQRCodes} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search QR Registry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by medicine name, batch number, or seller..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issued QR Codes ({filteredQrs.length})</CardTitle>
            <CardDescription>All signed QR codes stored in system registry</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Loading QR registry...</p>
            ) : filteredQrs.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <QrCode className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium">No QR codes found</p>
                <p className="text-xs text-muted-foreground mt-1">Sellers can generate QR codes from their seller dashboard.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredQrs.map((qr, idx) => (
                  <Card key={idx} className="border hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" /> {qr.medicine_name || 'Medicine'}
                          </CardTitle>
                          <CardDescription>Batch: {qr.batch_no || 'N/A'}</CardDescription>
                        </div>
                        {qr.revoked ? (
                          <Badge variant="destructive">Revoked</Badge>
                        ) : (
                          <Badge className="bg-green-600">Active</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" /> Seller: <span className="font-medium text-foreground">{qr.seller_name || 'Registered Seller'}</span>
                      </div>
                      <div className="text-xs font-mono bg-muted p-2 rounded truncate">
                        ID: {qr.id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Issued: {new Date(qr.issued_at).toLocaleDateString()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
