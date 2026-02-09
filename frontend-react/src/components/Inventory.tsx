// import React, { useRef, useState } from "react";
// import { Package, Search, AlertTriangle, Printer } from "lucide-react";
// import { Input } from "./ui/input";
// import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
// import { Badge } from "./ui/badge";
// import { Checkbox } from "./ui/checkbox";
// import { PrintLabels } from "./PrintLabels";
// import { Button } from "./ui/button";
// import QRCode from "react-qr-code";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "./ui/table";
// import { Product } from "./Scanner";

// interface InventoryProps {
//   products: Product[];
// }

// export function Inventory({ products }: InventoryProps) {
//   const [searchTerm, setSearchTerm] = useState("");
//   const [filterCategory, setFilterCategory] = useState<string>("all");
//   const [printSelection, setPrintSelection] = useState<{ [key: string]: number }>({});

//   const categories = ["all", ...new Set(products.map((p) => p.category))];

//   const filteredProducts = products.filter((product) => {
//     const matchesSearch =
//       product.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
//       product.barcode.includes(searchTerm);
//     const matchesCategory =
//       filterCategory === "all" || product.category === filterCategory;
//     return matchesSearch && matchesCategory;
//   });

//   const lowStockCount = products.filter((p) => p.stock < 10).length;
//   const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

//   const toggleSelection = (productId: string) => {
//     setPrintSelection(prev => {
//       const newSelection = { ...prev };
//       if (newSelection[productId]) {
//         delete newSelection[productId];
//       } else {
//         newSelection[productId] = 1;
//       }
//       return newSelection;
//     });
//   };

//   const InventoryImage = ({ url, alt }: { url?: string | null, alt: string }) => {
//     const [error, setError] = React.useState(false);
//     if (!url || error) {
//       return (
//         <div className="flex size-full items-center justify-center bg-gray-100 rounded-md">
//           <span className="text-[10px] text-gray-400">No Img</span>
//         </div>
//       );
//     }
//     return (
//       <img
//         src={url}
//         alt={alt}
//         className="size-full object-cover rounded-md"
//         onError={() => setError(true)}
//       />
//     );
//   };

//   const toggleAll = () => {
//     const allSelected = Object.keys(printSelection).length === filteredProducts.length && filteredProducts.length > 0;
//     if (allSelected) {
//       setPrintSelection({});
//     } else {
//       const all: { [key: string]: number } = {};
//       filteredProducts.forEach(p => {
//         all[p.id] = 1;
//       });
//       setPrintSelection(all);
//     }
//   };

//   const selectedProductsForPrint = products.filter(p => {
//     const id = String(p.id).trim();
//     return printSelection[id] !== undefined;
//   });
//   const selectedCount = Object.keys(printSelection).length;
// //working on web , keep is everything else fails
// const handlePrintLabels = () => {
//   const printContent = document.getElementById('hidden-print-factory');
//   if (!printContent) return;

//   const printWindow = window.open('', '_blank');
//   if (!printWindow) {
//     alert("Please allow pop-ups to print labels.");
//     return;
//   }

//   // Define critical styles for the A4 Grid
//   const gridStyles = `
//     @page { size: A4; margin: 10mm; }
//     body { margin: 0; padding: 10px; font-family: sans-serif; background: white !important; }
//     .a4-grid-container { 
//       display: grid; 
//       grid-template-columns: repeat(3, 1fr); 
//       gap: 15px; 
//       width: 100%;
//     }
//     .a4-label-item { 
//       width: 60mm; height: 50mm; 
//       border: 1px dashed #ccc; 
//       display: flex; flex-direction: column; 
//       align-items: center; justify-content: center; 
//       page-break-inside: avoid;
//     }
//     .qr-img { width: 80px; height: 80px; object-fit: contain; }
//     .qr-placeholder { width: 80px; height: 80px; background: #f3f4f6; }
//     .barcode-text { font-size: 13px; font-family: monospace; margin-top: 12px; font-weight: 700; text-align: center;}
//   `;

