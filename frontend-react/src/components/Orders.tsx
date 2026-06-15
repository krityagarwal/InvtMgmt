import React, { useState } from "react";
import { DollarSign, HandCoins, WalletCards, TrendingUp, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { HandHelping } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { OrderDetailsView } from "./ui/OrderDetailsView";

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  payment_method: string;
  notes?: string | null;
  created_at: string;
}

export interface WriteOffRecord {
  id: string;
  amount: number;
  reason?: string | null;
  notes?: string | null;
  created_at: string;
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
  extra_discount_amount?: number;
  discount_percent?: number;
  tax_percent?: number;
  tax_amount?: number;
  final_total?: number;
  clientPhone?: string,        
  referralSource?: string, 
  deliveryAddress?: string,
  payments?: PaymentRecord[],
  write_off_amount?: number,
  write_off_notes?: string,
  writeOffs?: WriteOffRecord[]
}

interface OrdersProps {
  orders: Order[];
  onFetchDetails: (orderId: string) => void;
  onFetchPayments: (orderId: string) => void;
  onFetchWriteOffs: (orderId: string) => void;
  onRecordPayment: (orderId: string, amount: number, method: string, notes?: string) => void;
  onWriteOff: (orderId: string, amount: number, reason?: string, notes?: string) => void;
  onDownloadInvoice: (orderId: string) => void;
  onCancelOrder?: (orderId: string) => Promise<void> | void; // New callback handler tracking hook
  summary?: {
    totalRevenue: number;
    totalReceived: number;
    totalDue: number;
    totalWriteOff: number;
    estimatedProfit: number;
  };
}

