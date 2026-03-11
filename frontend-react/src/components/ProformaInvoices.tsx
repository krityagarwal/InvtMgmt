// import React, { useState, useRef, useEffect } from "react";
// import { FileText, Calendar, User, ChevronDown, ChevronRight, Edit, Trash2, Receipt, Printer, Download } from "lucide-react";
// import jsPDF from "jspdf";
// import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
// import { Badge } from "./ui/badge";
// import { Button } from "./ui/button";
// import html2canvas from "html2canvas";
// import { toast } from "sonner";
// import { GlobalLoader } from "./Loader";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "./ui/table";
// import { OrderDetailsView } from "./ui/OrderDetailsView";
// import { Product } from "./Scanner";

// export interface ProformaInvoice {
//   id: string;
//   piNumber: string;
//   clientName: string;
//   items: { name: string; quantity: number; price: number; photo_url?: string; category?: string; attribute_metadata?: { label: string; qty: number }[] }[];
//   discount: number;
//   status: "draft" | "sent" | "negotiating" | "approved";
//   createdAt: string;
//   updatedAt: string;
//   notes?: string;
//   subtotal?: number;
//   paidAmount: number;
//   discount_amount?: number;
//   discount_percent?: number;
//   tax_percent?: number;
//   tax_amount?: number;
//   final_total?: number;
//   total?: number;
//   clientPhone?: string;        
//   referralSource?: string; 
//   deliveryAddress?: string; 
//   photo_url?: string;
//   attribute_metadata?: { label: string; qty: number }[] // Ensure this matches
// }

// interface ProformaInvoicesProps {
//   invoices: ProformaInvoice[];
//   products: Product[];
//   onEditPI: (pi: ProformaInvoice) => void;
//   onConvertToOrder: (pi: any) => void;
//   onDeletePI: (piId: string) => void;
//   onUpdateStatus: (piId: string, status: ProformaInvoice["status"]) => void;
//   onFetchDetails: (orderId: string) => void;
//   initialDownloadId: string | null; 
//   onClearInitialDownload: () => void;
// }

// export function ProformaInvoices({ 
//   invoices, 
//   products,
//   initialDownloadId, 
//   onClearInitialDownload,
//   onEditPI, 
//   onConvertToOrder, 
//   onDeletePI,
//   onUpdateStatus,
//   onFetchDetails
// }: ProformaInvoicesProps) {
//   const [expandedPIId, setExpandedPIId] = useState<string | null>(null);
//   const [printingPI, setPrintingPI] = useState<ProformaInvoice | null>(null);
//   const [downloadPI, setDownloadPI] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   useEffect(() => {
//     if (initialDownloadId) {
//       setDownloadPI(initialDownloadId);
//       onClearInitialDownload(); // Clear the signal in App.tsx
//     }
//   }, [initialDownloadId]);

//   // PDF Trigger Effect: Handles data fetching and DOM readiness
//   useEffect(() => {
//     if (downloadPI) {
//       const pi = invoices.find(inv => inv.id === downloadPI);
      
//       if (pi && (!pi.items || pi.items.length === 0)) {
//         onFetchDetails(downloadPI);
//         return; 
//       }
      
//       if (pi && pi.items && pi.items.length > 0) {
//         // Delay ensures React has mounted the PrintLayout into #printable-pi
//         const timer = setTimeout(() => {
//           handleDownloadPDF(pi);
//         }, 600); 
//         return () => clearTimeout(timer);
//       }
//     }
//   }, [downloadPI, invoices]);

//   useEffect(() => {
//     if (printingPI && printingPI.items && printingPI.items.length > 0) {
//       setTimeout(() => {
//         window.print();
//         setPrintingPI(null);
//       }, 300);
//     }
//   }, [printingPI]);

//   const handleDownloadPDF = async (pi: ProformaInvoice) => {
//     const element = document.getElementById("printable-pi");
    
//     if (!element) {
//       toast.error("Template rendering error");
//       setDownloadPI(null);
//       return; 
//     }

