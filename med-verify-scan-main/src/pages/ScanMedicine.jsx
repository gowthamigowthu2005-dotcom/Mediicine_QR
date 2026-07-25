import React from 'react';
import { Navigation } from '@/components/Navigation';
import { QRScanner } from '@/components/QRScanner';

export default function ScanMedicine() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-16">
        <QRScanner />
      </div>
    </div>
  );
}
