import React, { useState, useEffect, useMemo } from "react";
import { Camera, Search, Plus, Minus } from "lucide-react";
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
  onAddToCart: (product: Product, quantity: number) => void; // Updated to accept quantity
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

function CameraScanner({ onScan }: { onScan: (text: string) => void; onClose: () => void }) {
  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 180 }, aspectRatio: 1.0 },
          (decodedText) => { onScan(decodedText); },
          () => { }
        );
      } catch (err) { console.error("Scanner error", err); }
    };
    startScanner();
    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(e => console.error(e));
      }
    };
  }, [onScan]);
  return <div id="reader" className="w-full overflow-hidden rounded-md"></div>;
}

export function Scanner({ products, onAddToCart, onProductSearch, searchResult }: ScannerProps) {
  const [scanValue, setScanValue] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // 1 & 2. Fuzzy, Case-Insensitive Filter
  const suggestions = useMemo(() => {
    if (!scanValue.trim()) return [];
    const fuzzyPattern = scanValue.split("").join(".*");
    const regex = new RegExp(fuzzyPattern, "i");
    return products.filter(p => regex.test(p.barcode)).slice(0, 5);
  }, [scanValue, products]);

  // Reset quantity when search result changes
  useEffect(() => {
  // If searchResult is cleared, reset the stepper to 1 for the next scan
    if (searchResult === null) {
      setQuantity(1);
      setScanValue(""); // Also clear the text input field
    }
  }, [searchResult]);

  const handleManualSearch = (code: string) => {
    if (code.trim()) {
      onProductSearch(code);
      setScanValue(""); // Clear input after picking
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 relative">
        <div className="relative flex-1">
          <Input
            placeholder="Type or scan code..."
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSearch(scanValue)}
            className="pr-10"
          />
          <Search 
            className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 cursor-pointer" 
            onClick={() => handleManualSearch(scanValue)}
          />
          
          {/* Fuzzy Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
              {suggestions.map((p) => (
                <div 
                  key={p.id}
                  className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b last:border-0"
                  onClick={() => handleManualSearch(p.barcode)}
                >
                  <span className="font-mono text-sm font-bold">{p.barcode}</span>
                  <span className="text-xs text-gray-500">{p.vendor}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button onClick={() => setIsCameraOpen(true)} variant="outline">
          <Camera className="mr-2 size-4" /> Camera
        </Button>
      </div>

      {searchResult && (
        <div className="p-3 border rounded-lg bg-blue-50/50 flex items-center justify-between gap-4 animate-in fade-in zoom-in-95">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="font-bold text-gray-900 truncate">{searchResult.name}</h3>
              <span className="text-[10px] text-gray-400 font-mono">#{searchResult.barcode}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold text-blue-700">₹{searchResult.price.toLocaleString()}</span>
              <div className="flex gap-2 border-l pl-3 border-blue-200">
                <span className="text-gray-500">Stock: <b className="text-gray-900">{searchResult.stock}</b></span>
              </div>
            </div>
          </div>

          {/* 3. Quantity Stepper */}
          {searchResult.stock > 0 ? (
            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border">
              <Button 
                variant="ghost" size="icon" className="size-8"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
              >
                <Minus className="size-3" />
              </Button>
              <span className="w-6 text-center font-bold text-sm">{quantity}</span>
              <Button 
                variant="ghost" size="icon" className="size-8"
                onClick={() => setQuantity(q => Math.min(searchResult.stock, q + 1))}
              >
                <Plus className="size-3" />
              </Button>
              <Button 
                size="sm" 
                onClick={() => onAddToCart(searchResult, quantity)} 
                className="bg-blue-600 ml-1"
              >
                Add
              </Button>
            </div>
          ) : (
            <Badge variant="destructive">Out of Stock</Badge>
          )}
        </div>
      )}

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Item Barcode</DialogTitle>
          </DialogHeader>
          <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
            {isCameraOpen && (
              <CameraScanner 
                onScan={(text) => {
                  onProductSearch(text); // 4. Search only, do not add
                  setIsCameraOpen(false);
                }} 
                onClose={() => setIsCameraOpen(false)}
              />
            )}
          </div>
          <Button variant="ghost" onClick={() => setIsCameraOpen(false)} className="w-full">Cancel</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}