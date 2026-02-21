import React, { useState, useEffect, useMemo } from "react";
import { Camera, Search, Plus, Minus } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label"; // Ensure you have this import
import Fuse from "fuse.js";


import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "./ui/dialog";

interface ScannerProps {
  products: Product[]; 
  onAddToCart: (product: Product, quantity: number, attribute: string) => void; // Updated to accept quantity
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
  costPrice?: number;
  overheadPrice?: number;
  remark?: string;
  createdAt?: string;
  cost_price?: number;  
  overhead_expense?: number;  
  selling_price?: number;
}

function CameraScanner({ onScan }: { onScan: (text: string) => void; onClose: () => void }) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");
    setScanner(html5QrCode);

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { 
            fps: 20, // Higher FPS for faster capture
            qrbox: { width: 280, height: 200 }, 
            aspectRatio: 1.0,
            // FORCE HIGH RESOLUTION: This helps "see" small bars at a distance
            videoConstraints: {
              width: { min: 1280, ideal: 1920 },
              height: { min: 720, ideal: 1080 },
              facingMode: "environment"
            }
          },
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

  // Inside CameraScanner component

const handleZoomChange = async (val: number) => {
  setZoomLevel(val);
  
  // 1. Correct way to get the track from the scanner
  // We access the underlying media track directly
  const videoElement = document.querySelector("#reader video") as HTMLVideoElement;
  
  if (videoElement && videoElement.srcObject) {
    const stream = videoElement.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0]; // This is the 'Running Track'
    
    if (track) {
      try {
        const capabilities = track.getCapabilities() as any;
        
        // 2. Check if the hardware supports zoom
        if (capabilities.zoom) {
          await track.applyConstraints({
            advanced: [{ zoom: val }]
          } as any);
        } else {
          // 3. FALLBACK: CSS Zoom (Enlarges the video feed digitally)
          videoElement.style.transform = `scale(${val})`;
          videoElement.style.transformOrigin = "center";
        }
      } catch (e) {
        console.warn("Hardware zoom failed, using CSS fallback", e);
        videoElement.style.transform = `scale(${val})`;
      }
    }
  }
};

  return (
    <div className="space-y-4">
      <div id="reader" className="w-full overflow-hidden rounded-md bg-black"></div>
      
      {/* Zoom UI Control */}
      <div className="p-4 bg-slate-900 rounded-b-lg">
        <div className="flex items-center gap-4">
          <span className="text-white text-xs font-bold">Zoom</span>
          <input 
            type="range" 
            min="1" 
            max="5" 
            step="0.1" 
            className="flex-1 accent-blue-500"
            value={zoomLevel}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
          />
          <span className="text-white text-xs w-6">{zoomLevel}x</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Pinch to zoom or use slider for distant barcodes
        </p>
      </div>
    </div>
  );
}

