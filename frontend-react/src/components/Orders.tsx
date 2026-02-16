import React, { useState } from "react";
import { Package, Calendar, DollarSign, User, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
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
}

export function Orders({ orders, onFetchDetails, onRecordPayment }: OrdersProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

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
  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.total, 0);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Orders</CardTitle>
            <Package className="size-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Pending Orders</CardTitle>
            <Calendar className="size-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Revenue</CardTitle>
            <DollarSign className="size-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Order Management</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
            <TabsContent value="all"><OrderTable orders={orders} expandedOrderId={expandedOrderId} onToggleExpand={toggleExpand} getStatusColor={getStatusColor} onRecordPayment={onRecordPayment} /></TabsContent>
            <TabsContent value="pending"><OrderTable orders={pendingOrders} expandedOrderId={expandedOrderId} onToggleExpand={toggleExpand} getStatusColor={getStatusColor} onRecordPayment={onRecordPayment} /></TabsContent>
            <TabsContent value="completed"><OrderTable orders={completedOrders} expandedOrderId={expandedOrderId} onToggleExpand={toggleExpand} getStatusColor={getStatusColor} onRecordPayment={onRecordPayment} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderTable({ orders, expandedOrderId, onToggleExpand, getStatusColor, onRecordPayment }: any) {
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
            </TableRow>
            
            {expandedOrderId === order.id && (
              <TableRow>
                <TableCell colSpan={6} className="bg-gray-50/50 p-0">
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