//     try {
//       setIsLoading(true);
      
//       // Wait for all images inside the element to load
//       const images = element.getElementsByTagName('img');
//       const imagePromises = Array.from(images).map(img => {
//         if (img.complete) return Promise.resolve();
//         return new Promise(resolve => {
//           img.onload = resolve;
//           img.onerror = resolve; 
//         });
//       });

//       await Promise.all(imagePromises);

//       const canvas = await html2canvas(element, {
//         scale: 2,
//         useCORS: true,       
//         allowTaint: false,   
//         logging: false,       
//         backgroundColor: "#ffffff",
//         imageTimeout: 15000, 
//       });

//       const imgData = canvas.toDataURL("image/png");
//       const pdf = new jsPDF("p", "mm", "a4");
//       const pdfWidth = pdf.internal.pageSize.getWidth();
//       const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

//       pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
//       pdf.save(`PI_${pi.piNumber}_${pi.clientName}.pdf`);
      
//       toast.success("PI Downloaded");
//     } catch (err) {
//       console.error("PDF generation failed:", err);
//       toast.error("Failed to generate PDF");
//     } finally {
//       setDownloadPI(null); 
//       setIsLoading(false);
//     }
//   };

//   const toggleExpand = (piId: string) => {
//     if (expandedPIId !== piId) {
//       onFetchDetails(piId);
//       setExpandedPIId(piId);
//     } else {
//       setExpandedPIId(null);
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {isLoading && <GlobalLoader />}
      
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Total PIs</CardTitle>
//             <FileText className="size-4 text-gray-500" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{invoices.length}</div>
//           </CardContent>
//         </Card>
//       </div>

//       <Card className="print:hidden">
//         <CardHeader><CardTitle>Proforma Invoice Management</CardTitle></CardHeader>
//         <CardContent>
//           <PITable 
//             invoices={invoices}
//             products={products}
//             expandedPIId={expandedPIId}
//             onToggleExpand={toggleExpand}
//             onEditPI={onEditPI}
//             onConvertToOrder={onConvertToOrder}
//             onDeletePI={onDeletePI}
//             onUpdateStatus={onUpdateStatus}
//             onFetchDetails={onFetchDetails}
//             onSetDownloadPI={setDownloadPI}
//             onSetPrintingPI={setPrintingPI}
//           />
//         </CardContent>
//       </Card>

//       {/* Visible only during window.print() */}
//       <div className="hidden print:block">
//         {(printingPI || invoices.find(inv => inv.id === downloadPI)) && (
//           <PrintLayout pi={printingPI || invoices.find(inv => inv.id === downloadPI)} />
//         )}
//       </div>

//       {/* Hidden container for PDF capture - Uses HEX colors to avoid oklch errors */}
//       <div 
//         id="printable-pi" 
//         style={{ 
//           position: 'absolute', 
//           top: '-10000px', 
//           left: '-10000px',
//           backgroundColor: '#ffffff',
//           color: '#000000',
//           width: '210mm'
//         }}
//       >
//         {downloadPI && (
//           <PrintLayout pi={invoices.find(inv => inv.id === downloadPI)} />
//         )}
//       </div>
//     </div>
//   );
// }

// // Sanitized Layout: All colors converted to HEX to prevent html2canvas oklch crash
// function PrintLayout({ pi }: { pi?: ProformaInvoice }) {
//   if (!pi) return null;
  
//   const subtotal = pi.subtotal || (pi.items?.reduce((sum, i) => sum + i.price * i.quantity, 0) || 0);
//   const discountAmount = pi.discount_amount || (subtotal * (pi.discount_percent || pi.discount || 0) / 100);
//   const taxableAmount = subtotal - discountAmount;
//   const taxAmount = pi.tax_amount || (taxableAmount * (pi.tax_percent || 18) / 100);
//   const finalTotal = pi.final_total || (taxableAmount + taxAmount);

