import React, { useState, useEffect } from "react";
import { Camera, Search } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "./ui/dialog";

interface ScannerProps {
  products: Product[]; 
  onAddToCart: (product: Product) => void; 
  onProductSearch: (code: string) => void;
  searchResult: Product | null; 
}

export interface Product {  
  id: string;
  barcode: string;
  name: string;
  vendor: string;
  price: number;
  displayStock: number;
  godownStock: number;
  stock: number;
  category: string;
  photo_url?: string | null;
}

// Sub-component to handle the lifecycle of the actual camera
// function CameraScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
//   useEffect(() => {
//     const scanner = new Html5QrcodeScanner(
//       "reader",
//       { 
//         fps: 10, 
//         qrbox: { width: 250, height: 180 },
//         aspectRatio: 1.0 
//       },
//       /* verbose= */ false
//     );

//     scanner.render(
//       (text) => {
//         onScan(text);
//         scanner.clear().catch(err => console.error("Failed to clear scanner", err));
//       },
//       () => { /* frame errors ignored */ }
//     );

//     // Cleanup function: Stops camera when the Dialog closes
//     return () => {
//       scanner.clear().catch(err => console.error("Cleanup failed", err));
//     };
//   }, [onScan]);

//   return <div id="reader" className="w-full"></div>;
// }

function CameraScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  useEffect(() => {
    // Create the instance
    const html5QrCode = new Html5Qrcode("reader");

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // FORCES THE BACK CAMERA
          {
            fps: 10,
            qrbox: { width: 250, height: 180 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            onScan(decodedText);
            // Successfully scanned - the scanner is cleared in the cleanup
          },
          () => { /* Frame errors ignored */ }
        );
      } catch (err) {
        console.error("Failed to start back camera scanner", err);
      }
    };

    startScanner();

    // Cleanup function: Physically releases the camera back to the phone
    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop()
          .then(() => html5QrCode.clear())
          .catch((err) => console.error("Scanner cleanup failed", err));
      }
    };
  }, [onScan]);

  // Styling the 'reader' div is important for mobile fit
  return <div id="reader" className="w-full overflow-hidden rounded-md"></div>;
}

export function Scanner({ onAddToCart, onProductSearch, searchResult }: ScannerProps) {
  const [scanValue, setScanValue] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleManualSearch = () => {
    if (scanValue.trim()) {
      onProductSearch(scanValue);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Type or scan code..."
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
            className="pr-10"
          />
          <Search 
            className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 cursor-pointer" 
            onClick={handleManualSearch}
          />
        </div>
        <Button onClick={() => setIsCameraOpen(true)} variant="outline">
          <Camera className="mr-2 size-4" /> Camera
        </Button>
      </div>

      {/* {searchResult && (
        <div className="p-4 border rounded-lg bg-blue-50/50 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
          <div>
            <h3 className="font-bold text-lg text-gray-900">{searchResult.name}</h3>
            <p className="text-sm text-gray-500">SKU: {searchResult.barcode}</p>
            <p className="font-bold text-blue-600 mt-1">₹{searchResult.price.toLocaleString()}</p>
          </div>
          {(searchResult.displayStock + searchResult.godownStock) > 0 ? (
            <Button onClick={() => onAddToCart(searchResult)} className="bg-blue-600 hover:bg-blue-700">
              Add to Cart
            </Button>
          ) : (
            <Badge variant="destructive" className="px-4 py-1">Out of Stock</Badge>
          )}
        </div>
      )} */}

      {searchResult && (
        <div className="p-3 border rounded-lg bg-blue-50/50 flex items-center justify-between gap-4 animate-in fade-in zoom-in-95">
          {/* Product Info & Stock */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="font-bold text-gray-900 truncate">{searchResult.name}</h3>
              <span className="text-[10px] text-gray-400 font-mono">#{searchResult.barcode}</span>
            </div>
            
            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold text-blue-700">₹{searchResult.price.toLocaleString()}</span>
              <div className="flex gap-2 border-l pl-3 border-blue-200">
                <span className="text-gray-500">Disp: <b className={searchResult.displayStock > 0 ? "text-gray-900" : "text-red-500"}>{searchResult.displayStock}</b></span>
                <span className="text-gray-500">God: <b className={searchResult.godownStock > 0 ? "text-gray-900" : "text-red-500"}>{searchResult.godownStock}</b></span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          {(searchResult.displayStock + searchResult.godownStock) > 0 ? (
            <Button size="sm" onClick={() => onAddToCart(searchResult)} className="shrink-0 bg-blue-600">
              Add
            </Button>
          ) : (
            <Badge variant="destructive" className="shrink-0">Out of Stock</Badge>
          )}
        </div>
      )}

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Item Barcode</DialogTitle>
            <DialogDescription>
              Hold the barcode steady in front of the camera.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
            {isCameraOpen && (
              <CameraScanner 
                onScan={(text) => {
                  onProductSearch(text);
                  setIsCameraOpen(false);
                }} 
                onClose={() => setIsCameraOpen(false)}
              />
            )}
          </div>

          <Button variant="ghost" onClick={() => setIsCameraOpen(false)} className="w-full text-gray-500">
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}