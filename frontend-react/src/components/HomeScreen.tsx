// import { Scan, Package, FileText, ShoppingCart, FileCheck, LogOut } from "lucide-react";
// import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { supabase } from "@/lib/supabaseClient";

// interface HomeScreenProps {
//   onNavigate: (view: "scanner" | "inventory" | "orders" | "cart" | "proforma") => void;
// }

// export default function HomeScreen({ onNavigate }: HomeScreenProps) {
//   const menuItems = [
//     { id: "scanner", title: "POS Scanner", desc: "Scan items and create bills", icon: Scan, color: "text-blue-600" },
//     { id: "inventory", title: "Inventory", desc: "Manage 400+ lighting products", icon: Package, color: "text-orange-600" },
//     { id: "cart", title: "Active Carts", desc: "Manage ongoing customer sessions", icon: ShoppingCart, color: "text-green-600" },
//     { id: "orders", title: "Order History", desc: "View past sales and invoices", icon: FileText, color: "text-purple-600" },
//     { id: "proforma", title: "Proforma", desc: "Draft and edit proforma invoices", icon: FileCheck, color: "text-slate-600" },
//   ];

//   return (
//     <div className="min-h-screen bg-slate-50 p-6 md:p-12">
//       <div className="max-w-5xl mx-auto">
//         <header className="flex justify-between items-center mb-12">
//           <div>
//             <h1 className="text-3xl font-bold tracking-tight text-slate-900">TLC Lighting System</h1>
//             <p className="text-slate-500">Select a module to get started</p>
//           </div>
//           <Button variant="outline" onClick={() => supabase.auth.signOut()} className="text-red-600 border-red-200 hover:bg-red-50">
//             <LogOut className="size-4 mr-2" /> Logout
//           </Button>
//         </header>

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//           {menuItems.map((item) => (
//             <Card 
//               key={item.id} 
//               className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-blue-500 group"
//               onClick={() => onNavigate(item.id as any)}
//             >
//               <CardHeader>
//                 <item.icon className={`size-10 ${item.color} mb-4 group-hover:scale-110 transition-transform`} />
//                 <CardTitle>{item.title}</CardTitle>
//                 <CardDescription>{item.desc}</CardDescription>
//               </CardHeader>
//             </Card>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// import React from 'react';
// import { ShoppingCart, Package, ClipboardList, ScanLine, LogOut, Lightbulb } from 'lucide-react';
// import { Button } from "@/components/ui/button";
// import { supabase } from "@/lib/supabaseClient";

// interface HomeScreenProps {
//   onNavigate: (view: 'scan' | 'inventory' | 'orders' | 'cart') => void;
//   cartCount: number;
// }

// export default function HomeScreen({ onNavigate, cartCount }: HomeScreenProps) {
//   const menuItems = [
//     { id: 'scan', title: 'POS Scanner', desc: 'Scan items & create bills', icon: ScanLine, color: 'bg-blue-50', iconColor: 'text-blue-600', hover: 'hover:border-blue-500' },
//     { id: 'inventory', title: 'Inventory', desc: 'Manage 400+ products', icon: Package, color: 'bg-emerald-50', iconColor: 'text-emerald-600', hover: 'hover:border-emerald-500' },
//     { id: 'cart', title: 'Active Carts', desc: 'Manage customer sessions', icon: ShoppingCart, color: 'bg-orange-50', iconColor: 'text-orange-600', hover: 'hover:border-orange-500', badge: cartCount },
//     { id: 'orders', title: 'Order History', desc: 'View past sales & invoices', icon: ClipboardList, color: 'bg-purple-50', iconColor: 'text-purple-600', hover: 'hover:border-purple-500' },
//   ];

//   return (
//     <div className="min-h-screen bg-[#f8fafc] flex flex-col">
//       {/* Top Navigation Bar */}
//       <nav className="flex justify-between items-center px-8 py-6 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
//         <div className="flex items-center gap-2">
//           <div className="bg-blue-600 p-2 rounded-lg">
//             <Lightbulb className="text-white size-6" />
//           </div>
//           <div>
//             <h1 className="text-xl font-bold text-slate-900 leading-none">TLC Lighting</h1>
//             <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Management System</p>
//           </div>
//         </div>
        
//         <Button 
//           variant="ghost" 
//           onClick={() => supabase.auth.signOut()} 
//           className="text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
//         >
//           <LogOut className="size-4 mr-2" /> Logout
//         </Button>
//       </nav>