// // LOG: Check what data is actually present when the PDF is generated
//   console.log("Printing PI Data:", pi);
//   console.log("First Item Photo:", pi.items?.[0]?.photo_url);
//   console.log("First Item Attributes:", pi.items?.[0]?.attribute_metadata);

//   return (
//     <div style={{ backgroundColor: '#ffffff', color: '#000000', padding: '40px', fontFamily: 'sans-serif' }}>
//       {/* Business Header */}
//       <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '4px solid #1e3a8a', paddingBottom: '24px', marginBottom: '32px' }}>
//         <div>
//           <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#1e3a8a', margin: 0, textTransform: 'uppercase' }}>The Light Code</h1>
//           <p style={{ fontSize: '11px', color: '#374151', marginTop: '8px', maxWidth: '350px', lineHeight: '1.5' }}>
//             3RD FLOOR, DWARIKA HEIGHTS, EASTERN BYPASS, <br />
//             DON BOSCO COLONY, SILIGURI, WEST BENGAL - 734008
//           </p>
//           <p style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '8px', color: '#1e40af' }}>GSTIN: 19AAHCT0000A1Z5</p>
//         </div>
//         <div style={{ textAlign: 'right' }}>
//           <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase', margin: 0 }}>Proforma Invoice</h2>
//           <p style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', marginTop: '4px' }}>Ref: #{pi.piNumber}</p>
//           <p style={{ fontSize: '14px', marginTop: '4px' }}>Date: {pi.createdAt}</p>
//         </div>
//       </div>

//       {/* Customer Details */}
//       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginBottom: '40px' }}>
//         <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
//           <h3 style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: '#2563eb', marginBottom: '8px' }}>Bill To:</h3>
//           <p style={{ fontWeight: 'bold', fontSize: '18px', margin: 0 }}>{pi.clientName}</p>
//           <p style={{ fontSize: '14px', marginTop: '8px' }}>Phone: {pi.clientPhone || "N/A"}</p>
//         </div>
//         <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
//           <h3 style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', color: '#2563eb', marginBottom: '8px' }}>Delivery Address:</h3>
//           <p style={{ fontSize: '14px', fontStyle: 'italic', lineHeight: '1.4' }}>{pi.deliveryAddress || "Store Pickup"}</p>
//         </div>
//       </div>

