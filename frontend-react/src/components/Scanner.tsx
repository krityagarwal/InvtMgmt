import React, { useState } from "react";
import { Camera } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
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
  image?: string;
}

export function Scanner({ products, onAddToCart, onProductSearch, searchResult }: ScannerProps) {
  const [scanValue, setScanValue] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // function to start the scanner only when the div is guaranteed to exist
  const startScanner = () => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 180 } },
      false
    );

    scanner.render(
      (text) => {
        onProductSearch(text); //
        scanner.clear(); // Stop camera on success
        setIsCameraOpen(false); // Close dialog
      },
      () => { /* ignore frame errors */ }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Type or scan code..."
          value={scanValue}
          onChange={(e) => setScanValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onProductSearch(scanValue)}
        />
        <Button onClick={() => setIsCameraOpen(true)}>
          <Camera className="mr-2 size-4" /> Camera
        </Button>
      </div>

      {searchResult && (
        <div className="p-4 border rounded-lg bg-blue-50/50 flex justify-between items-center animate-in fade-in zoom-in-95">
          <div>
            <h3 className="font-bold text-lg">{searchResult.name}</h3>
            <p className="text-sm text-gray-500">Code: {searchResult.barcode}</p>
            <p className="font-semibold mt-1">₹{searchResult.price.toLocaleString()}</p>
          </div>
         {/* Only show/enable button if total stock > 0 */}
        {(searchResult.displayStock + searchResult.godownStock) > 0 ? (
          <Button onClick={() => onAddToCart(searchResult)}>
            Add to Cart
          </Button>
        ) : (
          <Badge variant="destructive">Out of Stock</Badge>
        )}
        </div>
      )}

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent 
          onOpenAutoFocus={(e) => {
            e.preventDefault(); // Prevents focus theft
            startScanner();     // Trigger scanner when DOM is fully ready
          }}
        >
          <DialogHeader>
            <DialogTitle>Camera Scanner</DialogTitle>
            {/* Fixes the "Missing Description" warning */}
            <DialogDescription>
              Align the barcode within the box below.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-black rounded-md overflow-hidden min-h-[300px]">
            {/* The library looks for this specific ID */}
            <div id="reader" className="w-full"></div>
          </div>

          <Button variant="outline" onClick={() => setIsCameraOpen(false)} className="w-full">
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}