//   printWindow.document.write(`
//     <html>
//       <head>
//         <title>Inventory Labels</title>
//         <style>${gridStyles}</style>
//       </head>
//       <body>
//         ${printContent.innerHTML}
//         <script>
//           window.onload = () => {
//             // Extra safety to ensure image data is decoded
//             setTimeout(() => {
//               window.print();
//               // window.close(); 
//             }, 750);
//           };
//         </script>
//       </body>
//     </html>
//   `);
//   printWindow.document.close();
// };
//   return (
//     <div className="space-y-6">
//       {/* Stats Overview */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between pb-2">
//             <CardTitle className="text-sm font-medium">Total Items</CardTitle>
//             <Package className="size-4 text-gray-500" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{products.length}</div>
//           </CardContent>
//         </Card>
//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between pb-2">
//             <CardTitle className="text-sm font-medium">Total Value</CardTitle>
//             <span className="text-gray-500">₹</span>
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
//           </CardContent>
//         </Card>
//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between pb-2">
//             <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
//             <AlertTriangle className="size-4 text-orange-500" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{lowStockCount}</div>
//           </CardContent>
//         </Card>
//       </div>

//       <Card>
//         <CardHeader>
//           <div className="flex items-center justify-between">
//             <CardTitle>Inventory Management</CardTitle>
            
//             {selectedCount > 0 && (
//               <Button 
//                 onClick={handlePrintLabels}
//                 className="bg-blue-600 hover:bg-blue-700 animate-in fade-in"
//               >
//                 <Printer className="mr-2 size-4" />
//                 Print {selectedCount} Labels
//               </Button>
//             )}
//           </div>

//           <div className="flex gap-4 mt-4">
//             <div className="relative flex-1">
//               <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
//               <Input
//                 placeholder="Search vendor or barcode..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className="pl-10"
//               />
//             </div>
//             <select
//               value={filterCategory}
//               onChange={(e) => setFilterCategory(e.target.value)}
//               className="px-4 py-2 border rounded-md text-sm"
//             >
//               {categories.map((cat) => (
//                 <option key={cat} value={cat}>
//                   {cat === "all" ? "All Categories" : cat}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </CardHeader>

//         <CardContent>
//           <Table>
//             <TableHeader>
//               <TableRow>
//                 <TableHead className="w-[50px]">
//                   <Checkbox 
//                     checked={selectedCount === filteredProducts.length && filteredProducts.length > 0}
//                     onCheckedChange={toggleAll}
//                   />
//                 </TableHead>
//                 <TableHead className="w-[80px]">Image</TableHead>
//                 <TableHead className="w-[100px]">Quick QR</TableHead>
//                 <TableHead>Barcode</TableHead>
//                 <TableHead>Vendor</TableHead>
//                 <TableHead>Price</TableHead>
//                 <TableHead>Stock (D/G)</TableHead>
//               </TableRow>
//             </TableHeader>
//             <TableBody>
//               {filteredProducts.map((product) => (
//                 <TableRow key={product.id} className={printSelection[product.id] ? "bg-blue-50/50" : ""}>
//                   <TableCell>
//                     <Checkbox 
//                       checked={!!printSelection[product.id]} 
//                       onCheckedChange={() => toggleSelection(product.id)}
//                     />
//                   </TableCell>
//                   <TableCell>
//                     <div className="size-10 border rounded overflow-hidden">
//                       <InventoryImage url={product.photo_url} alt={product.barcode} />
//                     </div>
//                   </TableCell>
//                   <TableCell>
//                     <div className="size-10 flex items-center justify-center border rounded bg-white p-1">
//                       <QRCode value={product.barcode} size={32} />
//                     </div>
//                   </TableCell>
//                   <TableCell className="font-mono text-xs">{product.barcode}</TableCell>
//                   <TableCell className="font-medium">{product.vendor}</TableCell>
//                   <TableCell>₹{product.price.toLocaleString()}</TableCell>
//                   <TableCell>
//                     <Badge variant="outline" className="mr-1">{product.displayStock}</Badge>
//                     <Badge variant="outline" className="bg-gray-50">{product.godownStock}</Badge>
//                   </TableCell>
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </CardContent>
//       </Card>

