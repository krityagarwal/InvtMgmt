// import { ShoppingCart, Trash2, Plus, Minus, CreditCard, User, FileText, Percent, Save, FileDown } from "lucide-react";
// import { Button } from "./ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
// import { Input } from "./ui/input";
// import { Badge } from "./ui/badge";
// import { Label } from "./ui/label";
// import { Product } from "./Scanner";

// export interface CartItem {
//   id: string;
//   name: string;
//   price: number;
//   quantity: number;
//   attribute_metadata?: { label: string; qty: number }[];
//   //stock: number;
// }

// interface CartProps {
//   items: CartItem[];
//   products: Product[];
//   clientName: string | null;
//   discount: number;
//   activeCart: any; // Add the active cart object
//   activeCartId: string | null; // Add the active cart ID
//   onUpdateQuantity: (id: string, quantity: number) => void;
//   onRemoveItem: (id: string) => void;
//   onUpdateDiscount: (discount: number) => void;
//   updateCartTax: (cartId: string | null, tax: number | "") => void;
//   onCheckout: () => void;
//   onGeneratePI: () => void;
//   onSaveCart: () => void;
//   onUpdateAdvance: (amount: number) => void;
//   onUpdateAddress: (address: string) => void; // Add this
//   onUpdatePhone: (phone: string) => void;     // Recommended for post-checkout edits
//   onUpdateReferral: (referral: string) => void;
// }

// export function Cart({ 
//   items, 
//   products,
//   clientName, 
//   discount,
//   activeCart,
//   activeCartId,
//   onUpdateQuantity, 
//   onRemoveItem, 
//   onUpdateDiscount,
//   onCheckout,
//   onGeneratePI,
//   onSaveCart,
//   updateCartTax,
//   onUpdateAdvance,
//   onUpdateAddress,
//   onUpdatePhone,
//   onUpdateReferral
// }: CartProps) {
//   // 1. Calculate subtotal first
//     const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
//     // 2. Ensure discount is treated as a number
//     const numericDiscount = Number(discount) || 0;
    
//     // 3. Derived values that update the UI
//     const discountAmount = subtotal * (numericDiscount / 100);
//     const afterDiscount = subtotal - discountAmount;
//     const tax = afterDiscount * ((activeCart?.tax ?? 18) / 100); 
//     const total = afterDiscount + tax;

//     // FIX: Check overstock using the products array passed from App.tsx
//     const hasOverstockItems = items.some(item => {
//       const master = products.find(p => p.id === item.id);
//       const available = master ? (Number(master.godownStock || 0) + Number(master.displayStock || 0)) : 0;
//       return item.quantity > available;
//     });
    

//   return (
//     <div className="space-y-3">
//       <Card className="shadow-sm">
//         <CardHeader className="border-b pb-0">
//           <div className="flex items-center justify-between">
//             <div>
//               <CardTitle className="text-xl">Active Session</CardTitle>
//               {clientName && (
//                 <div className="flex items-center gap-1 mt-0.5 text-blue-600 font-medium">
//                   <User className="size-4" />
//                   <span className="text-sm">Client: {clientName}</span>
//                 </div>
//               )}
//             </div>
//             <Badge variant="secondary" className="px-3 py-1">
//               {items.length} Items
//             </Badge>
//           </div>
//         </CardHeader>
//         <CardContent className="pt-2">
//           {!clientName ? (
//             <div className="text-center py-12">
//               <ShoppingCart className="size-12 mx-auto text-gray-300 mb-4" />
//               <p className="text-gray-500 font-medium">No cart selected</p>
//             </div>
//           ) : items.length === 0 ? (
//             <div className="text-center py-12">
//               <ShoppingCart className="size-12 mx-auto text-gray-300 mb-4" />
//               <p className="text-gray-500 font-medium">Cart is empty</p>
//               <p className="text-sm text-gray-400 mt-1">Add items from the scanner or inventory</p>
//             </div>
//           ) : (
//             <div className="space-y-1">
//               {items.map((item) => {
//                 // FIX: Look up real-time availability inside the loop
//                 const masterProduct = products.find((p) => p.id === item.id);
//                 const available = masterProduct 
//                   ? (Number(masterProduct.godownStock || 0) + Number(masterProduct.displayStock || 0)) 
//                   : 0;
//                 const isOverStock = item.quantity > available;