//       {/* Table */}
//       <table style={{ width: '100%', borderCollapse: 'collapse' }}>
//         <thead>
//           <tr style={{ borderTop: '2px solid #000000', borderBottom: '2px solid #000000', backgroundColor: '#f9fafb' }}>
//             <th style={{ padding: '12px 8px', fontSize: '10px', textAlign: 'left', textTransform: 'uppercase' }}>Photo</th>
//             <th style={{ padding: '12px 8px', fontSize: '10px', textAlign: 'left', textTransform: 'uppercase' }}>Description</th>
//             <th style={{ padding: '12px 8px', fontSize: '10px', textAlign: 'center', textTransform: 'uppercase' }}>Qty</th>
//             <th style={{ padding: '12px 8px', fontSize: '10px', textAlign: 'right', textTransform: 'uppercase' }}>Price</th>
//             <th style={{ padding: '12px 8px', fontSize: '10px', textAlign: 'right', textTransform: 'uppercase' }}>Total</th>
//           </tr>
//         </thead>
//         <tbody>
//           {pi.items?.map((item: any, idx: number) => (
//             <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
//               <td style={{ padding: '16px 8px' }}>
//                 <div style={{ width: '80px', height: '80px', border: '1px solid #e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
//                   <img src={item.photo_url || "https://placehold.co/100x100"} style={{ maxWidth: '100%', maxHeight: '100%' }} crossOrigin="anonymous" />
//                 </div>
//               </td>
//               <td style={{ padding: '16px 8px' }}>
//                 <p style={{ fontWeight: 'bold', fontSize: '14px', margin: 0, textTransform: 'uppercase' }}>{item.name}</p>
//                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
//                   {item.attribute_metadata?.map((attr: any, i: number) => (
//                     <span key={i} style={{ fontSize: '9px', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>{attr.label}: {attr.qty}</span>
//                   ))}
//                 </div>
//               </td>
//               <td style={{ padding: '16px 8px', textAlign: 'center' }}>{item.quantity}</td>
//               <td style={{ padding: '16px 8px', textAlign: 'right' }}>₹{item.price.toLocaleString()}</td>
//               <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: 'bold' }}>₹{(item.price * item.quantity).toLocaleString()}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       {/* Totals */}
//       <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
//         <div style={{ width: '320px' }}>
//           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingBottom: '4px' }}>
//             <span>Sub-Total</span>
//             <span style={{ fontWeight: 'bold' }}>₹{subtotal.toLocaleString()}</span>
//           </div>
//           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#dc2626', paddingBottom: '4px' }}>
//             <span>Discount ({pi.discount_percent || pi.discount}%)</span>
//             <span style={{ fontWeight: 'bold' }}>-₹{discountAmount.toLocaleString()}</span>
//           </div>
//           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
//             <span>GST ({pi.tax_percent || 18}%)</span>
//             <span style={{ fontWeight: 'bold' }}>₹{taxAmount.toLocaleString()}</span>
//           </div>
//           <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '2px solid #1e3a8a' }}>
//             <span style={{ fontSize: '18px', fontWeight: '900', color: '#1e3a8a' }}>GRAND TOTAL</span>
//             <span style={{ fontSize: '20px', fontWeight: '900', color: '#1e3a8a' }}>₹{finalTotal.toLocaleString()}</span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function PITable({ 
//   invoices, 
//   products= [], 
//   expandedPIId, 
//   onToggleExpand, 
//   onEditPI, 
//   onConvertToOrder, 
//   onDeletePI, 
//   onUpdateStatus, 
//   onFetchDetails, 
//   onSetDownloadPI, 
//   onSetPrintingPI 
// }: any) {
//   return (
//     <Table>
//       <TableHeader>
//         <TableRow>
//           <TableHead className="w-[40px]"></TableHead>
//           <TableHead>PI #</TableHead>
//           <TableHead>Client</TableHead>
//           <TableHead>Status</TableHead>
//           <TableHead className="text-right">Total</TableHead>
//           <TableHead className="text-right">Paid</TableHead> 
//           <TableHead className="text-right">Actions</TableHead>
//         </TableRow>
//       </TableHeader>
//       <TableBody>
//         {invoices.map((pi: ProformaInvoice) => {
//           const hasShortage = pi.items?.some(item => {
//             const masterProduct = products.find((p: any) => 
//               p.barcode?.toLowerCase().trim() === item.name?.toLowerCase().trim());
//             if (!masterProduct) return false;
//             const availableStock = (masterProduct.displayStock || 0) + (masterProduct.godownStock || 0);
//             return item.quantity > availableStock;
//           });

//           return (
//             <React.Fragment key={pi.id}>
//               <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => onToggleExpand(pi.id)}>
//                 <TableCell>
//                   {expandedPIId === pi.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
//                 </TableCell>
//                 <TableCell className="font-mono text-sm">{pi.piNumber}</TableCell>
//                 <TableCell className="font-medium">{pi.clientName}</TableCell>
//                 <TableCell>
//                   <div className="flex flex-col gap-1.5 items-start">
//                     <Badge variant="outline" className="text-[10px]">{pi.status}</Badge>
//                     {hasShortage && (
//                       <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] font-bold py-0 leading-tight">
//                         Stock Shortage
//                       </Badge>
//                     )}
//                   </div>
//                 </TableCell>
//               <TableCell className="text-right font-medium">
//                 ₹{(pi.total ?? 0).toLocaleString()}
//               </TableCell>
//               <TableCell className="text-right">
//                 <span className={(pi.paidAmount ?? 0) > 0 ? "text-green-600 font-semibold" : "text-gray-400"}>
//                   ₹{(pi.paidAmount ?? 0).toLocaleString()}
//                 </span>
//               </TableCell>
//                 <TableCell className="text-right">
//                   <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
//                     <Button 
//                       variant="ghost" 
//                       size="icon" 
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         onSetDownloadPI(pi.id);
//                       }}
//                       title="Download PI"
//                     >
//                       <Download className="size-4" />
//                     </Button>
//                     <Button 
//                       variant="ghost" 
//                       size="icon" 
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         onSetPrintingPI(pi);
//                       }}
//                       title="Print PI"
//                     >
//                       <Printer className="size-4" />
//                     </Button>
//                     <Button 
//                       variant="ghost" 
//                       size="icon" 
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         onEditPI(pi);
//                       }}
//                     >
//                       <Edit className="size-4" />
//                     </Button>
//                     <Button variant="ghost" size="icon" onClick={() => onDeletePI(pi.id)}><Trash2 className="size-4 text-red-500" /></Button>
//                   </div>
//                 </TableCell>
//               </TableRow>
              
