import React, { useCallback, useState } from "react";
import { Package, Search, AlertTriangle, Printer, LayoutDashboard, Edit2, Plus, Trash2, ArrowUpDown, ShoppingCart, Minus } from "lucide-react";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import QRCode from "react-qr-code";
import { BulkRow } from "./BulkRow";
import Fuse from "fuse.js";
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
import { toast } from "sonner";
import { supabase } from "../lib/supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export interface ExtendedProduct extends Product {
  costPrice: number;
  overheadPrice: number;
  remark: string;
  createdAt: string;
  category_id: string; // Add this line
}
interface InventorySummary {
  total_investment: number;
  dead_stock_count: number;
  godown_ratio: number;
}

interface InventoryProps {
  products: ExtendedProduct[];
  onUpdateInventory: (updatedProduct: any) => Promise<void>;
  onBulkAdd: (newItems: any[]) => Promise<void>;
  onGenerateCatalogPdf?: (catalogProducts: ExtendedProduct[], filterLabel: string) => Promise<void> | void;
  onAddToCartFromInventory?: (product: ExtendedProduct, quantity: number, room: string) => Promise<void>;
  activeCartId?: string | null;
  activeCartLabel?: string | null;
  onRequireActiveCart?: (callback?: () => void, items?: any[]) => void;
  onLoadMore?: () => Promise<void>;
  hasMoreProducts?: boolean;
  onSearchChange?: (searchTerm: string) => void;
  summary: InventorySummary | null;
  onFiltersChange?: (filters: InventoryFilterState) => void;
  totalProducts?: number;
  onDeleteItem?: (productId: string) => Promise<void>;
}

interface CategoryOption {
  id: string;
  name: string;
}

export interface InventoryFilterState {
  searchTerm: string;
  category: string;
  vendor: string;
  displayQty: {
    operator: string;
    value: string;
  };
  godownQty: {
    operator: string;
    value: string;
  };
}

const isRenderableImageUrl = (url?: string | null) =>
  !!url &&
  (url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:image/") ||
    url.startsWith("blob:"));

