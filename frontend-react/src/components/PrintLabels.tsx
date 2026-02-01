import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";

export const PrintLabels = React.forwardRef<HTMLDivElement, any>(
  ({ selectedProducts, quantities }, ref) => {
    const [isReady, setIsReady] = useState(false);

    // This ensures the QR codes only render once the component is physically in the DOM
    useEffect(() => {
      const timer = setTimeout(() => setIsReady(true), 150);
      return () => clearTimeout(timer);
    }, []);

    if (!isReady) return <div className="p-10 text-center text-xs text-gray-400">Loading Labels...</div>;

    return (
      <div ref={ref} className="bg-white">
        {selectedProducts.map((product: any) => {
          const qty = quantities[String(product.id)] || 1;
          return Array.from({ length: qty }).map((_, i) => (
            <div 
              key={`${product.id}-${i}`} 
              className="label-sticker flex flex-col items-center justify-center bg-white"
              style={{ width: '40mm', height: '30mm', pageBreakAfter: 'always' }}
            >
              <p className="text-[10px] font-bold uppercase">{product.vendor}</p>
              <div className="my-1">
                <QRCode value={product.barcode} size={65} level="H" />
              </div>
              <p className="text-[9px] font-mono">{product.barcode}</p>
              <p className="text-[11px] font-black">₹{product.price}</p>
            </div>
          ));
        })}
      </div>
    );
  }
);