import React, { useRef, useState } from "react";
import { Package, Search, AlertTriangle, Printer } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { PrintLabels } from "./PrintLabels";
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

interface InventoryProps {
  products: Product[];
}

export function Inventory({ products }: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [printSelection, setPrintSelection] = useState<{ [key: string]: number }>({});

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

  const toggleSelection = (productId: string) => {
    setPrintSelection(prev => {
      const newSelection = { ...prev };
      if (newSelection[productId]) {
        delete newSelection[productId];
      } else {
        newSelection[productId] = 1;
      }
      return newSelection;
    });
  };

  const InventoryImage = ({ url, alt }: { url?: string | null, alt: string }) => {
    const [error, setError] = React.useState(false);
    if (!url || error) {
      return (
        <div className="flex size-full items-center justify-center bg-gray-100 rounded-md">
          <span className="text-[10px] text-gray-400">No Img</span>
        </div>
      );
    }
    return (
      <img
        src={url}
        alt={alt}
        className="size-full object-cover rounded-md"
        onError={() => setError(true)}
      />
    );
  };

  const toggleAll = () => {
    const allSelected = Object.keys(printSelection).length === filteredProducts.length && filteredProducts.length > 0;
    if (allSelected) {
      setPrintSelection({});
    } else {
      const all: { [key: string]: number } = {};
      filteredProducts.forEach(p => {
        all[p.id] = 1;
      });
      setPrintSelection(all);
    }
  };

  const selectedProductsForPrint = products.filter(p => {
    const id = String(p.id).trim();
    return printSelection[id] !== undefined;
  });
  const selectedCount = Object.keys(printSelection).length;

const handlePrintLabels = () => {
  const printContent = document.getElementById('hidden-print-factory');
  if (!printContent) return;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const gridStyles = `
    @page { 
      size: A4; 
      margin: 10mm; 
    }
    body { 
      margin: 0; 
      padding: 0; 
      font-family: sans-serif; 
    }
    .a4-grid-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr); /* 3 Columns */
      gap: 10px;
      width: 100%;
    }
    .a4-label-item {
      width: 60mm; 
      height: 50mm; 
      border: 1px dashed #ccc; /* Cut lines for hanging */
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 5px;
      page-break-inside: avoid;
    }
    .vendor-name { font-size: 12px; font-weight: bold; margin: 0; text-transform: uppercase; }
    .qr-wrapper { margin: 5px 0; }
    .barcode-text { font-size: 10px; font-family: monospace; margin: 0; }
    svg { display: block; margin: 0 auto; }
  `;

  doc.open();
  doc.write('<html><head><style>' + gridStyles + '</style></head><body>');
  doc.write(printContent.innerHTML);
  doc.write('</body></html>');
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    document.body.removeChild(iframe);
  }, 500);
};

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="size-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <span className="text-gray-500">₹</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="size-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inventory Management</CardTitle>
            
            {selectedCount > 0 && (
              <Button 
                onClick={handlePrintLabels}
                className="bg-blue-600 hover:bg-blue-700 animate-in fade-in"
              >
                <Printer className="mr-2 size-4" />
                Print {selectedCount} Labels
              </Button>
            )}
          </div>

          <div className="flex gap-4 mt-4">
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
              className="px-4 py-2 border rounded-md text-sm"
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
                <TableHead className="w-[50px]">
                  <Checkbox 
                    checked={selectedCount === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead className="w-[100px]">Quick QR</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock (D/G)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} className={printSelection[product.id] ? "bg-blue-50/50" : ""}>
                  <TableCell>
                    <Checkbox 
                      checked={!!printSelection[product.id]} 
                      onCheckedChange={() => toggleSelection(product.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="size-10 border rounded overflow-hidden">
                      <InventoryImage url={product.photo_url} alt={product.barcode} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="size-10 flex items-center justify-center border rounded bg-white p-1">
                      <QRCode value={product.barcode} size={32} />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{product.barcode}</TableCell>
                  <TableCell className="font-medium">{product.vendor}</TableCell>
                  <TableCell>₹{product.price.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="mr-1">{product.displayStock}</Badge>
                    <Badge variant="outline" className="bg-gray-50">{product.godownStock}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* The Printing Factory: 
        Hidden from screen, but fully rendered in the background to capture SVGs.
      */}
      {/* Inventory.tsx - Updated Factory for A4 Grid */}
      <div 
        id="hidden-print-factory" 
        style={{ 
          position: 'absolute', 
          left: '-9999px', 
          top: 0, 
          opacity: 0 
        }}
      >
        <div className="a4-grid-container">
          {selectedProductsForPrint.map((product) => {
            const qty = printSelection[String(product.id)] || 1;
            return Array.from({ length: qty }).map((_, i) => (
              <div key={`${product.id}-${i}`} className="a4-label-item">
                <p className="vendor-name">{product.vendor}</p>
                <div className="qr-wrapper">
                  <QRCode value={product.barcode} size={100} level="H" />
                </div>
                <p className="barcode-text">{product.barcode}</p>
              </div>
            ));
          })}
        </div>
      </div>
    </div>
  );
}