export function Inventory({
  products,
  onUpdateInventory,
  onBulkAdd,
  onGenerateCatalogPdf,
  onAddToCartFromInventory,
  activeCartId,
  activeCartLabel,
  onRequireActiveCart,
  onLoadMore,
  hasMoreProducts,
  onSearchChange,
  summary,
  onFiltersChange,
  totalProducts,
  onDeleteItem,
}: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [printSelection, setPrintSelection] = useState<{ [key: string]: number }>({});
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Record<string, ExtendedProduct>>({});
  const [priceSort, setPriceSort] = useState<{
    field: "cost_price" | "overhead_expense" | "selling_price" | null;
    direction: "asc" | "desc";
  }>({ field: null, direction: "asc" });
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [vendorNames, setVendorNames] = useState<string[]>([]);
  const categories = React.useMemo(
  () => ["all", ...new Set(products.map(p => p.category))],
  [products]
);
  const categoryFilterOptions = React.useMemo(
    () => [
      "all",
      ...(categoryOptions.length > 0
        ? categoryOptions.map((cat) => cat.name)
        : categories.filter((cat) => cat !== "all")),
    ],
    [categories, categoryOptions]
  );

React.useEffect(() => {
  const fetchFilterOptions = async () => {
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

    try {
      const response = await fetch(`${API_BASE_URL}/vendors`);
      const data = await response.json();

      setVendorNames(
        data
          .map((vendor: string) => vendor.trim())
          .filter((vendor: string) => vendor !== "" && vendor !== "-")
      );
    } catch (error) {
      console.error("Failed to load vendors:", error);
    }
  };
  fetchFilterOptions();
}, []);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [advancedFilters, setAdvancedFilters] = useState({
    category: "all",
    vendor: "all",
    displayStockStatus: "all", // all, empty, available
    godownStockStatus: "all",  // all, empty, available
    searchTerm: ""
  });

  const fuse = React.useMemo(() => {
    return new Fuse(products, {
      keys: ["barcode"], // This matches your Product interface 'barcode' field
      threshold: 0.3,    // Adjust for strictness (0.0 is perfect match, 1.0 is anything)
      distance: 100
    });
  }, [products]);

  const [filters, setFilters] = useState({
    displayQty: { value: "", operator: "any" }, // any, equals, gt, lt
    godownQty: { value: "", operator: "any" },
    vendor: "all",
    category: "all"
  });

  const usesBackendFilters = Boolean(onFiltersChange);

  const activeFilterState = React.useMemo<InventoryFilterState>(() => ({
    searchTerm,
    category: filterCategory,
    vendor: filters.vendor,
    displayQty: filters.displayQty,
    godownQty: filters.godownQty,
  }), [filterCategory, filters.displayQty, filters.godownQty, filters.vendor, searchTerm]);

  React.useEffect(() => {
    if (!onSearchChange && !onFiltersChange) return;

    const timeoutId = window.setTimeout(() => {
      if (onFiltersChange) {
        onFiltersChange(activeFilterState);
      } else {
        onSearchChange?.(searchTerm);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [activeFilterState, onFiltersChange, onSearchChange, searchTerm]);

  const vendorOptions = React.useMemo(() => {
    const sourceVendors = vendorNames.length > 0
      ? vendorNames
      : products.map((product) => product.vendor);
    const uniqueVendors = new Set<string>();

    sourceVendors.forEach((vendor) => {
      if (vendor && vendor.trim() !== "" && vendor !== "-") {
        uniqueVendors.add(vendor.trim().toUpperCase());
      }
    });

    return ["all", ...Array.from(uniqueVendors)].sort();
  }, [products, vendorNames]);

  const filteredProducts = products.filter((product) => {

    let matchesSearch = true;
    if (!onSearchChange && !usesBackendFilters && searchTerm.trim() !== "") {
      const results = fuse.search(searchTerm);
      matchesSearch = results.some(r => r.item.id === product.id);
    }
    
    // 2. Category Filter Logic — always apply on the client so stale paginated rows
    // from a previous filter cannot appear while backend results are in flight.
    const matchesCategory = filterCategory === "all" || product.category === filterCategory;

    // 3. Vendor Filter Logic
    const matchesVendor = filters.vendor === "all" ||
      (product.vendor && product.vendor.trim().toUpperCase() === filters.vendor);

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
    //return matchesSearch && matchesCategory && matchesVendor && matchesDisplay && matchesGodown;
    // Final Combination: Show the item if it matches the search filters OR if it is actively checked!
    const isExplicitlyChecked = Boolean(printSelection[product.id]);
    return isExplicitlyChecked || (matchesSearch && matchesCategory && matchesVendor && matchesDisplay && matchesGodown);
  });

  // This is the new, crucial piece. It represents only the products that match the current text/dropdown filters,
  // ignoring any items that are only visible because they were previously selected.
  const productsMatchingCurrentFilters = products.filter((product) => {
    let matchesSearch = true;
    if (!onSearchChange && !usesBackendFilters && searchTerm.trim() !== "") {
      const results = fuse.search(searchTerm);
      matchesSearch = results.some(r => r.item.id === product.id);
    }
    const matchesCategory = filterCategory === "all" || product.category === filterCategory;
    const matchesVendor = filters.vendor === "all" || (product.vendor && product.vendor.trim().toUpperCase() === filters.vendor);
    const displayVal = Number(filters.displayQty.value);
    const matchesDisplay = filters.displayQty.operator === "any" || filters.displayQty.value === "" ? true :
      filters.displayQty.operator === "equals" ? product.displayStock === displayVal :
      filters.displayQty.operator === "gt" ? product.displayStock > displayVal :
      filters.displayQty.operator === "lt" ? product.displayStock < displayVal : true;
    const godownVal = Number(filters.godownQty.value);
    const matchesGodown = filters.godownQty.operator === "any" || filters.godownQty.value === "" ? true :
      filters.godownQty.operator === "equals" ? product.godownStock === godownVal :
      filters.godownQty.operator === "gt" ? product.godownStock > godownVal :
      filters.godownQty.operator === "lt" ? product.godownStock < godownVal : true;
    return matchesSearch && matchesCategory && matchesVendor && matchesDisplay && matchesGodown;
  });

  const sortedProducts = React.useMemo(() => {
    const sortField = priceSort.field;
    if (!sortField) return filteredProducts;

    const sorted = [...filteredProducts].sort((a, b) => {
      const left = Number((a as any)[sortField] ?? 0);
      const right = Number((b as any)[sortField] ?? 0);
      return priceSort.direction === "asc" ? left - right : right - left;
    });

    return sorted;
  }, [filteredProducts, priceSort]);

  const getCatalogFilterLabel = () => {
    const parts: string[] = [];

    if (searchTerm.trim()) {
      parts.push(`search-${searchTerm.trim()}`);
    }
    if (filterCategory !== "all") {
      parts.push(`${filterCategory}`);
    }
    if (filters.vendor !== "all") {
      parts.push(`vendor-${filters.vendor}`);
    }
    if (filters.displayQty.operator !== "any" && filters.displayQty.value !== "") {
      parts.push(`display-${filters.displayQty.operator}-${filters.displayQty.value}`);
    }
    if (filters.godownQty.operator !== "any" && filters.godownQty.value !== "") {
      parts.push(`godown-${filters.godownQty.operator}-${filters.godownQty.value}`);
    }

    return parts.length > 0 ? parts.join("_") : "all";
  };

  const handlePriceSort = (field: "cost_price" | "overhead_expense" | "selling_price") => {
    setPriceSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { field, direction: "asc" };
    });
  };
  const isFilteredView = filteredProducts.length !== products.length;

  // Add this state to track which product is being edited
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<any>(null);

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isAddToCartModalOpen, setIsAddToCartModalOpen] = useState(false);
  const [cartDrafts, setCartDrafts] = useState<Record<string, { qty: number; room: string; customRoom?: string }>>({});
  const roomOptions = ["None", "Living Room", "Bedroom", "Kitchen", "Dining", "Outdoor", "Custom"];
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

  // 1. Updated Financial Logic (CP + OH)
  const totalValue = summary?.total_investment ?? 0;

  // 2. Dead Stock Logic (>60 Days)
  const deadStockCount = summary?.dead_stock_count ?? 0;

  // 3. Storage Efficiency
  const godownRatio = summary?.godown_ratio ?? 0;

  // const toggleSelection = (productId: string) => {
  //   setPrintSelection(prev => {
  //     const newSelection = { ...prev };
  //     if (newSelection[productId]) delete newSelection[productId];
  //     else newSelection[productId] = 1;
  //     return newSelection;
  //   });
  // };

  const toggleSelection = (product: ExtendedProduct, isChecked: boolean) => {
    setPrintSelection(prev => {
      const newSelection = { ...prev };
      if (isChecked) {
        newSelection[product.id] = 1; // Tracks selection state
        setSelectedProductDetails(prevDetails => ({ ...prevDetails, [product.id]: product }));
      } else {
        delete newSelection[product.id];
        setSelectedProductDetails(prevDetails => {
          const newDetails = { ...prevDetails };
          delete newDetails[product.id];
          return newDetails;
        });
      }
      return newSelection;
    });
  };

  // Inside your Inventory function in Inventory.tsx

const toggleAll = () => {
  // 1. Check if all currently filtered products are already selected
  const allFilteredSelected = productsMatchingCurrentFilters.length > 0 && 
    sortedProducts.every(p => !!printSelection[p.id]);

  if (allFilteredSelected) {
    // 2. If all are selected, clear the selection for ONLY THESE visible items
    setPrintSelection(prev => {
      const newSelection = { ...prev };
      productsMatchingCurrentFilters.forEach(p => {
        delete newSelection[p.id];
      });
      return newSelection;
    });
    setSelectedProductDetails(prev => {
      const newDetails = { ...prev };
      productsMatchingCurrentFilters.forEach(p => delete newDetails[p.id]);
      return newDetails;
    });
  } else {
    // 3. Otherwise, add all currently visible filtered products to the selection
    setPrintSelection(prev => {
      const newSelection = { ...prev };
      productsMatchingCurrentFilters.forEach(p => {
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

  const selectedProductsForCart = React.useMemo(
    () => Object.values(selectedProductDetails).filter(p => !!printSelection[p.id]),
    [selectedProductDetails, printSelection]
  );

  const openAddToCartModal = () => {
    const itemsForCart = selectedProductsForCart.map(p => {
      const draft = cartDrafts[p.id] || { qty: 1, room: "None", customRoom: "" };
      const resolvedRoom = draft.room === "Custom" ? (draft.customRoom || "").trim() : draft.room;
      return {
        product_id: p.id,
        quantity: draft.qty,
        attribute_metadata: [{ label: resolvedRoom, qty: draft.qty }]
      };
    });

    if (!activeCartId) {
      onRequireActiveCart?.(() => setIsAddToCartModalOpen(true), itemsForCart);
      return;
    }

    if (selectedProductsForCart.length === 0) {
      toast.error("Select at least one item to add to the cart.");
      return;
    }

    const seed: Record<string, { qty: number; room: string; customRoom?: string }> = {};
    selectedProductsForCart.forEach((p) => {
      seed[p.id] = {
        qty: cartDrafts[p.id]?.qty ?? 1,
        room: cartDrafts[p.id]?.room ?? "None",
        customRoom: cartDrafts[p.id]?.customRoom ?? "",
      };
    });
    setCartDrafts(seed);
    setIsAddToCartModalOpen(true);
    // This was the problem. It was being called immediately.
  };

  const updateCartDraft = (productId: string, patch: Partial<{ qty: number; room: string; customRoom?: string }>) => {
    setCartDrafts((prev) => ({
      ...prev,
      [productId]: {
        qty: prev[productId]?.qty ?? 1,
        room: prev[productId]?.room ?? "None",
        customRoom: prev[productId]?.customRoom ?? "",
        ...patch,
      },
    }));
  };

  const handleConfirmAddToCart = async () => {
    if (!onAddToCartFromInventory) return;
    const lines = selectedProductsForCart
      .map((p) => ({ product: p, draft: cartDrafts[p.id] || { qty: 1, room: "None", customRoom: "" } }))
      .filter((row) => row.draft.qty > 0);

    if (lines.length === 0) {
      toast.error("Please enter quantity greater than 0.");
      return;
    }

    const stockError = lines.find(({ product, draft }) => draft.qty > (product.displayStock + product.godownStock));
    if (stockError) {
      toast.error(`Qty exceeds stock for ${stockError.product.barcode}.`);
      return;
    }

    const customRoomError = lines.find(
      ({ draft }) => draft.room === "Custom" && !(draft.customRoom || "").trim()
    );
    if (customRoomError) {
      toast.error("Please enter custom room for selected item(s).");
      return;
    }

    let successCount = 0;
    let failCount = 0;
    for (const row of lines) {
      try {
        const resolvedRoom = row.draft.room === "Custom" ? (row.draft.customRoom || "").trim() : row.draft.room;
        await onAddToCartFromInventory(row.product, row.draft.qty, resolvedRoom);
        successCount += 1;
      } catch {
        failCount += 1;
      }
    }

    if (successCount > 0) {
      toast.success(`Added ${successCount} item line(s) to ${activeCartLabel || "active cart"}.`);
      setPrintSelection({});
    }
    if (failCount > 0) {
      toast.error(`${failCount} item line(s) failed to add.`);
    }
    if (failCount === 0) {
      setIsAddToCartModalOpen(false);
    }
  };


  return (
    <div className="space-y-4">
      {/* Optimized Retail Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Investment</CardTitle>
            <span className="text-gray-400 font-bold">₹</span>
          </CardHeader>
          <CardContent className="pt-0 pb-4"><div className="text-2xl font-bold text-slate-900">₹{totalValue.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">{"Dead Stock (>60d)"}</CardTitle>
            <AlertTriangle className="size-4 text-red-500" />
          </CardHeader>
          <CardContent className="pt-0 pb-4"><div className="text-2xl font-bold text-slate-900">{deadStockCount} <small className="text-xs font-normal text-gray-400">Items</small></div></CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">Godown Ratio</CardTitle>
            <Package className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent className="pt-0 pb-4"><div className="text-2xl font-bold text-slate-900">{godownRatio}% <small className="text-xs font-normal text-gray-400">of Stock</small></div></CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold tracking-tight">Inventory</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={selectedProductsForCart.length === 0}
                onClick={openAddToCartModal}
              >
                Add {selectedProductsForCart.length} To Cart
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
              <Button
                variant="outline"
                onClick={() => onGenerateCatalogPdf?.(sortedProducts, getCatalogFilterLabel())}
              >
                Catalog PDF
              </Button>
            </div>
          </div>
         <div className="flex flex-wrap gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg items-end">
          {/* NEW: Fuzzy Item Code Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Search Item Code</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <Input
                placeholder="Search item code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs bg-white"
              />
            </div>
          </div>
          {/* 1. Category Filter (Restored) */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-8 px-2 border rounded-md text-xs bg-white min-w-[120px]"
            >
              {categoryFilterOptions.map((cat) => (
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

        <CardContent className="p-0">
            <div className="px-6 pt-0 pb-3 text-xs text-slate-500">
              Showing {sortedProducts.length} of {totalProducts ?? products.length} items
            </div>
            <div className="overflow-x-auto">
            <Table className="min-w-[1220px]">
              <TableHeader>
                <TableRow>
                  {/* <TableHead className="w-[40px]"><Checkbox /></TableHead> */}
                  <TableHead className="w-[40px]">
                    <Checkbox 
                      // Show as checked only if all visible items are selected
                      checked={productsMatchingCurrentFilters.length > 0 && productsMatchingCurrentFilters.every(p => !!printSelection[p.id])}
                      onCheckedChange={toggleAll}
                      className="translate-y-[2px]"
                    />
                  </TableHead>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead className="w-[190px]">Item Details</TableHead>
                  <TableHead className="w-[190px]">Vendor</TableHead>
                  {/* NEW COLUMNS */}
                  <TableHead className="w-[120px] text-left">
                    <button
                      type="button"
                      onClick={() => handlePriceSort("cost_price")}
                      className="inline-flex items-center gap-1 text-left hover:text-slate-900"
                    >
                      Cost Price
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px] text-left">
                    <button
                      type="button"
                      onClick={() => handlePriceSort("overhead_expense")}
                      className="inline-flex items-center gap-1 text-left hover:text-slate-900"
                    >
                      Landing Price
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px] text-left">
                    <button
                      type="button"
                      onClick={() => handlePriceSort("selling_price")}
                      className="inline-flex items-center gap-1 text-left hover:text-slate-900"
                    >
                      Selling Price
                      <ArrowUpDown className="size-3 text-slate-400" />
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px]">Stock (D/G)</TableHead>
                  <TableHead className="w-[80px]">Aging</TableHead>
                  <TableHead className="w-[160px]">Remark</TableHead>
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
               <TableBody>
                  {sortedProducts.map((product) => {
                    const isEditing = editingId === product.id;
                    // Use buffer values if editing, otherwise use original product data
                    const data = isEditing ? editBuffer : product;
                    const resolvedPhotoUrl = isRenderableImageUrl(data?.photo_url) ? data.photo_url : "";
                    return (
                      // <TableRow 
                      //   key={product.id} 
                      //   className={`${printSelection[product.id] ? "bg-blue-50" : ""} ${isEditing ? "bg-blue-50/30 ring-1 ring-inset ring-blue-200" : ""}`}
                      // >
                      //   <TableCell>
                      //     <Checkbox checked={!!printSelection[product.id]} onCheckedChange={() => toggleSelection(product.id)}/>
                      //   </TableCell>

                      <TableRow 
                        key={product.id} 
                        className={`${printSelection[product.id] ? "bg-blue-50/60 font-medium" : ""} ${isEditing ? "bg-blue-50/30 ring-1 ring-inset ring-blue-200" : ""}`}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={!!printSelection[product.id]} 
                            onCheckedChange={(checked) => toggleSelection(product, checked)}
                            className="cursor-pointer"
                          />
                        </TableCell>
                        
                        {/* IMAGE: With edit overlay if active */}
                        <TableCell>
                          <div
                            className={`relative size-10 border rounded overflow-hidden group ${resolvedPhotoUrl ? "cursor-zoom-in" : ""}`}
                            onClick={() => {
                              if (!isEditing && resolvedPhotoUrl) {
                                setSelectedImage(resolvedPhotoUrl);
                              }
                            }}
                          >
                            {resolvedPhotoUrl ? (
                              <img src={resolvedPhotoUrl} alt={data.barcode} className="size-full object-contain" />
                            ) : (
                              <div className="size-full flex items-center justify-center bg-gray-50 text-[10px] text-gray-400">No Img</div>
                            )}
                            {isEditing && (
                              <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* <input 
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
                                /> */}
                                {isEditing && (
                                <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    className="hidden" 
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;

                                      try {
                                        // Provide visual feedback during network request
                                        toast.loading("Uploading product image...", { id: "table-image-upload" });

                                        // 1. Generate a structured, unique filename to avoid bucket collisions
                                        const timestamp = Date.now();
                                        const randomStr = Math.random().toString(36).substring(2, 8);
                                        const sanitizedName = file.name
                                          .replace(/[^a-zA-Z0-9.-]/g, '-')
                                          .replace(/-+/g, '-')
                                          .toLowerCase();
                                        const fileName = `product-${timestamp}-${randomStr}-${sanitizedName}`;

                                        // 2. Upload raw file binary to your public bucket asset folder
                                        const { data: uploadData, error: uploadError } = await supabase.storage
                                          .from('product-images')
                                          .upload(fileName, file);

                                        if (uploadError) throw uploadError;

                                        // 3. Request the static CDN web path link pointing to the asset
                                        const { data: publicUrlData } = supabase.storage
                                          .from('product-images')
                                          .getPublicUrl(fileName);

                                        const publicUrl = publicUrlData.publicUrl;

                                        // 4. Update the row snapshot buffer with the clean URL string
                                        setEditBuffer({ 
                                          ...editBuffer, 
                                          photo_url: publicUrl 
                                        });

                                        toast.success("Image uploaded successfully", { id: "table-image-upload" });
                                      } catch (error: any) {
                                        console.error("Table image upload error details:", error);
                                        toast.error(error.message || "Failed to upload image", { id: "table-image-upload" });
                                      }
                                    }} 
                                  />
                                  <span className="text-[8px] text-white font-bold">CHANGE</span>
                                </label>
                              )}
                                <span className="text-[8px] text-white font-bold">CHANGE</span>
                              </label>
                            )}
                          </div>
                        </TableCell>

                        {/* ITEM DETAILS: Inline Inputs */}
                        <TableCell className="w-[190px] pl-4">
                          <div className="flex flex-col gap-1">
                            {isEditing ? (
                              <>
                                <Input 
                                  className="h-7 text-xs font-mono font-bold" 
                                  value={data.barcode} 
                                  onChange={(e) => setEditBuffer({ ...data, barcode: e.target.value })} 
                                />
                                <select
                                  className="h-6 text-[10px] uppercase border rounded px-1 bg-white"
                                  value={data.category || ""}
                                  onChange={(e) => setEditBuffer({ ...data, category: e.target.value })}
                                >
                                  {categories
                                    .filter((cat) => cat !== "all")
                                    .map((cat) => (
                                      <option key={cat} value={cat}>
                                        {cat}
                                      </option>
                                    ))}
                                </select>
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-xs font-bold">{product.barcode}</span>
                                <span className="text-[10px] text-gray-400 uppercase">{product.category}</span>
                              </>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="w-[190px]">
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
                        <TableCell className="text-left">
                          {isEditing ? (
                            <div className="flex items-center justify-start gap-1">
                              <span className="text-gray-400 text-[10px]">₹</span>
                              <Input 
                                type="number" 
                                className="h-7 w-20 text-xs text-left pl-1 font-mono" 
                                value={data.cost_price === 0 ? "" : data.cost_price} 
                                //onChange={(e) => setEditBuffer({ ...data, cost_price: Number(e.target.value) })} 
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") {
                                  // Allow empty input while typing
                                  setEditBuffer({ ...data, cost_price: 0, overhead_expense: 0, selling_price: 0 });
                                  return;
                                }
                                const baseCost = Number(val);
                                const landingPrice = baseCost * 1.10; // Auto-calculate 5% overhead
                                const sellingPrice = landingPrice * 3; // Auto-calculate 3x margin
                                
                                setEditBuffer({ 
                                  ...data, 
                                  cost_price: baseCost,
                                  overhead_expense: Math.round(landingPrice * 100) / 100, // Round to 2 decimals
                                  selling_price: Math.round(sellingPrice) // Round to nearest whole number
                                });
                              }}
                            />
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-gray-600">₹{product.cost_price?.toLocaleString() || "-"}</span>
                          )}
                        </TableCell>

                        <TableCell className="text-left">
                          {isEditing ? (
                            <div className="flex items-center justify-start gap-1">
                              <span className="text-gray-400 text-[10px]">₹</span>
                              <Input 
                                type="number" 
                                className="h-7 w-20 text-xs text-left pl-1 font-mono" 
                                value={data.overhead_expense === 0 ? "" : data.overhead_expense}
                                //onChange={(e) => setEditBuffer({ ...data, overhead_expense: Number(e.target.value) })} 
                              onChange={(e) => {
                                const val = e.target.value;
                              
                                // 2. If user clears the field, set values to 0 but display as empty
                                if (val === "") {
                                  setEditBuffer({ 
                                    ...data, 
                                    overhead_expense: 0, 
                                    selling_price: 0 
                                  });
                                  return;
                                }
                                const manualLanding = Number(val);
                                setEditBuffer({ 
                                  ...data, 
                                  overhead_expense: manualLanding,
                                  selling_price: Math.round(manualLanding * 3) // Selling price still follows the rule
                                });
                              }} 
                              onFocus={(e) => e.target.select()} // Highlight on click
                            />
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-gray-600">₹{product.overhead_expense?.toLocaleString() || "-"}</span>
                          )}
                        </TableCell>

                        <TableCell className="text-left">
                          {isEditing ? (
                            <div className="flex items-center justify-start gap-1">
                              <span className="text-gray-400 text-[10px]">₹</span>
                              {/* <Input 
                                type="number" 
                                className="h-7 w-20 text-xs text-left pl-1 font-mono" 
                                value={data.selling_price} 
                                onChange={(e) => setEditBuffer({ ...data, selling_price: Number(e.target.value) })} 
                                //onChange={(e) => setEditBuffer({ ...data, selling_price: Number(e.target.value) })} 
                                //readOnly // Implementation of "not allowed" requirement
                                tabIndex={-1}
                              /> */}
                              <Input 
                                type="number" 
                                className="h-7 w-20 text-xs text-left pl-1 font-mono font-bold text-blue-600 bg-white" 
                                value={data.selling_price === 0 ? "" : data.selling_price} // Empty string intercept fallback
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "") {
                                    setEditBuffer({ ...data, selling_price: 0 });
                                    return;
                                  }
                                  setEditBuffer({ ...data, selling_price: Number(val) }); // Saves your custom manual pricing
                                }}
                                onFocus={(e) => e.target.select()} // Highlight on click
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-gray-600">₹{product.selling_price?.toLocaleString() || "-"}</span>
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
                                    const matchedCategory = categoryOptions.find(
                                      (c) => c.name === data.category
                                    );
                                    const payload = {
                                      ...data,
                                      category_id: matchedCategory?.id || null,
                                    };
                                    // 1. Send data to your API
                                    await onUpdateInventory(payload); 
                                    
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
                            <div className="flex items-center justify-end gap-0">
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
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="size-8 hover:bg-red-50"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Are you sure you want to delete ${product.barcode}? This action cannot be undone.`)) {
                                    await onDeleteItem?.(product.id);
                                  }
                                }}
                              >
                                <Trash2 className="size-3.5 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
            </Table>
          </div>
          {hasMoreProducts && (
            <div className="flex justify-center p-4">
              <Button
                onClick={async () => {
                  setIsLoadingMore(true);
                  try {
                    await onLoadMore?.();
                  } finally {
                    setIsLoadingMore(false);
                  }
                }}
                disabled={isLoadingMore}
                variant="outline"
                className="w-full max-w-sm"
              >
                {isLoadingMore ? "Loading..." : "Load More Products"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    {/* The Printing Factory: Optimized to match your printSelection state */}
      <div 
        id="hidden-print-factory" 
        style={{ position: 'absolute', left: '-9999px', top: 0, opacity: 0 }}
      >
        {Object.values(selectedProductDetails).filter(p => printSelection[p.id]).map((product) => {
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
                          className="w-full h-10 px-3 text-right outline-none font-mono font-bold text-gray-700" 
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
      <Dialog open={isAddToCartModalOpen} onOpenChange={setIsAddToCartModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b bg-slate-50/70">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <ShoppingCart className="size-4 text-blue-600" />
              Add To Cart
            </DialogTitle>
            <p className="text-xs text-slate-600">
              Active cart: <span className="font-semibold">{activeCartLabel || "Not selected"}</span>
              {" · "}
              {selectedProductsForCart.length} item{selectedProductsForCart.length > 1 ? "s" : ""} selected
            </p>
          </DialogHeader>
          <div className="max-h-[62vh] overflow-y-auto divide-y">
            {selectedProductsForCart.map((p) => {
              const draft = cartDrafts[p.id] || { qty: 1, room: "None", customRoom: "" };
              const available = p.displayStock + p.godownStock;
              const safePhotoUrl = isRenderableImageUrl(p.photo_url) ? p.photo_url : "";
              return (
                <div key={p.id} className="px-5 py-4 bg-white space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="size-16 min-w-16 rounded-md border bg-slate-50 overflow-hidden flex items-center justify-center">
                      {safePhotoUrl ? (
                        <img
                          src={safePhotoUrl}
                          alt={p.name}
                          className="size-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">No Image</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name || p.barcode}</p>
                      <p className="text-[11px] font-mono text-blue-700 mt-0.5">#{p.barcode}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-slate-900">
                          Rs {Number(p.selling_price || p.price || 0).toFixed(0)}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          D:{p.displayStock} · G:{p.godownStock} · Avl:{available}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] tracking-wide uppercase font-semibold text-slate-500">Assign Room</span>
                      <Badge variant="secondary" className="text-[10px] h-5 px-2">
                        {draft.room === "Custom" ? (draft.customRoom?.trim() || "Custom") : draft.room}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {roomOptions.map((room) => (
                        room === "Custom" ? (
                          <div
                            key={room}
                            className={`rounded-full border transition-colors ${
                              draft.room === "Custom"
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-600 border-slate-300 hover:border-blue-300"
                            }`}
                            onClick={() => {
                              if (draft.room !== "Custom") {
                                updateCartDraft(p.id, { room: "Custom", customRoom: "" });
                              }
                            }}
                          >
                            {draft.room === "Custom" ? (
                              <input
                                autoFocus
                                placeholder="Custom..."
                                value={draft.customRoom || ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateCartDraft(p.id, { customRoom: e.target.value })}
                                className="h-7 w-24 px-2.5 rounded-full bg-transparent text-[11px] text-white placeholder:text-blue-100 outline-none"
                              />
                            ) : (
                              <button
                                key={room}
                                type="button"
                                onClick={() => updateCartDraft(p.id, { room: "Custom", customRoom: "" })}
                                className="px-2.5 py-1 rounded-full text-[11px]"
                              >
                                Custom
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            key={room}
                            type="button"
                            onClick={() =>
                              updateCartDraft(p.id, {
                                room,
                                customRoom: "",
                              })
                            }
                            className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                              draft.room === room
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-600 border-slate-300 hover:border-blue-300"
                            }`}
                          >
                            {room}
                          </button>
                        )
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-wide uppercase font-semibold text-slate-500">Quantity</span>
                    <div className="inline-flex items-center border rounded-md bg-white overflow-hidden">
                      <button
                        className="h-8 w-8 inline-flex items-center justify-center hover:bg-slate-100"
                        onClick={() => updateCartDraft(p.id, { qty: Math.max(0, draft.qty - 1) })}
                        type="button"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <Input
                        type="number"
                        value={draft.qty}
                        min={0}
                        className="w-14 h-8 text-center border-0 rounded-none"
                        onChange={(e) => updateCartDraft(p.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
                      />
                      <button
                        className="h-8 w-8 inline-flex items-center justify-center hover:bg-slate-100"
                        onClick={() => updateCartDraft(p.id, { qty: draft.qty + 1 })}
                        type="button"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="border-t px-5 py-4 bg-slate-50/80">
            <Button variant="outline" onClick={() => setIsAddToCartModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAddToCart} className="min-w-40">
              <ShoppingCart className="size-4 mr-2" />
              Add To Cart
            </Button>
          </DialogFooter>
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
