import React, { useCallback, useState } from "react";
import { Package, Search, AlertTriangle, Printer, EyeOff, LayoutDashboard, Edit2, Plus, Trash2 } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import QRCode from "react-qr-code";
import { BulkRow } from "./BulkRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Product } from "./Scanner";
import { Dialog, DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter, } from "./ui/dialog";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export interface ExtendedProduct extends Product {
  costPrice: number;
  overheadPrice: number;
  remark: string;
  createdAt: string;
  category_id: string; // Add this line
}

interface InventoryProps {
  products: ExtendedProduct[];
  onUpdateInventory: (updatedProduct: any) => Promise<void>;
  onBulkAdd: (newItems: any[]) => Promise<void>; 
}

interface CategoryOption {
  id: string;
  name: string;
}

export function Inventory({ products, onUpdateInventory, onBulkAdd}: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showOnlyNonDisplayed, setShowOnlyNonDisplayed] = useState(false);
  const [printSelection, setPrintSelection] = useState<{ [key: string]: number }>({});
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const categories = React.useMemo(
  () => ["all", ...new Set(products.map(p => p.category))],
  [products]
);

React.useEffect(() => {
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      const data = await response.json();
      
      // Fix: Since API returns objects, use cat.id and cat.name directly
      const formatted = data.map((cat: any) => ({
        id: cat.id,
        name: cat.name
      }));
      
      setCategoryOptions(formatted);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };
  fetchCategories();
}, []);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [advancedFilters, setAdvancedFilters] = useState({
    category: "all",
    vendor: "all",
    displayStockStatus: "all", // all, empty, available
    godownStockStatus: "all",  // all, empty, available
    searchTerm: ""
  });

  const [filters, setFilters] = useState({
    displayQty: { value: "", operator: "any" }, // any, equals, gt, lt
    godownQty: { value: "", operator: "any" },
    vendor: "all",
    category: "all"
  });

  const vendorOptions = React.useMemo(() => 
    ["all", ...new Set(products.map(p => p.vendor))].sort(), 
  [products]);

  const filteredProducts = products.filter((product) => {
    // 1. Search Term Logic (Barcode or Vendor)
    const matchesSearch = searchTerm.trim() === "" || 
      product.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Category Filter Logic
    const matchesCategory = filterCategory === "all" || product.category === filterCategory;

    // 3. Vendor Filter Logic
    const matchesVendor = filters.vendor === "all" || product.vendor === filters.vendor;

    // 4. Display Qty Numeric Logic
    const displayVal = Number(filters.displayQty.value);
    const matchesDisplay = 
      filters.displayQty.operator === "any" || filters.displayQty.value === "" ? true :
      filters.displayQty.operator === "equals" ? product.displayStock === displayVal :
      filters.displayQty.operator === "gt" ? product.displayStock > displayVal :
      filters.displayQty.operator === "lt" ? product.displayStock < displayVal : true;

    // 5. Godown Qty Numeric Logic
    const godownVal = Number(filters.godownQty.value);
    const matchesGodown = 
      filters.godownQty.operator === "any" || filters.godownQty.value === "" ? true :
      filters.godownQty.operator === "equals" ? product.godownStock === godownVal :
      filters.godownQty.operator === "gt" ? product.godownStock > godownVal :
      filters.godownQty.operator === "lt" ? product.godownStock < godownVal : true;

    // Final Combination
    return matchesSearch && matchesCategory && matchesVendor && matchesDisplay && matchesGodown;
  });


//   const filteredProducts = products.filter((product) => {
//   const matchesSearch = product.vendor.toLowerCase().includes(advancedFilters.searchTerm.toLowerCase()) ||
//                         product.barcode.toLowerCase().includes(advancedFilters.searchTerm.toLowerCase());
  
//   const matchesCategory = advancedFilters.category === "all" || product.category === advancedFilters.category;
  
//   const matchesVendor = advancedFilters.vendor === "all" || product.vendor === advancedFilters.vendor;

//   const matchesDisplay = 
//     advancedFilters.displayStockStatus === "all" ? true :
//     advancedFilters.displayStockStatus === "empty" ? product.displayStock === 0 :
//     product.displayStock > 0;