//                 return (
//                   <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg bg-white">
//                     <div className="flex-1">
//                       <h3 className="font-semibold text-sm uppercase">{item.name}</h3>
//                       {/* NEW: Render Attribute/Room Breakdown */}
//                       {item.attribute_metadata && item.attribute_metadata.length > 0 && (
//                         <div className="flex flex-wrap gap-1 mt-1">
//                           {item.attribute_metadata.map((attr, idx) => (
//                             <Badge 
//                               key={idx} 
//                               variant="secondary" 
//                               className="text-[9px] h-4 px-1.5 bg-gray-100 text-gray-600 border-none font-normal"
//                             >
//                               {attr.label}: {attr.qty}
//                             </Badge>
//                           ))}
//                         </div>
//                       )}
//                       <p className="text-xs text-gray-500">₹{item.price.toLocaleString()} / unit</p>
                      
//                       {/* FIXED BADGE LOGIC */}
//                       {isOverStock && (
//                         <Badge variant="destructive" className="mt-1 text-[10px] h-4">
//                           Exceeds Stock ({available} avail)
//                         </Badge>
//                       )}
//                     </div>

//                   <div className="flex items-center gap-2">
//                     <Button
//                       variant="outline"
//                       size="icon"
//                       className="size-8"
//                       onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
//                     >
//                       <Minus className="size-3" />
//                     </Button>
//                     <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
//                     <Button
//                       variant="outline"
//                       size="icon"
//                       className="size-8"
//                       onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
//                     >
//                       <Plus className="size-3" />
//                     </Button>
//                   </div>

//                   <div className="text-right min-w-[80px]">
//                     <p className="font-bold text-sm">₹{(item.price * item.quantity).toLocaleString()}</p>
//                   </div>

//                   <Button variant="ghost" size="icon" className="size-8" onClick={() => onRemoveItem(item.id)}>
//                     <Trash2 className="size-4 text-red-500" />
//                   </Button>
//                 </div>
//                 );
//               })}
//             </div>
//           )}
//         </CardContent>
//       </Card>

//       {/* Insert this between the two existing Cards */}
//       {items.length > 0 && (
//         <Card className="shadow-sm border-l-4 border-l-orange-400">
//           <CardContent className="pt-4 space-y-4">
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {/* Contact Update */}
//               <div className="space-y-1">
//                 <Label className="text-[10px] uppercase font-bold text-gray-400">
//                   Contact Number
//                 </Label>
//                 <div className="relative">
//                   <Input 
//                     placeholder="Primary phone..."
//                     value={activeCart?.clientPhone || ""}
//                     onChange={(e) => onUpdatePhone(e.target.value)}
//                     className="pl-8 text-sm h-9"
//                   />
//                   <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">📞</span>
//                 </div>
//               </div>

//               {/* Referral Update */}
//               <div className="space-y-1">
//                 <Label className="text-[10px] uppercase font-bold text-gray-400">
//                   Referral / Partner
//                 </Label>
//                 <Input 
//                   placeholder="Designer name..."
//                   value={activeCart?.referralSource || ""}
//                   onChange={(e) => onUpdateReferral(e.target.value)} 
//                   className="text-sm h-9 bg-white"
//                 />
//               </div>
//             </div>

//             <div className="space-y-1">
//               <Label className="text-[10px] uppercase font-bold text-gray-400">
//                 Delivery Address
//               </Label>
//               <textarea
//                 className="w-full p-2 text-sm border rounded-md bg-white focus:ring-1 focus:ring-blue-500 outline-none resize-none transition-all"
//                 placeholder="Enter site or home delivery details..."
//                 rows={2}
//                 value={activeCart?.deliveryAddress || ""}
//                 onChange={(e) => onUpdateAddress(e.target.value)}
//               />
//             </div>
//           </CardContent>
//         </Card>
//       )}

