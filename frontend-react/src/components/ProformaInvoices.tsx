import React, { useState, useRef, useEffect } from "react";
import { FileText, Calendar, User, ChevronDown, ChevronRight, Edit, Trash2, Receipt, Printer, Download } from "lucide-react";
import jsPDF from "jspdf";
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
import { OrderDetailsView } from "./ui/OrderDetailsView";
import { Product } from "./Scanner";

export interface ProformaInvoice {
  id: string;
  piNumber: string;
  clientName: string;
  items: { name: string; quantity: number; price: number }[];
  discount: number;
  status: "draft" | "sent" | "negotiating" | "approved";
  createdAt: string;
  updatedAt: string;
  notes?: string;
  subtotal?: number;
  paidAmount: number;
  discount_amount?: number;
  discount_percent?: number;
  tax_percent?: number;
  tax_amount?: number;
  final_total?: number;
  total?: number;
}

interface ProformaInvoicesProps {
  invoices: ProformaInvoice[];
  products: Product[];
  onEditPI: (pi: ProformaInvoice) => void;
  onConvertToOrder: (pi: any) => void;
  onDeletePI: (piId: string) => void;
  onUpdateStatus: (piId: string, status: ProformaInvoice["status"]) => void;
  onFetchDetails: (orderId: string) => void;
}