//   const matchesGodown = 
//     advancedFilters.godownStockStatus === "all" ? true :
//     advancedFilters.godownStockStatus === "empty" ? product.godownStock === 0 :
//     product.godownStock > 0;

//   return matchesSearch && matchesCategory && matchesVendor && matchesDisplay && matchesGodown;
// });

  // Add this state to track which product is being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<any>(null);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  // When initializing or adding a row, give it a random ID
  const [bulkRows, setBulkRows] = useState<any[]>([
    { id: crypto.randomUUID(), item_code: "" }
  ]);

  const addNewRow = () => {
    setBulkRows(prev => [...prev, { id: crypto.randomUUID(), item_code: "" }]);
  };

  // Aging calculation
  const calculateAging = (dateString: string) => {
    const created = new Date(dateString);
    const diff = Math.abs(new Date().getTime() - created.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // const filteredProducts = products.filter((product) => {
  //   const matchesSearch =
  //     product.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //     product.barcode.toLowerCase().includes(searchTerm.toLowerCase());
  //   const matchesCategory = filterCategory === "all" || product.category === filterCategory;
  //   const matchesDisplayFilter = showOnlyNonDisplayed ? product.displayStock === 0 : true;
  //   return matchesSearch && matchesCategory && matchesDisplayFilter;
  // });

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

  // Inside your Inventory function in Inventory.tsx

const toggleAll = () => {
  // 1. Check if all currently filtered products are already selected
  const allFilteredSelected = filteredProducts.length > 0 && 
    filteredProducts.every(p => !!printSelection[p.id]);

  if (allFilteredSelected) {
    // 2. If all are selected, clear the selection for THESE items
    setPrintSelection(prev => {
      const newSelection = { ...prev };
      filteredProducts.forEach(p => {
        delete newSelection[p.id];
      });
      return newSelection;
    });
  } else {
    // 3. Otherwise, add all filtered products to the selection
    setPrintSelection(prev => {
      const newSelection = { ...prev };
      filteredProducts.forEach(p => {
        newSelection[p.id] = 1; // Default quantity to 1
      });
      return newSelection;
    });
  }
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

  const gridStyles = `
  @page { 
    size: A4; 
    margin: 8mm; /* Reduced margin to fit 4 columns */
  }
  body { 
    margin: 0; 
    padding: 0; 
    background: white !important; 
  }
  .a4-grid-container { 
    display: grid; 
    /* Force 4 columns */
    grid-template-columns: repeat(4, 1fr); 
    /* Force 6 rows per page */
    grid-template-rows: repeat(6, 45mm); 
    gap: 2mm; 
    width: 100%;
  }
  .a4-label-item { 
    width: 100%; 
    height: 45mm; 
    border: 1px dashed #eee; 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    justify-content: center; 
    page-break-inside: avoid;
    overflow: hidden;
  }
  .qr-img { width: 75px; height: 75px; object-fit: contain; }
  .vendor-name { font-size: 10px; text-transform: uppercase; color: #666; margin-bottom: 2px; }
  .barcode-text { font-size: 12px; font-family: monospace; font-weight: 700; margin-top: 4px; }
  .price-text { font-size: 14px; font-weight: 900; margin-top: 2px; }
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

  const handleUpdateBulkRow = useCallback((rowId: string, field: string, value: any) => {
    setBulkRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  }, []);

  const handleRemoveBulkRow = useCallback((rowId: string) => {
    setBulkRows(prev => prev.filter(row => row.id !== rowId));
  }, []);

  const handleAddNewRow = () => {
    setBulkRows(prev => [...prev, { 
      id: crypto.randomUUID(), // Vital for focus persistence
      item_code: "",
      category_id: "",
      vendor_name: "",
      cost_price: "",
      overhead: "",
      unit_price: "",
      display_qty: "",
      godown_qty: ""
    }]);
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

              <Button 
                onClick={() => setIsBulkModalOpen(true)} // This triggers the modal
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 size-4" /> 
                Bulk Add
              </Button>
            </div>
          </div>

          {/* RESTORED SEARCH & FILTER BAR */}
          {/* <div className="flex gap-4">
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
          </div> */}
         <div className="flex flex-wrap gap-4 p-4 bg-slate-50 border rounded-lg mb-4 items-end">
          {/* 1. Category Filter (Restored) */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 px-2 border rounded-md text-xs bg-white min-w-[120px]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat === "all" ? "All Categories" : cat}</option>
              ))}
            </select>
          </div>

          {/* 2. Vendor Filter (Restored) */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Vendor</label>
            <select
              value={filters.vendor}
              onChange={(e) => setFilters(f => ({...f, vendor: e.target.value}))}
              className="h-8 px-2 border rounded-md text-xs bg-white min-w-[120px]"
            >
              {vendorOptions.map((v) => (
                <option key={v} value={v}>{v === "all" ? "All Vendors" : v}</option>
              ))}
            </select>
          </div>

          {/* 3. Display Qty Logic */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Display Qty</label>
            <div className="flex gap-1">
              <select 
                className="h-8 text-xs border rounded p-1 bg-white"
                value={filters.displayQty.operator}
                onChange={(e) => setFilters(f => ({...f, displayQty: {...f.displayQty, operator: e.target.value}}))}
              >
                <option value="any">Any</option>
                <option value="equals">=</option>
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
              </select>
              <Input 
                type="number" className="h-8 w-16 text-xs" placeholder="0"
                value={filters.displayQty.value}
                onChange={(e) => setFilters(f => ({...f, displayQty: {...f.displayQty, value: e.target.value}}))}
              />
            </div>
          </div>

          {/* 4. Godown Qty Logic */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Godown Qty</label>
            <div className="flex gap-1">
              <select 
                className="h-8 text-xs border rounded p-1 bg-white"
                value={filters.godownQty.operator}
                onChange={(e) => setFilters(f => ({...f, godownQty: {...f.godownQty, operator: e.target.value}}))}
              >
                <option value="any">Any</option>
                <option value="equals">=</option>
                <option value="gt">&gt;</option>
                <option value="lt">&lt;</option>
              </select>
              <Input 
                type="number" className="h-8 w-16 text-xs" placeholder="0"
                value={filters.godownQty.value}
                onChange={(e) => setFilters(f => ({...f, godownQty: {...f.godownQty, value: e.target.value}}))}
              />
            </div>
          </div>

         {/* Reset Button */}
        <Button 
          variant="ghost"     
          size="sm" 
          className="h-8 text-[10px] font-bold text-slate-400 hover:text-red-500"
          onClick={() => {
            // Reset the individual state
            setFilterCategory("all"); 
            
            // Reset the combined filters object - MUST include 'category'
            setFilters({
              vendor: "all",
              category: "all", // Added this to fix the TS error
              displayQty: { value: "", operator: "any" },
              godownQty: { value: "", operator: "any" }
            });
            
            setSearchTerm("");
          }}
        >
          RESET ALL
        </Button>
        </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {/* <TableHead className="w-[40px]"><Checkbox /></TableHead> */}
                <TableHead className="w-[40px]">
                  <Checkbox 
                    // Show as checked only if all visible items are selected
                    checked={filteredProducts.length > 0 && filteredProducts.every(p => !!printSelection[p.id])}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead className="w-[80px]">QR</TableHead>
                <TableHead>Item Details</TableHead>
                <TableHead>Vendor</TableHead>
                {/* NEW COLUMNS */}
                <TableHead className="text-right">Cost Price</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead>Stock (D/G)</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead>Remark</TableHead>
              </TableRow>
            </TableHeader>
             <TableBody>
                {filteredProducts.map((product) => {
                  const isEditing = editingId === product.id;
                  // Use buffer values if editing, otherwise use original product data
                  const data = isEditing ? editBuffer : product;

                  return (
                    <TableRow 
                      key={product.id} 
                      className={`${printSelection[product.id] ? "bg-blue-50" : ""} ${isEditing ? "bg-blue-50/30 ring-1 ring-inset ring-blue-200" : ""}`}
                    >
                      <TableCell>
                        <Checkbox checked={!!printSelection[product.id]} onCheckedChange={() => toggleSelection(product.id)}/>
                      </TableCell>
                      
                      {/* IMAGE: With edit overlay if active */}
                      <TableCell>
                        <div className="relative size-10 border rounded overflow-hidden group">
                          {data.photo_url ? (
                            <img src={data.photo_url} alt={data.barcode} className="size-full object-contain" />
                          ) : (
                            <div className="size-full flex items-center justify-center bg-gray-50 text-[10px] text-gray-400">No Img</div>
                          )}
                          {isEditing && (
                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                              <input 
                                type="file" 
                                className="hidden" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    // Logic for image preview/upload goes here
                                    const reader = new FileReader();
                                    reader.onloadend = () => setEditBuffer({ ...editBuffer, photo_url: reader.result });
                                    reader.readAsDataURL(file);
                                  }
                                }} 
                              />
                              <span className="text-[8px] text-white font-bold">CHANGE</span>
                            </label>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="size-10 flex items-center justify-center border rounded bg-white p-1">
                          <QRCode value={product.barcode} size={32} />
                        </div>
                      </TableCell>

                      {/* ITEM DETAILS: Inline Inputs */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {isEditing ? (
                            <>
                              <Input 
                                className="h-7 text-xs font-mono font-bold" 
                                value={data.barcode} 
                                onChange={(e) => setEditBuffer({ ...data, barcode: e.target.value })} 
                              />
                              <Input 
                                className="h-6 text-[10px] uppercase" 
                                value={data.category} 
                                onChange={(e) => setEditBuffer({ ...data, category: e.target.value })} 
                              />
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-xs font-bold">{product.barcode}</span>
                              <span className="text-[10px] text-gray-400 uppercase">{product.category}</span>
                            </>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Input 
                            className="h-7 text-xs" 
                            value={data.vendor} 
                            onChange={(e) => setEditBuffer({ ...data, vendor: e.target.value })} 
                          />
                        ) : (
                          <span className="text-sm font-medium">{product.vendor}</span>
                        )}
                      </TableCell>

                      {/* PRICE FIELDS */}
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 text-[10px]">₹</span>
                            <Input 
                              type="number" 
                              className="h-7 w-20 text-xs text-right font-mono" 
                              value={data.cost_price} 
                              onChange={(e) => setEditBuffer({ ...data, cost_price: Number(e.target.value) })} 
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-gray-500">₹{product.cost_price?.toLocaleString() || "-"}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-blue-400 text-[10px]">₹</span>
                            <Input 
                              type="number" 
                              className="h-7 w-20 text-xs text-right font-mono font-bold" 
                              value={data.selling_price} 
                              onChange={(e) => setEditBuffer({ ...data, selling_price: Number(e.target.value) })} 
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-mono font-bold text-blue-600">₹{product.selling_price?.toLocaleString() || "-"}</span>
                        )}
                      </TableCell>

                      {/* STOCK */}
                      <TableCell>
                        <div className="flex gap-1">
                          {isEditing ? (
                            <>
                              <Input 
                                type="number" 
                                className="h-7 w-12 text-xs p-1" 
                                value={data.displayStock} 
                                onChange={(e) => setEditBuffer({ ...data, displayStock: Number(e.target.value) })} 
                              />
                              <Input 
                                type="number" 
                                className="h-7 w-12 text-xs p-1" 
                                value={data.godownStock} 
                                onChange={(e) => setEditBuffer({ ...data, godownStock: Number(e.target.value) })} 
                              />
                            </>
                          ) : (
                            <>
                              <Badge className={product.displayStock === 0 ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-700 border-green-100"}>
                                {product.displayStock}
                              </Badge>
                              <Badge variant="outline" className="text-gray-400">{product.godownStock}</Badge>
                            </>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        <span className={calculateAging(product.createdAt) > 60 ? "text-red-500 font-bold" : "text-gray-500"}>
                          {calculateAging(product.createdAt)}d
                        </span>
                      </TableCell>

                      <TableCell className="max-w-[120px]">
                        {isEditing ? (
                          <Input 
                            className="h-7 text-[11px] italic" 
                            value={data.remark || ""} 
                            onChange={(e) => setEditBuffer({ ...data, remark: e.target.value })} 
                          />
                        ) : (
                          <p className="truncate text-[11px] text-gray-400 italic" title={product.remark}>
                            {product.remark || "-"}
                          </p>
                        )}
                      </TableCell>

                      {/* ROW ACTIONS */}
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 px-2 text-[10px] font-bold text-blue-600 hover:bg-blue-50"
                              onClick={async () => {
                                try {
                                  // 1. Send data to your API
                                  await onUpdateInventory(data); 
                                  
                                  // 2. Clear edit states to "get out of edit mode"
                                  setEditingId(null);
                                  setEditBuffer(null);
                                  
                                  // The parent state update in onUpdateInventory will refresh the data automatically
                                } catch (error) {
                                  console.error("Save failed:", error);
                                  // We keep editingId active here so the user doesn't lose their typed changes
                                }
                              }}
                            >
                              SAVE
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 px-2 text-[10px] text-gray-400 hover:bg-gray-50"
                              onClick={() => setEditingId(null)}
                            >
                              CANCEL
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="size-8"
                            onClick={() => {
                              setEditingId(product.id);
                              setEditBuffer({ ...product });
                            }}
                          >
                            <Edit2 className="size-3.5 text-slate-400" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      {/* ADD BULK MODAL HERE */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="sm:max-w-none w-[98vw] max-w-[80vw] h-[50vh] p-0 flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold">Bulk Inventory Entry</DialogTitle>
            <p className="text-xs text-slate-500 font-medium">Mandatory: Item Code. Image upload supports JPG/PNG.</p>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-6">
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-[11px] border-collapse bg-white">
                <thead className="bg-slate-100 sticky top-0 z-20 border-b">
                  <tr className="divide-x divide-slate-200">
                    <th className="p-2 text-center w-14">Image</th>
                    <th className="p-2 text-left w-40">Item Code *</th>
                    <th className="p-2 text-left w-48">Category</th>
                    <th className="p-2 text-left w-40">Vendor</th>
                    <th className="p-2 text-right w-28">Cost Price</th>
                    <th className="p-2 text-right w-28">Overhead</th>
                    <th className="p-2 text-right w-28">Selling Price</th>
                    <th className="p-2 text-center w-20">Display</th>
                    <th className="p-2 text-center w-20">Godown</th>
                    <th className="p-2 text-center w-12 bg-slate-100"></th>
                  </tr>
                </thead>
                  {/* <tbody className="divide-y divide-slate-200">
                  {bulkRows.map((row, idx) => (
                    <tr key={idx} className="divide-x divide-slate-100 hover:bg-blue-50/30 transition-colors">
                      
                      <td className="p-1">
                        <div className="relative size-10 mx-auto border rounded bg-slate-50 overflow-hidden group">
                          {row.photo_url ? (
                            <img src={row.photo_url} className="size-full object-cover" />
                          ) : (
                            <Plus className="size-3 m-auto absolute inset-0 text-slate-300" />
                          )}
                          <input 
                            type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const newRows = [...bulkRows];
                                  newRows[idx].photo_url = reader.result;
                                  setBulkRows(newRows);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </div>
                      </td>

                      <td className="p-0">
                        <input 
                          className="w-full h-10 px-3 outline-none focus:bg-white font-bold" 
                          placeholder="REQUIRED" value={row.item_code || ""}
                          onChange={(e) => {
                            const newRows = [...bulkRows];
                            newRows[idx].item_code = e.target.value;
                            setBulkRows(newRows);
                          }}
                        />
                      </td>

                      <td className="p-0">
                       <select 
                          className="w-full h-10 px-2 bg-transparent outline-none cursor-pointer text-[11px]"
                          value={row.category_id || ""} // Note: this will save the name string (e.g. "Lights")
                          onChange={(e) => {
                            const newRows = [...bulkRows];
                            newRows[idx].category_id = e.target.value;
                            setBulkRows(newRows);
                          }}
                        >
                          <option value="">Select Category</option>
                          {categories.filter(cat => cat !== "all").map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-0">
                        <input 
                          className="w-full h-10 px-3 outline-none" 
                          value={row.vendor_name || ""}
                          onChange={(e) => {
                            const newRows = [...bulkRows];
                            newRows[idx].vendor_name = e.target.value;
                            setBulkRows(newRows);
                          }}
                        />
                      </td>

                      <td className="p-0">
                        <input 
                          type="number" step="any"
                          className="w-full h-10 px-3 text-right outline-none font-mono" 
                          value={row.cost_price || ""}
                          onChange={(e) => {
                            const newRows = [...bulkRows];
                            newRows[idx].cost_price = e.target.value;
                            setBulkRows(newRows);
                          }}
                        />
                      </td>

                      <td className="p-0">
                        <input 
                          type="number" step="any"
                          className="w-full h-10 px-3 text-right outline-none font-mono" 
                          value={row.overhead || ""}
                          onChange={(e) => {
                            const newRows = [...bulkRows];
                            newRows[idx].overhead = e.target.value;
                            setBulkRows(newRows);
                          }}
                        />
                      </td>

                      <td className="p-0">
                        <input 
                          type="number" step="any"
                          className="w-full h-10 px-3 text-right outline-none font-mono font-bold text-blue-600" 
                          value={row.unit_price || ""}
                          onChange={(e) => {
                            const newRows = [...bulkRows];
                            newRows[idx].unit_price = e.target.value;
                            setBulkRows(newRows);
                          }}
                        />
                      </td>

                      <td className="p-0">
                        <input 
                          type="number"
                          className="w-full h-10 px-3 text-center outline-none" 
                          value={row.display_qty || ""}
                          onChange={(e) => {
                            const newRows = [...bulkRows];
                            newRows[idx].display_qty = Math.floor(Number(e.target.value)) || "";
                            setBulkRows(newRows);
                          }}
                        />
                      </td>

                      <td className="p-0">
                        <input 
                          type="number"
                          className="w-full h-10 px-3 text-center outline-none" 
                          value={row.godown_qty || ""}
                          onChange={(e) => {
                            const newRows = [...bulkRows];
                            newRows[idx].godown_qty = Math.floor(Number(e.target.value)) || "";
                            setBulkRows(newRows);
                          }}
                        />
                      </td>

                      <td className="p-0 text-center bg-slate-50/50">
                        <Button 
                          variant="ghost" size="icon" className="h-10 w-full rounded-none text-red-300 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>  */}
              <tbody className="divide-y divide-slate-200">
                {bulkRows.map((row) => (
                  <BulkRow 
                    key={row.id} // Stable UUID key
                    row={row}
                    categoryOptions={categoryOptions}
                    onUpdate={handleUpdateBulkRow}
                    onRemove={handleRemoveBulkRow}
                  />
                ))}
              </tbody>
              </table>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
            <Button variant="outline" onClick={() => setBulkRows(prev => [...prev,{ id: crypto.randomUUID(), item_code: "" }])} className="bg-white border-dashed font-bold border-slate-300">
              <Plus className="size-4 mr-2" /> Add New Product
            </Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => {
                setIsBulkModalOpen(false);
                setBulkRows([{ id: crypto.randomUUID(), item_code: "" }]);
              }} className="font-bold">Discard Changes</Button>
              <Button 
                className="bg-blue-600 px-10 font-bold shadow-lg shadow-blue-200"
                disabled={bulkRows.some(r => !r.item_code)}
                onClick={() => {
                  onBulkAdd(bulkRows);
                  setIsBulkModalOpen(false);
                  setBulkRows([{ id: crypto.randomUUID(), item_code: "" }]);
                }}
              >
                Finalize & Sync {bulkRows.length} Items
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog> 
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none shadow-none flex items-center justify-center">
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {selectedImage && (
              <img 
                src={selectedImage} 
                className="max-w-full max-h-full rounded-lg shadow-2xl object-contain bg-white"
                alt="Preview"
              />
            )}
            <Button 
              variant="ghost" 
              className="absolute top-2 right-2 text-white bg-black/20 hover:bg-black/40 rounded-full size-8 p-0"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div> // Closing div for the entire component
  );
}