//       {items.length > 0 && (
//         <Card className="border-t-4 border-t-blue-500">
//           <CardHeader>
//             <CardTitle className="text-lg">Billing Summary</CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <div className="space-y-3">
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-500">Subtotal</span>
//                 <span>₹{subtotal.toLocaleString()}</span>
//               </div>
//               <div className="flex items-center justify-between py-2 border-y border-dashed">
//                 <div className="flex items-center gap-2">
//                   <Percent className="size-4 text-gray-400" />
//                   <Label htmlFor="discount" className="text-sm">Discount (%)</Label>
//                 </div>
//                 <div className="flex items-center gap-3">
//                   <Input
//                     id="discount"
//                     type="number"
//                     /* Use an empty string if discount is 0 to make it easier to type new numbers */
//                     value={discount === 0 ? "" : discount} 
//                     placeholder="0"
//                     onChange={(e) => {
//                       const value = e.target.value;
//                       // If the input is cleared, set discount to 0
//                       if (value === "") {8
//                         onUpdateDiscount(0);
//                         return;
//                       }
//                       const numValue = parseFloat(value);
//                       // Prevent NaN and cap the discount at 100%
//                       if (!isNaN(numValue)) {
//                         onUpdateDiscount(Math.min(100, Math.max(0, numValue)));
//                       }
//                     }}
//                     className="w-24 h-9 text-right font-medium"
//                     step="any" // Allows decimals like 5.5
//                   />
//                   <span className="text-red-500 font-bold text-sm min-w-[80px] text-right">
//                     -₹{discountAmount.toLocaleString()}
//                   </span>
//                 </div>
//               </div>
//               {/* <div className="flex justify-between text-sm">
//                 <span className="text-gray-500">Tax (10%)</span>
//                 <span>₹{tax.toLocaleString()}</span>
//               </div> */}
              
//               <div className="flex justify-between items-center text-sm">
//                 <div className="flex items-center gap-1">
//                   <span className="text-gray-500">Tax</span>
//                   <div className="flex items-center border rounded px-1 bg-gray-50">
//                     <input
//                       type="number"
//                       className="w-10 bg-transparent focus:outline-none text-right appearance-none"
//                       value={activeCart?.tax ?? 18} // Defaults to 18
//                       min="0" // Allow 0, prevent negative
//                       onChange={(e) => {
//                         const newVal = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
//                         updateCartTax(activeCartId, newVal);
//                       }}
//                     />
//                     <span className="text-gray-400 text-xs">%</span>
//                   </div>
//                 </div>
//                 <span>₹{tax.toLocaleString()}</span>
//               </div>

//               <div className="pt-2 flex justify-between items-center border-t">
//                 <span className="text-lg font-bold">Total Amount</span>
//                 <span className="text-2xl font-black text-blue-700">₹{total.toLocaleString()}</span>
//               </div>
//               {/* --- NEW: Advance Payment Section --- */}
//               <div className="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex justify-between items-center">
//                 <div className="space-y-1">
//                   <Label htmlFor="advance" className="text-xs font-bold text-blue-800 uppercase tracking-wider">
//                     Advance Payment (₹)
//                   </Label>
//                   <p className="text-[10px] text-gray-500 italic">Enter amount received today</p>
//                 </div>
//                 <div className="flex flex-col items-end gap-1">
//                   <Input
//                     id="advance"
//                     type="number"
//                     placeholder="0.00"
//                     value={activeCart?.advancePaid || ""}
//                     className="w-32 h-10 text-right font-bold text-lg bg-white border-blue-200 focus:ring-blue-500"
//                     onChange={(e) => {
//                         const val = parseFloat(e.target.value) || 0;
//                         // You'll need to pass setAdvanceAmount from App.tsx as a prop
//                         onUpdateAdvance(val); 
//                     }}
//                   />
//                   {/* Visual calculation of balance */}
//                   <span className="text-[10px] font-medium text-red-600">
//                     Balance: ₹{(total - (activeCart?.advancePaid || 0)).toLocaleString()}
//                   </span>
//                 </div>
//               </div>
//               {/* ---------------------------------- */}
//             </div>
//             <div className="grid grid-cols-1 gap-3 pt-2">
//               <Button
//                 className="w-full h-12 text-blue-600 border-blue-200 hover:bg-blue-50"
//                 variant="outline"
//                 onClick={onSaveCart}
//               >
//                 <Save className="size-4 mr-2" />
//                 Save Progress
//               </Button>
              
//               <Button
//                 className="w-full h-12 bg-blue-700 hover:bg-blue-800 text-white font-bold"
//                 onClick={onGeneratePI}
//               >
//                 <FileDown className="size-4 mr-2" />
//                 Generate & Download PI
//               </Button>
              
