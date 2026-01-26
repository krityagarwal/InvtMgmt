import { useState, useEffect } from "react";
import { ShoppingCart, Package, FileText, Scan, FileCheck } from "lucide-react";
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

// 1. Hardcode your preferred Shop ID here for now
const PRESELECTED_SHOP_ID = "102e6445-6462-4cb6-bcbf-e9dd43a70b7e";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type View = "scanner" | "inventory" | "orders" | "cart" | "proforma";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("scanner");
  const [clientCarts, setClientCarts] = useState<ClientCart[]>([]);
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]); 
  const [searchResult, setSearchResult] = useState<Product | null>(null);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [editingPI, setEditingPI] = useState<ProformaInvoice | null>(null);

  // Compute proformaOrders from orders to ensure it's always in sync
  const proformaOrders = orders.filter(o => o.status === 'pi');
  const [isLoading, setIsLoading] = useState(false);

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

  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [activeCartLoaded, setActiveCartLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  // On-demand: Load inventory when button is clicked
  const handleLoadInventory = async () => {
    const data = await apiCall(`${API_BASE_URL}/inventory/${PRESELECTED_SHOP_ID}`);
    
    const mappedProducts = data.map((item: any) => ({
      id: item.id,
      barcode: item.item_code,
      vendor: item.vendor_name || "-", // Mapping vendor_name
      price: item.selling_price,
      displayStock: item.qty_display || 0, // Separate Display
      godownStock: item.qty_godown || 0,   // Separate Godown
      stock: (item.qty_display || 0) + (item.qty_godown || 0), // Total sum
      category: item.category_name || "General",
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
      setClientCarts(loadedCarts);
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
        items: []
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


  //   try {
  //     const item = await apiCall(`${API_BASE_URL}/product/by-code?item_code=${encodeURIComponent(code)}`);
      
  //     if (item && !item.error) {
  //       // Map backend item to Product interface
  //       const foundProduct: Product = {
  //         id: item.id,
  //         barcode: item.item_code,
  //         name: item.item_code,
  //         vendor: item.vendor_name || "-",
  //         price: item.selling_price,
  //         displayStock: item.qty_display || 0,
  //         godownStock: item.qty_godown || 0,
  //         stock: (item.qty_display || 0) + (item.qty_godown || 0),
  //         category: item.category_name || "General",
  //         image: item.photo_url
  //       };
        
  //       setSearchResult(foundProduct);
  //     } else {
  //       toast.error("Product code not found in database");
  //     }
  //   } catch (error) {
  //     console.error("Search error:", error);
  //     toast.error("Error connecting to server");
  //   }
  // };

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

        // If a cart is already active, add it immediately for a seamless flow
        if (activeCartId) {
          handleAddToCart(foundProduct);
        }
      } else {
        toast.error(`Product ${code} not found`);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const activeCart = clientCarts.find((cart) => cart.id === activeCartId);

    // Inside App.tsx


  

    // Inside src/App.tsx
  const handleAddToCart = async (product: Product) => {
    // 1. If no active cart, show dialog to select or create cart
    if (!activeCartId) {
      setPendingProduct(product);
      setShowClientDialog(true);
      return;
    }

    try {
      // 2. Prepare the payload for main.py
      const payload = {
        order_id: activeCartId, // The UUID of the order/basket
        product_id: product.id,
        qty: 1
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
      
      toast.success(`Added ${product.name} to database basket`);
      setSearchResult(null); // Clear the search card after adding

    } catch (error) {
      console.error("Cart API Error:", error);
      toast.error("Could not sync with server");
    }
  };

  // const handleCreateCart = async (clientName: string) => {
  //   try {
  //     const data = await apiCall(`${API_BASE_URL}/basket/create`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({
  //         shop_id: PRESELECTED_SHOP_ID,
  //         client_name: clientName,
  //         initial_product_id: pendingProduct?.id
  //       }),
  //     });

  //     const newCart: ClientCart = {
  //       id: data.order_id, // Use the real UUID from the DB
  //       clientName: data.client_name,
  //       items: [],
  //       createdAt: new Date().toISOString(),
  //       discount: 0,
  //     };

  //     setClientCarts((prev) => [...prev, newCart]);
  //     setActiveCartId(data.order_id);
  //     setPendingProduct(null); // Clear the pending state
  //     toast.success(`Session started for ${clientName}`);

  //     // If there was a pending product (the one that triggered the dialog), add it now
  //     if (pendingProduct) {
  //       //handleAddToCart(pendingProduct);
  //       setClientCarts((prev) =>
  //         prev.map((cart) => {
  //           if (cart.id !== data.order_id) return cart;
  //           return {
  //             ...cart,
  //             items: [
  //               { 
  //                 id: pendingProduct.id, 
  //                 name: pendingProduct.name, 
  //                 price: pendingProduct.price, 
  //                 quantity: 1, 
  //                 stock: pendingProduct.stock 
  //               }
  //             ],
  //           };
  //         })
  //       );
  //       toast.success(`Added ${pendingProduct.name} to ${clientName}'s cart`);
  //       setPendingProduct(null);
  //     }
  //   } catch (error) {
  //     toast.error("Failed to initialize session");
  //   }
  // };

  const handleCreateCart = async (clientName: string) => {
    try {
      // 1. Single API call creates both the Order and the first Item
      const data = await apiCall(`${API_BASE_URL}/basket/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: PRESELECTED_SHOP_ID,
          client_name: clientName,
          initial_product_id: pendingProduct?.id // Pass the scanned item ID
        }),
      });

      // 2. Prepare the items array for local state immediately
      const initialItems = pendingProduct ? [{ 
        id: pendingProduct.id, 
        name: pendingProduct.name, 
        price: pendingProduct.price, 
        quantity: 1, 
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
        handleAddToCart(pendingProduct);
        setPendingProduct(null);
      }, 100);
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
    if (newQuantity > item.quantity && newQuantity > totalAvailableStock) {
      // Use your existing toast notification system if available
      alert(`Cannot exceed available stock (${totalAvailableStock} units)`); 
      return;
    }

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
    
    // 2. Extract values and ensure they are numbers, not objects or undefined
    const d = Number(activeCart?.discount) || 0; 
    const t = activeCart?.tax !== undefined ? Number(activeCart.tax) : 18;

    try {
      // 3. Send the clean numbers to the backend
      await apiCall(
        `${API_BASE_URL}/order/finalize-sale?order_id=${activeCartId}&discount=${d}&tax=${t}`, 
        { method: "POST" }
      );

      toast.success("Sale finalized! Stock levels updated.");
      
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
  
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await apiCall(`${API_BASE_URL}/orders/list/${PRESELECTED_SHOP_ID}`);
        
        const mappedOrders: Order[] = data.map((o: any) => ({
          id: o.id,
          orderNumber: o.id.slice(0, 8).toUpperCase(), // Using ID snippet as Order #
          customerName: o.client_name || "Unknown",
          total: o.final_total || 0,
          status: o.status,
          date: new Date(o.created_at).toLocaleDateString(),
          discount: o.discount_percent || 0
        }));
        
        setOrders(mappedOrders);
      } catch (error) {
        console.error("Failed to load orders:", error);
      }
    };

    if (currentView === "orders") {
      fetchOrders();
    }
  }, [currentView]); // Re-fetch when entering the orders view

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
    try {
      // Extract discount and tax values, same as handleCheckout
      const d = Number(activeCart?.discount) || 0;
      const t = activeCart?.tax !== undefined ? Number(activeCart.tax) : 18;

      // Update order status to 'pi' in backend
       await apiCall(`${API_BASE_URL}/order/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          order_id: activeCartId, 
          status: "pi",
          discount_percent: d,
          tax_percent: t
        }),
      });

      toast.success(`Proforma Invoice Generated for ${activeCart?.clientName}!`);
      setActiveCartId(null); // Clear active session
      setCurrentView("proforma"); // Switch to PI list
      
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
        id: item.product_id || Math.random().toString(),
        name: item.item_code,
        price: item.unit_price,
        quantity: item.quantity,
        stock: 999 // Placeholder stock for editing
      }));

      // 3. Create or Update the Cart session
      const newCart: ClientCart = {
        id: pi.id,
        clientName: pi.clientName,
        items: freshItems,
        discount: pi.discount || 0,
        createdAt: pi.createdAt,
        tax: 18
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
      toast.error("Failed to load PI details for editing");
    }
  };

  const getTotalCartCount = () => {
    return clientCarts.reduce(
      (sum, cart) =>
        sum + cart.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />

      {isLoading && <GlobalLoader />}

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl">The Light Code</h1>
            <div className="flex gap-2">
              <Button
                variant={currentView === "scanner" ? "default" : "outline"}
                onClick={() => setCurrentView("scanner")}
              >
                <Scan className="size-4 mr-2" />
                Scanner
              </Button>
              <Button
                variant={currentView === "inventory" ? "default" : "outline"}
                onClick={async () => {
                  await handleLoadInventory();
                  setCurrentView("inventory");
                }}
              >
                <Package className="size-4 mr-2" />
                Inventory
              </Button>
              <Button
                variant={currentView === "orders" ? "default" : "outline"}
                onClick={() => setCurrentView("orders")}
              >
                <FileText className="size-4 mr-2" />
                Orders
              </Button>
              <Button
                variant={currentView === "cart" ? "default" : "outline"}
                onClick={async () => {
                  await handleLoadActiveCarts();
                  setCurrentView("cart");
                }}
                className="relative"
              >
                <ShoppingCart className="size-4 mr-2" />
                Carts
                {clientCarts.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 size-6 flex items-center justify-center p-0 rounded-full">
                    {clientCarts.length}
                  </Badge>
                )}
              </Button>
              <Button
                variant={currentView === "proforma" ? "default" : "outline"}
                onClick={async () => {
                  await handleLoadProformaInvoices();
                  setCurrentView("proforma");
                }}
              >
                <FileCheck className="size-4 mr-2" />
                Proforma Invoices
              </Button>
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
        {currentView === "orders" && <Orders orders={orders} onFetchDetails={fetchOrderItems} />}
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
            />
          </div>
        )}
        {currentView === "proforma" && (
          <ProformaInvoices
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