//               {expandedPIId === pi.id && (
//                 <TableRow>
//                   <TableCell colSpan={7} className="bg-gray-50/50 p-0">
//                     <OrderDetailsView
//                       clientName={pi.clientName}
//                       date={pi.createdAt}
//                       items={pi.items || []}
//                       financial={pi}
//                       actions={
//                         <Button 
//                           size="sm" 
//                           className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300" 
//                           onClick={() => onConvertToOrder(pi)}
//                           disabled={hasShortage}
//                         >
//                           {hasShortage ? "Insufficient Stock" : "Convert to Sale"}
//                         </Button>
//                       }
//                     />
//                   </TableCell>
//                 </TableRow>
//               )}
//             </React.Fragment>
//           );
//         })}
//       </TableBody>
//     </Table>
//   );
// }

import React, { useState, useRef, useEffect } from "react";
import { FileText, Calendar, User, ChevronDown, ChevronRight, Edit, Trash2, Receipt, Printer, Download } from "lucide-react";
import jsPDF from "jspdf";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { GlobalLoader } from "./Loader";
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
  items: { name: string; quantity: number; price: number; photo_url?: string; category?: string; attribute_metadata?: { label: string; qty: number }[] }[];
  discount: number;
  status: "draft" | "sent" | "negotiating" | "approved";
  createdAt: string;
  updatedAt: string;
  notes?: string;
  subtotal?: number;
  paidAmount: number;
  discount_amount?: number;
  extra_discount_amount?: number;
  discount_percent?: number;
  tax_percent?: number;
  tax_amount?: number;
  final_total?: number;
  total?: number;
  write_off_amount?: number;
  write_off_notes?: string;
  clientPhone?: string;        
  referralSource?: string; 
  deliveryAddress?: string; 
  photo_url?: string;
  attribute_metadata?: { label: string; qty: number }[] // Ensure this matches
}
export type PrintDocumentType = "PI" | "INVOICE";
interface ProformaInvoicesProps {
  invoices: ProformaInvoice[];
  products: Product[];
  onEditPI: (pi: ProformaInvoice) => void;
  onConvertToOrder: (pi: any) => void;
  onDeletePI: (piId: string) => void;
  onUpdateStatus: (piId: string, status: ProformaInvoice["status"]) => void;
  onFetchDetails: (orderId: string) => void;
  initialDownloadId: string | null; 
  onClearInitialDownload: () => void;
}
export function ProformaInvoices({ 
  invoices, 
  products,
  initialDownloadId, 
  onClearInitialDownload,
  onEditPI, 
  onConvertToOrder, 
  onDeletePI,
  onUpdateStatus,
  onFetchDetails
}: ProformaInvoicesProps) {
  const [expandedPIId, setExpandedPIId] = useState<string | null>(null);
  const [printingPI, setPrintingPI] = useState<ProformaInvoice | null>(null);
  const [downloadPI, setDownloadPI] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (initialDownloadId) {
      // From cart "PI" action: open in expanded view for review first.
      setExpandedPIId(initialDownloadId);
      onFetchDetails(initialDownloadId);
      onClearInitialDownload(); // Clear the signal in App.tsx
    }
  }, [initialDownloadId]);
  // PDF Trigger Effect: Handles data fetching and DOM readiness
  useEffect(() => {
    if (downloadPI) {
      const pi = invoices.find(inv => inv.id === downloadPI);
      
      if (pi && (!pi.items || pi.items.length === 0)) {
        onFetchDetails(downloadPI);
        return; 
      }
      
      if (pi && pi.items && pi.items.length > 0) {
        // Delay ensures React has mounted the PrintLayout into #printable-pi
        const timer = setTimeout(() => {
          handleDownloadPDF(pi);
        }, 600); 
        return () => clearTimeout(timer);
      }
    }
  }, [downloadPI, invoices]);
  useEffect(() => {
    if (printingPI && printingPI.items && printingPI.items.length > 0) {
      setTimeout(() => {
        window.print();
        setPrintingPI(null);
      }, 300);
    }
  }, [printingPI]);
  const handleDownloadPDF = async (pi: ProformaInvoice) => {
    const element = document.getElementById("printable-pi");
    
    if (!element) {
      toast.error("Template rendering error");
      setDownloadPI(null);
      return; 
    }
    try {
      setIsLoading(true);
      
      // Wait for all images inside the element to load
      const images = element.getElementsByTagName('img');
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve; 
        });
      });
      await Promise.all(imagePromises);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,       
        allowTaint: false,   
        logging: false,       
        backgroundColor: "#ffffff",
        imageTimeout: 15000, 
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`PI_${pi.piNumber}_${pi.clientName}.pdf`);
      
      toast.success("PI Downloaded");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadPI(null); 
      setIsLoading(false);
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
      {isLoading && <GlobalLoader />}
      
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
      {/* Visible only during window.print() */}
      <div className="hidden print:block">
        {(printingPI || invoices.find(inv => inv.id === downloadPI)) && (
          <PrintLayout pi={printingPI || invoices.find(inv => inv.id === downloadPI)} />
        )}
      </div>
      {/* Hidden container for PDF capture - Uses HEX colors to avoid oklch errors */}
      <div 
        id="printable-pi" 
        style={{ 
          position: 'absolute', 
          top: '-10000px', 
          left: '-10000px',
          backgroundColor: '#ffffff',
          color: '#000000',
          width: '210mm'
        }}
      >
        {downloadPI && (
          <PrintLayout pi={invoices.find(inv => inv.id === downloadPI)} />
        )}
      </div>
    </div>
  );
}
// Sanitized Layout: All colors converted to HEX to prevent html2canvas oklch crash
export function PrintLayout({ pi, docType = "PI" }: { pi?: ProformaInvoice; docType?: PrintDocumentType }) {
  if (!pi) return null;
  const subtotal = pi.subtotal ?? (pi.items?.reduce((sum, i) => sum + i.price * i.quantity, 0) ?? 0);
  const discountPercent = pi.discount_percent ?? pi.discount ?? 0;
  const discountPercentDisplay = Number(discountPercent).toFixed(2);
  const discountAmount = pi.discount_amount ?? Math.floor(subtotal * discountPercent / 100);
  const extraDiscountAmount = pi.extra_discount_amount ?? 0;
  const writeOffAmount = pi.write_off_amount ?? 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount - extraDiscountAmount);
  const taxPercent = pi.tax_percent ?? 0;
  const taxAmount = pi.tax_amount ?? Math.ceil(taxableAmount * taxPercent / 100);
  const finalTotal = pi.final_total ?? (taxableAmount + taxAmount);
  const paidAmount = Number(pi.paidAmount || 0);
  const balanceDue = finalTotal - paidAmount - writeOffAmount;
  const docTitle = docType === "INVOICE" ? "Invoice" : "Proforma Invoice";
  const docPrefix = docType === "INVOICE" ? "INV" : "PI";
  const docNumber = pi.piNumber || `${docPrefix}-${String(pi.id).slice(0, 8).toUpperCase()}`;
  return (
    <div style={{ backgroundColor: '#ffffff', color: '#1a1a1a', padding: '48px', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", maxWidth: '210mm', margin: '0 auto' }}>
      {/* Top accent bar */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 50%, #1e3a5f 100%)', borderRadius: '2px', marginBottom: '32px' }} />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>TLC Lighting (The Light Code)</h1>
          <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', lineHeight: '1.6', maxWidth: '280px' }}>
            3rd Floor, Dwarika Heights, Eastern Bypass,<br />
            Don Bosco Colony, Siliguri, WB - 734008
          </p>
          <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Phone: 7872663828</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#64748b', margin: 0, fontWeight: '700' }}>{docTitle}</p>
          <p style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '2px 0 0 0', fontFamily: 'monospace' }}>#{docNumber}</p>
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '10px' }}>
            Issued: <strong style={{ color: '#334155' }}>{new Date(pi.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
          </p>
        </div>
      </div>
      {/* Bill To / Ship To (Concise) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
        <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#94a3b8', fontWeight: '700', margin: 0 }}>Bill To</p>
          <p style={{ fontWeight: '700', fontSize: '14px', margin: '6px 0 0 0', color: '#0f172a' }}>{pi.clientName || "Walk-in Customer"}</p>
          <p style={{ fontSize: '11px', color: '#475569', margin: '4px 0 0 0' }}>
            {pi.clientPhone || "-"}
          </p>
        </div>
        <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#94a3b8', fontWeight: '700', margin: 0 }}>Ship To</p>
          <p style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4', margin: '6px 0 0 0' }}>{pi.deliveryAddress || "Store Pickup"}</p>
        </div>
      </div>
      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ padding: '12px 10px', fontSize: '9px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff', backgroundColor: '#1e3a5f', fontWeight: '600' }}>#</th>
            <th style={{ padding: '12px 10px', fontSize: '9px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff', backgroundColor: '#1e3a5f', fontWeight: '600' }}>Photo</th>
            <th style={{ padding: '12px 10px', fontSize: '9px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff', backgroundColor: '#1e3a5f', fontWeight: '600' }}>Description</th>
            <th style={{ padding: '12px 10px', fontSize: '9px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff', backgroundColor: '#1e3a5f', fontWeight: '600' }}>Qty</th>
            <th style={{ padding: '12px 10px', fontSize: '9px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff', backgroundColor: '#1e3a5f', fontWeight: '600' }}>Price / Unit</th>
            <th style={{ padding: '12px 10px', fontSize: '9px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff', backgroundColor: '#1e3a5f', fontWeight: '600' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {pi.items?.map((item: any, idx: number) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '14px 10px', color: '#94a3b8', fontWeight: '500' }}>{String(idx + 1).padStart(2, '0')}</td>
              <td style={{ padding: '14px 10px' }}>
                <div style={{ width: '64px', height: '64px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                  {item.photo_url ? (
                    <img src={item.photo_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                  ) : null}
                </div>
              </td>
              <td style={{ padding: '14px 10px' }}>
                <p style={{ fontWeight: '600', fontSize: '13px', margin: 0, color: '#0f172a', textTransform: 'uppercase' }}>{item.name}</p>
                {item.category && <p style={{ fontSize: '10px', color: '#94a3b8', margin: '2px 0 0 0' }}>{item.category}</p>}
                {item.attribute_metadata &&
                  item.attribute_metadata.filter((attr: any) => String(attr?.label || "").trim().toLowerCase() !== "none").length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {item.attribute_metadata
                      .filter((attr: any) => String(attr?.label || "").trim().toLowerCase() !== "none")
                      .map((attr: any, i: number) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '9px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          lineHeight: '1',
                        }}
                      >
                        {attr.label}: {attr.qty}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td style={{ padding: '14px 10px', textAlign: 'center', fontWeight: '600' }}>{item.quantity}</td>
              <td style={{ padding: '14px 10px', textAlign: 'right', color: '#475569' }}>₹{item.price.toLocaleString('en-IN')} / unit</td>
              <td style={{ padding: '14px 10px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Summary Section */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
        <div style={{ width: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', color: '#475569' }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: '600' }}>₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          {discountAmount > 0 && discountPercent > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', color: '#dc2626' }}>
              <span>Discount ({discountPercentDisplay}%)</span>
              <span style={{ fontWeight: '600' }}>−₹{discountAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {extraDiscountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', color: '#dc2626' }}>
              <span>Extra Discount</span>
              <span style={{ fontWeight: '600' }}>−₹{extraDiscountAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {taxPercent > 0 && taxAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '13px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
              <span>GST ({taxPercent}%)</span>
              <span style={{ fontWeight: '600' }}>₹{taxAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700', color: '#0f172a' }}>Grand Total</span>
            <span style={{ fontSize: '22px', fontWeight: '800', color: '#1e3a5f' }}>₹{finalTotal.toLocaleString('en-IN')}</span>
          </div>
          {writeOffAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: '#dc2626' }}>
              <span>Write-Off</span>
              <span style={{ fontWeight: '600' }}>−₹{writeOffAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {paidAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', color: '#16a34a' }}>
              <span>Paid</span>
              <span style={{ fontWeight: '600' }}>₹{paidAmount.toLocaleString('en-IN')}</span>
            </div>
          )}
          {balanceDue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '13px', backgroundColor: '#fef2f2', borderRadius: '6px', color: '#b91c1c', fontWeight: '700' }}>
              <span>Balance Due</span>
              <span>₹{balanceDue.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>
      {/* Notes */}
      {pi.notes && (
        <div style={{ marginTop: '32px', padding: '16px', backgroundColor: '#fffbeb', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
          <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#92400e', fontWeight: '700', margin: '0 0 6px 0' }}>Notes</p>
          <p style={{ fontSize: '12px', color: '#78350f', margin: 0, lineHeight: '1.5' }}>{pi.notes}</p>
        </div>
      )}
      {/* Footer */}
      <div style={{ marginTop: '48px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>This is a computer-generated proforma invoice.</p>
          <p style={{ fontSize: '10px', color: '#94a3b8', margin: '2px 0 0 0' }}>Prices are subject to change. Valid for 15 days from date of issue.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '10px', color: '#94a3b8', margin: '0 0 24px 0' }}>Authorized Signatory</p>
          <div style={{ borderTop: '1px solid #cbd5e1', width: '160px', marginLeft: 'auto' }} />
          <p style={{ fontSize: '10px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '600' }}>TLC Lighting (The Light Code)</p>
        </div>
      </div>
      {/* Bottom accent bar */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 50%, #1e3a5f 100%)', borderRadius: '2px', marginTop: '24px' }} />
    </div>
  );
}
function PITable({ 
  invoices, 
  products= [], 
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
          const hasShortage = pi.items?.some(item => {
            const masterProduct = products.find((p: any) => 
              p.barcode?.toLowerCase().trim() === item.name?.toLowerCase().trim());
            if (!masterProduct) return false;
            const availableStock = (masterProduct.displayStock || 0) + (masterProduct.godownStock || 0);
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
                    {hasShortage && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] font-bold py-0 leading-tight">
                        Stock Shortage
                      </Badge>
                    )}
                  </div>
                </TableCell>
              <TableCell className="text-right font-medium">
                ₹{(pi.total ?? 0).toLocaleString()}
              </TableCell>
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
                        onSetDownloadPI(pi.id);
                      }}
                      title="Download PI"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetPrintingPI(pi);
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
                  <TableCell colSpan={7} className="bg-gray-50/50 p-0">
                    <OrderDetailsView
                      clientName={pi.clientName}
                      date={pi.createdAt}
                      items={pi.items || []}
                      financial={pi}
                      actions={
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