//               <Button
//                 className="w-full h-12 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
//                 onClick={onCheckout}
//                 disabled={hasOverstockItems} // Block direct sale if out of stock
//               >
//                 <CreditCard className="size-4 mr-2" />
//                 {hasOverstockItems ? 'Cannot Sell (Insufficient Stock)' : 'Finalize Sale (Direct)'}
//               </Button>
//             </div>
//           </CardContent>
//         </Card>
//       )}
//     </div>
//   );
// }

import { ShoppingCart, Trash2, Plus, Minus, CreditCard, User, Percent, Save, FileDown, Phone, MapPin, Users } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { Product } from "./Scanner";
import { Label } from "./ui/label";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  attribute_metadata?: { label: string; qty: number }[];
}

interface CartProps {
  items: CartItem[];
  products: Product[];
  clientName: string | null;
  discount: number;
  activeCart: any;
  activeCartId: string | null;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateDiscount: (discount: number) => void;
  updateCartTax: (cartId: string | null, tax: number | "") => void;
  onCheckout: () => void;
  onGeneratePI: () => void;
  onSaveCart: () => void;
  onUpdateAdvance: (amount: number) => void;
  onUpdateAddress: (address: string) => void;
  onUpdatePhone: (phone: string) => void;
  onUpdateReferral: (referral: string) => void;
}