export function ProformaInvoices({ 
  invoices, 
  products,
  onEditPI, 
  onConvertToOrder, 
  onDeletePI,
  onUpdateStatus,
  onFetchDetails
}: ProformaInvoicesProps) {
  const [expandedPIId, setExpandedPIId] = useState<string | null>(null);
  const [printingPI, setPrintingPI] = useState<ProformaInvoice | null>(null);
  const [downloadPI, setDownloadPI] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Watch for download PI and trigger download when data is ready
  useEffect(() => {
    if (downloadPI) {
      const pi = invoices.find(inv => inv.id === downloadPI);
      if (pi && pi.items && pi.items.length > 0) {
        handleDownloadPDF(pi);
        setDownloadPI(null);
      }
    }
  }, [downloadPI, invoices]);

  // Watch for printing PI and trigger print when data is ready
  useEffect(() => {
    if (printingPI && printingPI.items && printingPI.items.length > 0) {
      setTimeout(() => {
        window.print();
        setPrintingPI(null);
      }, 300);
    }
  }, [printingPI]);

  const handleDownloadPDF = (pi: ProformaInvoice) => {
    try {
      const subtotal = pi.subtotal || pi.items?.reduce((sum, i) => sum + i.price * i.quantity, 0) || 0;
      const discountAmount = pi.discount_amount || (subtotal * (pi.discount_percent || pi.discount || 0) / 100);
      const taxableAmount = subtotal - discountAmount;
      const taxAmount = pi.tax_amount || (taxableAmount * (pi.tax_percent || 18) / 100);
      const finalTotal = pi.final_total || (taxableAmount + taxAmount);

      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      let yPosition = 20;

      // Header
      doc.setFontSize(28);
      doc.text("PROFORMA INVOICE", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;

      doc.setFontSize(10);
      doc.text(`Invoice #: ${pi.piNumber}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      // Company info
      doc.setFontSize(12);
      doc.text("The Light Code", pageWidth - 20, yPosition, { align: "right" });
      doc.setFontSize(9);
      doc.text("Electronics & Components", pageWidth - 20, yPosition + 5, { align: "right" });
      doc.text("Ph: +91-XXXXXXXXXX", pageWidth - 20, yPosition + 10, { align: "right" });
      doc.text("Email: info@thelightcode.com", pageWidth - 20, yPosition + 15, { align: "right" });

      // Bill to section
      yPosition += 25;
      doc.setFontSize(11);
      doc.text("BILL TO:", 20, yPosition);
      doc.setFontSize(12);
      doc.text(pi.clientName, 20, yPosition + 6);
      doc.setFontSize(9);
      doc.text(`Date: ${pi.createdAt}`, 20, yPosition + 12);
      doc.text(`Status: ${pi.status.toUpperCase()}`, pageWidth - 20, yPosition + 12, { align: "right" });

      // Items table header
      yPosition += 30;
      doc.setFontSize(10);
      doc.setFillColor(200, 200, 200);
      doc.rect(20, yPosition - 5, pageWidth - 40, 8, "F");
      doc.text("Item", 22, yPosition);
      doc.text("Qty", 120, yPosition);
      doc.text("Unit Price", 140, yPosition);
      doc.text("Total", pageWidth - 22, yPosition, { align: "right" });
      yPosition += 10;

      // Items table rows
      doc.setFontSize(9);
      if (pi.items && pi.items.length > 0) {
        pi.items.forEach((item) => {
          doc.text(item.name, 22, yPosition);
          doc.text(item.quantity.toString(), 120, yPosition);
          doc.text(`₹${item.price.toLocaleString()}`, 140, yPosition);
          doc.text(`₹${(item.price * item.quantity).toLocaleString()}`, pageWidth - 22, yPosition, { align: "right" });
          yPosition += 7;
        });
      }

      yPosition += 10;

      // Financial summary
      const summaryX = pageWidth - 100;
      doc.setFontSize(10);
      doc.text("Subtotal:", summaryX, yPosition);
      doc.text(`₹${subtotal.toLocaleString()}`, pageWidth - 22, yPosition, { align: "right" });

      yPosition += 8;
      if ((pi.discount_percent || pi.discount) > 0) {
        doc.setTextColor(204, 0, 0);
        doc.text(`Discount (${pi.discount_percent || pi.discount}%):`, summaryX, yPosition);
        doc.text(`-₹${discountAmount.toLocaleString()}`, pageWidth - 22, yPosition, { align: "right" });
        yPosition += 8;
        doc.setTextColor(0, 0, 0);
      }

      doc.text("Taxable Amount:", summaryX, yPosition);
      doc.text(`₹${taxableAmount.toLocaleString()}`, pageWidth - 22, yPosition, { align: "right" });

      yPosition += 8;
      if ((pi.tax_percent || 18) > 0) {
        doc.text(`Tax (${pi.tax_percent || 18}%):`, summaryX, yPosition);
        doc.text(`₹${taxAmount.toLocaleString()}`, pageWidth - 22, yPosition, { align: "right" });
        yPosition += 8;
      }

      doc.setFontSize(12);
      doc.setFont("Helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(summaryX - 10, yPosition - 6, 80, 8, "F");
      doc.text("TOTAL AMOUNT:", summaryX, yPosition);
      doc.text(`₹${finalTotal.toLocaleString()}`, pageWidth - 22, yPosition, { align: "right" });

      // Footer
      yPosition = pageHeight - 30;
      doc.setFontSize(9);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Note: This is a Proforma Invoice. It is not an official invoice unless converted to sale.", 20, yPosition);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, yPosition + 6);

      doc.save(`PI_${pi.piNumber}_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const toggleExpand = (piId: string) => {
    if (expandedPIId !== piId) {
      onFetchDetails(piId);
      setExpandedPIId(piId);
    } else {
      setExpandedPIId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header/Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total PIs</CardTitle>
            <FileText className="size-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Management Table */}
      <Card className="print:hidden">
        <CardHeader><CardTitle>Proforma Invoice Management</CardTitle></CardHeader>
        <CardContent>
          <PITable 
            invoices={invoices}
            products={products}
            expandedPIId={expandedPIId}
            onToggleExpand={toggleExpand}
            onEditPI={onEditPI}
            onConvertToOrder={onConvertToOrder}
            onDeletePI={onDeletePI}
            onUpdateStatus={onUpdateStatus}
            onFetchDetails={onFetchDetails}
            onSetDownloadPI={setDownloadPI}
            onSetPrintingPI={setPrintingPI}
          />
        </CardContent>
      </Card>

      {/* 3. Printable Component - Hidden on screen, visible on print */}
      <div ref={printRef} className="hidden print:block">
        {printingPI && (
          <PrintLayout pi={printingPI} />
        )}
      </div>
    </div>
  );
}

// Inner component for the printable layout using Tailwind
function PrintLayout({ pi }: { pi?: ProformaInvoice }) {
  if (!pi) return null;
  
  // Use actual financial data from PI, fallback to calculations if needed
  const subtotal = pi.subtotal || (pi.items?.reduce((sum, i) => sum + i.price * i.quantity, 0) || 0);
  const discountAmount = pi.discount_amount || (subtotal * (pi.discount_percent || pi.discount || 0) / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = pi.tax_amount || (taxableAmount * (pi.tax_percent || 18) / 100);
  const finalTotal = pi.final_total || (taxableAmount + taxAmount);

  return (
    <div className="p-12 bg-white text-black max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start mb-12">
        <div>
          <h1 className="text-4xl font-bold">PROFORMA INVOICE</h1>
          <p className="text-gray-600 mt-2">Invoice #: {pi.piNumber}</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold">The Light Code</h2>
          <p className="text-sm text-gray-600">Electronics & Components</p>
          <p className="text-sm text-gray-600">Ph: +91-XXXXXXXXXX</p>
          <p className="text-sm text-gray-600">Email: info@thelightcode.com</p>
        </div>
      </div>

      <div className="border-t-2 border-b-2 py-8 mb-8 flex justify-between">
        <div>
          <p className="font-bold text-sm">BILL TO:</p>
          <p className="text-lg font-semibold">{pi.clientName}</p>
          <p className="text-sm text-gray-600">Date: {pi.createdAt}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Status: <span className="font-semibold">{pi.status.toUpperCase()}</span></p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="bg-gray-100 border-b-2">
            <th className="p-3 text-left font-bold">Item</th>
            <th className="p-3 text-center font-bold">Quantity</th>
            <th className="p-3 text-right font-bold">Unit Price</th>
            <th className="p-3 text-right font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          {pi.items && pi.items.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="p-3">{item.name}</td>
              <td className="p-3 text-center">{item.quantity}</td>
              <td className="p-3 text-right">₹{item.price.toLocaleString()}</td>
              <td className="p-3 text-right">₹{(item.price * item.quantity).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Financial Summary */}
      <div className="flex justify-end mb-8">
        <div className="w-80 border-t-2">
          <div className="flex justify-between p-3 border-b">
            <span className="font-semibold">Subtotal:</span>
            <span>₹{subtotal.toLocaleString()}</span>
          </div>
          
          {(pi.discount_percent || pi.discount) > 0 && (
            <div className="flex justify-between p-3 border-b text-red-600">
              <span className="font-semibold">Discount ({pi.discount_percent || pi.discount}%):</span>
              <span>-₹{discountAmount.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between p-3 border-b">
            <span className="font-semibold">Taxable Amount:</span>
            <span>₹{taxableAmount.toLocaleString()}</span>
          </div>

          {(pi.tax_percent || 18) > 0 && (
            <div className="flex justify-between p-3 border-b">
              <span className="font-semibold">Tax ({pi.tax_percent || 18}%):</span>
              <span>₹{taxAmount.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between p-3 bg-gray-100 font-bold text-lg">
            <span>TOTAL AMOUNT:</span>
            <span>₹{finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 pt-8 mt-12 text-xs text-gray-600">
        <p>Note: This is a Proforma Invoice. It is not an official invoice unless converted to sale.</p>
        <p className="mt-2">Generated on: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
}

function PITable({ 
  invoices, 
  products= [], // 1. Added products prop for runtime check
  expandedPIId, 
  onToggleExpand, 
  onEditPI, 
  onConvertToOrder, 
  onDeletePI, 
  onUpdateStatus, 
  onFetchDetails, 
  onSetDownloadPI, 
  onSetPrintingPI 
}: any) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]"></TableHead>
          <TableHead>PI #</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Paid</TableHead> 
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((pi: ProformaInvoice) => {
          // Check the data structure immediately
          console.log(`--- Checking PI: ${pi.piNumber} ---`);
          console.log("Items available:", pi.items?.length || 0);
          console.log("Full PI Object:", pi); // Inspect this in console to see if 'items' exists
          // 2. Derive stock status at runtime
          // We check if any item in the PI has a quantity greater than current master stock
          const hasShortage = pi.items?.some(item => {
            const masterProduct = products.find((p: any) => 
              p.barcode?.toLowerCase().trim() === item.name?.toLowerCase().trim());
            console.log(masterProduct)
            if (!masterProduct) {
              console.warn(`Could not find product in inventory: "${item.name}"`);
              return false;
            }
            const availableStock = (masterProduct.displayStock || 0) + (masterProduct.godownStock || 0);
            console.log(
              `Item: ${item.name} | Req: ${item.quantity} | Available: ${availableStock} | Shortage: ${item.quantity > availableStock }`);
            return item.quantity > availableStock;
          });

          return (
            <React.Fragment key={pi.id}>
              <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => onToggleExpand(pi.id)}>
                <TableCell>
                  {expandedPIId === pi.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </TableCell>
                <TableCell className="font-mono text-sm">{pi.piNumber}</TableCell>
                <TableCell className="font-medium">{pi.clientName}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5 items-start">
                    <Badge variant="outline" className="text-[10px]">{pi.status}</Badge>
                    {/* 3. Visual Flag for Shortage */}
                    {hasShortage && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px]font-bold py-0 leading-tight">
                        Stock Shortage
                      </Badge>
                    )}
                  </div>
                </TableCell>
                {/* Total Column */}
              <TableCell className="text-right font-medium">
                ₹{(pi.total ?? 0).toLocaleString()}
              </TableCell>

              {/* Paid Amount Column */}
              <TableCell className="text-right">
                <span className={(pi.paidAmount ?? 0) > 0 ? "text-green-600 font-semibold" : "text-gray-400"}>
                  ₹{(pi.paidAmount ?? 0).toLocaleString()}
                </span>
              </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onFetchDetails(pi.id);
                        onSetDownloadPI(pi.id);
                      }}
                      title="Download PI as PDF"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onFetchDetails(pi.id);
                        const latestPI = invoices.find((inv: ProformaInvoice) => inv.id === pi.id) || pi;
                        onSetPrintingPI(latestPI);
                      }}
                      title="Print PI"
                    >
                      <Printer className="size-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPI(pi);
                      }}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDeletePI(pi.id)}><Trash2 className="size-4 text-red-500" /></Button>
                  </div>
                </TableCell>
              </TableRow>
              
              {expandedPIId === pi.id && (
                <TableRow>
                  <TableCell colSpan={5} className="bg-gray-50/50 p-0">
                    <OrderDetailsView
                      clientName={pi.clientName}
                      date={pi.createdAt}
                      items={pi.items || []}
                      financial={pi}
                      actions={
                        /* 4. Conditionally disable 'Convert to Sale' */
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300" 
                          onClick={() => onConvertToOrder(pi)}
                          disabled={hasShortage}
                        >
                          {hasShortage ? "Insufficient Stock" : "Convert to Sale"}
                        </Button>
                      }
                    />
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