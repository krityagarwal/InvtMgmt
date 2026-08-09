import React from "react";
import { User, Calendar } from "lucide-react";

export interface FinancialData {
  subtotal?: number;
  discount_amount?: number;
  extra_discount_amount?: number;
  discount_percent?: number;
  tax_percent?: number;
  tax_amount?: number;
  final_total?: number;
  total?: number;
  write_off_amount?: number;
  transportation_cost?: number;
}

export interface OrderDetailsViewProps {
  clientName: string;
  date: string;
  items: { name: string; quantity: number; price: number }[];
  financial: FinancialData;
  actions?: React.ReactNode;
}

export function OrderDetailsView({
  clientName,
  date,
  items,
  financial,
  actions
}: OrderDetailsViewProps) {
  return (
    <div className="p-6 border-b bg-white/50 space-y-6 animate-in fade-in slide-in-from-top-2">
      {/* Header Info */}
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-1">
          <label className="text-xs text-gray-400 flex items-center gap-1">
            <User className="size-3"/> Client
          </label>
          <p className="font-medium capitalize">{clientName}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400 flex items-center gap-1">
            <Calendar className="size-3"/> Date
          </label>
          <p className="font-medium">{date}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Items ({items?.length || 0})</h4>
        <div className="rounded-md border bg-white">
          {items?.map((item, idx) => (
            <div key={idx} className="flex justify-between p-3 text-sm border-b last:border-0">
              <span>{item.name} <span className="text-gray-400 ml-2">x{item.quantity}</span></span>
              <span className="font-mono">₹{(item.price * item.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 border">
        <h4 className="text-sm font-semibold mb-3">Summary</h4>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>₹{(financial.subtotal || 0).toLocaleString()}</span>
        </div>

        {financial.discount_percent !== undefined && financial.discount_percent > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Discount ({financial.discount_percent}%)</span>
            <span className="text-red-600">-₹{(financial.discount_amount || 0).toLocaleString()}</span>
          </div>
        )}

        {(financial.extra_discount_amount || 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Extra Discount</span>
            <span className="text-red-600">-₹{(financial.extra_discount_amount || 0).toLocaleString()}</span>
          </div>
        )}

        {(financial.transportation_cost || 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Transportation</span>
            <span>₹{(financial.transportation_cost || 0).toLocaleString()}</span>
          </div>
        )}

        {financial.tax_percent !== undefined && financial.tax_percent > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax ({financial.tax_percent}%)</span>
            <span>₹{(financial.tax_amount || 0).toLocaleString()}</span>
          </div>
        )}

        {(financial.write_off_amount || 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Write-Off</span>
            <span className="text-red-600">-₹{(financial.write_off_amount || 0).toLocaleString()}</span>
          </div>
        )}

        <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
          <span>Total Amount</span>
          <span className="text-blue-600">₹{(financial.final_total || financial.total || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Actions */}
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
