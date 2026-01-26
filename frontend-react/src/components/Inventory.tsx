import React,{ useState } from "react";
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
        className="size-full object-cover transition-transform hover:scale-110 cursor-zoom-in rounded-md"
        loading="lazy"
        onError={() => setError(true)}
      />
    );
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
                <TableHead className="w-[80px]">Image</TableHead> {/* New Header */}
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
                  {/* --- New Image Cell --- */}
                  <TableCell>
                    <div className="size-12 border rounded-md overflow-hidden">
                      <InventoryImage url={product.photo_url} alt={product.barcode} />
                    </div>
                  </TableCell>
                  {/* --- End New Image Cell --- */}

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
  );
}