export function Cart({
  items, products, clientName, discount, activeCart, activeCartId,
  onUpdateQuantity, onRemoveItem, onUpdateDiscount, onCheckout,
  onGeneratePI, onSaveCart, updateCartTax, onUpdateAdvance,
  onUpdateAddress, onUpdatePhone, onUpdateReferral,
}: CartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const numericDiscount = Number(discount) || 0;
  const discountAmount = subtotal * (numericDiscount / 100);
  const tax = (subtotal - discountAmount) * ((activeCart?.tax ?? 18) / 100);
  const total = subtotal - discountAmount + tax;

  const hasOverstockItems = items.some((item) => {
    const master = products.find((p) => p.id === item.id);
    const available = master ? Number(master.godownStock || 0) + Number(master.displayStock || 0) : 0;
    return item.quantity > available;
  });

  if (!clientName) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl">
        <ShoppingCart className="size-10 mb-3 opacity-20" />
        <p className="font-bold text-sm">No Active Session</p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-white shadow-sm flex flex-col h-full">
      {/* 1. COMPACT HEADER */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-700 text-white">
        <div className="flex items-center gap-2">
          <User className="size-4 text-blue-400" />
          <span className="text-sm font-black uppercase tracking-tight">{clientName}</span>
        </div>
        <Badge className="bg-white/10 text-[10px] h-5">{items.length} Items</Badge>
      </div>

      {/* 2. INLINE CUSTOMER DATA */}
      <div className="px-3 py-2 border-b bg-slate-50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Phone className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Phone"
              value={activeCart?.clientPhone || ""}
              onChange={(e) => onUpdatePhone(e.target.value)}
              className="h-7 text-xs pl-7 bg-white"
            />
          </div>
          <div className="relative">
            <Users className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Referral"
              value={activeCart?.referralSource || ""}
              onChange={(e) => onUpdateReferral(e.target.value)}
              className="h-7 text-xs pl-7 bg-white"
            />
          </div>
        </div>
        <div className="relative">
          <MapPin className="size-3 absolute left-2 top-2 text-gray-400" />
          <textarea
            className="w-full pl-7 pr-2 py-1 text-xs border rounded-md bg-white resize-none outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Delivery address..."
            rows={1}
            value={activeCart?.deliveryAddress || ""}
            onChange={(e) => onUpdateAddress(e.target.value)}
          />
        </div>
      </div>

      {/* 3. SCROLLABLE ITEM LIST */}
      <div className="divide-y overflow-y-auto max-h-[45vh] bg-white">
        {items.map((item) => {
          const masterProduct = products.find((p) => p.id === item.id);
          const available = masterProduct ? (Number(masterProduct.godownStock || 0) + Number(masterProduct.displayStock || 0)) : 0;
          const isOverStock = item.quantity > available;

          return (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs uppercase truncate text-gray-800">{item.name}</p>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {item.attribute_metadata?.map((attr, idx) => (
                    <span key={idx} className="bg-blue-50 text-blue-700 text-[8px] px-1 py-0.5 rounded border border-blue-100">
                      {attr.label}: {attr.qty}
                    </span>
                  ))}
                </div>
                {isOverStock && <p className="text-[9px] font-bold text-red-500 mt-1 italic uppercase">Low Stock ({available})</p>}
              </div>

              <div className="flex items-center gap-1 bg-gray-50 border rounded-md p-0.5">
                <Button variant="ghost" size="icon" className="size-6" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>
                  <Minus className="size-2.5" />
                </Button>
                <span className="w-5 text-center text-[11px] font-black">{item.quantity}</span>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>
                  <Plus className="size-2.5" />
                </Button>
              </div>

              <div className="text-right min-w-[70px]">
                <p className="font-black text-xs text-gray-900 font-mono">₹{(item.price * item.quantity).toLocaleString()}</p>
              </div>

              <Button variant="ghost" size="icon" className="size-7 hover:bg-red-50" onClick={() => onRemoveItem(item.id)}>
                <Trash2 className="size-3.5 text-gray-300 hover:text-red-500" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* 4. PERSISTENT BILLING SUMMARY */}
      <div className="mt-auto border-t bg-slate-50 p-3 space-y-2">
        <div className="flex justify-between text-[11px] font-bold text-gray-400 uppercase tracking-tight">
          <span>Subtotal</span>
          <span>₹{subtotal.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Discount</span>
            <input
              type="number" 
              value={discount || ""} 
              placeholder="0"
              onChange={(e) => onUpdateDiscount(parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-12 h-6 text-[11px] text-center font-bold border border-slate-200 rounded bg-white outline-none focus:border-blue-400 transition-colors"
            />
            <span className="text-[11px] font-bold text-slate-400">%</span>
          </div>
          <span className="font-bold text-red-500 font-mono text-[11px]">-₹{discountAmount.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tax</span>
            <input
              type="number" 
              value={activeCart?.tax ?? 18}
              onChange={(e) => updateCartTax(activeCartId, Number(e.target.value))}
              onFocus={(e) => e.currentTarget.select()}
              className="w-12 h-6 text-[11px] text-center font-bold border border-slate-200 rounded bg-white outline-none focus:border-blue-400 transition-colors"
            />
            <span className="text-[11px] font-bold text-slate-400">%</span>
          </div>
          <span className="font-bold text-slate-600 font-mono text-[11px]">₹{tax.toLocaleString()}</span>
        </div>

        <div className="pt-2 border-t-2 border-dashed flex justify-between items-center">
          <span className="text-xs font-black uppercase text-gray-400">Total</span>
          <span className="text-xl font-black text-blue-700 font-mono tracking-tighter">₹{total.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between bg-blue-600/5 rounded-lg px-2 py-1.5 border border-blue-100">
          <div className="leading-tight">
            <p className="text-[9px] font-black text-blue-800 uppercase">Advance</p>
            <p className="text-[10px] font-bold text-red-600 font-mono italic">Bal: ₹{(total - (activeCart?.advancePaid || 0)).toLocaleString()}</p>
          </div>
          <Input
            type="number" value={activeCart?.advancePaid || ""}
            className="w-24 h-7 text-right font-black text-xs bg-white border-blue-200"
            onChange={(e) => onUpdateAdvance(parseFloat(e.target.value) || 0)}
          />
        </div>

        {/* 5. ACTION BUTTONS */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-9 font-bold text-[10px] uppercase text-blue-600 border-blue-100" onClick={onSaveCart}>
             Save
          </Button>
          <Button variant="outline" size="sm" className="h-9 font-bold text-[10px] uppercase text-gray-600" onClick={onGeneratePI}>
             PI
          </Button>
          <Button 
            size="sm" className={`h-9 font-bold text-[10px] uppercase ${hasOverstockItems ? 'bg-gray-300' : 'bg-blue-700'}`}
            onClick={onCheckout} disabled={hasOverstockItems}
          >
             {hasOverstockItems ? 'Shortage' : 'Sell'}
          </Button>
        </div>
      </div>
    </div>
  );
}
