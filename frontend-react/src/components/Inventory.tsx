import { useState } from "react";
import { Package, Search, AlertTriangle } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Product } from "./Scanner";

interface InventoryProps {
  products: Product[];
}

export function Inventory({ products }: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const categories = ["all", ...new Set(products.map((p) => p.category))];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode.includes(searchTerm);
    const matchesCategory =
      filterCategory === "all" || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockCount = products.filter((p) => p.stock < 10).length;
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

  const [printSelection, setPrintSelection] = useState<Record<string, number>>({});

  const toggleSelection = (productId: string) => {
    setPrintSelection(prev => {
      const newSelection = { ...prev };
      if (newSelection[productId]) {
        delete newSelection[productId]; // Deselect
      } else {
        newSelection[productId] = 1; // Select with default qty of 1
      }
      return newSelection;
    });
  };

  const updateQty = (productId: string, qty: number) => {
    setPrintSelection(prev => ({
      ...prev,
      [productId]: Math.max(1, qty) // Ensure at least 1 is printed
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Items</CardTitle>
            <Package className="size-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{products.length}</div>
            <p className="text-xs text-gray-500">products in inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Value</CardTitle>
            <Package className="size-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">${totalValue.toFixed(2)}</div>
            <p className="text-xs text-gray-500">inventory value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Low Stock</CardTitle>
            <AlertTriangle className="size-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{lowStockCount}</div>
            <p className="text-xs text-gray-500">items below 10 units</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border rounded-md"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "all" ? "All Categories" : cat}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Barcode</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-sm">{product.barcode}</TableCell>
                  <TableCell className="font-medium">{product.vendor}</TableCell>
                  
                  <TableCell>
                    <Badge variant="outline">{product.category}</Badge>
                 </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="mr-1">D: {product.displayStock}</Badge>
                    <Badge variant="outline" className="bg-gray-50">G: {product.godownStock}</Badge>
                  </TableCell>
                  <TableCell>₹{product.price.toLocaleString()}</TableCell>
                  <TableCell>
                    {/* Combined stock for status badge */}
                    {(product.displayStock + product.godownStock) === 0 ? (
                      <Badge variant="destructive">Out</Badge>
                    ) : (
                      <Badge className="bg-green-600">In Stock</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    // <div className="space-y-4">
    //   {/* Bulk Action Header */}
    //   {Object.keys(printSelection).length > 0 && (
    //     <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2">
    //       <p className="text-sm text-blue-800 font-medium">
    //         {Object.keys(printSelection).length} products selected for printing
    //       </p>
    //       <button 
    //         onClick={() => window.print()} 
    //         className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
    //       >
    //         Print {Object.values(printSelection).reduce((a, b) => a + b, 0)} Labels
    //       </button>
    //     </div>
    //   )}

    //   <Table>
    //     <TableHeader>
    //       <TableRow>
    //         {/* New Selection Header */}
    //         <TableHead className="w-12">Select</TableHead>
    //         <TableHead>Barcode</TableHead>
    //         <TableHead>Vendor</TableHead>
    //         <TableHead>Stock (D/G)</TableHead>
    //         <TableHead>Price</TableHead>
    //         {/* New Quantity Header */}
    //         <TableHead className="w-24 text-center">Print Qty</TableHead>
    //       </TableRow>
    //     </TableHeader>
    //     <TableBody>
    //       {filteredProducts.map((product) => {
    //         const isSelected = !!printSelection[product.id];
    //         return (
    //           <TableRow key={product.id} className={isSelected ? "bg-blue-50/50" : ""}>
    //             <TableCell>
    //               <input
    //                 type="checkbox"
    //                 checked={isSelected}
    //                 onChange={() => toggleSelection(product.id)}
    //                 className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    //               />
    //             </TableCell>
    //             <TableCell className="font-mono text-sm">{product.barcode}</TableCell>
    //             <TableCell className="font-medium">{product.vendor}</TableCell>
    //             <TableCell>
    //               <Badge variant="outline" className="mr-1">D: {product.displayStock}</Badge>
    //               <Badge variant="outline" className="bg-gray-50">G: {product.godownStock}</Badge>
    //             </TableCell>
    //             <TableCell>₹{product.price.toLocaleString()}</TableCell>
    //             <TableCell>
    //               <Input
    //                 type="number"
    //                 min="1"
    //                 disabled={!isSelected}
    //                 value={printSelection[product.id] || ""}
    //                 onChange={(e) => updateQty(product.id, parseInt(e.target.value))}
    //                 className={`h-8 w-20 mx-auto text-center ${!isSelected ? 'opacity-30' : 'bg-white'}`}
    //               />
    //             </TableCell>
    //           </TableRow>
    //         );
    //       })}
    //     </TableBody>
    //   </Table>
    //         {/* Hidden on screen, visible during print */}
    //   <div id="print-area" className="hidden print:block">
    //     {Object.entries(printSelection).map(([id, qty]) => {
    //       const p = products.find(prod => prod.id === id);
    //       if (!p) return null;
          
    //       return Array.from({ length: qty }).map((_, index) => (
    //         <div key={`${id}-${index}`} className="label-break flex flex-col items-center justify-center border-none">
    //           <h2 className="text-lg font-bold uppercase">{p.vendor}</h2>
    //           {/* Assuming you have a Barcode component or library installed */}
    //           <div className="py-2">
    //             {/* Replace this with your actual <Barcode /> component */}
    //             <p className="font-mono text-2xl tracking-widest">{p.barcode}</p> 
    //           </div>
    //           <p className="text-md font-semibold">₹{p.price.toLocaleString()}</p>
    //         </div>
    //       ));
    //     })}
    //   </div>
    // </div>
  );
}
