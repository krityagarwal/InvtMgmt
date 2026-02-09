import { useState, useEffect } from "react";
import { ShoppingCart, Package, FileText, Scan, FileCheck, Home} from "lucide-react";
import { Scanner, Product } from "./components/Scanner";
import { Inventory } from "./components/Inventory";
import { Orders, Order } from "./components/Orders";
import { Cart, CartItem } from "./components/Cart";
import { CartManager, ClientCart } from "./components/CartManager";
import { ProformaInvoices, ProformaInvoice } from "./components/ProformaInvoices";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
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

// 1. Hardcode your preferred Shop ID here for now
const PRESELECTED_SHOP_ID = "102e6445-6462-4cb6-bcbf-e9dd43a70b7e";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type View = "home" | "scanner" | "inventory" | "orders" | "cart" | "proforma";

export default function App() {
  //const [currentView, setCurrentView] = useState<View>("scanner");
  const [clientCarts, setClientCarts] = useState<ClientCart[]>([]);
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]); 
  const [searchResult, setSearchResult] = useState<Product | null>(null);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<number>(1); // New state
  const [newClientName, setNewClientName] = useState("");
  const [editingPI, setEditingPI] = useState<ProformaInvoice | null>(null);
  // Compute proformaOrders from orders to ensure it's always in sync
  const proformaOrders = orders.filter(o => o.status === 'pi');
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  // Keep your existing View state, but we'll add a "home" view
  const [currentView, setCurrentView] = useState<View | "home">("home");
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [activeCartLoaded, setActiveCartLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

    useEffect(() => {
      // 1. Initial Session Check
      // This runs once when the app loads to see if the user is already logged in
      const checkInitialSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
        } catch (error) {
          console.error("Error checking session:", error);
        } finally {
          // Once we have checked (success or fail), we stop the loading state
          setInitializing(false);
        }
      };

      checkInitialSession();

      // 2. Auth State Listener
      // This is vital for the Invitation Flow. When a user clicks the email link,
      // Supabase updates the auth state, and this listener detects it to log them in.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        
        // Optional: If you want to automatically redirect to home on login
        if (session) {
          setCurrentView("home");
        }
      });

      // 3. Cleanup
      // Unsubscribe from the listener when the component unmounts to prevent memory leaks
      return () => {
        subscription.unsubscribe();
      };
    }, []);

    // NEW: Data Fetching Effect
    useEffect(() => {
      // Only fetch data if we have an active session
      if (!session) return;
      setSearchResult(null);     // Clears the scanner card
      setPendingQuantity(1);     // Resets internal stepper
      setNewClientName("");      // Clears dialog input
      // -----------------------------
      const loadData = async () => {
        switch (currentView) {
          case "inventory":
            await handleLoadInventory();
            break;
          case "cart":
            if (clientCarts.length === 0) {
              await handleLoadActiveCarts();
            }
            break;
          case "proforma":
            await handleLoadProformaInvoices();
            break;
          case "orders":
            try {
              const data = await apiCall(`${API_BASE_URL}/orders/list/${PRESELECTED_SHOP_ID}`);
              
              const mappedOrders: Order[] = data.map((o: any) => ({
                id: o.id,
                orderNumber: o.id.slice(0, 8).toUpperCase(), // Using ID snippet as Order #
                customerName: o.client_name || "Unknown",
                total: o.final_total || 0,
                status: o.status,
                date: new Date(o.created_at).toLocaleDateString(),
                discount: o.discount_percent || 0,
                paidAmount: o.paid_amount || 0
              }));
              
              setOrders(mappedOrders);
            } catch (error) {
              console.error("Failed to load orders:", error);
            }
            break;
          default:
            // 'home' or 'scanner' might not need an initial API call
            break;
        }
      };

      loadData();
    }, [currentView, session]); // This effect "watches" these two variables

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
      name: item.item_code
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
          createdAt: order.created_at,
          discount: order.discount_percent || 0,
          tax: order.tax_percent || 18,
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
  const handleLoadOrders = async () => {
    if (ordersLoaded) return; // Don't reload if already loaded
    try {
      const data = await apiCall(`${API_BASE_URL}/orders/list/${PRESELECTED_SHOP_ID}`);
      
      const mappedOrders: Order[] = data.map((o: any) => ({
        id: o.id,
        orderNumber: o.id.slice(0, 8).toUpperCase(),
        customerName: o.client_name || "Unknown",
        total: o.final_total || 0,
        status: o.status,
        date: new Date(o.created_at).toLocaleDateString(),
        discount: o.discount_percent || 0,
        items: [],
        paidAmount: o.paid_amount || 0
      }));
      
      setOrders(mappedOrders);
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
        items: []
      }));
      
      setOrders(mappedOrders);
    } catch (error) {
      console.error("Failed to load proforma invoices:", error);
    }
  };

    const handleProductSearch = async (code: string) => {
    if (!code.trim()) return;
    
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
          photo_url: item.photo_url
        };
        
        setSearchResult(foundProduct);
      } else {
        toast.error(`Product ${code} not found`);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const activeCart = clientCarts.find((cart) => cart.id === activeCartId);

  const handleAddToCart = async (product: Product, quantity: number = 1) => {
    // 1. If no active cart, show dialog to select or create cart
    if (!activeCartId) {
      setPendingProduct(product);
      setPendingQuantity(quantity); // Save the stepped-up value
      setShowClientDialog(true);
      return;
    }

    try {
      // 2. Prepare the payload for main.py
      const payload = {
        order_id: activeCartId, // The UUID of the order/basket
        product_id: product.id,
        qty: quantity
      };

      await apiCall(`${API_BASE_URL}/basket/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // 3. Update local UI state only after successful API response
      setClientCarts((prev) =>
        prev.map((cart) => {
          if (cart.id !== activeCartId) return cart;
          
          const existing = cart.items.find((item) => item.id === product.id);
          if (existing) {
            return {
              ...cart,
              items: cart.items.map((item) =>
                item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
              ),
            };
          } else {
            return {
              ...cart,
              items: [...cart.items, { id: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock }],
            };
          }
        })
      );
      
      toast.success(`Added ${quantity} units of ${product.name}`);
      setSearchResult(null);      // Removes the result card from UI
      setPendingQuantity(1);      // Resets the count for the NEXT scan

    } catch (error) {
      console.error("Cart API Error:", error);
      toast.error("Could not sync with server");
    }
  };


  const handleCreateCart = async (clientName: string, quantity: number = 1) => {
    try {
      // 1. Single API call creates both the Order and the first Item
      const data = await apiCall(`${API_BASE_URL}/basket/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: PRESELECTED_SHOP_ID,
          client_name: clientName,
          initial_product_id: pendingProduct?.id, // Pass the scanned item ID
          qty: quantity // Send the actual quantity selected in the stepper
        }),
      });

      // 2. Prepare the items array for local state immediately
      const initialItems = pendingProduct ? [{ 
        id: pendingProduct.id, 
        name: pendingProduct.name, 
        price: pendingProduct.price, 
        quantity: quantity,
        stock: pendingProduct.stock 
      }] : [];

      // 3. Construct the full Cart object once
      const newCart: ClientCart = {
        id: data.order_id,
        clientName: data.client_name,
        items: initialItems,
        createdAt: new Date().toISOString(),
        discount: 0, 
        tax: 18
      };

      // 4. Update all states in a single batch
      setClientCarts((prev) => [...prev, newCart]);
      setActiveCartId(data.order_id);
      setSearchResult(null);
      setPendingQuantity(1);
      setPendingProduct(null);
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
        handleAddToCart(pendingProduct, pendingQuantity);
        setPendingProduct(null);
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

  const handleCheckout = async () => {
    if (!activeCartId) return;

    // 1. Find the active cart to get its specific discount
    const activeCart = clientCarts.find((c) => c.id === activeCartId);
    // FINAL VALIDATION: Check stock one last time before calling API
    const hasShortage = activeCart?.items.some(item => {
      const masterProduct = products.find(p => p.id === item.id);
      const available = masterProduct ? (masterProduct.displayStock + masterProduct.godownStock) : 0;
      return item.quantity > available;
    });

    if (hasShortage) {
      toast.error("Cannot finalize sale: One or more items exceed available stock.");
      return; // Stop the execution here
    }
    
    // 2. Extract values and ensure they are numbers, not objects or undefined
    const d = Number(activeCart?.discount) || 0; 
    const t = activeCart?.tax !== undefined ? Number(activeCart.tax) : 18;
    const paid = activeCart?.advancePaid || 0;

    try {
      // 3. Send the clean numbers to the backend
      await apiCall(
        `${API_BASE_URL}/order/finalize-sale?order_id=${activeCartId}&discount=${d}&tax=${t}&paid_amount=${paid}`,
        { method: "POST" }
      );

      toast.success(`Sale finalized! Stock levels updated. Paid: ₹${paid}`);
      // REFRESH INVENTORY: After a sale, we MUST re-fetch products to see the new stock
      await handleLoadInventory();
      setActiveCartId(null);
      setClientCarts((prev) => prev.filter((c) => c.id !== activeCartId));
      setCurrentView("orders");
    } catch (error) {
      // apiCall handles the error toast automatically
      console.error("Checkout error:", error);
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
          discount: o.discount_percent || 0
        }));
        
        setOrders(mappedOrders);
      }

      const apiData = await apiCall(`${API_BASE_URL}/basket/details/${orderId}`);

      const mappedItems = apiData.order_items.map((item: any) => ({
        name: item.item_code,
        quantity: item.quantity,
        price: item.unit_price
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
            final_total: apiData.final_total
          } : o
        );
      });
    } catch (error) { 
      console.error("Failed to load items:", error);
    }
  };

  const updateCartTax = (cartId: string | null, newTax: number | "") => {
    const taxValue = newTax === "" ? 18 : newTax; // Default to 18 if empty
    setClientCarts((prevCarts) =>
      prevCarts.map((cart) =>
        cart.id === cartId ? { ...cart, tax: taxValue } : cart
      )
    );
  };

  const handleUpdateDiscount = (discount: number) => {
    if (!activeCartId) return;

    setClientCarts((prev) =>
      prev.map((cart) => {
        if (cart.id !== activeCartId) return cart;
        return { ...cart, discount }; // State updated with the new number
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

  const handleGeneratePI = async () => {
    if (!activeCartId) return;
    // Store the ID in a local variable so we don't lose it during state updates
    const cartIdToConvert = activeCartId;
    try {
      // Extract discount and tax values, same as handleCheckout
      const d = Number(activeCart?.discount) || 0;
      const t = activeCart?.tax !== undefined ? Number(activeCart.tax) : 18;
      const paid = activeCart?.advancePaid || 0; // Capture the payment value

      // Update order status to 'pi' in backend
       await apiCall(`${API_BASE_URL}/order/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          order_id: activeCartId, 
          status: "pi",
          discount_percent: d,
          tax_percent: t,
          paid_amount: paid // ADD THIS LINE
        }),
      });

      toast.success(`Proforma Invoice Generated for ${activeCart?.clientName}!`);

      // 1. Remove from the list first using the local variable
      setClientCarts((prev) => prev.filter((c) => c.id !== cartIdToConvert));
      // 2. Clear the selection
      setActiveCartId(null); 
      // 3. Navigate away
      setCurrentView("proforma");
      
    } catch (error) {
      toast.error("Failed to generate PI");
    }
  };

  const handleEditPI = async (pi: ProformaInvoice) => {
    try {
      // 1. Fetch fresh items directly from the source to ensure they exist
      const data = await apiCall(`${API_BASE_URL}/basket/details/${pi.id}`);
      
      // 2. Map the backend items to CartItem format
      const freshItems = data.order_items.map((item: any) => ({
        id: item.product_id,
        name: item.item_code,
        price: item.unit_price,
        quantity: item.quantity,
        stock: 0 // Placeholder stock for editing
      }));

      // 3. Create or Update the Cart session
      const newCart: ClientCart = {
        id: pi.id,
        clientName: pi.clientName,
        items: freshItems,
        discount: pi.discount || 0,
        createdAt: pi.createdAt,
        tax: 18,
        advancePaid: pi.paidAmount || 0
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

  const handleRecordPayment = async (orderId: string, amount: number, method: string) => {
    try {
      await apiCall(`${API_BASE_URL}/order/record-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, amount, method }),
      });

      // Re-fetch orders to update the 'Paid' and 'Balance' columns
      await handleLoadOrders(); 
      toast.success(`Payment of ₹${amount} recorded successfully!`);
    } catch (error) {
      console.error("Payment failed:", error);
    }
  };

  // Handle Loading State
  if (initializing) return <GlobalLoader />;

  // IF NOT LOGGED IN -> Show Login Page
  if (!session) {
    return <LoginForm />;
  }

  // 2. HOME VIEW CHECK (Add this block)
  if (currentView === "home") {
    return (
      <>
        <Toaster />
        <HomeScreen onNavigate={(view: any) => setCurrentView(view)} />
      </>
    );
  }

// ADD THESE LOGS HERE:
  console.log("--- RENDER DEBUG ---");
  console.log("1. Current View:", currentView);
  console.log("2. Active Cart ID:", activeCartId);
  console.log("3. Total Carts in State:", clientCarts.length);
  console.log("4. Active Cart Object Found:", activeCart);
  console.log("5. Items in Active Cart:", activeCart?.items);

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />

      {isLoading && <GlobalLoader />}

      {/* 1. THE HOMESCREEN VIEW: No header, full-screen dashboard */}
      {currentView === "home" ? (
        <HomeScreen 
          onNavigate={(view) => setCurrentView(view)} 
          cartCount={clientCarts.length} 
        />
      ) : (
        /* 2. THE MODULE VIEW: Clean header + specific content */
        <>
          <header className="bg-white border-b sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Left Side: The only way back and the current context */}
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

                {/* Right Side: Keep only essential global actions if needed, otherwise empty */}
                <div className="flex items-center gap-4">
                   {/* Optional: User initials or a simplified cart indicator */}
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


      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentView === "scanner" && (
          <div>
            {activeCart && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Adding items to <strong>{activeCart.clientName}</strong>'s cart
                  {activeCart.items.length > 0 && 
                    ` (${activeCart.items.reduce((sum, item) => sum + item.quantity, 0)} items)`
                  }
                </p>
              </div>
            )}
            <Scanner products={products} onAddToCart={handleAddToCart} onProductSearch={handleProductSearch} searchResult={searchResult} />
          </div>
        )}
        {currentView === "inventory" && <Inventory products={products} />}
        {currentView === "orders" && <Orders orders={orders} onFetchDetails={fetchOrderItems} onRecordPayment={handleRecordPayment} />}
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
              onUpdateAdvance={handleUpdateAdvance}
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
              items: o.items,
              discount: o.discount || 0,
              status: "draft", // Default UI display status
              createdAt: o.date,
              updatedAt: o.date,
              subtotal: o.subtotal,
              discount_amount: o.discount_amount,
              discount_percent: o.discount_percent,
              tax_percent: o.tax_percent,
              tax_amount: o.tax_amount,
              final_total: o.final_total,
              paidAmount: o.paidAmount || 0,
              total: o.total
            }))
            }
            onEditPI={handleEditPI}
            onConvertToOrder={handleCheckout}
            onDeletePI={handleCloseCart}
            onUpdateStatus={handleUpdatePIStatus}
            onFetchDetails={fetchOrderItems} // Pass the item fetcher here too!
          />
        )}
      </main>
      </>
      )}

      {/* Client Selection Dialog */}
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
            <div>
              <h4 className="text-sm font-medium mb-2">New Cart</h4>
              <Input
                type="text"
                placeholder="Enter client name..."
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateNewCartFromDialog()}
                autoFocus
              />
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