import { useState, useEffect, useRef } from "react";
import { ShoppingCart, Package, FileText, Scan, FileCheck, Home} from "lucide-react";
import { Scanner, Product } from "./components/Scanner";
import { Inventory, ExtendedProduct } from "./components/Inventory";
import { Orders, Order } from "./components/Orders";
import { Cart, CartItem } from "./components/Cart";
import { CartManager, ClientCart } from "./components/CartManager";
import { ProformaInvoices, ProformaInvoice, PrintLayout, PrintDocumentType } from "./components/ProformaInvoices";
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

type View = "home" | "scanner" | "inventory" | "orders" | "cart" | "proforma" | "login";

export default function App() {
  const [clientCarts, setClientCarts] = useState<ClientCart[]>([]);
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]); 
  const [searchResult, setSearchResult] = useState<Product | null>(null);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<number>(1); // New state
  const [pendingAttribute, setPendingAttribute] = useState<string>("None");
  const [newClientName, setNewClientName] = useState("");
  const [editingPI, setEditingPI] = useState<ProformaInvoice | null>(null);
  const proformaOrders = orders.filter(o => o.status === 'pi');
  const [isLoading, setIsLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentView, setCurrentView] = useState<View>("login");
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [activeCartLoaded, setActiveCartLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
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
    estimatedProfit: 0,
  });
  const cartDraftRef = useRef<Record<string, { discount?: number; tax?: number; pricingMode?: "discount" | "finalized"; finalTotalOverride?: number }>>({});
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
      paid_amount: number;
      final_total_override?: number | null;
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
      paid_amount: number;
      final_total_override?: number | null;
      referral_source: string;
      delivery_address: string;
      client_phone: string;
    };
  } | null>(null);
  const [isConfirmingPI, setIsConfirmingPI] = useState(false);
  const previewPdfUrlRef = useRef<string | null>(null);

  const activeCart = clientCarts.find((cart) => cart.id === activeCartId);
  const [autoDownloadPIId, setAutoDownloadPIId] = useState<string | null>(null);

  const viewRef = useRef(currentView);

  // 1. Monitor View changes
useEffect(() => {
  console.log("🚩 VIEW CHANGED TO:", currentView);
  // This will tell us if a piece of code is manually calling setCurrentView('home')
}, [currentView]);

// 2. Monitor Auth State Changes
useEffect(() => {
  console.log("🔐 SESSION STATE:", session ? "Logged In" : "Logged Out");
}, [session]);

