import React from "react";

interface PrintableInvoiceProps {
  pi: any;
}

export const PrintableInvoice = React.forwardRef<HTMLDivElement, PrintableInvoiceProps>(({ pi }, ref) => {
  const subtotal = pi.items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
  const discountVal = subtotal * (pi.discount / 100);
  const total = (subtotal - discountVal) * 1.1;

  return (
    <div ref={ref} className="p-10 bg-white text-black print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">PROFORMA INVOICE</h1>
          <p className="text-gray-500 mt-1">Order Ref: {pi.piNumber}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold">Your Shop Name</h2>
          <p className="text-sm text-gray-600">Address Line 1, City</p>
          <p className="text-sm text-gray-600">GSTIN: 29ABCDE1234F1Z5</p>
        </div>
      </div>

      {/* Info Sections */}
      <div className="flex justify-between my-8">
        <div>
          <h3 className="text-sm font-bold uppercase text-gray-500">Bill To:</h3>
          <p className="text-lg font-medium">{pi.clientName}</p>
        </div>
        <div className="text-right">
          <h3 className="text-sm font-bold uppercase text-gray-500">Date:</h3>
          <p className="text-lg font-medium">{pi.createdAt}</p>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-y border-gray-300">
            <th className="text-left p-3">Item Description</th>
            <th className="text-center p-3">Qty</th>
            <th className="text-right p-3">Unit Price</th>
            <th className="text-right p-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {pi.items.map((item: any, idx: number) => (
            <tr key={idx} className="border-b border-gray-200">
              <td className="p-3 uppercase text-sm font-medium">{item.name}</td>
              <td className="p-3 text-center">{item.quantity}</td>
              <td className="p-3 text-right">₹{item.price.toLocaleString()}</td>
              <td className="p-3 text-right font-medium">₹{(item.price * item.quantity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-8 flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>₹{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-red-600">
            <span>Discount ({pi.discount}%):</span>
            <span>-₹{discountVal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Tax (10%):</span>
            <span>₹{((subtotal - discountVal) * 0.1).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t-2 border-gray-800 pt-2 text-xl font-bold text-blue-700">
            <span>Grand Total:</span>
            <span>₹{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
});