export function Orders({ orders, onFetchDetails, onFetchPayments, onFetchWriteOffs, onRecordPayment, onWriteOff, onDownloadInvoice, onCancelOrder, summary }: OrdersProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [writeOffOrder, setWriteOffOrder] = useState<Order | null>(null);
  const [writeOffAmount, setWriteOffAmount] = useState<string>("");
  const [writeOffReason, setWriteOffReason] = useState<string>("Customer Waived");
  const [writeOffNotes, setWriteOffNotes] = useState<string>("");
  const handleCancelClick = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation(); // Stop row expansion when clicking the button
    const confirmText = `Are you absolutely sure you want to cancel Order ${order.orderNumber}? \n\nThis will return all items back to Godown stock and zero out financial allocations.`;
    if (window.confirm(confirmText)) {
      onCancelOrder?.(order.id);
    }
  };
  const toggleExpand = (orderId: string) => {
    if (expandedOrderId !== orderId) {
      onFetchDetails(orderId); 
      onFetchPayments(orderId);
      onFetchWriteOffs(orderId);
      setExpandedOrderId(orderId);
    } else {
      setExpandedOrderId(null);
    }
  };

  const openPaymentModal = (order: Order) => {
    setPaymentOrder(order);
    setPaymentAmount("");
    setPaymentMethod("Cash");
    setPaymentNotes("");
    setPaymentModalOpen(true);
  };

  const handleSubmitPayment = () => {
    if (!paymentOrder) return;
    const amount = Number(paymentAmount);
    if (!amount || Number.isNaN(amount) || amount <= 0) return;
    onRecordPayment(paymentOrder.id, amount, paymentMethod, paymentNotes.trim() || undefined);
    setPaymentModalOpen(false);
  };

  const openWriteOffModal = (order: Order) => {
    setWriteOffOrder(order);
    setWriteOffAmount("");
    setWriteOffReason("Customer Waived");
    setWriteOffNotes("");
    setWriteOffModalOpen(true);
  };

  const handleSubmitWriteOff = () => {
    if (!writeOffOrder) return;
    const amount = Number(writeOffAmount);
    if (!amount || Number.isNaN(amount) || amount <= 0) return;
    onWriteOff(writeOffOrder.id, amount, writeOffReason, writeOffNotes.trim() || undefined);
    setWriteOffModalOpen(false);
  };
  const activeDisplayOrders = orders.filter((o) => o.status === "sold" || (o.status as string) === "cancelled");
  const soldOrders = orders.filter((o) => o.status === "sold");
  const totalRevenue = summary?.totalRevenue ?? soldOrders.reduce((sum, o) => sum + o.total, 0);
  const totalReceived = summary?.totalReceived ?? soldOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalDue = summary?.totalDue ?? soldOrders.reduce((sum, o) => sum + Math.max(0, o.total - (o.paidAmount || 0) - (o.write_off_amount || 0)), 0);
  const totalWriteOff = summary?.totalWriteOff ?? soldOrders.reduce((sum, o) => sum + (o.write_off_amount || 0), 0);
  const estimatedProfit = summary?.estimatedProfit ?? 0;

  const getStatusColor = (status: Order["status"]| "cancelled") => {
    switch (status) {
      case "bucket": return "bg-gray-400"; // Changed to gray for drafts
      case "pi": return "bg-yellow-500";  
      case "sold": return "bg-green-500";
      case "cancelled": return "bg-red-500 text-white"; // Red alert design flag
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
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
            <CardTitle className="text-[11px] leading-tight">Write-Off Total</CardTitle>
            <HandHelping className="size-3.5 text-gray-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0.5">
            <div className="text-base md:text-lg font-bold leading-none truncate">₹{totalWriteOff.toLocaleString()}</div>
            <p className="text-[10px] text-slate-500 mt-1">Closed without payment</p>
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
          <div className="mt-1 mb-3 text-xs text-slate-500 font-medium">
            Showing {activeDisplayOrders.length} of {orders.length} records
          </div>
          <OrderTable
            orders={activeDisplayOrders}
            expandedOrderId={expandedOrderId}
            onToggleExpand={toggleExpand}
            getStatusColor={getStatusColor}
            onOpenPaymentModal={openPaymentModal}
            onOpenWriteOffModal={openWriteOffModal}
            onDownloadInvoice={onDownloadInvoice}
            onCancelClick={handleCancelClick}
          />
        </CardContent>
      </Card>

      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {paymentOrder && (
            <div className="space-y-4">
              <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Customer</span>
                  <span className="font-medium text-slate-900">{paymentOrder.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Order #</span>
                  <span className="font-mono text-slate-800">{paymentOrder.orderNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Balance Due</span>
                  <span className="font-semibold text-slate-900">
                    ₹{(paymentOrder.total - (paymentOrder.paidAmount || 0) - (paymentOrder.write_off_amount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-gray-400">Amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-gray-400">Method</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-gray-400">Notes (optional)</Label>
                <Input
                  type="text"
                  placeholder="Add a note"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitPayment} disabled={!paymentAmount || Number(paymentAmount) <= 0}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={writeOffModalOpen} onOpenChange={setWriteOffModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Write-Off Balance</DialogTitle>
          </DialogHeader>
          {writeOffOrder && (
            <div className="space-y-4">
              <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Customer</span>
                  <span className="font-medium text-slate-900">{writeOffOrder.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Order #</span>
                  <span className="font-mono text-slate-800">{writeOffOrder.orderNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Balance Due</span>
                  <span className="font-semibold text-slate-900">
                    ₹{(writeOffOrder.total - (writeOffOrder.paidAmount || 0) - (writeOffOrder.write_off_amount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-gray-400">Amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  placeholder="Enter amount to write off"
                  value={writeOffAmount}
                  onChange={(e) => setWriteOffAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-gray-400">Reason</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  value={writeOffReason}
                  onChange={(e) => setWriteOffReason(e.target.value)}
                >
                  <option value="Customer Waived">Customer Waived</option>
                  <option value="Small Balance">Small Balance</option>
                  <option value="Pricing Adjustment">Pricing Adjustment</option>
                  <option value="Bad Debt">Bad Debt</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-gray-400">Notes (optional)</Label>
                <Input
                  type="text"
                  placeholder="Add a note"
                  value={writeOffNotes}
                  onChange={(e) => setWriteOffNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOffModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitWriteOff} disabled={!writeOffAmount || Number(writeOffAmount) <= 0}>
              Write Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderTable({ orders, expandedOrderId, onToggleExpand, getStatusColor, onOpenPaymentModal, onOpenWriteOffModal, onDownloadInvoice,onCancelClick }: any) {
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
        {/* {orders.map((order: Order) => (
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
              <TableCell className={`font-bold ${order.total - (order.paidAmount || 0) - (order.write_off_amount || 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                ₹{(order.total - (order.paidAmount || 0) - (order.write_off_amount || 0)).toLocaleString()}
              </TableCell>
              <TableCell><Badge className={getStatusColor(order.status)}>{order.status}</Badge></TableCell>
              <TableCell className="text-right">
                {(order.total - (order.paidAmount || 0) - (order.write_off_amount || 0)) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2 h-7 text-[10px] font-bold uppercase"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPaymentModal(order);
                    }}
                  >
                    Record Payment
                  </Button>
                )}
                {(order.total - (order.paidAmount || 0) - (order.write_off_amount || 0)) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mr-2 h-7 text-[10px] font-bold uppercase"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenWriteOffModal(order);
                    }}
                  >
                    Write-Off
                  </Button>
                )}
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
                  <div className="px-6 pb-6">
                    <div className="rounded-lg border bg-white p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Payment History</h4>
                        <span className="text-xs text-slate-500">
                          {order.payments?.length || 0} record{(order.payments?.length || 0) === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {order.payments && order.payments.length > 0 ? (
                          order.payments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                              <div>
                                <div className="font-medium text-slate-900">₹{payment.amount.toLocaleString()}</div>
                                <div className="text-slate-500">
                                  {payment.created_at ? new Date(payment.created_at).toLocaleString() : "—"} · {payment.payment_method}
                                </div>
                                {payment.notes && (
                                  <div className="text-slate-500">{payment.notes}</div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-500">No payments recorded yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6">
                    <div className="rounded-lg border bg-white p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Write-Off History</h4>
                        <span className="text-xs text-slate-500">
                          {order.writeOffs?.length || 0} record{(order.writeOffs?.length || 0) === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {order.writeOffs && order.writeOffs.length > 0 ? (
                          order.writeOffs.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                              <div>
                                <div className="font-medium text-slate-900">₹{entry.amount.toLocaleString()}</div>
                                <div className="text-slate-500">
                                  {entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"} · {entry.reason || "Write-off"}
                                </div>
                                {entry.notes && (
                                  <div className="text-slate-500">{entry.notes}</div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-500">No write-offs recorded yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </React.Fragment>
        ))} */}
        {orders.map((order: Order) => {
          const isCancelled = order.status === ("cancelled" as any);
          return (
            <React.Fragment key={order.id}>
              <TableRow 
                className={`cursor-pointer transition-colors ${
                  isCancelled 
                    ? "opacity-45 bg-slate-50 line-through hover:bg-slate-100/80" 
                    : "hover:bg-gray-50"
                }`} 
                onClick={() => onToggleExpand(order.id)}
              >
                <TableCell>
                  {expandedOrderId === order.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </TableCell>
                <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                <TableCell className={isCancelled ? "text-slate-400" : ""}>{order.customerName}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>₹{order.total.toLocaleString()}</TableCell>
                <TableCell className={isCancelled ? "text-slate-400" : "text-green-600"}>
                  ₹{(order.paidAmount || 0).toLocaleString()}
                </TableCell>
                <TableCell className={`font-bold ${
                  isCancelled 
                    ? "text-slate-400" 
                    : order.total - (order.paidAmount || 0) - (order.write_off_amount || 0) > 0 
                      ? 'text-red-600' 
                      : 'text-gray-900'
                }`}>
                  ₹{(order.total - (order.paidAmount || 0) - (order.write_off_amount || 0)).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {!isCancelled && (order.total - (order.paidAmount || 0) - (order.write_off_amount || 0)) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-2 h-7 text-[10px] font-bold uppercase"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPaymentModal(order);
                      }}
                    >
                      Record Payment
                    </Button>
                  )}
                  {!isCancelled && (order.total - (order.paidAmount || 0) - (order.write_off_amount || 0)) > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-2 h-7 text-[10px] font-bold uppercase"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenWriteOffModal(order);
                      }}
                    >
                      Write-Off
                    </Button>
                  )}
                  {!isCancelled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] font-bold uppercase text-red-500 hover:text-red-700 hover:bg-red-50 mr-2"
                      onClick={(e) => onCancelClick(e, order)}
                    >
                      Cancel Order
                    </Button>
                  )}
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
                    <div className="px-6 pb-6">
                      <div className="rounded-lg border bg-white p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Payment History</h4>
                          <span className="text-xs text-slate-500">
                            {order.payments?.length || 0} record{(order.payments?.length || 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {order.payments && order.payments.length > 0 ? (
                            order.payments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                                <div>
                                  <div className="font-medium text-slate-900">₹{payment.amount.toLocaleString()}</div>
                                  <div className="text-slate-500">
                                    {payment.created_at ? new Date(payment.created_at).toLocaleString() : "—"} · {payment.payment_method}
                                  </div>
                                  {payment.notes && (
                                    <div className="text-slate-500">{payment.notes}</div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500">No payments recorded yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="px-6 pb-6">
                      <div className="rounded-lg border bg-white p-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Write-Off History</h4>
                          <span className="text-xs text-slate-500">
                            {order.writeOffs?.length || 0} record{(order.writeOffs?.length || 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {order.writeOffs && order.writeOffs.length > 0 ? (
                            order.writeOffs.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                                <div>
                                  <div className="font-medium text-slate-900">₹{entry.amount.toLocaleString()}</div>
                                  <div className="text-slate-500">
                                    {entry.created_at ? new Date(entry.created_at).toLocaleString() : "—"} · {entry.reason || "Write-off"}
                                  </div>
                                  {entry.notes && (
                                    <div className="text-slate-500">{entry.notes}</div>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500">No write-offs recorded yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