// 3. Monitor the Bootstrap Ref
useEffect(() => {
  console.log("⚙️ BOOTSTRAP DONE REF:", bootstrapDoneRef.current);
}, [bootstrapDoneRef.current]);

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
        console.log("📡 Supabase Event:", _event); // See if it's a 'SIGNED_IN' or 'TOKEN_REFRESH'  
        setSession((prev: Session | null) => {
          if (prev?.access_token === newSession?.access_token) {
            return prev; // prevent useless rerender
          }
          return newSession;
        });

        // 3. Update the Auth Listener to check the REF, not the STATE
        if (newSession && viewRef.current === "login") {
          console.log("🚀 Redirecting to Home ONLY because user is actually on login");
          setCurrentView("home");
        } else {
          // If viewRef.current is 'inventory', this block will now correctly do nothing!
          console.log("✅ Staying on current view:", viewRef.current);
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


  const apiCall = async (url: string, options?: RequestInit) => {
    setIsLoading(true);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Network response was not ok");
      }
      return await response.json(); 
    } catch (error: any) {
      toast.error(error.message || "Something went wrong");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRoundedBilling = (
    subtotal: number,
    discountPercent: number,
    taxPercent: number
  ) => {
    const safeSubtotal = Number(subtotal) || 0;
    const safeDiscount = Number(discountPercent) || 0;
    const safeTax = Number(taxPercent) || 0;

    const discountAmount = Math.floor(safeSubtotal * (safeDiscount / 100));
    const taxableAmount = Math.max(0, safeSubtotal - discountAmount);
    const taxAmount = Math.ceil(taxableAmount * (safeTax / 100));
    const finalTotal = taxableAmount + taxAmount;

    return { discountAmount, taxAmount, finalTotal };
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
      const response = await fetch(`${API_BASE_URL}/inventory/${updatedProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });

      if (!response.ok) throw new Error("Update failed");

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

  const handleLoadInventory = async () => {
    const data = await apiCall(`${API_BASE_URL}/inventory/${PRESELECTED_SHOP_ID}`);
    
    const mappedProducts = data.map((item: any) => ({
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
    
    setProducts(mappedProducts);
    setInventoryLoaded(true);
  };

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
  // On-demand: Load orders when button is clicked
  const handleLoadOrders = async (force = false) => {
    if (ordersLoaded && !force) return; // Don't reload if already loaded
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
        items: [],
        paidAmount: o.paid_amount || 0,
        discountAmount: o.discount_amount || 0,
        taxAmount: o.tax_amount || 0
      }));
      
      setOrders(mappedOrders);
      setOrderSummary({
        totalRevenue: Number(summary.total_revenue) || 0,
        totalReceived: Number(summary.total_received) || 0,
        totalDue: Number(summary.total_due) || 0,
        estimatedProfit: Number(summary.estimated_profit) || 0,
      });
      setOrdersLoaded(true);
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
        discountAmount: o.discount_amount || 0,
        taxAmount: o.tax_amount || 0,
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

  const handleCreateCart = async (clientName: string, quantity: number = 1) => {
    try {
      // Create the metadata array for the first item being added
      const initialMetadata = [{ label: pendingAttribute || "None", qty: quantity }];
      // 1. Single API call creates both the Order and the first Item
      const data = await apiCall(`${API_BASE_URL}/basket/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: PRESELECTED_SHOP_ID,
          client_name: clientName,
          initial_product_id: pendingProduct?.id, // Pass the scanned item ID
          qty: quantity, // Send the actual quantity selected in the stepper
          client_phone: clientPhone || null,        // Match interface
          referral_source: referralSource,  // Match interface
          delivery_address: deliveryAddress || null, // Match interface
          attribute_metadata: initialMetadata
        }),
      });

      // 2. Prepare the items array for local state immediately
      const initialItems = pendingProduct ? [{ 
        id: pendingProduct.id, 
        name: pendingProduct.name, 
        price: pendingProduct.price, 
        quantity: quantity,
        stock: pendingProduct.stock,
        attribute_metadata: initialMetadata
      }] : [];

      // 3. Construct the full Cart object once
      const newCart: ClientCart = {
        id: data.order_id,
        clientName: data.client_name,
        clientPhone: clientPhone,
        referralSource: referralSource,
        deliveryAddress: deliveryAddress || "",
        items: initialItems,
        createdAt: new Date().toISOString(),
        discount: 0, 
        tax: 0
      };

      // 4. Update all states in a single batch
      setClientCarts((prev) => [...prev, newCart]);
      setActiveCartId(data.order_id);
      setClientPhone("");
      setReferralSource("");
      setDeliveryAddress("");
      setSearchResult(null);
      setPendingQuantity(1);
      setPendingProduct(null);
      setPendingAttribute("None");
      setShowClientDialog(false); // Close the dialog
      
      toast.success(`Session started for ${clientName}${pendingProduct ? ` with ${pendingProduct.name}` : ''}`);
    } catch (error) {
      // apiCall handles the error toast automatically
      console.error("Cart creation failed:", error);
    }
};

  const handleSelectExistingCart = (cartId: string) => {
    setActiveCartId(cartId);
    setShowClientDialog(false);
    
    // If there was a pending product, add it now
    if (pendingProduct) {
      setTimeout(() => {
        handleAddToCart(pendingProduct, pendingQuantity, pendingAttribute);
        // Cleanup pending states
        setPendingProduct(null);
        setPendingQuantity(1);
        setPendingAttribute("None"); // Reset to default
      }, 100);
    }
  };

  const handleCreateNewCartFromDialog = () => {
    if (newClientName.trim()) {
      handleCreateCart(newClientName.trim(), pendingQuantity);
      setNewClientName("");
      setPendingQuantity(1); // Reset to default
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
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    return pdf;
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
        discount_percent: details.discount_percent ?? target.discount_percent ?? target.discount ?? 0,
        tax_percent: details.tax_percent ?? target.tax_percent ?? 0,
        tax_amount: details.tax_amount || target.tax_amount || 0,
        final_total: details.final_total || target.final_total || target.total || 0,
        total: details.final_total || target.total || 0,
        paidAmount: target.paidAmount || 0,
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
        tax: draft.tax ?? cart.tax,
      };
    })();
    if (!activeCart) return;

    // 1. FINAL VALIDATION: Check stock one last time
    const hasShortage = activeCart.items.some(item => {
      const masterProduct = products.find(p => p.id === item.id);
      const available = masterProduct ? (masterProduct.displayStock + masterProduct.godownStock) : 0;
      return item.quantity > available;
    });

    if (hasShortage) {
      toast.error("Cannot finalize sale: One or more items exceed available stock.");
      return;
    }
    
    // 2. Prepare the Request Body (JSON)
    // We include all the metadata that was previously being lost
    const payload = {
      order_id: activeCartId,
      discount_percent: Number(activeCart.discount) || 0,
      tax_percent: activeCart.tax !== undefined ? Number(activeCart.tax) : 0,
      paid_amount: Number(activeCart.advancePaid) || 0,
      final_total_override:
        draft.pricingMode === "finalized" && draft.finalTotalOverride !== undefined
          ? Number(draft.finalTotalOverride)
          : null,
      referral_source: activeCart.referralSource || "",
      delivery_address: activeCart.deliveryAddress || "",
      client_phone: activeCart.clientPhone || ""
    };

    try {
      const effectiveDiscount = Number(activeCart.discount) || 0;
      const effectiveTax = activeCart.tax !== undefined ? Number(activeCart.tax) : 0;
      const details = await apiCall(`${API_BASE_URL}/basket/details/${activeCartId}`);
      const subtotal = Number(details.subtotal) || 0;
      const { discountAmount, taxAmount, finalTotal } = calculateRoundedBilling(
        subtotal,
        effectiveDiscount,
        effectiveTax
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
          discountAmount: o.discount_amount || 0,
          taxAmount: o.tax_amount || 0,
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
            discount_percent: apiData.discount_percent,
            tax_percent: apiData.tax_percent,
            tax_amount: apiData.tax_amount,
            final_total: apiData.final_total,
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

  const updateCartTax = (cartId: string | null, newTax: number | "") => {
    const taxValue = newTax === "" ? 0 : newTax; // Default to 0 if empty
    if (cartId) {
      cartDraftRef.current[cartId] = {
        ...cartDraftRef.current[cartId],
        tax: Number(taxValue),
      };
    }
    setClientCarts((prevCarts) =>
      prevCarts.map((cart) =>
        cart.id === cartId ? { ...cart, tax: taxValue } : cart
      )
    );
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

  const handlePricingModeChange = (mode: "discount" | "finalized") => {
    if (!activeCartId) return;
    cartDraftRef.current[activeCartId] = {
      ...cartDraftRef.current[activeCartId],
      pricingMode: mode,
      finalTotalOverride:
        mode === "finalized" ? cartDraftRef.current[activeCartId]?.finalTotalOverride : undefined,
    };
  };

  const handleFinalizedPriceChange = (value: number | null) => {
    if (!activeCartId) return;
    cartDraftRef.current[activeCartId] = {
      ...cartDraftRef.current[activeCartId],
      finalTotalOverride: value === null ? undefined : Number(value),
    };
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
        tax: draft.tax ?? cart.tax,
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
          tax_percent: activeCart.tax !== undefined ? Number(activeCart.tax) : 0,
          paid_amount: activeCart.advancePaid || 0,
          final_total_override:
            draft.pricingMode === "finalized" && draft.finalTotalOverride !== undefined
              ? Number(draft.finalTotalOverride)
              : null,
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
        tax: draft.tax ?? cart.tax,
      };
    })();
    if (!activeCart) return;
    const cartIdToConvert = activeCartId;
    
    try {
      const piPayload = {
        order_id: cartIdToConvert,
        status: "pi",
        discount_percent: Number(activeCart.discount) || 0,
        tax_percent: activeCart.tax !== undefined ? Number(activeCart.tax) : 0,
        paid_amount: activeCart.advancePaid || 0,
        final_total_override:
          draft.pricingMode === "finalized" && draft.finalTotalOverride !== undefined
            ? Number(draft.finalTotalOverride)
            : null,
        referral_source: activeCart.referralSource || "",
        delivery_address: activeCart.deliveryAddress || "",
        client_phone: activeCart.clientPhone || ""
      };

      // Preview first; do not persist PI yet
      const piDetails = await apiCall(`${API_BASE_URL}/basket/details/${cartIdToConvert}`);
      const effectiveDiscount = Number(activeCart.discount) || 0;
      const effectiveTax = activeCart.tax !== undefined ? Number(activeCart.tax) : 0;
      const subtotal = Number(piDetails.subtotal) || 0;
      const { discountAmount, taxAmount, finalTotal } = calculateRoundedBilling(
        subtotal,
        effectiveDiscount,
        effectiveTax
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
        tax: Number(data.tax_percent ?? 0),
        pricingMode: "finalized",
        finalTotalOverride:
          data.final_total !== undefined && data.final_total !== null
            ? Number(data.final_total)
            : undefined,
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
  const activeCartDraft = activeCartId ? cartDraftRef.current[activeCartId] : undefined;

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

  const handleRecordPayment = async (orderId: string, amount: number, method: string) => {
    try {
      await apiCall(`${API_BASE_URL}/order/record-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, amount, method }),
      });

      // Re-fetch orders to update the 'Paid' and 'Balance' columns
      await handleLoadOrders(true); 
      toast.success(`Payment of ₹${amount} recorded successfully!`);
    } catch (error) {
      console.error("Payment failed:", error);
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

  // Handle Loading State
  if (initializing) return <GlobalLoader />;

  // IF NOT LOGGED IN -> Show Login Page
  // if (!session) {
  //   return <LoginForm />;
  // }

  // // 2. HOME VIEW CHECK (Add this block)
  // if (currentView === "home") {
  //   return (
  //     <>
  //       <Toaster />
  //       <HomeScreen onNavigate={(view: any) => setCurrentView(view)} 
  //         cartCount={clientCarts.length}/>
  //     </>
  //   );
  //}

  // return (
  //   <div className="min-h-screen bg-gray-50">
  //     <Toaster />

  //     {isLoading && <GlobalLoader />}

  //     {(currentView as string) === "home" ? (
  //       <HomeScreen 
  //         onNavigate={(view) => setCurrentView(view as View)} 
  //         cartCount={clientCarts.length} 
  //       />
  //     ) : (
  //       <>
  //         <header className="bg-white border-b sticky top-0 z-50">
  //           <div className="max-w-7xl mx-auto px-6 py-4">
  //             <div className="flex items-center justify-between">
  //               {/* Left Side: The only way back and the current context */}
  //               <div className="flex items-center gap-4">
  //                 <Button
  //                   variant="ghost"
  //                   onClick={() => setCurrentView("home")}
  //                   className="text-gray-600 hover:text-blue-600 transition-colors px-2"
  //                 >
  //                   <Home className="size-5 mr-2" />
  //                   <span className="font-semibold">Dashboard</span>
  //                 </Button>
  //                 <div className="h-6 w-px bg-gray-200" />
  //                 <h1 className="text-xl font-bold text-gray-900 capitalize">
  //                   {currentView === 'proforma' ? 'Proforma Invoices' : currentView}
  //                 </h1>
  //               </div>

  //               {/* Right Side: Keep only essential global actions if needed, otherwise empty */}
  //               <div className="flex items-center gap-4">
  //                  {/* Optional: User initials or a simplified cart indicator */}
  //                  {currentView !== 'cart' && clientCarts.length > 0 && (
  //                    <Button variant="outline" size="sm" onClick={() => setCurrentView('cart')} className="rounded-full">
  //                       <ShoppingCart className="size-4 mr-2" />
  //                       {clientCarts.length} Active
  //                    </Button>
  //                  )}
  //               </div>
  //             </div>
  //           </div>
  //         </header>


  //     {/* Main Content */}
  //     <main className="max-w-7xl mx-auto px-4 py-8">
  //       {currentView === "scanner" && inventoryReady && (
  //         <div>
  //           {activeCart && (
  //             <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
  //               <p className="text-sm text-blue-800">
  //                 Adding items to <strong>{activeCart.clientName}</strong>'s cart
  //                 {activeCart.items.length > 0 && 
  //                   ` (${activeCart.items.reduce((sum, item) => sum + item.quantity, 0)} items)`
  //                 }
  //               </p>
  //             </div>
  //           )}
  //           <Scanner products={products || []} onAddToCart={handleAddToCart} onProductSearch={handleProductSearch} searchResult={searchResult} />
  //         </div>
  //       )}
  //       {currentView === "inventory" && <Inventory products={products as unknown as ExtendedProduct[]} onUpdateInventory={handleUpdateInventory} onBulkAdd={handleBulkAdd} />}
  //       {currentView === "orders" && <Orders orders={orders} onFetchDetails={fetchOrderItems} onRecordPayment={handleRecordPayment} />}
  //       {currentView === "cart" && (
  //         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  //           <CartManager
  //             carts={clientCarts}
  //             activeCartId={activeCartId}
  //             onSelectCart={handleSelectCart}
  //             onCreateCart={handleCreateCart}
  //             onCloseCart={handleCloseCart}
  //           />
  //           <Cart
  //             items={activeCart?.items || []}
  //             products={products}
  //             clientName={activeCart?.clientName || null}
  //             discount={activeCart?.discount || 0}
  //             activeCart={activeCart}
  //             activeCartId={activeCartId}
  //             onUpdateQuantity={handleUpdateQuantity}
  //             onRemoveItem={handleRemoveItem}
  //             onCheckout={handleCheckout}
  //             onUpdateDiscount={handleUpdateDiscount}
  //             updateCartTax={updateCartTax}
  //             onGeneratePI={handleGeneratePI}
  //             onSaveCart={handleSaveCart}
  //             onUpdateAdvance={handleUpdateAdvance}
  //             onUpdateAddress={(val) => handleUpdateCartMetadata('deliveryAddress', val)} //
  //             onUpdatePhone={(val) => handleUpdateCartMetadata('clientPhone', val)}       //
  //             onUpdateReferral={(val) => handleUpdateCartMetadata('referralSource', val)} //
  //           />
  //         </div>
  //       )}
  //       {currentView === "proforma" && (
  //         <ProformaInvoices
  //           products={products}
  //           invoices={proformaOrders.map(o => ({
  //             id: o.id,
  //             piNumber: o.orderNumber,
  //             clientName: o.customerName,
  //             items: o.items || [],
  //             discount: o.discount || 0,
  //             status: o.status as any,
  //             createdAt: o.date,
  //             updatedAt: o.date,
  //             subtotal: o.subtotal,
  //             discount_amount: o.discount_amount,
  //             discount_percent: o.discount_percent,
  //             tax_percent: o.tax_percent,
  //             tax_amount: o.tax_amount,
  //             final_total: o.final_total,
  //             paidAmount: o.paidAmount || 0,
  //             total: o.total,
  //             clientPhone: o.clientPhone,        
  //             referralSource: o.referralSource, 
  //             deliveryAddress: o.deliveryAddress
  //           }))
  //           }
  //           onEditPI={handleEditPI}
  //           onConvertToOrder={handleCheckout}
  //           onDeletePI={handleCloseCart}
  //           onUpdateStatus={handleUpdatePIStatus}
  //           onFetchDetails={fetchOrderItems} // Pass the item fetcher here too!
  //           initialDownloadId={autoDownloadPIId} // Add this prop
  //           onClearInitialDownload={() => setAutoDownloadPIId(null)} // Add this prop
  //         />
  //       )}
  //     </main>
  //     </>
  //     )}

  //     {/* Client Selection Dialog */}
  //     <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
  //       <DialogContent>
  //         <DialogHeader>
  //           <DialogTitle>Select or Create Client Cart</DialogTitle>
  //         </DialogHeader>
  //         <div className="py-4 space-y-4">
  //           {clientCarts.length > 0 && (
  //             <div>
  //               <h4 className="text-sm font-medium mb-2">Existing Carts</h4>
  //               <div className="space-y-2">
  //                 {clientCarts.map((cart) => (
  //                   <Button
  //                     key={cart.id}
  //                     variant="outline"
  //                     className="w-full justify-start"
  //                     onClick={() => handleSelectExistingCart(cart.id)}
  //                   >
  //                     <ShoppingCart className="size-4 mr-2" />
  //                     {cart.clientName} ({cart.items.length} items)
  //                   </Button>
  //                 ))}
  //               </div>
  //               <div className="relative my-4">
  //                 <div className="absolute inset-0 flex items-center">
  //                   <div className="w-full border-t"></div>
  //                 </div>
  //                 <div className="relative flex justify-center text-xs uppercase">
  //                   <span className="bg-white px-2 text-gray-500">Or</span>
  //                 </div>
  //               </div>
  //             </div>
  //           )}
  //           <div className="space-y-3">
  //             <h4 className="text-sm font-medium border-b pb-1">New Cart</h4>
              
  //             {/* Primary Field: Client Name */}
  //             <div>
  //               <Label className="text-[10px] uppercase font-bold text-gray-400">Client Name *</Label>
  //               <Input
  //                 type="text"
  //                 placeholder="Enter client name..."
  //                 value={newClientName}
  //                 onChange={(e) => setNewClientName(e.target.value)}
  //                 onKeyDown={(e) => e.key === "Enter" && handleCreateNewCartFromDialog()}
  //                 autoFocus
  //                 className="mt-1"
  //               />
  //             </div>

  //             {/* Secondary Row: Domain-Agnostic Optional Fields */}
  //             <div className="grid grid-cols-2 gap-3">
  //               <div>
  //                 <Label className="text-[10px] uppercase font-bold text-gray-400">Phone</Label>
  //                 <Input
  //                   type="tel"
  //                   placeholder="Contact number"
  //                   value={clientPhone} // Ensure this state is defined
  //                   onChange={(e) => setClientPhone(e.target.value)}
  //                   onKeyDown={(e) => e.key === "Enter" && handleCreateNewCartFromDialog()}
  //                   className="mt-1 text-sm"
  //                 />
  //               </div>
  //               <div>
  //                 <Label className="text-[10px] uppercase font-bold text-gray-400">Referral / Partner</Label>
  //                 <Input
  //                   type="text"
  //                   placeholder="Designer, Agent, etc."
  //                   value={referralSource} // Use 'referralSource' for domain flexibility
  //                   onChange={(e) => setReferralSource(e.target.value)}
  //                   onKeyDown={(e) => e.key === "Enter" && handleCreateNewCartFromDialog()}
  //                   className="mt-1 text-sm"
  //                 />
  //               </div>
  //             </div>
  //           </div>
  //         </div>
  //         <DialogFooter>
  //           <Button
  //             variant="outline"
  //             onClick={() => {
  //               setShowClientDialog(false);
  //               setPendingProduct(null);
  //             }}
  //           >
  //             Cancel
  //           </Button>
  //           <Button
  //             onClick={handleCreateNewCartFromDialog}
  //             disabled={!newClientName.trim()}
  //           >
  //             Create New Cart
  //           </Button>
  //         </DialogFooter>
  //       </DialogContent>
  //     </Dialog>
  //   </div>
  // );
// --- END OF LOGIC SECTION ---

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
                      {currentView === 'proforma' ? 'Proforma Invoices' : currentView}
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
                onAddToCartFromInventory={async (product, quantity, room) => {
                  await handleAddToCart(product as unknown as Product, quantity, room);
                }}
                activeCartId={activeCartId}
                activeCartLabel={activeCart?.clientName || null}
                onRequireActiveCart={() => {
                  setPendingProduct(null);
                  setPendingQuantity(1);
                  setPendingAttribute("None");
                  setShowClientDialog(true);
                }}
              />
            )}

            {currentView === "orders" && (
              <Orders
                orders={orders}
                onFetchDetails={fetchOrderItems}
                onRecordPayment={handleRecordPayment}
                onDownloadInvoice={handleDownloadInvoice}
                summary={orderSummary}
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
                  activeCart={activeCart}
                  activeCartId={activeCartId}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onCheckout={handleCheckout}
                  onUpdateDiscount={handleUpdateDiscount}
                  updateCartTax={updateCartTax}
                  onGeneratePI={handleGeneratePI}
                  onSaveCart={handleSaveCart}
                  onUpdateAdvance={handleUpdateAdvance}
                  onUpdateAddress={(val) => handleUpdateCartMetadata('deliveryAddress', val)}
                  onUpdatePhone={(val) => handleUpdateCartMetadata('clientPhone', val)}
                  onUpdateReferral={(val) => handleUpdateCartMetadata('referralSource', val)}
                  onPricingModeChange={handlePricingModeChange}
                  onFinalizedPriceChange={handleFinalizedPriceChange}
                  pricingModeDraft={activeCartDraft?.pricingMode}
                  finalTotalOverrideDraft={activeCartDraft?.finalTotalOverride}
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
