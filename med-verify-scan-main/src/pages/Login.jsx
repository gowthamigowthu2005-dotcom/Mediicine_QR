import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { login } from '@/lib/auth';
import { Navigation } from '@/components/Navigation';
import { Eye, EyeOff, AlertCircle, XCircle, ShieldCheck, Store, User } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVerificationAlert, setShowVerificationAlert] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShowVerificationAlert(false);
    setError('');

    try {
      const data = await login(email, password);

      // Check for seller verification status
      if (data.data?.user?.role === 'seller') {
        const sellerStatus = data.seller_status;

        // Handle rejected/revoked - prevent login
        if (sellerStatus === 'rejected') {
          setVerificationStatus('rejected');
          setShowVerificationAlert(true);
          return;
        }
        if (sellerStatus === 'revoked') {
          setVerificationStatus('revoked');
          setShowVerificationAlert(true);
          return;
        }

        toast({ title: 'Login successful', description: 'Welcome back!' });
        window.dispatchEvent(new Event('auth-state-changed'));

        // Redirect based on seller status
        if (sellerStatus === 'no_application') {
          navigate('/seller/apply');
        } else if (sellerStatus === 'approved') {
          navigate('/seller/dashboard');
        } else {
          navigate('/seller/status');
        }
        return;
      }

      toast({ title: 'Login successful', description: 'Welcome back!' });

      // Redirect non-sellers
      if (data.data?.user?.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (data.data?.user?.role === 'user') {
        navigate('/user/dashboard');
      } else {
        navigate('/');
      }

      window.dispatchEvent(new Event('auth-state-changed'));
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-pink-50/30 backdrop-blur-sm">
      <Navigation />
      <div className="flex flex-col items-center justify-center p-4 pt-20 gap-6 pb-12">

        {/* Login Card */}
        <Card className="w-full max-w-md shadow-2xl border-2 backdrop-blur-md bg-white/95">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Login Error Alert */}
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-sm text-red-700 ml-2">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Seller Verification Alert */}
              {showVerificationAlert && (
                <Alert className="border-red-200 bg-red-50">
                  {verificationStatus === 'rejected' ? (
                    <>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-sm text-red-700 ml-2">
                        Your seller application has been rejected. Please contact support for more information.
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-sm text-red-700 ml-2">
                        Your seller account has been revoked. Please contact support.
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={loading || showVerificationAlert}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="text-primary hover:underline">
                  Register
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Role Info Card */}
        <Card className="w-full max-w-md shadow-md border bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              How Login Works – Roles Explained
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Admin */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
              <ShieldCheck className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-red-800">Admin</span>
                  <Badge variant="outline" className="text-xs border-red-300 text-red-700">Full Access</Badge>
                </div>
                <p className="text-xs text-red-700">
                  Manages sellers, medicines, QR codes &amp; analytics. After login → Admin Dashboard.
                </p>
              </div>
            </div>

            {/* Seller */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <Store className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-blue-800">Seller</span>
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">KYC Required</Badge>
                </div>
                <p className="text-xs text-blue-700">
                  Must submit KYC application and get admin approval.
                  Status flow: <strong>pending → approved → Seller Dashboard</strong>. Rejected/revoked sellers cannot log in.
                </p>
              </div>
            </div>

            {/* User */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
              <User className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-green-800">User</span>
                  <Badge variant="outline" className="text-xs border-green-300 text-green-700">Browse &amp; Scan</Badge>
                </div>
                <p className="text-xs text-green-700">
                  Can browse the medicine database and scan QR codes. After login → User Dashboard.
                </p>
              </div>
            </div>

            {/* Password policy hint */}
            <div className="pt-1 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">
                📝 New here? Register at{' '}
                <Link to="/register" className="text-primary hover:underline">/register</Link>, then log in.
              </p>
              <p className="text-xs text-muted-foreground">
                🔒 Password policy: min 8 chars, 1 uppercase, 1 lowercase, 1 digit
                {' '}(e.g. <code className="bg-muted px-1 rounded text-xs">MyPass@1</code>)
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
