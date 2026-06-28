import { useState, useEffect, useRef, useCallback } from "react";
import { ShoppingCart, Package, FileText, Scan, FileCheck, Home} from "lucide-react";
import { Scanner, Product } from "./components/Scanner";
import { Inventory, ExtendedProduct, InventoryFilterState } from "./components/Inventory";
import { Orders, Order } from "./components/Orders";
import { Cart, CartItem } from "./components/Cart";
import { CartManager, ClientCart } from "./components/CartManager";
import { ProformaInvoices, ProformaInvoice, PrintLayout, PrintDocumentType } from "./components/ProformaInvoices";
import { History, AuditEvent } from "./components/History";
import { Dashboard, DashboardStats } from "./components/Dashboard";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Session } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { GlobalLoader } from "./components/Loader"; 
import { supabase } from "./lib/supabaseClient"; // Ensure you have this file
import LoginForm from "./components/auth/LoginForm";
import HomeScreen from "./components/HomeScreen";
import { Label } from "./components/ui/label";
// 1. Hardcode your preferred Shop ID here for now
const PRESELECTED_SHOP_ID = "102e6445-6462-4cb6-bcbf-e9dd43a70b7e";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const DEFAULT_INVENTORY_FILTERS: InventoryFilterState = {
  searchTerm: "",
  category: "all",
  vendor: "all",
  displayQty: { operator: "any", value: "" },
  godownQty: { operator: "any", value: "" },
};

type View = "home" | "scanner" | "inventory" | "orders" | "cart" | "proforma" | "history" | "dashboard" | "login";

export default function App() {
  const isRenderableImageUrl = (url?: string | null) =>
    !!url &&
    (url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("data:image/") ||
      url.startsWith("blob:"));
  const [clientCarts, setClientCarts] = useState<ClientCart[]>([]);
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryPagination, setInventoryPagination] = useState({ total: 0, skip: 0, limit: 20, hasMore: false });
  const [inventoryFilters, setInventoryFilters] = useState<InventoryFilterState>(DEFAULT_INVENTORY_FILTERS);
  const [searchResult, setSearchResult] = useState<Product | null>(null);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<number>(1); // New state
  const [pendingAttribute, setPendingAttribute] = useState<string>("None");
  const [pendingCartItems, setPendingCartItems] = useState<PendingCartItem[] | null>(null);
  const [pendingContinuation, setPendingContinuation] = useState<(() => void) | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [editingPI, setEditingPI] = useState<ProformaInvoice | null>(null);
  const proformaOrders = orders.filter(o => o.status === 'pi');
  const [isLoading, setIsLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentView, setCurrentView] = useState<View>("login");
  const [activeCartLoaded, setActiveCartLoaded] = useState(false);
  const [clientPhone, setClientPhone] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const bootstrapDoneRef = useRef(false);
  const [inventoryReady, setInventoryReady] = useState(false);
  const [orderSummary, setOrderSummary] = useState({
    totalRevenue: 0,
    totalReceived: 0,
    totalDue: 0,
    totalWriteOff: 0,
    estimatedProfit: 0,
  });
  const cartDraftRef = useRef<Record<string, { discount?: number; extraDiscount?: number; tax?: number }>>({});
  const [showPIPreview, setShowPIPreview] = useState(false);
  const [piPreviewUrl, setPiPreviewUrl] = useState<string | null>(null);
  const [piPreviewData, setPiPreviewData] = useState<ProformaInvoice | null>(null);
  const [previewDocType, setPreviewDocType] = useState<PrintDocumentType>("PI");
  const [pendingSellContext, setPendingSellContext] = useState<{
    orderId: string;
    payload: {
      order_id: string;
      discount_percent: number;
      tax_percent: number;
      extra_discount_amount: number;
      paid_amount: number;
      referral_source: string;
      delivery_address: string;
      client_phone: string;
    };
  } | null>(null);
  const [isConfirmingSell, setIsConfirmingSell] = useState(false);
  const [pendingPIContext, setPendingPIContext] = useState<{
    orderId: string;
    payload: {
      order_id: string;
      status: string;
      discount_percent: number;
      tax_percent: number;
      extra_discount_amount: number;
      paid_amount: number;
      referral_source: string;
      delivery_address: string;
      client_phone: string;
    };
  } | null>(null);
  const [isConfirmingPI, setIsConfirmingPI] = useState(false);
  const previewPdfUrlRef = useRef<string | null>(null);

  const activeCart = clientCarts.find((cart) => cart.id === activeCartId);
  const [autoDownloadPIId, setAutoDownloadPIId] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditEntityType, setAuditEntityType] = useState<string>("all");
  const [auditLoading, setAuditLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const inventoryRequestIdRef = useRef(0);

  const viewRef = useRef(currentView);


useEffect(() => {
  if (currentView === "history") {
    handleLoadAuditEvents(auditEntityType);
  }
}, [currentView]);



useEffect(() => {
  const handleSecretShortcut = (e: KeyboardEvent) => {
    // Secret combination: Ctrl + Shift + A
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setCurrentView("dashboard");
      toast.success("Welcome to hidden admin dashboard!");
    }
  };

  window.addEventListener("keydown", handleSecretShortcut);
  return () => window.removeEventListener("keydown", handleSecretShortcut);
}, []);

//chatgpt
useEffect(() => {
  const checkInitialSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    } catch (error) {
      console.error("Error checking session:", error);
    } finally {
      setInitializing(false);
    }
  };

  checkInitialSession();

  const { data: { subscription } } =
    supabase.auth.onAuthStateChange(
      (_event, newSession: Session | null) => {
        setSession((prev: Session | null) => {
          if (prev?.access_token === newSession?.access_token) {
            return prev; // prevent useless rerender
          }
          return newSession;
        });

        // 3. Update the Auth Listener to check the REF, not the STATE
        if (newSession && viewRef.current === "login") {
          setCurrentView("home");
        }
      }
    );

  return () => subscription.unsubscribe();
}, []);

useEffect(() => {
  viewRef.current = currentView;
}, [currentView]);