//       {/* Main Content */}
//       <main className="flex-1 flex items-center justify-center p-6">
//         <div className="max-w-4xl w-full">
//           <div className="text-center mb-12">
//             <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
//               Welcome back
//             </h2>
//             <p className="text-slate-500 text-lg">What would you like to handle today?</p>
//           </div>

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             {menuItems.map((item) => (
//               <button
//                 key={item.id}
//                 onClick={() => onNavigate(item.id as any)}
//                 className={`group relative flex items-start p-8 bg-white rounded-2xl border-2 border-transparent shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${item.hover}`}
//               >
//                 <div className={`${item.color} ${item.iconColor} p-4 rounded-xl mr-6 group-hover:scale-110 transition-transform duration-300`}>
//                   <item.icon className="size-8" />
//                 </div>
                
//                 <div className="text-left">
//                   <h3 className="text-xl font-bold text-slate-900 mb-1">{item.title}</h3>
//                   <p className="text-slate-500 leading-relaxed">{item.desc}</p>
//                 </div>

//                 {item.badge ? (
//                   <span className="absolute top-6 right-6 flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-[10px] font-bold text-white ring-4 ring-orange-50">
//                     {item.badge}
//                   </span>
//                 ) : null}

//                 <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
//                    <span className="text-blue-600 text-sm font-bold flex items-center gap-1">
//                      Open →
//                    </span>
//                 </div>
//               </button>
//             ))}
//           </div>
//         </div>
//       </main>

//       {/* Footer Decoration */}
//       <footer className="py-8 text-center text-slate-400 text-sm">
//         &copy; 2026 The Light Code . Internal Staff Portal
//       </footer>
//     </div>
//   );
// }

import React from 'react';
import { ShoppingCart, Package, ClipboardList, ScanLine, LogOut, Lightbulb, FileCheck, History } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

interface HomeScreenProps {
  onNavigate: (view: any) => void;
  cartCount: number;
}

export default function HomeScreen({ onNavigate, cartCount }: HomeScreenProps) {
  const menuItems = [
    { id: 'scanner', title: 'POS Scanner', desc: 'Scan items & create bills', icon: ScanLine, color: 'bg-blue-50', iconColor: 'text-blue-600', hover: 'hover:border-blue-500' },
    { id: 'inventory', title: 'Inventory', desc: 'Manage 400+ products', icon: Package, color: 'bg-emerald-50', iconColor: 'text-emerald-600', hover: 'hover:border-emerald-500' },
    { id: 'cart', title: 'Active Carts', desc: 'Manage customer sessions', icon: ShoppingCart, color: 'bg-orange-50', iconColor: 'text-orange-600', hover: 'hover:border-orange-500', badge: cartCount },
    { id: 'orders', title: 'Order History', desc: 'View past sales & invoices', icon: ClipboardList, color: 'bg-purple-50', iconColor: 'text-purple-600', hover: 'hover:border-purple-500' },
    { id: 'proforma', title: 'Proforma', desc: 'Generate & edit quotes', icon: FileCheck, color: 'bg-rose-50', iconColor: 'text-rose-600', hover: 'hover:border-rose-500' },
    { id: 'history', title: 'History', desc: 'Audit edits & activity log', icon: History, color: 'bg-slate-50', iconColor: 'text-slate-700', hover: 'hover:border-slate-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="flex justify-between items-center px-8 py-6 bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
            <Lightbulb className="text-white size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-none">The Light Code</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Management Portal</p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          onClick={() => supabase.auth.signOut()} 
          className="text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="size-4 mr-2" /> Logout
        </Button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-5xl w-full">
          {/* Welcome Text matching index.css font styles */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back
            </h2>
            <p className="text-gray-500 text-lg font-normal">
              What would you like to handle today?
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`group relative flex items-start p-8 bg-white rounded-2xl border-2 border-transparent shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${item.hover}`}
              >
                <div className={`${item.color} ${item.iconColor} p-4 rounded-xl mr-5 group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="size-7" />
                </div>
                
                <div className="text-left">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-snug">{item.desc}</p>
                </div>

                {item.badge ? (
                  <span className="absolute top-6 right-6 flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-[10px] font-bold text-white shadow-sm">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-gray-400 text-xs font-medium uppercase tracking-widest">
        The Light Code &bull; Internal System &bull; 2026
      </footer>
    </div>
  );
}
