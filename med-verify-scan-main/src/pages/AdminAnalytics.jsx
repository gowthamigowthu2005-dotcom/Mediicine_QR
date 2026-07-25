import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuthHeader } from '@/lib/auth';
import { BarChart3, TrendingUp, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, ArrowLeft, RefreshCw, QrCode, Users, Package } from 'lucide-react';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/admin/analytics', {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
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
              <BarChart3 className="h-8 w-8 text-primary" /> System Analytics &amp; Insights
            </h1>
            <p className="text-muted-foreground">Comprehensive system-wide performance and verification metrics</p>
          </div>
          <Button onClick={fetchAnalytics} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Registered Sellers</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.total_sellers || 0}</div>
              <p className="text-xs text-muted-foreground">Approved business profiles</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Medicines</CardTitle>
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.total_medicines || 0}</div>
              <p className="text-xs text-muted-foreground">In verified database</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Issued QR Codes</CardTitle>
              <QrCode className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.total_qr_codes || 0}</div>
              <p className="text-xs text-muted-foreground">{data?.revoked_qr_codes || 0} revoked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Verifications</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(data?.scan_counts || {}).reduce((a, b) => a + b, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Camera &amp; payload scans</p>
            </CardContent>
          </Card>
        </div>

        {/* Scan Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Scan Verification Results</CardTitle>
              <CardDescription>Breakdown of scan statuses across all user scans</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-900">Verified Authentic</span>
                </div>
                <Badge variant="outline" className="bg-white text-green-700 font-bold">
                  {data?.scan_counts?.verified || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-amber-900">Expired Medicines Detected</span>
                </div>
                <Badge variant="outline" className="bg-white text-amber-700 font-bold">
                  {data?.scan_counts?.expired || 0}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-900">Counterfeit / Unverified</span>
                </div>
                <Badge variant="outline" className="bg-white text-red-700 font-bold">
                  {(data?.scan_counts?.counterfeit || 0) + (data?.scan_counts?.revoked || 0)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Health &amp; Security</CardTitle>
              <CardDescription>Key integrity status and ECDSA verification state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ECDSA Cryptographic Signing</span>
                  <Badge className="bg-green-600">Active (P-256)</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Every QR payload is signed using standard ECDSA P-256 keys.</p>
              </div>

              <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database Auto-Recovery</span>
                  <Badge className="bg-blue-600">Enabled</Badge>
                </div>
                <p className="text-xs text-muted-foreground">PostgreSQL connection pool with automatic keepalives and retry logic.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
