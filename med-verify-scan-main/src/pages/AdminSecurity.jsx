import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuthHeader } from '@/lib/auth';
import { Shield, ArrowLeft, RefreshCw, Lock, Key, AlertOctagon } from 'lucide-react';

export default function AdminSecurity() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchSecurity = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/admin/revoked-keys', {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        setKeys(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load security info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurity();
  }, []);

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
              <Shield className="h-8 w-8 text-indigo-600" /> Security &amp; Key Revocation Management
            </h1>
            <p className="text-muted-foreground">Manage revoked cryptographic seller keys and security state</p>
          </div>
          <Button onClick={fetchSecurity} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Security Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Signature Standard</CardTitle>
              <Lock className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-indigo-900">ECDSA P-256</div>
              <p className="text-xs text-muted-foreground mt-1">SEC1 / PKCS#8 Cryptographic Standard</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revoked Key Count</CardTitle>
              <Key className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keys.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Blacklisted public keys</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Authentication State</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-700">JWT + CORS Guarded</div>
              <p className="text-xs text-muted-foreground mt-1">Bearer token role enforcement active</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Revoked Public Keys List</CardTitle>
            <CardDescription>Public keys belonging to revoked or compromised seller profiles</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Loading security records...</p>
            ) : keys.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <AlertOctagon className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium">No revoked keys found</p>
                <p className="text-xs text-muted-foreground mt-1">All active seller public keys are in good standing.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {keys.map((k, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-red-50/50 border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="destructive">Revoked Key #{idx + 1}</Badge>
                      <span className="text-xs text-muted-foreground">Revoked on: {new Date(k.revoked_at).toLocaleString()}</span>
                    </div>
                    {k.reason && <p className="text-sm font-medium text-red-800 mb-2">Reason: {k.reason}</p>}
                    <div className="text-xs font-mono bg-white p-2 rounded border truncate text-muted-foreground">
                      {k.public_key}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
