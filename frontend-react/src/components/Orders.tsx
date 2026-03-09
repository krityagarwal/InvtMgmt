import React, { useState } from "react";
import { DollarSign, HandCoins, WalletCards, TrendingUp, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { OrderDetailsView } from "./ui/OrderDetailsView";

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: 'bucket' | 'pi' | 'sold';
  date: string;
  discount?: number;
  items: OrderItem[];
  subtotal?: number;
  paidAmount: number;
  discount_amount?: number;
  discount_percent?: number;
  tax_percent?: number;
  tax_amount?: number;
  final_total?: number;
  clientPhone?: string,        
  referralSource?: string, 
  deliveryAddress?: string
}

interface OrdersProps {
  orders: Order[];
  onFetchDetails: (orderId: string) => void;
  onRecordPayment: (orderId: string, amount: number, method: string) => void; // Add this 
  onDownloadInvoice: (orderId: string) => void;
  summary?: {
    totalRevenue: number;
    totalReceived: number;
    totalDue: number;
    estimatedProfit: number;
  };
}

export function Orders({ orders, onFetchDetails, onRecordPayment, onDownloadInvoice, summary }: OrdersProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "completed">("all");

  const toggleExpand = (orderId: string) => {
    if (expandedOrderId !== orderId) {
      onFetchDetails(orderId); 
      setExpandedOrderId(orderId);
    } else {
      setExpandedOrderId(null);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "bucket" || o.status === "pi");
  const completedOrders = orders.filter((o) => o.status === "sold");
  const totalRevenue = summary?.totalRevenue ?? completedOrders.reduce((sum, o) => sum + o.total, 0);
  const totalReceived = summary?.totalReceived ?? completedOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalDue = summary?.totalDue ?? completedOrders.reduce((sum, o) => sum + Math.max(0, o.total - (o.paidAmount || 0)), 0);
  const estimatedProfit = summary?.estimatedProfit ?? 0;
  const displayedOrders =
    activeTab === "pending" ? pendingOrders :
    activeTab === "completed" ? completedOrders :
    orders;

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "bucket": return "bg-gray-400"; // Changed to gray for drafts
      case "pi": return "bg-yellow-500";  
      case "sold": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-3 px-3">
            <CardTitle className="text-[11px] leading-tight">Total Revenue</CardTitle>
            <DollarSign className="size-3.5 text-gray-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0.5">
            <div className="text-base md:text-lg font-bold leading-none truncate">₹{totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-3 px-3">
            <CardTitle className="text-[11px] leading-tight">Amount Received</CardTitle>
            <HandCoins className="size-3.5 text-gray-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0.5">
            <div className="text-base md:text-lg font-bold leading-none truncate">₹{totalReceived.toLocaleString()}</div>
            <p className="text-[10px] text-slate-500 mt-1">Customer payments</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-3 px-3">
            <CardTitle className="text-[11px] leading-tight">Amount Due</CardTitle>
            <WalletCards className="size-3.5 text-gray-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0.5">
            <div className="text-base md:text-lg font-bold leading-none truncate">₹{totalDue.toLocaleString()}</div>
            <p className="text-[10px] text-slate-500 mt-1">Pending from customers</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5 pt-3 px-3">
            <CardTitle className="text-[11px] leading-tight">Estimated Profit</CardTitle>
            <TrendingUp className="size-3.5 text-gray-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0.5">
            <div className="text-base md:text-lg font-bold leading-none truncate">₹{estimatedProfit.toLocaleString()}</div>
            <p className="text-[10px] text-slate-500 mt-1">Assuming all due collected</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Order Management</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "pending" | "completed")} className="w-full">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
            <div className="mt-3 mb-2 text-xs text-slate-500 font-medium">
              Showing {displayedOrders.length} of {orders.length} records
            </div>
            <TabsContent value="all"><OrderTable orders={orders} expandedOrderId={expandedOrderId} onToggleExpand={toggleExpand} getStatusColor={getStatusColor} onRecordPayment={onRecordPayment} onDownloadInvoice={onDownloadInvoice} /></TabsContent>
            <TabsContent value="pending"><OrderTable orders={pendingOrders} expandedOrderId={expandedOrderId} onToggleExpand={toggleExpand} getStatusColor={getStatusColor} onRecordPayment={onRecordPayment} onDownloadInvoice={onDownloadInvoice} /></TabsContent>
            <TabsContent value="completed"><OrderTable orders={completedOrders} expandedOrderId={expandedOrderId} onToggleExpand={toggleExpand} getStatusColor={getStatusColor} onRecordPayment={onRecordPayment} onDownloadInvoice={onDownloadInvoice} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderTable({ orders, expandedOrderId, onToggleExpand, getStatusColor, onRecordPayment, onDownloadInvoice }: any) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]"></TableHead>
          <TableHead>Order #</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Paid</TableHead>
          <TableHead>Balance</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order: Order) => (
          <React.Fragment key={order.id}>
            <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => onToggleExpand(order.id)}>
              <TableCell>
                {expandedOrderId === order.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </TableCell>
              <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell>{order.date}</TableCell>
              <TableCell>₹{order.total.toLocaleString()}</TableCell>
              <TableCell className="text-green-600">₹{(order.paidAmount || 0).toLocaleString()}</TableCell>
              <TableCell className={`font-bold ${order.total - (order.paidAmount || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                ₹{(order.total - (order.paidAmount || 0)).toLocaleString()}
              </TableCell>
              <TableCell><Badge className={getStatusColor(order.status)}>{order.status}</Badge></TableCell>
              <TableCell className="text-right">
                {order.status === "sold" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Download Invoice"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadInvoice(order.id);
                    }}
                  >
                    <Download className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
            
            {expandedOrderId === order.id && (
              <TableRow>
                <TableCell colSpan={9} className="bg-gray-50/50 p-0">
                  <OrderDetailsView
                    clientName={order.customerName}
                    date={order.date}
                    items={order.items || []}
                    financial={order}
                  />
                  {/* NEW: Record Payment Action Box */}
                    {(order.total - (order.paidAmount || 0)) > 0 && (
                      <div className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Remaining Balance</p>
                          <p className="text-xl font-bold text-red-600">₹{(order.total - (order.paidAmount || 0)).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                           <button 
                             className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                             onClick={(e) => {
                               e.stopPropagation();
                               const amount = prompt(`Enter installment amount for ${order.customerName}:`);
                               if (amount && !isNaN(parseFloat(amount))) {
                                 onRecordPayment(order.id, parseFloat(amount), "Cash");
                               }
                             }}
                           >
                             Record Payment
                           </button>
                        </div>
                      </div>
                    )}
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