useEffect(() => {
  return () => {
    if (previewPdfUrlRef.current) {
      URL.revokeObjectURL(previewPdfUrlRef.current);
    }
  };
}, []);


  useEffect(() => {
    if (!session) return;
    if (bootstrapDoneRef.current) return;

    bootstrapDoneRef.current = true;

    const bootstrap = async () => {
      await handleLoadInventory();
      setInventoryReady(true);
    };

    bootstrap();
  }, [session]);

  useEffect(() => {
  if (!session) return;

  const loadViewData = async () => {
    try {
      switch (currentView) {

        case "cart":
          if (!activeCartLoaded) {
            await handleLoadActiveCarts();
          }
          break;

        case "proforma":
          await handleLoadProformaInvoices();
          break;

        case "orders":
          await handleLoadOrders();
          break;

        case "dashboard":
          await handleLoadDashboard();
          break;
      }
    } catch (error) {
      console.error("View data load failed:", error);
    }
  };

  // reset scanner UI when navigating
  setSearchResult(null);
  setPendingQuantity(1);
  setNewClientName("");

  loadViewData();

}, [currentView]);


  const apiCall = async (
    url: string,
    options?: RequestInit,
    config?: { suppressToast?: boolean }
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData?.detail;
        const status = response.status;
        const statusText = response.statusText || "Request failed";
        // Prioritize the backend's 'detail' message for user-facing errors.
        // Fallback to the full status text for other errors.
        const message = detail || `${status} ${statusText}`;
        throw new Error(message);
      }
      return await response.json(); 
    } catch (error: any) {
      if (!config?.suppressToast) {
        const fallback = "Something went wrong";
        toast.error(error?.message ? String(error.message) : fallback);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRoundedBilling = (
    subtotal: number,
    discountPercent: number,
    taxPercent: number,
    extraDiscountAmount: number = 0
  ) => {
    const safeSubtotal = Number(subtotal) || 0;
    const safeDiscount = Number(discountPercent) || 0;
    const safeTax = Number(taxPercent) || 0;
    const safeExtraDiscount = Math.max(0, Math.floor(Number(extraDiscountAmount) || 0));

    const discountAmount = Math.floor(safeSubtotal * (safeDiscount / 100));
    const clampedExtraDiscount = Math.min(safeExtraDiscount, Math.max(0, Math.floor(safeSubtotal) - discountAmount));
    const taxableAmount = Math.max(0, safeSubtotal - discountAmount - clampedExtraDiscount);
    const taxAmount = Math.ceil(taxableAmount * (safeTax / 100));
    const finalTotal = taxableAmount + taxAmount;

    return { discountAmount, extraDiscountAmount: clampedExtraDiscount, taxAmount, finalTotal };
  };

  // Inside App.tsx
  const handleUpdateInventory = async (updatedProduct: any) => {
    const original = products.find(p => p.id === updatedProduct.id);
    if (!original) return;

    const patchPayload: any = {};
    
    if (updatedProduct.barcode !== original.barcode) patchPayload.item_code = updatedProduct.barcode;
    if (updatedProduct.selling_price !== original.selling_price) patchPayload.selling_price = updatedProduct.selling_price;
    if (updatedProduct.cost_price !== original.cost_price) patchPayload.cost_price = updatedProduct.cost_price;
    if (updatedProduct.overhead_expense !== original.overhead_expense) patchPayload.overhead_expense = updatedProduct.overhead_expense;
    if (updatedProduct.vendor !== original.vendor) patchPayload.vendor_name = updatedProduct.vendor;
    if (updatedProduct.photo_url !== original.photo_url) patchPayload.photo_url = updatedProduct.photo_url;
    if (updatedProduct.displayStock !== original.displayStock) patchPayload.qty_display = updatedProduct.displayStock;
    if (updatedProduct.godownStock !== original.godownStock) patchPayload.qty_godown = updatedProduct.godownStock;
    if (updatedProduct.remark !== original.remark) patchPayload.remark = updatedProduct.remark;
    if (updatedProduct.category !== original.category && updatedProduct.category_id) {
      patchPayload.category_id = updatedProduct.category_id;
    }

    if (Object.keys(patchPayload).length === 0) return;

    try {
      await apiCall(
        `${API_BASE_URL}/inventory/${updatedProduct.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchPayload),
        },
        { suppressToast: true }
      );

      // Sync the global state
      setProducts(prev => prev.map(p => 
        p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p
      ));
      
      toast.success("Inventory updated");
    } catch (error) {
      toast.error("Failed to save changes");
    }
  };

const handleBulkAdd = async (newItems: any[]) => {
  try {
    // Transform rows for the backend
    const payload = newItems.map(item => ({
      shop_id: PRESELECTED_SHOP_ID,
      // item.category_id already contains the UUID from the dropdown
      category_id: item.category_id || null, 
      item_code: item.item_code,
      image_url: item.photo_url || "",
      cost_price: parseFloat(item.cost_price) || 0,
      overhead: parseFloat(item.overhead) || 0,
      unit_price: parseFloat(item.unit_price) || 0,
      vendor_name: item.vendor_name || "",
      display_qty: parseInt(item.display_qty) || 0,
      godown_qty: parseInt(item.godown_qty) || 0
    }));

    const response = await fetch(`${API_BASE_URL}/inventory/bulk-add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Server Error Detail:", errorData.detail);
      throw new Error("Bulk add failed");
    }

    toast.success("Inventory synced successfully!");
    handleLoadInventory(); // Refresh the main list
  } catch (error) {
    console.error(error);
    toast.error("Failed to sync inventory.");
  }
};

  const handleLoadInventory = useCallback(async (skip: number = 0, filtersOverride?: InventoryFilterState) => {
    const activeFilters = filtersOverride ?? inventoryFilters;
    const params = new URLSearchParams({
      skip: String(skip),
      limit: "20",
    });

    const activeSearch = activeFilters.searchTerm.trim();
    if (activeSearch) {
      params.set("search", activeSearch);
    }

    if (activeFilters.category !== "all") {
      params.set("category", activeFilters.category);
    }

    if (activeFilters.vendor !== "all") {
      params.set("vendor", activeFilters.vendor);
    }

    if (activeFilters.displayQty.operator !== "any" && activeFilters.displayQty.value !== "") {
      params.set("display_qty_operator", activeFilters.displayQty.operator);
      params.set("display_qty_value", activeFilters.displayQty.value);
    }

    if (activeFilters.godownQty.operator !== "any" && activeFilters.godownQty.value !== "") {
      params.set("godown_qty_operator", activeFilters.godownQty.operator);
      params.set("godown_qty_value", activeFilters.godownQty.value);
    }

    const requestId = ++inventoryRequestIdRef.current;
    const data = await apiCall(`${API_BASE_URL}/inventory/${PRESELECTED_SHOP_ID}?${params.toString()}`);

    if (requestId !== inventoryRequestIdRef.current) return;
    
    // Handle both old format (array) and new format (paginated object)
    const items = Array.isArray(data) ? data : data.data || [];
    const paginationInfo = Array.isArray(data) ? { total: items.length, skip: 0, limit: 20, hasMore: false } : data;
    
    const mappedProducts = items.map((item: any) => ({
      id: item.id,
      barcode: item.item_code,
      vendor: item.vendor_name || "-",
      price: item.selling_price,
      // Exact mapping from your API response
      costPrice: item.cost_price || 0,
      overheadPrice: item.overhead_expense || 0,
      remark: item.remark || "-", 
      displayStock: item.qty_display || 0,
      godownStock: item.qty_godown || 0,
      stock: (item.qty_display || 0) + (item.qty_godown || 0),
      category: item.category_name || "General",
      createdAt: item.created_at, 
      photo_url: item.photo_url,
      name: item.item_code,
      cost_price: item.cost_price || 0,
      overhead_expense: item.overhead_expense || 0,
      selling_price: item.selling_price || 0
    }));
    
    if (skip === 0) {
      // First page - replace products
      setProducts(mappedProducts);
    } else {
      // Subsequent pages - append products
      setProducts(prev => [...prev, ...mappedProducts]);
    }
    
    setInventoryPagination({
      total: paginationInfo.total,
      skip: paginationInfo.skip,
      limit: paginationInfo.limit,
      hasMore: paginationInfo.hasMore
    });
    setInventoryReady(true);
  }, [inventoryFilters]);

  const handleLoadMoreInventory = async () => {
    if (inventoryPagination.hasMore) {
      const nextSkip = inventoryPagination.skip + inventoryPagination.limit;
      await handleLoadInventory(nextSkip);
    }
  };

  const handleInventoryFiltersChange = useCallback(async (nextFilters: InventoryFilterState) => {
    if (JSON.stringify(nextFilters) === JSON.stringify(inventoryFilters)) return;

    setInventoryFilters(nextFilters);
    await handleLoadInventory(0, nextFilters);
  }, [handleLoadInventory, inventoryFilters]);

  // On-demand: Load active carts when button is clicked
  const handleLoadActiveCarts = async () => {
    try {
      // 1. Fetch all orders for this shop
      const allOrders = await apiCall(`${API_BASE_URL}/orders/list/${PRESELECTED_SHOP_ID}`);

      // 2. Filter for 'bucket' status (these are our active carts)
      const activeBuckets = allOrders.filter((o: any) => o.status === 'bucket');

      // 3. Fetch details for each active bucket
      const cartPromises = activeBuckets.map(async (order: any) => {
      const details = await apiCall(`${API_BASE_URL}/basket/details/${order.id}`);

        return {
          id: order.id,
          clientName: order.client_name,
          clientPhone: order.client_phone ?? details.client_phone ?? "",
          referralSource: order.referral_source ?? details.referral_source ?? "",
          deliveryAddress: order.delivery_address ?? details.delivery_address ?? "",
          createdAt: order.created_at,
          discount: order.discount_percent ?? 0,
          extraDiscount: order.extra_discount_amount ?? details.extra_discount_amount ?? 0,
          tax: order.tax_percent ?? 0,
          advancePaid: order.paid_amount ?? details.paid_amount ?? 0,
          // Map backend items to your CartItem interface
          items: details.order_items.map((item: any) => ({
            id: item.product_id,
            name: item.item_code,
            price: item.unit_price,
            quantity: item.quantity,
            stock: 999 // You may want to fetch actual stock separately or join it in the API
          }))
        };
      });

      const loadedCarts = await Promise.all(cartPromises);
      //setClientCarts(loadedCarts);
      setClientCarts((prev) => {
        // Keep carts that are NOT in the incoming 'loadedCarts' list to avoid duplicates
        const uniquePrev = prev.filter(p => !loadedCarts.some(l => l.id === p.id));
        return [...uniquePrev, ...loadedCarts];
      });
      setActiveCartLoaded(true);
    } catch (error) {
      console.error("Error loading active carts:", error);
    }
  };
  const handleLoadDashboard = async (force = false) => {
    try {
      const data = await apiCall(`${API_BASE_URL}/stats/dashboard/${PRESELECTED_SHOP_ID}`);
      setDashboardStats(data as DashboardStats);
      setDashboardLoaded(true);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    }
  };

  const handleLoadOrders = async (force = false) => {
    try {
      const [data, summary] = await Promise.all([
        apiCall(`${API_BASE_URL}/orders/list/${PRESELECTED_SHOP_ID}`),
        apiCall(`${API_BASE_URL}/orders/summary/${PRESELECTED_SHOP_ID}`),
      ]);
      
      const mappedOrders: Order[] = data.map((o: any) => ({
        id: o.id,
        orderNumber: o.id.slice(0, 8).toUpperCase(),
        customerName: o.client_name || "Unknown",
        total: o.final_total || 0,
        status: o.status,
        date: new Date(o.created_at).toLocaleDateString(),
        discount: o.discount_percent || 0,
        extra_discount_amount: o.extra_discount_amount || 0,
        items: [],
        paidAmount: o.paid_amount || 0,
        discount_amount: o.discount_amount || 0,
        tax_amount: o.tax_amount || 0,
        write_off_amount: o.write_off_amount || 0,
        write_off_notes: o.write_off_notes || ""
      }));
      
      setOrders(mappedOrders);
      setOrderSummary({
        totalRevenue: Number(summary.total_revenue) || 0,
        totalReceived: Number(summary.total_received) || 0,
        totalDue: Number(summary.total_due) || 0,
        totalWriteOff: Number(summary.total_write_off) || 0,
        estimatedProfit: Number(summary.estimated_profit) || 0,
      });
    } catch (error) {
      console.error("Failed to load orders:", error);
    }
  };

  // Fetch proforma invoices with status=pi filter from backend
  const handleLoadProformaInvoices = async () => {
    try {
      const data = await apiCall(`${API_BASE_URL}/orders/list/${PRESELECTED_SHOP_ID}?status=pi`);
      
      const mappedOrders: Order[] = data.map((o: any) => ({
        id: o.id,
        orderNumber: o.id.slice(0, 8).toUpperCase(),
        customerName: o.client_name || "Unknown",
        total: o.final_total || 0,
        paidAmount: o.paid_amount || 0,
        status: o.status,
        date: new Date(o.created_at).toLocaleDateString(),
        discount: o.discount_percent || 0,
        extra_discount_amount: o.extra_discount_amount || 0,
        discount_amount: o.discount_amount || 0,
        tax_amount: o.tax_amount || 0,
        items: []
      }));
      
      setOrders(mappedOrders);
    } catch (error) {
      console.error("Failed to load proforma invoices:", error);
    }
  };

  const handleProductSearch = async (code: string) => {
    if (!inventoryReady) return;   
    if (!code.trim()) return;
    // PREVENT LOOP: Don't search if the result is already for this code
    if (searchResult && searchResult.barcode === code) return;
    try {
      // apiCall triggers the GlobalLoader automatically
      const item = await apiCall(`${API_BASE_URL}/product/by-code?item_code=${encodeURIComponent(code)}`);
      
      if (item && !item.error) {
        const foundProduct: Product = {
          id: item.id,
          barcode: item.item_code,
          name: item.item_code,
          vendor: item.vendor_name || "-",
          price: item.selling_price,
          displayStock: item.qty_display || 0, // Added
          godownStock: item.qty_godown || 0,   // Added
          stock: (item.qty_display || 0) + (item.qty_godown || 0),
          category: item.category_name || "General", // Added
          photo_url: item.photo_url,
          cost_price: item.cost_price || 0,
          selling_price: item.selling_price || 0
        };
        
        setSearchResult(foundProduct);
      } else {
        toast.error(`Product ${code} not found`);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

const handleAddToCart = async (product: Product, quantity: number = 1, attribute: string = "None") => {
    if (!product) return;

    if (!attribute) {
      toast.error("Please select a room/location");
      return;
    }  
  
  // 1. If no active cart, show dialog to select or create cart
    if (!activeCartId) {
      setPendingProduct(product);
      setPendingQuantity(quantity); 
      setPendingAttribute(attribute); // Ensure this state is defined in App.tsx
      setShowClientDialog(true);
      return;
    }

    try {
      // Find existing item to get current metadata for merging
      const currentCart = clientCarts.find(c => c.id === activeCartId);
      const existingItem = currentCart?.items.find(i => i.id === product.id);
      
      // LOGIC: Prepare the JSON metadata
      let metadata = [...(existingItem?.attribute_metadata || [])];
      const existingAttrIndex = metadata.findIndex(m => m.label === attribute);

      if (existingAttrIndex > -1) {
        metadata[existingAttrIndex].qty += quantity; // SOP: Merge (e.g., 2 + 1 = 3)
      } else {
        metadata.push({ label: attribute, qty: quantity }); // SOP: New location entry
      }

      // 2. Prepare the payload for your correct /basket/add endpoint
      const payload = {
        order_id: activeCartId,
        product_id: product.id,
        qty: quantity, // The backend likely handles the increment, but we send the change
        attribute_metadata: metadata // We pass the updated breakdown here
      };

      await apiCall(`${API_BASE_URL}/basket/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // 3. Update local UI state
      setClientCarts((prev) =>
        prev.map((cart) => {
          if (cart.id !== activeCartId) return cart;
          
          const existing = cart.items.find((item) => item.id === product.id);
          if (existing) {
            return {
              ...cart,
              items: cart.items.map((item) =>
                item.id === product.id 
                  ? { ...item, quantity: item.quantity + quantity, attribute_metadata: metadata } 
                  : item
              ),
            };
          } else {
            return {
              ...cart,
              items: [
                ...cart.items, 
                { 
                  id: product.id, 
                  name: product.name, 
                  price: product.price, 
                  quantity: quantity, 
                  stock: product.stock,
                  attribute_metadata: metadata 
                }
              ],
            };
          }
        })
      );
      
      toast.success(`Added ${quantity} units to ${attribute}`);
      setSearchResult(null);      
      setPendingQuantity(1);      

    } catch (error) {
      console.error("Cart API Error:", error);
      toast.error("Could not sync with server");
    }
  };

  const handleCreateCart = async (clientName: string) => {
    try {
      const data = await apiCall(`${API_BASE_URL}/basket/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: PRESELECTED_SHOP_ID,
          client_name: clientName,
          client_phone: clientPhone || null,        // Match interface
          referral_source: referralSource,  // Match interface
          delivery_address: deliveryAddress || null
        }),
      });

      const newCart: ClientCart = {
        id: data.order_id,
        clientName: data.client_name,
        clientPhone: clientPhone,
        referralSource: referralSource,
        deliveryAddress: deliveryAddress || "",
        items: [], // Items will be fetched on next view or interaction
        createdAt: new Date().toISOString(),
        discount: 0, 
        extraDiscount: 0,
        tax: 0
      };

      setClientCarts((prev) => [...prev, newCart]);
      setActiveCartId(data.order_id);
      setClientPhone("");
      setReferralSource("");
      setDeliveryAddress("");
      setSearchResult(null);
      setPendingProduct(null);
      setPendingAttribute("None");
      setShowClientDialog(false); // Close the dialog
      
      toast.success(`Session started for ${clientName}.`);

      if (pendingContinuation) {
        pendingContinuation();
        setPendingContinuation(null);
      }
      
    }
 catch (error) {
      console.error("Cart creation failed:", error);
    }
};

  const handleSelectExistingCart = (cartId: string) => {
    setActiveCartId(cartId);
    setShowClientDialog(false);

    if (pendingContinuation) {
      pendingContinuation();
      setPendingContinuation(null);
    } else if (pendingProduct) {
      handleAddToCart(pendingProduct, pendingQuantity, pendingAttribute);
    }
  };

  const handleCreateNewCartFromDialog = () => {
    if (newClientName.trim()) {
      handleCreateCart(newClientName.trim());
      setNewClientName("");
      setShowClientDialog(false);
    }
  };

  const handleSelectCart = (cartId: string) => {
    setActiveCartId(cartId);
    setCurrentView("cart");
  };

  // Update handleCloseCart in App.tsx
  const handleCloseCart = async (cartId: string) => {
    try {
      // apiCall automatically shows the loader and handles error toasts
      await apiCall(`${API_BASE_URL}/order/delete/${cartId}`, {
        method: "DELETE"
      });
      
      // If we reach this line, the request was successful
      setClientCarts((prev) => prev.filter((cart) => cart.id !== cartId));
      if (activeCartId === cartId) setActiveCartId(null);
      toast.info("Cart deleted from database");
      
    } catch (error) {
      // The specific error toast is already shown by apiCall, 
      // but you can log it here for debugging if needed
      console.error("Delete failed:", error);
    }
  };

    // Inside src/App.tsx
    const handleUpdateQuantity = async (productId: string, newQuantity: number) => {
    if (!activeCartId) return;

    // Find the current quantity in the local state to calculate the "change"
    const currentCart = clientCarts.find(c => c.id === activeCartId);
    const item = currentCart?.items.find(i => i.id === productId);
    if (!item) return;

    // 2. Find the product in master list to check available stock
    const product = products.find(p => p.id === productId);
    const totalAvailableStock = product ? (product.displayStock + product.godownStock) : 0;

    // 3. Validation: Prevent increasing quantity beyond total stock
    // if (newQuantity > item.quantity && newQuantity > totalAvailableStock) {
    //   // Use your existing toast notification system if available
    //   alert(`Cannot exceed available stock (${totalAvailableStock} units)`); 
    //   return;
    // }

    const change = newQuantity - item.quantity; // The backend expects the delta (e.g., +1 or -1)
    
    try {
      // apiCall handles setIsLoading(true), the fetch, and setIsLoading(false)
      await apiCall(`${API_BASE_URL}/order/update-qty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: activeCartId,
          product_id: productId,
          change: change
        }),
      });

      // If we are here, the API call was successful. Update local state.
      setClientCarts((prev) =>
        prev.map((cart) => {
          if (cart.id !== activeCartId) return cart;
          
          // If quantity becomes 0 or less, the backend deletes it, so we filter it out
          const updatedItems = cart.items
            .map((i) => (i.id === productId ? { ...i, quantity: newQuantity } : i))
            .filter((i) => i.quantity > 0);

          return { ...cart, items: updatedItems };
        })
      );
    } catch (error) {
      // The specific error toast is already handled inside apiCall
      console.error("Quantity update failed:", error);
    }
  };

  // Inside src/App.tsx
  const handleRemoveItem = async (productId: string) => {
    if (!activeCartId) return;

    try {
      await apiCall(
        `${API_BASE_URL}/order/remove-item?order_id=${activeCartId}&product_id=${productId}`,
        { method: "DELETE" }
      );

      setClientCarts((prev) =>
        prev.map((cart) => {
          if (cart.id !== activeCartId) return cart;
          return {
            ...cart,
            items: cart.items.filter((item) => item.id !== productId),
          };
        })
      );
      toast.info("Item removed from session");
    } catch (error) {
      toast.error("Could not remove item from server");
    }
  };

  const handleUpdateItemRoom = async (
    productId: string,
    metadata: { label: string; qty: number }[]
  ) => {
    if (!activeCartId) return;

    try {
      await apiCall(`${API_BASE_URL}/order/update-item-metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: activeCartId,
          product_id: productId,
          attribute_metadata: metadata,
        }),
      });

      setClientCarts((prev) =>
        prev.map((cart) => {
          if (cart.id !== activeCartId) return cart;
          return {
            ...cart,
            items: cart.items.map((line) =>
              line.id === productId ? { ...line, attribute_metadata: metadata } : line
            ),
          };
        })
      );
    } catch (error) {
      console.error("Room update failed:", error);
      toast.error("Failed to update room");
    }
  };

  const renderDocumentPdf = async (
    doc: ProformaInvoice,
    docType: PrintDocumentType
  ) => {
    setPreviewDocType(docType);
    setPiPreviewData(doc);

    await new Promise((resolve) => setTimeout(resolve, 120));

    const element = document.getElementById("printable-pi-preview");
    if (!element) throw new Error("Preview template render failed");

    const images = element.getElementsByTagName("img");
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: "#ffffff",
      imageTimeout: 15000,
    });
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const topMarginMm = 10;
    const bottomMarginMm = 10;

    const firstPageHeightMm = Math.max(0, pdfHeight - bottomMarginMm);
    const otherPageHeightMm = Math.max(0, pdfHeight - topMarginMm - bottomMarginMm);

    const firstPageHeightPx = Math.floor((canvas.width * firstPageHeightMm) / pdfWidth);
    const otherPageHeightPx = Math.floor((canvas.width * otherPageHeightMm) / pdfWidth);

    const pageCanvas = document.createElement("canvas");
    const pageCtx = pageCanvas.getContext("2d");
    if (!pageCtx) throw new Error("Canvas context unavailable");

    pageCanvas.width = canvas.width;

    const elementHeight = element.scrollHeight || element.getBoundingClientRect().height || canvas.height;
    const scale = canvas.height / elementHeight;
    const firstPageHeightDom = firstPageHeightPx / scale;
    const otherPageHeightDom = otherPageHeightPx / scale;

    const blockElements = Array.from(
      element.querySelectorAll<HTMLElement>('[data-pi-item-row="true"], [data-pdf-nosplit="true"]')
    );
    const elementRect = element.getBoundingClientRect();
    const rowBlocks = blockElements.map((block) => {
      const rect = block.getBoundingClientRect();
      const top = rect.top - elementRect.top;
      const height = rect.height;
      return { top, bottom: top + height, height };
    }).sort((a, b) => a.top - b.top);

    const breaksDom: number[] = [];
    let currentPageStart = 0;
    let currentPageLimit = firstPageHeightDom;
    for (const row of rowBlocks) {
      if (row.bottom - currentPageStart > currentPageLimit && row.top > currentPageStart) {
        breaksDom.push(row.top);
        currentPageStart = row.top;
        currentPageLimit = otherPageHeightDom;
      } else if (row.height > currentPageLimit) {
        // Row is taller than a page; allow split at page height to avoid infinite loop
        breaksDom.push(currentPageStart + currentPageLimit);
        currentPageStart = currentPageStart + currentPageLimit;
        currentPageLimit = otherPageHeightDom;
      }
    }

    const pageStartsDom = [0, ...breaksDom];
    const pageEndsDom = [...breaksDom, elementHeight];

    for (let pageIndex = 0; pageIndex < pageStartsDom.length; pageIndex += 1) {
      const isFirstPage = pageIndex === 0;
      const startDom = pageStartsDom[pageIndex];
      const endDom = pageEndsDom[pageIndex];
      const sliceHeightDom = Math.max(0, endDom - startDom);
      const sourceY = Math.floor(startDom * scale);
      const sliceHeight = Math.min(canvas.height - sourceY, Math.floor(sliceHeightDom * scale));

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pageCanvas.height = sliceHeight;
      pageCtx.clearRect(0, 0, pageCanvas.width, sliceHeight);
      pageCtx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );

      const imgData = pageCanvas.toDataURL("image/png");
      const imgHeightMm = (sliceHeight * pdfWidth) / canvas.width;
      const yMm = isFirstPage ? 0 : topMarginMm;
      pdf.addImage(imgData, "PNG", 0, yMm, pdfWidth, imgHeightMm);
    }
    return pdf;
  };

  const handleGenerateCatalogPdf = async (catalogProducts: any[] = [], filterLabel = "all") => {
    if (!catalogProducts || catalogProducts.length === 0) {
      toast.error("No products found for current filters.");
      return;
    }

    setIsLoading(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const sideMarginMm = 8;
      const topMarginMm = 8;
      const bottomMarginMm = 8;
      const usableWidthMm = pdfWidth - sideMarginMm * 2;
      const usableHeightMm = pdfHeight - topMarginMm - bottomMarginMm;

      const itemsPerPage = 12; // 3 x 4 cards
      const pages: any[][] = [];
      for (let i = 0; i < catalogProducts.length; i += itemsPerPage) {
        pages.push(catalogProducts.slice(i, i + itemsPerPage));
      }

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const pageContainer = document.createElement("div");
        pageContainer.style.position = "fixed";
        pageContainer.style.left = "-10000px";
        pageContainer.style.top = "0";
        pageContainer.style.width = "794px"; // A4-ish CSS px width
        pageContainer.style.background = "#ffffff";
        pageContainer.style.padding = "24px";
        pageContainer.style.boxSizing = "border-box";
        pageContainer.style.fontFamily = "Arial, sans-serif";

        const grid = document.createElement("div");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(3, 1fr)";
        grid.style.gap = "20px";
        pageContainer.appendChild(grid);

        pages[pageIndex].forEach((p: any) => {
          const qty = Number(p.displayStock || 0) + Number(p.godownStock || 0);

          const card = document.createElement("div");
          card.style.border = "1px solid #e2e8f0";
          card.style.borderRadius = "8px";
          card.style.padding = "12px";
          card.style.minHeight = "210px";
          card.style.display = "flex";
          card.style.flexDirection = "column";
          card.style.gap = "8px";

          const imageWrap = document.createElement("div");
          imageWrap.style.height = "130px";
          imageWrap.style.display = "flex";
          imageWrap.style.alignItems = "center";
          imageWrap.style.justifyContent = "center";
          imageWrap.style.border = "1px solid #f1f5f9";
          imageWrap.style.borderRadius = "6px";
          imageWrap.style.background = "#f8fafc";
          imageWrap.style.overflow = "hidden";

          if (isRenderableImageUrl(p.photo_url)) {
            const img = document.createElement("img");
            img.src = p.photo_url;
            img.alt = p.barcode || p.name || "product";
            img.crossOrigin = "anonymous";
            img.style.maxWidth = "100%";
            img.style.maxHeight = "100%";
            img.style.objectFit = "contain";
            imageWrap.appendChild(img);
          } else {
            const noImg = document.createElement("span");
            noImg.textContent = "No Image";
            noImg.style.color = "#94a3b8";
            noImg.style.fontSize = "12px";
            imageWrap.appendChild(noImg);
          }

          const codeEl = document.createElement("div");
          codeEl.textContent = `Code: ${p.barcode || p.name || "-"}`;
          codeEl.style.fontSize = "12px";
          codeEl.style.fontWeight = "700";
          codeEl.style.wordBreak = "break-all";

          const qtyEl = document.createElement("div");
          qtyEl.textContent = `Qty: ${qty}`;
          qtyEl.style.fontSize = "12px";
          qtyEl.style.fontWeight = "700";

          const priceEl = document.createElement("div");
          priceEl.textContent = `Price: ₹${Number(p.selling_price || p.price || 0).toLocaleString("en-IN")}`;
          priceEl.style.fontSize = "12px";
          priceEl.style.fontWeight = "700";

          card.appendChild(imageWrap);
          card.appendChild(codeEl);
          card.appendChild(qtyEl);
          card.appendChild(priceEl);
          grid.appendChild(card);
        });

        document.body.appendChild(pageContainer);
        try {
          const images = pageContainer.getElementsByTagName("img");
          await Promise.all(
            Array.from(images).map((img) => {
              if (img.complete) return Promise.resolve();
              return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
              });
            })
          );

          const canvas = await html2canvas(pageContainer, {
            scale: 1.5,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: "#ffffff",
            imageTimeout: 15000,
            onclone: (clonedDoc) => {
              // Avoid html2canvas crashing on unsupported CSS color functions (e.g. oklch).
              clonedDoc
                .querySelectorAll('style,link[rel="stylesheet"]')
                .forEach((node) => node.remove());
            },
          });

          const imgHeightMm = (canvas.height * usableWidthMm) / canvas.width;
          const renderHeightMm = Math.min(imgHeightMm, usableHeightMm);
          // Pass canvas directly to avoid building very large base64 strings.
          pdf.addImage(canvas as any, "JPEG", sideMarginMm, topMarginMm, usableWidthMm, renderHeightMm, undefined, "FAST");
        } finally {
          pageContainer.remove();
        }
      }

      const safeFilterLabel = filterLabel
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80) || "all";
      pdf.save(`TLC_Catalog_${safeFilterLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Catalog PDF downloaded.");
    } catch (error: any) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to generate catalog PDF.";
      console.error("Catalog PDF failed:", error);
      toast.error(message || "Failed to generate catalog PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  const openDocumentPreview = async (
    doc: ProformaInvoice,
    docType: PrintDocumentType
  ) => {
    const pdf = await renderDocumentPdf(doc, docType);
    const blobUrl = URL.createObjectURL(pdf.output("blob"));

    if (previewPdfUrlRef.current) {
      URL.revokeObjectURL(previewPdfUrlRef.current);
    }
    previewPdfUrlRef.current = blobUrl;
    setPiPreviewUrl(blobUrl);
    setShowPIPreview(true);
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const target = orders.find((o) => o.id === orderId);
      if (!target) return;

      const details = await apiCall(`${API_BASE_URL}/basket/details/${orderId}`);
      const invoiceDoc: ProformaInvoice = {
        id: orderId,
        piNumber: target.orderNumber,
        clientName: target.customerName,
        items: (details.order_items || []).map((item: any) => ({
          name: item.item_code,
          quantity: item.quantity,
          price: item.unit_price,
          photo_url: item.photo_url,
          attribute_metadata: item.attribute_metadata || [],
        })),
        discount: target.discount || 0,
        status: "approved",
        createdAt: target.date,
        updatedAt: target.date,
        subtotal: details.subtotal || target.subtotal || 0,
        discount_amount: details.discount_amount || target.discount_amount || 0,
        extra_discount_amount: details.extra_discount_amount || target.extra_discount_amount || 0,
        discount_percent: details.discount_percent ?? target.discount_percent ?? target.discount ?? 0,
        tax_percent: details.tax_percent ?? target.tax_percent ?? 0,
        tax_amount: details.tax_amount || target.tax_amount || 0,
        final_total: details.final_total || target.final_total || target.total || 0,
        total: details.final_total || target.total || 0,
        paidAmount: target.paidAmount || 0,
        write_off_amount: details.write_off_amount || target.write_off_amount || 0,
        write_off_notes: details.write_off_notes || target.write_off_notes || "",
        clientPhone: details.client_phone || target.clientPhone || "",
        referralSource: details.referral_source || target.referralSource || "",
        deliveryAddress: details.delivery_address || target.deliveryAddress || "",
      };

      const pdf = await renderDocumentPdf(invoiceDoc, "INVOICE");
      pdf.save(`Invoice_${target.orderNumber}_${target.customerName}.pdf`);
      toast.success("Invoice downloaded");
    } catch (error) {
      console.error("Invoice download failed:", error);
      toast.error("Failed to download invoice");
    }
  };

  const handleCheckout = async () => {
    if (!activeCartId) return;
    const draft = cartDraftRef.current[activeCartId] || {};

    const activeCart = (() => {
      const cart = clientCarts.find((c) => c.id === activeCartId);
      if (!cart) return null;
      return {
        ...cart,
        discount: draft.discount ?? cart.discount,
        extraDiscount: draft.extraDiscount ?? cart.extraDiscount ?? 0,
        tax: 0,
      };
    })();
    if (!activeCart) return;

    // Stock validation is already done by Cart component before showing the "Sell" button
    // (Cart checks against both loaded products and missing product stock fetched on-demand)
    // So we can proceed directly to finalization
    
    // 2. Prepare the Request Body (JSON)
    // We include all the metadata that was previously being lost
    const payload = {
      order_id: activeCartId,
      discount_percent: Number(activeCart.discount) || 0,
      tax_percent: 0,
      extra_discount_amount: Number(activeCart.extraDiscount) || 0,
      paid_amount: Number(activeCart.advancePaid) || 0,
      referral_source: activeCart.referralSource || "",
      delivery_address: activeCart.deliveryAddress || "",
      client_phone: activeCart.clientPhone || ""
    };

    try {
      const effectiveDiscount = Number(activeCart.discount) || 0;
      const effectiveExtraDiscount = Number(activeCart.extraDiscount) || 0;
      const effectiveTax = 0;
      const details = await apiCall(`${API_BASE_URL}/basket/details/${activeCartId}`);
      const subtotal = Number(details.subtotal) || 0;
      const { discountAmount, extraDiscountAmount, taxAmount, finalTotal } = calculateRoundedBilling(
        subtotal,
        effectiveDiscount,
        effectiveTax,
        effectiveExtraDiscount
      );

      const previewInvoice: ProformaInvoice = {
        id: activeCartId,
        piNumber: activeCartId.slice(0, 8).toUpperCase(),
        clientName: activeCart.clientName,
        items: (details.order_items || []).map((item: any) => ({
          name: item.item_code,
          quantity: item.quantity,
          price: item.unit_price,
          photo_url: item.photo_url,
          attribute_metadata: item.attribute_metadata || [],
        })),
        discount: effectiveDiscount,
        status: "approved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtotal,
        discount_amount: discountAmount,
        extra_discount_amount: extraDiscountAmount,
        discount_percent: effectiveDiscount,
        tax_percent: effectiveTax,
        tax_amount: taxAmount,
        final_total: finalTotal,
        total: finalTotal,
        paidAmount: Number(activeCart.advancePaid) || 0,
        clientPhone: activeCart.clientPhone || "",
        referralSource: activeCart.referralSource || "",
        deliveryAddress: activeCart.deliveryAddress || "",
      };

      setPendingSellContext({ orderId: activeCartId, payload });
      await openDocumentPreview(previewInvoice, "INVOICE");
      toast.info("Review invoice and click Confirm Sell to finalize.");
    } catch (error) {
      console.error("Checkout preview error:", error);
    }
  };

  const handleConfirmSellFromPreview = async () => {
    if (!pendingSellContext) return;
    try {
      setIsConfirmingSell(true);
      await apiCall(`${API_BASE_URL}/order/finalize-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingSellContext.payload),
      });

      toast.success(`Sale finalized! Paid: ₹${pendingSellContext.payload.paid_amount}.`);
      setShowPIPreview(false);
      setPiPreviewData(null);
      setPendingSellContext(null);

      await handleLoadInventory();
      await handleLoadOrders(true);
      setActiveCartId(null);
      setClientCarts((prev) => prev.filter((c) => c.id !== pendingSellContext.orderId));
      delete cartDraftRef.current[pendingSellContext.orderId];
      setCurrentView("orders");
    } catch (error) {
      console.error("Confirm sell error:", error);
      toast.error("Failed to finalize sale");
    } finally {
      setIsConfirmingSell(false);
    }
  };

  // Inside App.tsx component, before 'return'
  const fetchOrderItems = async (orderId: string) => {
    try {
      // If orders is empty, load them first
      if (orders.length === 0) {
        const data = await apiCall(`${API_BASE_URL}/orders/list/${PRESELECTED_SHOP_ID}`);
        
        const mappedOrders: Order[] = data.map((o: any) => ({
          id: o.id,
          orderNumber: o.id.slice(0, 8).toUpperCase(),
          customerName: o.client_name || "Unknown",
          total: o.final_total || 0,
          paidAmount: o.paid_amount || 0,
          status: o.status,
          date: new Date(o.created_at).toLocaleDateString(),
          discount: o.discount_percent || 0,
          discount_amount: o.discount_amount || 0,
          extra_discount_amount: o.extra_discount_amount || 0,
          tax_amount: o.tax_amount || 0,
          write_off_amount: o.write_off_amount || 0,
          write_off_notes: o.write_off_notes || "",
          photo_url: o.photo_url || "",
          attribute_metadata: o.attribute_metadata || []
        }));
        
        setOrders(mappedOrders);
      }

      const apiData = await apiCall(`${API_BASE_URL}/basket/details/${orderId}`);

      const mappedItems = apiData.order_items.map((item: any) => ({
        name: item.item_code,
        quantity: item.quantity,
        price: item.unit_price,
       // photo_url: item.photo_url,           // Ensure this field is mapped
        attribute_metadata: item.attribute_metadata || [], // Ensure this field is mapped
        photo_url: item.photo_url || item.product?.photo_url
      }));

      setOrders((prev) => {
        return prev.map((o) =>
          o.id === orderId ? { 
            ...o, 
            items: mappedItems,
            subtotal: apiData.subtotal,
            discount_amount: apiData.discount_amount,
            extra_discount_amount: apiData.extra_discount_amount,
            discount_percent: apiData.discount_percent,
            tax_percent: apiData.tax_percent,
            tax_amount: apiData.tax_amount,
            final_total: apiData.final_total,
            write_off_amount: apiData.write_off_amount,
            write_off_notes: apiData.write_off_notes,
            clientPhone: apiData.client_phone,        
            referralSource: apiData.referral_source, 
            deliveryAddress: apiData.delivery_address
          } : o
        );
      });
    } catch (error) { 
      console.error("Failed to load items:", error);
    }
  };

  const handleUpdateDiscount = (discount: number) => {
    if (!activeCartId) return;
    cartDraftRef.current[activeCartId] = {
      ...cartDraftRef.current[activeCartId],
      discount: Number(discount) || 0,
    };

    setClientCarts((prev) =>
      prev.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        return { ...cart, discount }; // State updated with the new number
      })
    );
  };

  const handleUpdateExtraDiscount = (amount: number) => {
    if (!activeCartId) return;
    const normalized = Math.max(0, Math.floor(Number(amount) || 0));
    cartDraftRef.current[activeCartId] = {
      ...cartDraftRef.current[activeCartId],
      extraDiscount: normalized,
    };

    setClientCarts((prev) =>
      prev.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        return { ...cart, extraDiscount: normalized };
      })
    );
  };

  // Inside App.tsx
  const proformaInvoices = orders.filter(o => o.status === 'pi'); // Filter orders with 'pi' status

  const handleUpdatePIStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await apiCall(`${API_BASE_URL}/order/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, status: newStatus }),
      });

      if (response.ok) {
        // Refresh orders to reflect the status change
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
        toast.success(`PI updated to ${newStatus}`);
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleSaveCart = async () => {
    if (!activeCartId) return;
    const draft = cartDraftRef.current[activeCartId] || {};
    const activeCart = (() => {
      const cart = clientCarts.find((c) => c.id === activeCartId);
      if (!cart) return null;
      return {
        ...cart,
        discount: draft.discount ?? cart.discount,
        extraDiscount: draft.extraDiscount ?? cart.extraDiscount ?? 0,
        tax: 0,
      };
    })();
    if (!activeCart) return;
    try {
      await apiCall(`${API_BASE_URL}/order/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          order_id: activeCartId, 
          status: "bucket", // Keep as active bucket
          discount_percent: Number(activeCart.discount) || 0,
          tax_percent: 0,
          extra_discount_amount: Number(activeCart.extraDiscount) || 0,
          paid_amount: activeCart.advancePaid || 0,
          referral_source: activeCart.referralSource || "",
          delivery_address: activeCart.deliveryAddress || "",
          client_phone: activeCart.clientPhone || ""
        }),
      });
      delete cartDraftRef.current[activeCartId];
      toast.success("Progress saved to database");
    } catch (error) {
      console.error("Save failed:", error);
    }
  };

  // 3. Updated Generate PI (Save + Convert + Trigger Download)
  const handleGeneratePI = async () => {
    if (!activeCartId) return;
    const draft = cartDraftRef.current[activeCartId] || {};
    const activeCart = (() => {
      const cart = clientCarts.find((c) => c.id === activeCartId);
      if (!cart) return null;
      return {
        ...cart,
        discount: draft.discount ?? cart.discount,
        extraDiscount: draft.extraDiscount ?? cart.extraDiscount ?? 0,
        tax: 0,
      };
    })();
    if (!activeCart) return;
    const cartIdToConvert = activeCartId;
    
    try {
      const piPayload = {
        order_id: cartIdToConvert,
        status: "pi",
        discount_percent: Number(activeCart.discount) || 0,
        tax_percent: 0,
        extra_discount_amount: Number(activeCart.extraDiscount) || 0,
        paid_amount: activeCart.advancePaid || 0,
        referral_source: activeCart.referralSource || "",
        delivery_address: activeCart.deliveryAddress || "",
        client_phone: activeCart.clientPhone || ""
      };

      // Preview first; do not persist PI yet
      const piDetails = await apiCall(`${API_BASE_URL}/basket/details/${cartIdToConvert}`);
      const effectiveDiscount = Number(activeCart.discount) || 0;
      const effectiveExtraDiscount = Number(activeCart.extraDiscount) || 0;
      const effectiveTax = 0;
      const subtotal = Number(piDetails.subtotal) || 0;
      const { discountAmount, extraDiscountAmount, taxAmount, finalTotal } = calculateRoundedBilling(
        subtotal,
        effectiveDiscount,
        effectiveTax,
        effectiveExtraDiscount
      );
      const previewPI: ProformaInvoice = {
        id: cartIdToConvert,
        piNumber: cartIdToConvert.slice(0, 8).toUpperCase(),
        clientName: activeCart.clientName,
        items: (piDetails.order_items || []).map((item: any) => ({
          name: item.item_code,
          quantity: item.quantity,
          price: item.unit_price,
          photo_url: item.photo_url,
          attribute_metadata: item.attribute_metadata || [],
        })),
        discount: effectiveDiscount,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtotal,
        discount_amount: discountAmount,
        extra_discount_amount: extraDiscountAmount,
        discount_percent: effectiveDiscount,
        tax_percent: effectiveTax,
        tax_amount: taxAmount,
        final_total: finalTotal,
        total: finalTotal,
        paidAmount: Number(activeCart.advancePaid) || 0,
        clientPhone: activeCart.clientPhone || "",
        referralSource: activeCart.referralSource || "",
        deliveryAddress: activeCart.deliveryAddress || "",
      };

      setPendingPIContext({ orderId: cartIdToConvert, payload: piPayload });
      await openDocumentPreview(previewPI, "PI");
      toast.info("Review PI and click Confirm PI to generate.");
    } catch (error) {
      toast.error("Failed to generate PI");
    }
  };

  const handleConfirmPIFromPreview = async () => {
    if (!pendingPIContext) return;
    try {
      setIsConfirmingPI(true);
      await apiCall(`${API_BASE_URL}/order/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingPIContext.payload),
      });

      await fetchOrderItems(pendingPIContext.orderId);
      await handleLoadProformaInvoices();
      setClientCarts((prev) => prev.filter((c) => c.id !== pendingPIContext.orderId));
      setActiveCartId(null);
      delete cartDraftRef.current[pendingPIContext.orderId];
      setAutoDownloadPIId(null);
      setShowPIPreview(false);
      setPiPreviewData(null);
      setPendingPIContext(null);
      toast.success("PI generated.");
    } catch (error) {
      console.error("Confirm PI error:", error);
      toast.error("Failed to generate PI");
    } finally {
      setIsConfirmingPI(false);
    }
  };
  
  const handleEditPI = async (pi: ProformaInvoice) => {
    try {
      // 1. Fetch fresh items directly from the source to ensure they exist
      const data = await apiCall(`${API_BASE_URL}/basket/details/${pi.id}`);
      console.log("API Response:", data)
      
      // 2. Map the backend items to CartItem format
      const freshItems = data.order_items.map((item: any) => ({
        id: item.product_id,
        name: item.item_code,
        price: item.unit_price,
        quantity: item.quantity,
        attribute_metadata: item.attribute_metadata || []
      }));

      // 3. Create or Update the Cart session
      const newCart: ClientCart = {
        id: pi.id,
        clientName: pi.clientName,
        items: freshItems,
        discount: data.discount_percent ?? 0,
        extraDiscount: data.extra_discount_amount ?? 0,
        tax: data.tax_percent ?? 0,
        advancePaid: data.paid_amount || 0,
        referralSource: data.referral_source || "",
        deliveryAddress: data.delivery_address || "",
        clientPhone: data.client_phone || "",
        createdAt: pi.createdAt,
      };

      cartDraftRef.current[pi.id] = {
        ...cartDraftRef.current[pi.id],
        discount: Number(data.discount_percent ?? 0),
        extraDiscount: Number(data.extra_discount_amount ?? 0),
        tax: Number(data.tax_percent ?? 0),
      };

      setClientCarts((prev) => {
        const filtered = prev.filter(c => c.id !== pi.id); // Remove if already exists
        return [...filtered, newCart];
      });

      // 4. Set active and navigate
      setActiveCartId(pi.id);
      setCurrentView("cart");
      toast.success(`Loaded ${pi.piNumber} into cart`);
    } catch (error) {
      console.error("Edit PI Error:", error);
      toast.error("Failed to load PI details for editing");
    }
  };

  // Inside App.tsx - Mapping items for the Cart component
  const cartItemsWithStock = activeCart?.items.map(item => {
    const masterProduct = products.find(p => p.id === item.id);
    return {
      ...item,
      // Derive current stock at runtime from the master product list
      stock: masterProduct ? (masterProduct.displayStock + masterProduct.godownStock) : 0
    };}) || [];
  const getTotalCartCount = () => {
    return clientCarts.reduce(
      (sum, cart) =>
        sum + cart.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
  };

  const handleUpdateAdvance = (amount: number) => {
    if (!activeCartId) return;
    setClientCarts((prev) =>
      prev.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        return { 
          ...cart, 
          advancePaid: amount 
        };
      })
    );
  };

const handleCancelOrder = async (orderId: string) => {
    try {
      // 1. Call the backend transaction route we created earlier
      const response = await apiCall(`${API_BASE_URL}/order/cancel/${orderId}`, {
        method: "POST",
      });

      toast.success(response.message || "Order successfully cancelled and stock reverted!");

      // 2. Refresh the active orders datagrid using your actual method name
      await handleLoadOrders(true);
      
    } catch (err: any) {
      console.error("Order cancellation failed:", err);
      toast.error(err.message || "Failed to cancel the order.");
    }
  };

  const handleRecordPayment = async (orderId: string, amount: number, method: string, notes?: string) => {
    try {
      await apiCall(`${API_BASE_URL}/order/record-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, amount, method, notes }),
      });

      // Re-fetch orders to update the 'Paid' and 'Balance' columns
      await handleLoadOrders(true); 
      toast.success(`Payment of ₹${amount} recorded successfully!`);
    } catch (error) {
      console.error("Payment failed:", error);
    }
  };

  const handleWriteOff = async (orderId: string, amount: number, reason?: string, notes?: string) => {
    try {
      await apiCall(`${API_BASE_URL}/order/write-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, amount, reason, notes }),
      });

      await handleLoadOrders(true);
      await handleFetchWriteOffs(orderId);
      toast.success(`Write-off of ₹${amount} recorded successfully!`);
    } catch (error) {
      console.error("Write-off failed:", error);
    }
  };

  const handleFetchPayments = async (orderId: string) => {
    try {
      const rows = await apiCall(`${API_BASE_URL}/order/payments/${orderId}`);
      const payments = (rows || []).map((row: any) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          return {
            id: row.id,
            amount: Number(row.amount ?? 0),
            payment_method: row.payment_method,
            notes: row.notes,
            created_at: row.transaction_date ?? row.created_at ?? null,
          };
        }
        return {
          id: row[0],
          amount: Number(row[1] ?? 0),
          payment_method: row[2],
          notes: row[3],
          created_at: row[4] ?? null,
        };
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, payments } : o)));
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    }
  };

  const handleFetchWriteOffs = async (orderId: string) => {
    try {
      const rows = await apiCall(`${API_BASE_URL}/order/write-offs/${orderId}`);
      const writeOffs = (rows || []).map((row: any) => ({
        id: row.id,
        amount: Number(row.amount ?? 0),
        reason: row.reason,
        notes: row.notes,
        created_at: row.created_at,
      }));
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, writeOffs } : o)));
    } catch (error) {
      console.error("Failed to fetch write-offs:", error);
    }
  };

  const handleLoadAuditEvents = async (entityType: string = auditEntityType) => {
    setAuditLoading(true);
    try {
      const query = entityType && entityType !== "all" ? `?entity_type=${encodeURIComponent(entityType)}` : "";
      const data = await apiCall(`${API_BASE_URL}/audit/events/${PRESELECTED_SHOP_ID}${query}`);
      const mapped: AuditEvent[] = (data || []).map((row: any) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          return {
            id: row.id,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            action: row.action,
            actor_id: row.actor_id,
            actor_email: row.actor_email,
            source: row.source,
            notes: row.notes,
            before: row.before,
            after: row.after,
            created_at: row.created_at,
          };
        }
        return {
          id: row[0],
          entity_type: row[1],
          entity_id: row[2],
          action: row[3],
          actor_id: row[4],
          actor_email: row[5],
          source: row[6],
          notes: row[7],
          before: row[8],
          after: row[9],
          created_at: row[10],
        };
      });
      setAuditEvents(mapped);
    } catch (error) {
      console.error("Failed to load audit events:", error);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleUpdateCartMetadata = (field: keyof ClientCart, value: string) => {
    if (!activeCartId) return;

    setClientCarts((prevCarts) =>
      prevCarts.map((cart) =>
        cart.id === activeCartId 
          ? { ...cart, [field]: value } 
          : cart
      )
    );
  };

  const handleGeneratePIPDF = async (pi: ProformaInvoice) => {
    try {
      setIsLoading(true);
      const pdf = await renderDocumentPdf(pi, "PI");
      pdf.save(`PI_${pi.piNumber}_${pi.clientName}.pdf`);
      toast.success("PI Downloaded");
    } catch (error) {
      console.error("PI PDF generation failed:", error);
      toast.error("Failed to generate PI PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (productId: string) => {
    try {
      await apiCall(`${API_BASE_URL}/inventory/${productId}`, {
        method: "DELETE",
      });
      
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      
      toast.success("Product deleted successfully.");
    } catch (error) {
      console.error("Failed to delete product:", error);
      // The apiCall function will show a toast on failure
    }
  };

  // Handle Loading State
  if (initializing) return <GlobalLoader />;

return (
  <div className="min-h-screen bg-gray-50">
    <Toaster />
    {isLoading && <GlobalLoader />}

    {/* 1. Login View Shell */}
    {!session ? (
      <LoginForm />
    ) : (
      <>
        {/* 2. Header: Stays mounted for all views EXCEPT Home */}
        {currentView !== "home" && (
            <header className="bg-white border-b sticky top-0 z-50">
              <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentView("home")}
                      className="text-gray-600 hover:text-blue-600 transition-colors px-2"
                    >
                      <Home className="size-5 mr-2" />
                      <span className="font-semibold">Dashboard</span>
                    </Button>
                    <div className="h-6 w-px bg-gray-200" />
                    <h1 className="text-xl font-bold text-gray-900 capitalize">
                      {currentView === 'proforma'
                        ? 'Proforma Invoices'
                        : currentView === 'dashboard'
                          ? 'Analytics Dashboard'
                          : currentView}
                    </h1>
                  </div>
                  <div className="flex items-center gap-4">
                    {currentView !== 'cart' && clientCarts.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setCurrentView('cart')} className="rounded-full">
                        <ShoppingCart className="size-4 mr-2" />
                        {clientCarts.length} Active
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </header>
          )}

          {/* 4. Main Dynamic Content */}
          <main className={currentView === "home" ? "" : "max-w-7xl mx-auto px-4 py-8"}>
            {currentView === "home" && (
              <HomeScreen 
                onNavigate={(view: any) => setCurrentView(view)} 
                cartCount={clientCarts.length} 
              />
            )}

            {currentView === "scanner" && inventoryReady && (
              <div>
                {activeCart && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Adding items to <strong>{activeCart.clientName}</strong>'s cart
                    </p>
                  </div>
                )}
                <Scanner products={products || []} onAddToCart={handleAddToCart} onProductSearch={handleProductSearch} searchResult={searchResult} />
              </div>
            )}

            {currentView === "inventory" && (
              <Inventory
                products={products as unknown as ExtendedProduct[]}
                onUpdateInventory={handleUpdateInventory}
                onBulkAdd={handleBulkAdd}
                onGenerateCatalogPdf={handleGenerateCatalogPdf}
                onAddToCartFromInventory={async (product, quantity, room) => {
                  await handleAddToCart(product as unknown as Product, quantity, room);
                }}
                activeCartId={activeCartId}
                activeCartLabel={activeCart?.clientName || null}
                onRequireActiveCart={(continuation, items) => {
                  setPendingProduct(null);
                  setPendingCartItems(items || null);
                  setPendingContinuation(() => continuation); // This was mistakenly removed and is now restored.
                  setPendingQuantity(1);
                  setPendingAttribute("None");
                  setShowClientDialog(true);
                }}
                onLoadMore={handleLoadMoreInventory}
                hasMoreProducts={inventoryPagination.hasMore}
                onFiltersChange={handleInventoryFiltersChange}
                onDeleteItem={handleDeleteItem}
                totalProducts={inventoryPagination.total}
              />
            )}

            {currentView === "orders" && (
              <Orders
                orders={orders}
                onFetchDetails={fetchOrderItems}
                onFetchPayments={handleFetchPayments}
                onRecordPayment={handleRecordPayment}
                onFetchWriteOffs={handleFetchWriteOffs}
                onWriteOff={handleWriteOff}
                onDownloadInvoice={handleDownloadInvoice}
                onCancelOrder={handleCancelOrder}
                summary={orderSummary}
              />
            )}
            {currentView === "dashboard" && (
              <Dashboard
                stats={dashboardStats}
                onRefresh={() => handleLoadDashboard(true)}
                isLoading={isLoading}
              />
            )}

            {currentView === "history" && (
              <History
                events={auditEvents}
                entityType={auditEntityType}
                onEntityTypeChange={(value) => {
                  setAuditEntityType(value);
                  handleLoadAuditEvents(value);
                }}
                onRefresh={() => handleLoadAuditEvents(auditEntityType)}
                isLoading={auditLoading}
              />
            )}

            {currentView === "cart" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CartManager
                  carts={clientCarts}
                  activeCartId={activeCartId}
                  onSelectCart={handleSelectCart}
                  onCreateCart={handleCreateCart}
                  onCloseCart={handleCloseCart}
                />
                <Cart
                  items={activeCart?.items || []}
                  products={products}
                  clientName={activeCart?.clientName || null}
                  discount={activeCart?.discount || 0}
                  extraDiscount={activeCart?.extraDiscount || 0}
                  activeCart={activeCart}
                  activeCartId={activeCartId}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onCheckout={handleCheckout}
                  onUpdateDiscount={handleUpdateDiscount}
                  onUpdateExtraDiscount={handleUpdateExtraDiscount}
                  onGeneratePI={handleGeneratePI}
                  onSaveCart={handleSaveCart}
                  onUpdateAdvance={handleUpdateAdvance}
                  onUpdateAddress={(val) => handleUpdateCartMetadata('deliveryAddress', val)}
                  onUpdatePhone={(val) => handleUpdateCartMetadata('clientPhone', val)}
                  onUpdateReferral={(val) => handleUpdateCartMetadata('referralSource', val)}
                  onUpdateItemRoom={handleUpdateItemRoom}
                />
              </div>
            )}

            {currentView === "proforma" && (
              <ProformaInvoices
                products={products}
                invoices={proformaOrders.map(o => ({
                  id: o.id,
                  piNumber: o.orderNumber,
                  clientName: o.customerName,
                  items: o.items || [],
                  discount: o.discount || 0,
                  status: o.status as any,
                  createdAt: o.date,
                  updatedAt: o.date,
                  subtotal: o.subtotal,
                  discount_amount: o.discount_amount,
                  extra_discount_amount: o.extra_discount_amount,
                  discount_percent: o.discount_percent,
                  tax_percent: o.tax_percent,
                  tax_amount: o.tax_amount,
                  final_total: o.final_total,
                  paidAmount: o.paidAmount || 0,
                  total: o.total,
                  clientPhone: o.clientPhone,        
                  referralSource: o.referralSource, 
                  deliveryAddress: o.deliveryAddress
                }))}
                onEditPI={handleEditPI}
                onConvertToOrder={handleCheckout}
                onDeletePI={handleCloseCart}
                onUpdateStatus={handleUpdatePIStatus}
                onFetchDetails={fetchOrderItems}
                initialDownloadId={autoDownloadPIId}
                onClearInitialDownload={() => setAutoDownloadPIId(null)}
                onDownloadPIPDF={async (pi) => {
                  try {
                    setIsLoading(true);
                    const pdf = await renderDocumentPdf(pi, "PI");
                    pdf.save(`PI_${pi.piNumber}_${pi.clientName}.pdf`);
                    toast.success("Proforma Invoice downloaded successfully");
                  } catch (err) {
                    console.error("Central PI generation failed:", err);
                    toast.error("Failed to generate multi-page PDF");
                  } finally {
                    setIsLoading(false);
                  }
                }}
              />
            )}
          </main>
        </>
      )}

      {/* 5. Global Dialogs (Stable even during view changes) */}
      <Dialog
        open={showPIPreview}
        onOpenChange={(open) => {
          setShowPIPreview(open);
          if (!open) {
            setPiPreviewData(null);
            setPendingSellContext(null);
            setPendingPIContext(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-6xl">
          <DialogHeader>
            <DialogTitle>{previewDocType === "INVOICE" ? "Invoice Preview" : "PI Preview"}</DialogTitle>
          </DialogHeader>
          {piPreviewUrl ? (
            <iframe
              src={piPreviewUrl}
              className="w-full h-[80vh] border rounded-md"
              title="PI PDF Preview"
            />
          ) : (
            <div className="h-[80vh] flex items-center justify-center text-sm text-gray-500">
              Preview unavailable
            </div>
          )}
          <DialogFooter>
            {previewDocType === "INVOICE" && pendingSellContext ? (
              <>
                <Button variant="outline" onClick={() => setShowPIPreview(false)} disabled={isConfirmingSell}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmSellFromPreview} disabled={isConfirmingSell}>
                  {isConfirmingSell ? "Confirming..." : "Confirm Sell"}
                </Button>
              </>
            ) : previewDocType === "PI" && pendingPIContext ? (
              <>
                <Button variant="outline" onClick={() => setShowPIPreview(false)} disabled={isConfirmingPI}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmPIFromPreview} disabled={isConfirmingPI}>
                  {isConfirmingPI ? "Confirming..." : "Confirm PI"}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setShowPIPreview(false)}>
                Close
              </Button>
            )}
            {piPreviewUrl && (
              <Button
                onClick={() => window.open(piPreviewUrl, "_blank", "noopener,noreferrer")}
              >
                Open In New Tab
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        id="printable-pi-preview"
        style={{
          position: "absolute",
          top: "-10000px",
          left: "-10000px",
          backgroundColor: "#ffffff",
          color: "#000000",
          width: "210mm",
        }}
      >
        {piPreviewData && <PrintLayout pi={piPreviewData} docType={previewDocType} />}
      </div>
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select or Create Client Cart</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {clientCarts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Existing Carts</h4>
                <div className="space-y-2">
                  {clientCarts.map((cart) => (
                    <Button
                      key={cart.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleSelectExistingCart(cart.id)}
                    >
                      <ShoppingCart className="size-4 mr-2" />
                      {cart.clientName} ({cart.items.length} items)
                    </Button>
                  ))}
                </div>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-medium border-b pb-1">New Cart</h4>
              <div>
                <Label className="text-[10px] uppercase font-bold text-gray-400">
                  Client Name *
                </Label>
                <Input
                  type="text"
                  placeholder="Enter client name..."
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateNewCartFromDialog()}
                  autoFocus
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-gray-400">
                    Phone
                  </Label>
                  <Input
                    type="tel"
                    placeholder="Contact number"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateNewCartFromDialog()}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-gray-400">
                    Referral / Partner
                  </Label>
                  <Input
                    type="text"
                    placeholder="Designer, Agent, etc."
                    value={referralSource}
                    onChange={(e) => setReferralSource(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateNewCartFromDialog()}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowClientDialog(false);
                setPendingProduct(null);
                setPendingCartItems(null);
                setPendingContinuation(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNewCartFromDialog}
              disabled={!newClientName.trim()}
            >
              Create New Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