export function Scanner({ products, onAddToCart, onProductSearch, searchResult }: ScannerProps) {
  const [scanValue, setScanValue] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedAttribute, setSelectedAttribute] = useState<string>("None");
  const [customAttribute, setCustomAttribute] = useState("");

  // DEBUG LOG: Track every render of the quantity
  console.log("[Scanner Render] Current Quantity State:", quantity);

  const fuse = useMemo(() => {
  if (!products.length) return null;

  return new Fuse(products, {
    keys: ["barcode"],
    threshold: 0.25,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
}, [products]);

  const suggestions = useMemo(() => {
    if (!scanValue || !fuse) return [];

    return fuse
      .search(scanValue, { limit: 5 })
      .map(r => r.item);
  }, [scanValue, fuse]);

  useEffect(() => {
  // If searchResult is cleared, reset the stepper to 1 for the next scan
    if (searchResult === null) {
      setQuantity(1);
      //setScanValue(""); // Also clear the text input field
    }
  }, [searchResult]);

  const handleManualSearch = (code: string) => {
    if (code.trim()) {
      const targetCode = code.trim();
      setScanValue(""); 
      onProductSearch(targetCode);
      // Reset room to None for new search
      setSelectedAttribute("None");
    }
  };

  return (
      <div className="space-y-4">
        {/* Search Bar remains same */}
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
            {/* Suggestions code... */}
            {!searchResult && scanValue && suggestions.length > 0 && (
              <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                {suggestions.map((p) => (
                  <div
                    key={p.id}
                    className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm flex justify-between"
                    onClick={() => {
                      setScanValue(p.barcode);
                      handleManualSearch(p.barcode);
                    }}
                  >
                    <span className="font-semibold">{p.barcode}</span>
                    <span className="text-gray-400 text-xs truncate ml-2">
                      {p.vendor}
                    </span>
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
          <div className="p-4 border rounded-xl bg-blue-50/50 flex flex-col gap-4 animate-in fade-in zoom-in-95 shadow-sm border-blue-100">
            
            {/* 1. Top Section: Product Details with Larger Image */}
            <div className="flex items-start gap-4">
              <div className="size-28 min-w-[112px] bg-white border-2 border-white rounded-lg overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                {searchResult.photo_url ? (
                  <img 
                    src={searchResult.photo_url} 
                    alt={searchResult.name} 
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=No+Img";
                    }}
                  />
                ) : (
                  <div className="size-full flex items-center justify-center bg-gray-100">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">No Image</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                <h3 className="font-black text-gray-900 text-lg leading-tight truncate uppercase">
                  {searchResult.name}
                </h3>
                <span className="text-xs text-blue-600 font-mono font-bold mt-1">
                  #{searchResult.barcode}
                </span>
                <div className="flex items-center gap-3 mt-3">
                  <span className="font-black text-blue-800 text-xl">
                    ₹{searchResult.price.toLocaleString()}
                  </span>
                  <div className="h-4 w-px bg-blue-200" />
                  <span className="text-gray-500 text-[11px] font-bold">
                    STOCK: <b className="text-gray-900">{searchResult.stock}</b>
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Room Selection Section (The "Missing" Piece) */}
            <div className="space-y-2 border-t border-blue-100/50 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Assign to Room</span>
                <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-700 border-none font-bold uppercase px-2">
                  {selectedAttribute}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {["None", "Living Room", "Bedroom", "Kitchen", "Dining", "Outdoor"].map((room) => (
                  <button
                    key={room}
                    onClick={() => setSelectedAttribute(room)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                      selectedAttribute === room 
                        ? "bg-blue-600 text-white border-blue-600 shadow-md" 
                        : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {room}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Bottom Section: Stepper and Add Action
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-blue-100">
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border shadow-sm">
                <Button 
                  variant="ghost" size="icon" className="size-10"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center font-black text-lg text-blue-700">{quantity}</span>
                <Button 
                  variant="ghost" size="icon" className="size-10"
                  onClick={() => setQuantity(q => q + 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <Button 
                onClick={() => onAddToCart(searchResult, quantity, selectedAttribute)} 
                className="bg-blue-600 hover:bg-blue-700 flex-1 h-12 font-black text-base shadow-lg rounded-xl transition-all active:scale-95"
              >
                ADD TO CART
              </Button>
            </div> */}

            {/* 3. Bottom Section: Stepper and Add Action */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-blue-100">

              {/* Quantity Stepper */}
              <div className="flex items-center justify-center sm:justify-start gap-2 bg-white p-1 rounded-xl border shadow-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 sm:size-10"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                >
                  <Minus className="size-4" />
                </Button>

                <span className="w-8 text-center font-bold text-base sm:text-lg text-blue-700">
                  {quantity}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 sm:size-10"
                  onClick={() => setQuantity(q => q + 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              {/* Add to Cart */}
              <Button
                disabled={!searchResult}
                onClick={() => searchResult && onAddToCart(searchResult, quantity, selectedAttribute)}
                className="
                  bg-blue-600 hover:bg-blue-700
                  w-full sm:w-auto sm:min-w-[180px]
                  h-11 sm:h-12
                  text-sm sm:text-base
                  font-semibold
                  shadow-md
                  rounded-xl
                  transition-all
                  active:scale-95
                "
              >
                ADD TO CART
              </Button>

            </div>

          </div>
        )}
        {/* Camera Dialog... */}
        <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
          <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black border-none">
            <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800">
              <DialogTitle className="text-white flex items-center justify-between">
                <span>Scan Barcode</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsCameraOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Close
                </Button>
              </DialogTitle>
            </DialogHeader>
            
            <div className="relative">
              <CameraScanner 
                onScan={(text) => {
                  handleManualSearch(text);
                  setIsCameraOpen(false);
                }} 
                onClose={() => setIsCameraOpen(false)} 
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  

}