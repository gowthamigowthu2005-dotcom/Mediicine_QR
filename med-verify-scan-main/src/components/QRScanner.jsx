import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QrCode, Camera, Upload, CheckCircle, XCircle, AlertTriangle, Info, Search, X, Lock, LogIn } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";
import { isAuthenticated } from "@/lib/auth";


export const QRScanner = () => {
  const navigate = useNavigate();
  const isLoggedIn = isAuthenticated();
  const [isScanning, setIsScanning] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");

  const [verificationResult, setVerificationResult] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check if a medicine is expired
  const checkExpiry = (expiryDateStr) => {
    if (!expiryDateStr || expiryDateStr === 'Unknown' || expiryDateStr === 'N/A') {
      return false;
    }
    try {
      const expiry = new Date(expiryDateStr);
      const now = new Date();
      return expiry < now;
    } catch (error) {
      return false;
    }
  };

  // Get alternative medicines based on category or usage
  const getAlternatives = async (medicineName, category) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/medicine/alternatives?name=${encodeURIComponent(medicineName)}&category=${encodeURIComponent(category || '')}`);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    } catch (error) {
      console.error('Failed to fetch alternatives:', error);
    }
    return [
      { name: 'Paracetamol 500mg', manufacturer: 'Generic Pharma', category: 'Pain Relief' },
      { name: 'Aspirin 300mg', manufacturer: 'MediCorp', category: 'Pain Relief' },
      { name: 'Ibuprofen 400mg', manufacturer: 'HealthCare Inc', category: 'Anti-inflammatory' }
    ];
  };

  // Handle scanned QR payload (from camera or image)
  const processDecodedQrText = async (decodedText) => {
    setIsScanning(true);
    try {
      let qrData = null;
      try { qrData = JSON.parse(decodedText); } catch(e){}

      // If payload has qr_id
      if (qrData && qrData.qr_id) {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/scan/verify-qr/${qrData.qr_id}`);
        const data = await res.json();
        if (res.ok && data.data) {
          const med = data.data.medicine;
          const isExpired = checkExpiry(med.expiry_date);
          const isVer = data.data.verified;
          const result = {
            code: qrData.qr_id,
            name: med.name || "Unknown Medicine",
            manufacturer: data.data.seller?.company_name || med.manufacturer || "Unknown",
            batchNumber: med.batch_no || "N/A",
            mfgDate: med.mfg_date || "N/A",
            expDate: med.expiry_date || "N/A",
            category: med.category || "N/A",
            dosage: med.dosage || "N/A",
            strength: med.strength || "N/A",
            description: med.description || "N/A",
            usage: med.usage || "N/A",
            isAuthentic: isVer,
            isExpired: isExpired,
            status: isVer ? (isExpired ? "expired" : "verified") : (med.approval_status === "pending" ? "pending" : "rejected"),
            seller: data.data.seller

          };
          setVerificationResult(result);
          setIsScanning(false);
          toast({
            title: isVer ? "QR Verified" : "Verification Failed",
            description: `Medicine: ${result.name}`,
            variant: isVer ? "default" : "destructive"
          });
          return;
        }
      }

      // Plain string batch or ID fallback
      handleBatchSearch(decodedText);
    } catch(e) {
      console.error("QR processing error:", e);
      setIsScanning(false);
    }
  };

  // Camera Scanning Logic
  const handleCameraScan = async () => {
    setIsCameraActive(true);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("camera-reader");
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            processDecodedQrText(decodedText);
            stopCamera(html5QrCode);
          },
          () => {}
        );
        scannerRef.current = html5QrCode;
        toast({
          title: "Camera Started",
          description: "Point camera at QR code to scan",
        });
      } catch (error) {
        console.error("Camera error:", error);
        setIsCameraActive(false);
        toast({
          title: "Camera Error",
          description: "Failed to access camera. Check permissions.",
          variant: "destructive",
        });
      }
    }, 100);
  };

  const stopCamera = (scanner) => {
    if (scanner) {
      scanner.stop().then(() => scanner.clear()).catch((e) => console.error(e));
    }
    setIsCameraActive(false);
  };

  const handleCloseCamera = () => {
    if (scannerRef.current) {
      stopCamera(scannerRef.current);
    }
  };

  // Search by Batch Number
  const handleBatchSearch = async (customVal = null) => {
    const searchVal = typeof customVal === 'string' ? customVal : batchNumber.trim();
    if (!searchVal) {
      toast({
        title: "Input Required",
        description: "Please enter a batch number or medicine ID",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/scan/batch/${encodeURIComponent(searchVal)}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        toast({
          title: "Medicine Unverified",
          description: data.error || "No medicine found for this batch number",
          variant: "destructive",
        });
        setVerificationResult({
          code: searchVal,
          name: "Unknown Medicine",
          manufacturer: "Unknown",
          batchNumber: searchVal,
          mfgDate: "N/A",
          expDate: "N/A",
          category: "N/A",
          isAuthentic: false,
          isExpired: false,
          status: "counterfeit"
        });
        return;
      }

      const medicineData = data.data?.medicine || {};
      const sellerData = data.data?.seller || {};
      const isExpired = checkExpiry(medicineData.expiry_date);
      const isVerified = data.data?.verified;

      const result = {
        code: searchVal,
        name: medicineData.name || "Unknown Medicine",
        manufacturer: sellerData.company_name || medicineData.manufacturer || "Unknown",
        batchNumber: medicineData.batch_no || searchVal,
        mfgDate: medicineData.mfg_date || "N/A",
        expDate: medicineData.expiry_date || "N/A",
        category: medicineData.category || "N/A",
        dosage: medicineData.dosage || "N/A",
        strength: medicineData.strength || "N/A",
        description: medicineData.description || "N/A",
        usage: medicineData.usage || "N/A",
        isAuthentic: isVerified,
        isExpired: isExpired,
        status: isVerified ? (isExpired ? "expired" : "verified") : (medicineData.approval_status === "pending" ? "pending" : "rejected"),
        seller: sellerData

      };

      setVerificationResult(result);

      if (isExpired && result.name !== "Unknown Medicine") {
        const alts = await getAlternatives(result.name, result.category);
        setAlternatives(alts);
      } else {
        setAlternatives([]);
      }

      toast({
        title: isVerified ? "Batch Verified" : "Verification Warning",
        description: isVerified
          ? `Medicine found: ${result.name}`
          : `Medicine not verified by platform`,
        variant: isVerified ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Batch search error:", error);
      toast({
        title: "Search Error",
        description: "Failed to connect to verification server",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Image upload functions
  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    setSelectedImage(file);
    handleImageUpload(file);
  };

  const handleImageUpload = async (file) => {
    setIsScanning(true);

    // Try client-side scan first
    let clientDecoded = null;
    try {
      const html5QrCode = new Html5Qrcode("temp-qr-reader");
      clientDecoded = await html5QrCode.scanFile(file, true);
    } catch (err) {
      console.log("Client-side image scan failed, using server-side:", err);
    }

    if (clientDecoded) {
      await processDecodedQrText(clientDecoded);
      return;
    }

    // Server-side scan fallback
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/scan/image`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        toast({
          title: "Scan Failed",
          description: data.error,
          variant: "destructive",
        });
        setVerificationResult({
          code: file.name,
          name: "Unknown Medicine",
          manufacturer: "Unknown",
          batchNumber: "N/A",
          mfgDate: "N/A",
          expDate: "N/A",
          category: "N/A",
          isAuthentic: false,
          isExpired: false,
          status: "counterfeit"
        });
        return;
      }

      const isExpired = checkExpiry(data.expiry_date);
      const isAuthentic = data.verified !== false && !data.error;
      const result = {
        code: data.name || "Unknown",
        name: data.name || "Unknown Medicine",
        manufacturer: data.manufacturer || "Unknown",
        batchNumber: data.batch_number || "N/A",
        mfgDate: data.manufacture_date || "N/A",
        expDate: data.expiry_date || "N/A",
        category: data.category || "N/A",
        dosage: data.dosage || "N/A",
        strength: data.strength || "N/A",
        description: data.description || "N/A",
        usage: data.usage || "N/A",
        isAuthentic: isAuthentic,
        isExpired: isExpired,
        status: isAuthentic ? (isExpired ? "expired" : "verified") : (data.approval_status === "pending" ? "pending" : "rejected")

      };

      setVerificationResult(result);

      if (isExpired && result.name !== "Unknown Medicine") {
        const alts = await getAlternatives(result.name, result.category);
        setAlternatives(alts);
      } else {
        setAlternatives([]);
      }

      toast({
        title: isAuthentic ? "Scan Successful" : "Unverified Medicine",
        description: `Medicine: ${result.name}`,
        variant: isAuthentic ? "default" : "destructive"
      });

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Failed to process image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "verified": return "text-emerald-700 font-bold";
      case "pending": return "text-amber-700 font-bold";
      case "expired": return "text-amber-700 font-bold";
      case "rejected":
      case "counterfeit": return "text-rose-700 font-bold";
      default: return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "verified":
        return (
          <div className="p-2.5 bg-emerald-100 rounded-full border-2 border-emerald-500 shadow-sm flex items-center justify-center shrink-0">
            <CheckCircle className="h-7 w-7 text-emerald-600 stroke-[2.5]" />
          </div>
        );
      case "pending":
        return (
          <div className="p-2.5 bg-amber-100 rounded-full border-2 border-amber-500 shadow-sm flex items-center justify-center shrink-0">
            <Info className="h-7 w-7 text-amber-600 stroke-[2.5]" />
          </div>
        );
      case "expired":
        return (
          <div className="p-2.5 bg-amber-100 rounded-full border-2 border-amber-500 shadow-sm flex items-center justify-center shrink-0">
            <AlertTriangle className="h-7 w-7 text-amber-600 stroke-[2.5]" />
          </div>
        );
      case "rejected":
      case "counterfeit":
        return (
          <div className="p-2.5 bg-rose-100 rounded-full border-2 border-rose-500 shadow-sm flex items-center justify-center shrink-0">
            <XCircle className="h-7 w-7 text-rose-600 stroke-[2.5]" />
          </div>
        );
      default:
        return <Info className="h-7 w-7 text-muted-foreground" />;
    }
  };


  return (
    <section id="scanner" className="py-20 bg-background">
      {/* Hidden container for client-side Html5Qrcode file reader */}
      <div id="temp-qr-reader" style={{ display: 'none' }}></div>

      {/* Camera Scan Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-xl p-6 relative border shadow-2xl">
            <button 
              onClick={handleCloseCamera}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-6 w-6" />
            </button>
            <h3 className="text-xl font-semibold mb-4 text-center">Scanning Medicine QR Code</h3>
            <div id="camera-reader" className="overflow-hidden rounded-lg border bg-black min-h-[300px]"></div>
            <p className="text-sm text-center text-muted-foreground mt-4">
              Center the QR code inside the box to scan automatically
            </p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Medicine Verification Scanner</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Scan via live camera, upload a QR image, or enter a batch number to check medicine authenticity
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Scanner / Manual Input Interface */}
          <Card className="p-8 bg-gradient-to-br from-card to-secondary/20 border-primary/20">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Medicine Verification</h3>
              <p className="text-muted-foreground">
                {isLoggedIn 
                  ? "Choose your preferred verification method below" 
                  : "Log in to access live camera scanning, QR upload, & verification"}
              </p>
            </div>

            {!isLoggedIn ? (
              <div className="p-6 bg-slate-900 text-white rounded-xl border border-primary/30 text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
                  <Lock className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Authentication Required</h4>
                  <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                    Please log in to your MedVerify account to unlock live camera QR scanning, image uploads, and medicine batch verification.
                  </p>
                </div>
                <Button 
                  className="w-full bg-[#00a8e8] hover:bg-[#0090c8] text-white font-semibold py-6 text-base rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all"
                  onClick={() => navigate('/login')}
                >
                  <LogIn className="h-5 w-5" />
                  <span>Log In to Scan & Authenticate</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Scan Buttons (Camera Scan + Upload Image) */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="py-6 bg-[#00a8e8] hover:bg-[#0090c8] text-white font-semibold flex items-center justify-center gap-2 rounded-lg text-base shadow transition-all"
                    onClick={handleCameraScan}
                    disabled={isScanning || isCameraActive}
                  >
                    <Camera className="h-5 w-5" />
                    <span>Camera Scan</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="py-6 border-primary/30 font-semibold flex items-center justify-center gap-2 rounded-lg text-base shadow-sm hover:bg-primary/5 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                  >
                    <Upload className="h-5 w-5 text-primary" />
                    <span>Upload Image</span>
                  </Button>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />

                <div className="relative my-4 text-center text-xs text-muted-foreground uppercase">
                  <span className="bg-card px-2">OR VERIFY BY BATCH NUMBER</span>
                </div>

                {/* Batch Number Search */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter Batch Number (e.g. F001, F004, F009)"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBatchSearch()}
                    />
                    <Button onClick={() => handleBatchSearch()} disabled={isScanning} className="bg-primary">
                      <Search className="mr-2 h-4 w-4" />
                      Verify
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-sm text-blue-900">
                    📸 Point camera at QR code, upload image, or enter batch number to verify authenticity
                  </p>
                </div>
              </div>
            )}
          </Card>


          {/* Verification Results */}
          <Card className="p-8">
            <h3 className="text-2xl font-semibold mb-6">Verification Result</h3>

            {!verificationResult ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Use camera, upload image, or enter batch number to see results</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Banner */}
                <div className={`flex items-center gap-4 p-5 rounded-xl border-2 shadow-sm ${
                  verificationResult.status === "verified" ? "bg-emerald-50 border-emerald-300 text-emerald-900" :
                  verificationResult.status === "pending" ? "bg-amber-50 border-amber-300 text-amber-900" :
                  verificationResult.status === "expired" ? "bg-amber-50 border-amber-300 text-amber-900" :
                  "bg-rose-50 border-rose-300 text-rose-900"
                }`}>
                  {getStatusIcon(verificationResult.status)}
                  <div>
                    <h4 className={`text-lg font-bold flex items-center gap-2 ${getStatusColor(verificationResult.status)}`}>
                      {verificationResult.status === "verified" ? "✓ APPROVED & VERIFIED AUTHENTIC" :
                       verificationResult.status === "pending" ? "⏳ PENDING VERIFICATION" :
                       verificationResult.status === "expired" ? "⚠️ MEDICINE EXPIRED" :
                       "❌ REJECTED / UNAPPROVED MEDICINE"}
                    </h4>
                    <p className="text-sm font-medium mt-0.5 opacity-90">
                      {verificationResult.status === "verified" ? "Green Tick: This medicine has been verified and approved for safe usage." :
                       verificationResult.status === "pending" ? "Amber Status: This medicine is currently under review by platform administrators." :
                       verificationResult.status === "expired" ? "Warning: This medicine has expired and should not be used." :
                       "Red Mark: WARNING! This medicine was rejected by platform regulators."}
                    </p>
                  </div>
                </div>


                {/* Medicine Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Medicine Name</label>
                    <p className="font-semibold">{verificationResult.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Manufacturer</label>
                      <p className="font-medium">{verificationResult.manufacturer}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Batch Number</label>
                      <p className="font-medium">{verificationResult.batchNumber}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Mfg Date</label>
                      <p className="font-medium">{verificationResult.mfgDate}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Exp Date</label>
                      <p className={`font-medium ${verificationResult.isExpired ? 'text-warning' : ''}`}>
                        {verificationResult.expDate}
                      </p>
                    </div>
                  </div>

                  {verificationResult.dosage && verificationResult.dosage !== "N/A" && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Dosage</label>
                      <p className="font-medium">{verificationResult.dosage}</p>
                    </div>
                  )}

                  {verificationResult.strength && verificationResult.strength !== "N/A" && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Strength</label>
                      <p className="font-medium">{verificationResult.strength}</p>
                    </div>
                  )}

                  {verificationResult.category && verificationResult.category !== "N/A" && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Category</label>
                      <p className="font-medium">{verificationResult.category}</p>
                    </div>
                  )}

                  {verificationResult.description && verificationResult.description !== "N/A" && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Description</label>
                      <p className="text-sm">{verificationResult.description}</p>
                    </div>
                  )}

                  {verificationResult.usage && verificationResult.usage !== "N/A" && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Usage</label>
                      <p className="text-sm">{verificationResult.usage}</p>
                    </div>
                  )}

                  {verificationResult.seller && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <label className="text-sm font-medium text-blue-900">Seller Information</label>
                      <p className="font-medium text-blue-900">{verificationResult.seller.company_name}</p>
                      <p className="text-sm text-blue-700">Status: {verificationResult.seller.status}</p>
                    </div>
                  )}
                </div>

                {/* Alternatives Section if Expired */}
                {alternatives.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold mb-3">Suggested Alternatives</h4>
                    <div className="space-y-3">
                      {alternatives.map((alt, index) => (
                        <div key={index} className="p-3 bg-secondary/30 rounded-lg flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">{alt.name}</p>
                            <p className="text-xs text-muted-foreground">{alt.manufacturer}</p>
                          </div>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {alt.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
};