//       {/* The Printing Factory: 
//         Hidden from screen, but fully rendered in the background to capture SVGs.
//       */}
//       {/* Inventory.tsx - Updated Factory for A4 Grid */}
//       <div 
//         id="hidden-print-factory" 
//         style={{ 
//           position: 'absolute', 
//           left: '-9999px', 
//           top: 0, 
//           opacity: 0 
//         }}
//       >
//         <div className="a4-grid-container">
//           {selectedProductsForPrint.map((product) => {
//             const qty = printSelection[String(product.id)] || 1;
//             return Array.from({ length: qty }).map((_, i) => (
//               <div key={`${product.id}-${i}`} className="a4-label-item">
//                 <div className="qr-wrapper">
//                   <QRCode value={product.barcode} size={100} level="H" />
//                 </div>
//                 <p className="barcode-text">{product.barcode}</p>
//               </div>
//             ));
//           })}
//         </div>
//       </div>
//     </div>
//   );
// }

import React, { useState } from "react";
import { Package, Search, AlertTriangle, Printer, EyeOff, LayoutDashboard } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import QRCode from "react-qr-code";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Product } from "./Scanner";

interface ExtendedProduct extends Product {
  costPrice: number;
  overheadPrice: number;
  remark: string;
  createdAt: string;
}

interface InventoryProps {
  products: ExtendedProduct[];
}

export function Inventory({ products }: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showOnlyNonDisplayed, setShowOnlyNonDisplayed] = useState(false);
  const [printSelection, setPrintSelection] = useState<{ [key: string]: number }>({});

  const categories = ["all", ...new Set(products.map((p) => p.category))];

  // Aging calculation
  const calculateAging = (dateString: string) => {
    const created = new Date(dateString);
    const diff = Math.abs(new Date().getTime() - created.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || product.category === filterCategory;
    const matchesDisplayFilter = showOnlyNonDisplayed ? product.displayStock === 0 : true;
    return matchesSearch && matchesCategory && matchesDisplayFilter;
  });

  // 1. Updated Financial Logic (CP + OH)
  const totalValue = products.reduce((sum, p) => sum + ((p.costPrice + p.overheadPrice) * p.stock), 0);

  // 2. Dead Stock Logic (>60 Days)
  const deadStockCount = products.filter(p => calculateAging(p.createdAt) > 60).length;

  // 3. Storage Efficiency
  const totalItems = products.reduce((sum, p) => sum + p.stock, 0);
  const godownItems = products.reduce((sum, p) => sum + p.godownStock, 0);
  const godownRatio = totalItems > 0 ? Math.round((godownItems / totalItems) * 100) : 0;

  const toggleSelection = (productId: string) => {
    setPrintSelection(prev => {
      const newSelection = { ...prev };
      if (newSelection[productId]) delete newSelection[productId];
      else newSelection[productId] = 1;
      return newSelection;
    });
  };

