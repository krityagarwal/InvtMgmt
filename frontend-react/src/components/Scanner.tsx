// import React, { useState, useEffect, useMemo } from "react";
// import { Camera, Search, Plus, Minus } from "lucide-react";
// import { Html5Qrcode } from "html5-qrcode";
// import { Button } from "./ui/button";
// import { Input } from "./ui/input";
// import { Badge } from "./ui/badge";
// import { 
//   Dialog, 
//   DialogContent, 
//   DialogHeader, 
//   DialogTitle,
//   DialogDescription 
// } from "./ui/dialog";

// interface ScannerProps {
//   products: Product[]; 
//   onAddToCart: (product: Product, quantity: number) => void; // Updated to accept quantity
//   onProductSearch: (code: string) => void;
//   searchResult: Product | null; 
// }

// export interface Product {  
//   id: string;
//   barcode: string;
//   name: string;
//   vendor: string;
//   price: number;
//   displayStock: number;
//   godownStock: number;
//   stock: number;
//   category: string;
//   photo_url?: string | null;
// }

// function CameraScanner({ onScan }: { onScan: (text: string) => void; onClose: () => void }) {
//   const [zoomLevel, setZoomLevel] = useState(1);
//   const [scanner, setScanner] = useState<Html5Qrcode | null>(null);

//   useEffect(() => {
//     const html5QrCode = new Html5Qrcode("reader");
//     setScanner(html5QrCode);

//     const startScanner = async () => {
//       try {
//         await html5QrCode.start(
//           { facingMode: "environment" },
//           { 
//             fps: 20, // Higher FPS for faster capture
//             qrbox: { width: 280, height: 200 }, 
//             aspectRatio: 1.0,
//             // FORCE HIGH RESOLUTION: This helps "see" small bars at a distance
//             videoConstraints: {
//               width: { min: 1280, ideal: 1920 },
//               height: { min: 720, ideal: 1080 },
//               facingMode: "environment"
//             }
//           },
//           (decodedText) => { onScan(decodedText); },
//           () => { }
//         );
//       } catch (err) { console.error("Scanner error", err); }
//     };

//     startScanner();

//     return () => {
//       if (html5QrCode.isScanning) {
//         html5QrCode.stop().then(() => html5QrCode.clear()).catch(e => console.error(e));
//       }
//     };
//   }, [onScan]);

// const handleZoomChange = async (val: number) => {
//   setZoomLevel(val);
  
//   // 1. Correct way to get the track from the scanner
//   // We access the underlying media track directly
//   const videoElement = document.querySelector("#reader video") as HTMLVideoElement;
  
//   if (videoElement && videoElement.srcObject) {
//     const stream = videoElement.srcObject as MediaStream;
//     const track = stream.getVideoTracks()[0]; // This is the 'Running Track'
    
//     if (track) {
//       try {
//         const capabilities = track.getCapabilities() as any;
        
//         // 2. Check if the hardware supports zoom
//         if (capabilities.zoom) {
//           await track.applyConstraints({
//             advanced: [{ zoom: val }]
//           } as any);
//         } else {
//           // 3. FALLBACK: CSS Zoom (Enlarges the video feed digitally)
//           videoElement.style.transform = `scale(${val})`;
//           videoElement.style.transformOrigin = "center";
//         }
//       } catch (e) {
//         console.warn("Hardware zoom failed, using CSS fallback", e);
//         videoElement.style.transform = `scale(${val})`;
//       }
//     }
//   }
// };

//   return (
//     <div className="space-y-4">
//       <div id="reader" className="w-full overflow-hidden rounded-md bg-black"></div>
      
//       {/* Zoom UI Control */}
//       <div className="p-4 bg-slate-900 rounded-b-lg">
//         <div className="flex items-center gap-4">
//           <span className="text-white text-xs font-bold">Zoom</span>
//           <input 
//             type="range" 
//             min="1" 
//             max="5" 
//             step="0.1" 
//             className="flex-1 accent-blue-500"
//             value={zoomLevel}
//             onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
//           />
//           <span className="text-white text-xs w-6">{zoomLevel}x</span>
//         </div>
//         <p className="text-[10px] text-gray-400 mt-2 text-center">
//           Pinch to zoom or use slider for distant barcodes
//         </p>
//       </div>
//     </div>
//   );
// }

// export function Scanner({ products, onAddToCart, onProductSearch, searchResult }: ScannerProps) {
//   const [scanValue, setScanValue] = useState("");
//   const [isCameraOpen, setIsCameraOpen] = useState(false);
//   const [quantity, setQuantity] = useState(1);

//   const suggestions = useMemo(() => {
//   if (!scanValue.trim()) return [];

//   // 1. Escape special characters (+, -, *, etc.) to prevent SyntaxErrors
//   const escapedValue = scanValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

//   // 2. Create the fuzzy pattern using the escaped string
//   const fuzzyPattern = escapedValue.split("").join(".*");
  
