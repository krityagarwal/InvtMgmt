import { ShoppingCart, Trash2, Plus, Minus, CreditCard, User, FileText, Percent } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface CartProps {
  items: CartItem[];
  clientName: string | null;
  discount: number;
  activeCart: any; // Add the active cart object
  activeCartId: string | null; // Add the active cart ID
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateDiscount: (discount: number) => void;
  updateCartTax: (cartId: string | null, tax: number | "") => void;
  onCheckout: () => void;
  onGeneratePI: () => void;
  onUpdateAdvance: (amount: number) => void;
}

export function Cart({ 
  items, 
  clientName, 
  discount,
  activeCart,
  activeCartId,
  onUpdateQuantity, 
  onRemoveItem, 
  onUpdateDiscount,
  onCheckout,
  onGeneratePI,
  updateCartTax,
  onUpdateAdvance
}: CartProps) {
  // 1. Calculate subtotal first
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    // 2. Ensure discount is treated as a number
    const numericDiscount = Number(discount) || 0;
    
    // 3. Derived values that update the UI
    const discountAmount = subtotal * (numericDiscount / 100);
    const afterDiscount = subtotal - discountAmount;
    const tax = afterDiscount * ((activeCart?.tax ?? 18) / 100); 
    const total = afterDiscount + tax;

    const hasOverstockItems = items.some(item => item.quantity > item.stock);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Active Session</CardTitle>
              {clientName && (
                <div className="flex items-center gap-2 mt-2 text-blue-600 font-medium">
                  <User className="size-4" />
                  <span className="text-sm">Client: {clientName}</span>
                </div>
              )}
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              {items.length} Items
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!clientName ? (
            <div className="text-center py-12">
              <ShoppingCart className="size-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">No cart selected</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="size-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">Cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">Add items from the scanner or inventory</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg bg-white">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm uppercase">{item.name}</h3>
                    <p className="text-xs text-gray-500">₹{item.price.toLocaleString()} / unit</p>
                    {item.quantity > item.stock && (
                      <Badge variant="destructive" className="mt-1 text-[10px] h-4">Exceeds Stock ({item.stock} avail)</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>

                  <div className="text-right min-w-[80px]">
                    <p className="font-bold text-sm">₹{(item.price * item.quantity).toLocaleString()}</p>
                  </div>

                  <Button variant="ghost" size="icon" className="size-8" onClick={() => onRemoveItem(item.id)}>
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card className="border-t-4 border-t-blue-500">
          <CardHeader>
            <CardTitle className="text-lg">Billing Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              
              {/* <div className="flex items-center justify-between py-2 border-y border-dashed">
                <div className="flex items-center gap-2">
                  <Percent className="size-4 text-gray-400" />
                  <Label htmlFor="discount" className="text-sm">Discount (%)</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="discount"
                    type="number"
                    value={discount}
                    onChange={(e) => onUpdateDiscount(parseFloat(e.target.value) || 0)}
                    className="w-16 h-8 text-right"
                    min="0"
                    max="100"
                  />
                  <span className="text-red-500 font-medium text-sm">
                    -₹{discountAmount.toLocaleString()}
                  </span>
                </div>
              </div> */}
              <div className="flex items-center justify-between py-2 border-y border-dashed">
                <div className="flex items-center gap-2">
                  <Percent className="size-4 text-gray-400" />
                  <Label htmlFor="discount" className="text-sm">Discount (%)</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="discount"
                    type="number"
                    /* Use an empty string if discount is 0 to make it easier to type new numbers */
                    value={discount === 0 ? "" : discount} 
                    placeholder="0"
                    onChange={(e) => {
                      const value = e.target.value;
                      // If the input is cleared, set discount to 0
                      if (value === "") {
                        onUpdateDiscount(0);
                        return;
                      }
                      const numValue = parseFloat(value);
                      // Prevent NaN and cap the discount at 100%
                      if (!isNaN(numValue)) {
                        onUpdateDiscount(Math.min(100, Math.max(0, numValue)));
                      }
                    }}
                    className="w-24 h-9 text-right font-medium"
                    step="any" // Allows decimals like 5.5
                  />
                  <span className="text-red-500 font-bold text-sm min-w-[80px] text-right">
                    -₹{discountAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              {/* <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax (10%)</span>
                <span>₹{tax.toLocaleString()}</span>
              </div> */}
              
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Tax</span>
                  <div className="flex items-center border rounded px-1 bg-gray-50">
                    <input
                      type="number"
                      className="w-10 bg-transparent focus:outline-none text-right appearance-none"
                      value={activeCart?.tax ?? 18} // Defaults to 18
                      min="0" // Allow 0, prevent negative
                      onChange={(e) => {
                        const newVal = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
                        updateCartTax(activeCartId, newVal);
                      }}
                    />
                    <span className="text-gray-400 text-xs">%</span>
                  </div>
                </div>
                <span>₹{tax.toLocaleString()}</span>
              </div>

              <div className="pt-2 flex justify-between items-center border-t">
                <span className="text-lg font-bold">Total Amount</span>
                <span className="text-2xl font-black text-blue-700">₹{total.toLocaleString()}</span>
              </div>
              {/* --- NEW: Advance Payment Section --- */}
              <div className="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex justify-between items-center">
                <div className="space-y-1">
                  <Label htmlFor="advance" className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                    Advance Payment (₹)
                  </Label>
                  <p className="text-[10px] text-gray-500 italic">Enter amount received today</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Input
                    id="advance"
                    type="number"
                    placeholder="0.00"
                    className="w-32 h-10 text-right font-bold text-lg bg-white border-blue-200 focus:ring-blue-500"
                    onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        // You'll need to pass setAdvanceAmount from App.tsx as a prop
                        onUpdateAdvance(val); 
                    }}
                  />
                  {/* Visual calculation of balance */}
                  <span className="text-[10px] font-medium text-red-600">
                    Balance: ₹{(total - (activeCart?.advancePaid || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              {/* ---------------------------------- */}
            </div>
            <div className="grid grid-cols-1 gap-3 pt-2">
              <Button
                className={`w-full h-12 ${hasOverstockItems ? 'border-orange-500 text-orange-600' : 'text-blue-600 border-blue-200'}`}
                variant="outline"
                onClick={onGeneratePI}
              >
                <FileText className="size-4 mr-2" />
                Generate Proforma Invoice
              </Button>
              
              <Button
                className="w-full h-12 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                onClick={onCheckout}
                disabled={hasOverstockItems} // Block direct sale if out of stock
              >
                <CreditCard className="size-4 mr-2" />
                {hasOverstockItems ? 'Cannot Sell (Insufficient Stock)' : 'Finalize Sale (Direct)'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}