const handlePrintLabels = () => {
  const printContent = document.getElementById('hidden-print-factory');
  if (!printContent || Object.keys(printSelection).length === 0) {
    alert("No labels selected for printing.");
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Please allow pop-ups to print labels.");
    return;
  }

  // Optimized styles for A4 Grid printing
  const gridStyles = `
    @page { size: A4; margin: 10mm; }
    body { margin: 0; padding: 10px; font-family: sans-serif; background: white !important; }
    .a4-grid-container { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 15px; 
      width: 100%;
    }
    .a4-label-item { 
      width: 60mm; height: 50mm; 
      border: 1px dashed #ccc; 
      display: flex; flex-direction: column; 
      align-items: center; justify-content: center; 
      page-break-inside: avoid;
    }
    .qr-wrapper { margin-bottom: 8px; }
    .barcode-text { font-size: 13px; font-family: monospace; margin-top: 8px; font-weight: 700; text-align: center;}
    .price-text { font-size: 16px; font-weight: 900; margin-top: 4px; }
  `;

  printWindow.document.write(`
    <html>
      <head>
        <title>Inventory Labels</title>
        <style>${gridStyles}</style>
      </head>
      <body>
        <div class="a4-grid-container">
          ${printContent.innerHTML}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              window.close();
            }, 750);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

  return (
    <div className="space-y-6">
      {/* Optimized Retail Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-500">Total Investment</CardTitle>
            <span className="text-gray-400 font-bold">₹</span>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-500">{"Dead Stock (>60d)"}</CardTitle>
            <AlertTriangle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{deadStockCount} <small className="text-xs font-normal text-gray-400">Items</small></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-500">Godown Ratio</CardTitle>
            <Package className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{godownRatio}% <small className="text-xs font-normal text-gray-400">of Stock</small></div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Inventory Management</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant={showOnlyNonDisplayed ? "destructive" : "outline"}
                size="sm"
                onClick={() => setShowOnlyNonDisplayed(!showOnlyNonDisplayed)}
              >
                <EyeOff className="mr-2 size-4" />
                {showOnlyNonDisplayed ? "Showing Non-Displayed" : "Filter Non-Displayed"}
              </Button>
              <Button 
                disabled={Object.keys(printSelection).length === 0} 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handlePrintLabels} // Re-linked to the popup logic
              >
                <Printer className="mr-2 size-4" /> 
                Print {Object.keys(printSelection).length} Labels
              </Button>
            </div>
          </div>

          {/* RESTORED SEARCH & FILTER BAR */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                placeholder="Search vendor or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border rounded-md text-sm bg-white"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat === "all" ? "All Categories" : cat}</option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"><Checkbox /></TableHead>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead className="w-[80px]">QR</TableHead>
                <TableHead>Item Details</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Stock (D/G)</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead>Remark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} className={printSelection[product.id] ? "bg-blue-50" : ""}>
                  <TableCell>
                    <Checkbox checked={!!printSelection[product.id]} onCheckedChange={() => toggleSelection(product.id)}/>
                  </TableCell>
                  <TableCell>
                    <div className="size-10 border rounded overflow-hidden">
                      {product.photo_url ? (
                        <img src={product.photo_url} alt={product.barcode} className="size-full object-cover" />
                      ) : (
                        <div className="size-full flex items-center justify-center bg-gray-50 text-[10px] text-gray-400">No Img</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="size-10 flex items-center justify-center border rounded bg-white p-1">
                      <QRCode value={product.barcode} size={32} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold">{product.barcode}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{product.category}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{product.vendor}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge className={product.displayStock === 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100"}>
                        {product.displayStock}
                      </Badge>
                      <Badge variant="outline" className="text-gray-400">{product.godownStock}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className={calculateAging(product.createdAt) > 60 ? "text-red-500 font-bold" : "text-gray-500"}>
                      {calculateAging(product.createdAt)}d
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[120px]">
                    <p className="truncate text-[11px] text-gray-400 italic" title={product.remark}>
                      {product.remark || "-"}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    {/* The Printing Factory: Optimized to match your printSelection state */}
      <div 
        id="hidden-print-factory" 
        style={{ position: 'absolute', left: '-9999px', top: 0, opacity: 0 }}
      >
        {products.filter(p => printSelection[p.id]).map((product) => {
          // Get quantity from selection or default to 1
          const qty = printSelection[product.id] || 1;
          return Array.from({ length: qty }).map((_, i) => (
            <div key={`${product.id}-${i}`} className="a4-label-item">
              <div className="qr-wrapper">
                <QRCode value={product.barcode} size={100} level="H" />
              </div>
              <p className="barcode-text">{product.barcode}</p>
            </div>
          ));
        })}
      </div>
    </div>
  );
}