//   try {
//     const regex = new RegExp(fuzzyPattern, "i");
//     return products.filter(p => regex.test(p.barcode)).slice(0, 5);
//   } catch (e) {
//     // Fallback to simple inclusion check if regex still fails
//     console.error("Regex error:", e);
//     return products.filter(p => 
//       p.barcode.toLowerCase().includes(scanValue.toLowerCase())
//     ).slice(0, 5);
//   }
// }, [scanValue, products]);

//   // Reset quantity when search result changes
//   useEffect(() => {
//   // If searchResult is cleared, reset the stepper to 1 for the next scan
//     if (searchResult === null) {
//       setQuantity(1);
//       setScanValue(""); // Also clear the text input field
//     }
//   }, [searchResult]);

//   const handleManualSearch = (code: string) => {
//     if (code.trim()) {
//       onProductSearch(code);
//       setScanValue(""); // Clear input after picking
//     }
//   };

//   return (
//     <div className="space-y-4">
//       <div className="flex gap-2 relative">
//         <div className="relative flex-1">
//           <Input
//             placeholder="Type or scan code..."
//             value={scanValue}
//             onChange={(e) => setScanValue(e.target.value)}
//             onKeyDown={(e) => e.key === "Enter" && handleManualSearch(scanValue)}
//             className="pr-10"
//           />
//           <Search 
//             className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 cursor-pointer" 
//             onClick={() => handleManualSearch(scanValue)}
//           />
          
//           {/* Fuzzy Suggestions Dropdown */}
//           {suggestions.length > 0 && (
//             <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
//               {suggestions.map((p) => (
//                 <div 
//                   key={p.id}
//                   className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b last:border-0"
//                   onClick={() => handleManualSearch(p.barcode)}
//                 >
//                   <span className="font-mono text-sm font-bold">{p.barcode}</span>
//                   <span className="text-xs text-gray-500">{p.vendor}</span>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//         <Button onClick={() => setIsCameraOpen(true)} variant="outline">
//           <Camera className="mr-2 size-4" /> Camera
//         </Button>
//       </div>

//     {searchResult && (
//       <div className="p-3 border rounded-lg bg-blue-50/50 flex items-center justify-between gap-4 animate-in fade-in zoom-in-95">
//         {/* --- NEW: Image Preview Section --- */}
//         <div className="size-16 min-w-[64px] bg-white border rounded-md overflow-hidden flex items-center justify-center">
//           {searchResult.photo_url ? (
//             <img 
//               src={searchResult.photo_url} 
//               alt={searchResult.name} 
//               className="size-full object-cover"
//               onError={(e) => {
//                 // Fallback for broken links
//                 (e.target as HTMLImageElement).src = "https://placehold.co/100x100?text=No+Img";
//               }}
//             />
//           ) : (
//             <div className="size-full flex items-center justify-center bg-gray-100">
//               <span className="text-[10px] text-gray-400">No Img</span>
//             </div>
//           )}
//         </div>

//         {/* Details Section */}
//         <div className="flex-1 min-w-0">
//           <div className="flex items-baseline gap-2 mb-1">
//             <h3 className="font-bold text-gray-900 truncate">{searchResult.name}</h3>
//             <span className="text-[10px] text-gray-400 font-mono">#{searchResult.barcode}</span>
//           </div>
//           <div className="flex items-center gap-3 text-xs">
//             <span className="font-bold text-blue-700">₹{searchResult.price.toLocaleString()}</span>
//             <div className="flex gap-2 border-l pl-3 border-blue-200">
//               <span className="text-gray-500">Stock: <b className="text-gray-900">{searchResult.stock}</b></span>
//             </div>
//           </div>
//         </div>

//         {/* Quantity Stepper (Remains same) */}
//         {searchResult.stock > 0 ? (
//           <div className="flex items-center gap-2 bg-white p-1 rounded-lg border">
//             <Button 
//               variant="ghost" size="icon" className="size-8"
//               onClick={() => setQuantity(q => Math.max(1, q - 1))}
//             >
//               <Minus className="size-3" />
//             </Button>
//             <span className="w-6 text-center font-bold text-sm">{quantity}</span>
//             <Button 
//               variant="ghost" size="icon" className="size-8"
//               onClick={() => setQuantity(q => Math.min(searchResult.stock, q + 1))}
//             >
//               <Plus className="size-3" />
//             </Button>
//             <Button 
//               size="sm" 
//               onClick={() => onAddToCart(searchResult, quantity)} 
//               className="bg-blue-600 ml-1"
//             >
//               Add
//             </Button>
//           </div>
//         ) : (
//           <Badge variant="destructive">Out of Stock</Badge>
//         )}
//       </div>
//     )}

//       {/* Instead of conditional rendering, use visibility */}
//       <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
//         <DialogContent className="sm:max-w-md">
//           <DialogHeader>
//             <DialogTitle>Scan Item Barcode</DialogTitle>
//           </DialogHeader>
          
