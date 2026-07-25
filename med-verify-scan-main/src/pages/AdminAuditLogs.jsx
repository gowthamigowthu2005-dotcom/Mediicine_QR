import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAuthHeader } from '@/lib/auth';
import { FileText, ArrowLeft, RefreshCw, Clock, User, ShieldAlert } from 'lucide-react';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/admin/audit-logs', {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
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
              <FileText className="h-8 w-8 text-primary" /> System Audit Logs
            </h1>
            <p className="text-muted-foreground">Track all administrative actions, approvals, and key revocations</p>
          </div>
          <Button onClick={fetchLogs} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Administrative Events</CardTitle>
            <CardDescription>Chronological log of administrative actions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground py-8 text-center">Loading logs...</p>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-lg">
                <ShieldAlert className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium">No audit logs recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1">Actions such as approving sellers or rejecting medicines will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log, idx) => (
                  <div key={idx} className="p-4 border rounded-lg hover:shadow-sm transition-shadow flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="capitalize font-semibold">
                          {log.action?.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">Resource: {log.resource_type} ({log.resource_id})</p>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    {log.ip_address && (
                      <Badge variant="secondary" className="text-xs">IP: {log.ip_address}</Badge>
                    )}
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