//           {/* Keep the component mounted so the browser 'holds' the permission */}
//           {/* <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
//               <CameraScanner 
//                 onScan={(text) => {
//                   onProductSearch(text);
//                   setIsCameraOpen(false);
//                 }} 
//                 onClose={() => setIsCameraOpen(false)}
//               />
//           </div> */}
//           <div className="bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
//               {/* Only mount the scanner when the dialog is actually open */}
//               {isCameraOpen && (
//                 <CameraScanner 
//                   onScan={(text) => {
//                     // FIX: Use the prop name 'onProductSearch'
//                     onProductSearch(text);
//                     setIsCameraOpen(false);
//                   }} 
//                   onClose={() => setIsCameraOpen(false)}
//                 />
//               )}
//           </div>
//           <Button variant="ghost" onClick={() => setIsCameraOpen(false)} className="w-full">Cancel</Button>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }

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
  DialogTitle 
} from "./ui/dialog";

// Interfaces
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

interface ScannerProps {
  products: Product[]; 
  onAddToCart: (product: Product, quantity: number) => void;
  onProductSearch: (code: string) => void;
  searchResult: Product | null; 
}

// 1. Fixed CameraScanner Component
function CameraScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("reader");

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { 
            fps: 20, 
            qrbox: { width: 280, height: 200 }, 
            aspectRatio: 1.0,
            videoConstraints: {
              width: { min: 1280, ideal: 1920 },
              height: { min: 720, ideal: 1080 },
              facingMode: "environment"
            }
          },
          async (decodedText) => { 
            // BREAK THE LOOP: Stop camera immediately upon detection
            if (html5QrCode.isScanning) {
              await html5QrCode.stop();
            }
            onScan(decodedText); 
          },
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

  const handleZoomChange = async (val: number) => {
    setZoomLevel(val);
    const videoElement = document.querySelector("#reader video") as HTMLVideoElement;
    
    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track) {
        try {
          const capabilities = track.getCapabilities() as any;
          if (capabilities.zoom) {
            await track.applyConstraints({ advanced: [{ zoom: val }] } as any);
          } else {
            videoElement.style.transform = `scale(${val})`;
            videoElement.style.transformOrigin = "center";
          }
        } catch (e) {
          videoElement.style.transform = `scale(${val})`;
        }
      }
    }
  };

  // MUST RETURN JSX to be a valid component
  return (
    <div className="space-y-4">
      <div id="reader" className="w-full overflow-hidden rounded-md bg-black min-h-[300px]"></div>
      <div className="p-4 bg-slate-900 rounded-b-lg">
        <div className="flex items-center gap-4">
          <span className="text-white text-xs font-bold">Zoom</span>
          <input 
            type="range" min="1" max="5" step="0.1" 
            className="flex-1 accent-blue-500"
            value={zoomLevel}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
          />
          <span className="text-white text-xs w-6">{zoomLevel}x</span>
        </div>
      </div>
    </div>
  );
}

// 2. Main Scanner Component
export function Scanner({ products, onAddToCart, onProductSearch, searchResult }: ScannerProps) {
  const [scanValue, setScanValue] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const suggestions = useMemo(() => {
    if (!scanValue.trim()) return [];
    const escapedValue = scanValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fuzzyPattern = escapedValue.split("").join(".*");
    try {
      const regex = new RegExp(fuzzyPattern, "i");
      return products.filter(p => regex.test(p.barcode)).slice(0, 5);
    } catch (e) {
      return products.filter(p => p.barcode.toLowerCase().includes(scanValue.toLowerCase())).slice(0, 5);
    }
  }, [scanValue, products]);

  useEffect(() => {
    if (searchResult === null) {
      setQuantity(1);
      setScanValue(""); 
    }
  }, [searchResult]);

  const handleManualSearch = (code: string) => {
    if (code.trim()) {
      onProductSearch(code);
      setScanValue("");
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
          {suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-xl overflow-hidden">
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
          <div className="size-16 min-w-[64px] bg-white border rounded-md overflow-hidden flex items-center justify-center">
            {searchResult.photo_url ? (
              <img src={searchResult.photo_url} alt={searchResult.name} className="size-full object-cover" />
            ) : (
              <div className="size-full flex items-center justify-center bg-gray-100">
                <span className="text-[10px] text-gray-400">No Img</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="font-bold text-gray-900 truncate">{searchResult.name}</h3>
              <span className="text-[10px] text-gray-400 font-mono">#{searchResult.barcode}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold text-blue-700">₹{searchResult.price.toLocaleString()}</span>
              <span className="text-gray-500 border-l pl-3">Stock: <b>{searchResult.stock}</b></span>
            </div>
          </div>
          {searchResult.stock > 0 ? (
            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
                <Minus className="size-3" />
              </Button>
              <span className="w-6 text-center font-bold text-sm">{quantity}</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setQuantity(q => Math.min(searchResult.stock, q + 1))}>
                <Plus className="size-3" />
              </Button>
              <Button size="sm" onClick={() => onAddToCart(searchResult, quantity)} className="bg-blue-600 ml-1">Add</Button>
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
                  onProductSearch(text);
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