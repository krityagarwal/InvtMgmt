// import React, { useState, useEffect } from 'react';
// import QRCode from "react-qr-code";

// export const PrintLabels = React.forwardRef<HTMLDivElement, any>(
//   ({ selectedProducts, quantities }, ref) => {
//     const [isReady, setIsReady] = useState(false);

//     // This ensures the QR codes only render once the component is physically in the DOM
//     useEffect(() => {
//       const timer = setTimeout(() => setIsReady(true), 150);
//       return () => clearTimeout(timer);
//     }, []);

//     if (!isReady) return <div className="p-10 text-center text-xs text-gray-400">Loading Labels...</div>;

//     return (
//       <div ref={ref} className="bg-white">
//         {selectedProducts.map((product: any) => {
//           const qty = quantities[String(product.id)] || 1;
//           return Array.from({ length: qty }).map((_, i) => (
//             <div 
//               key={`${product.id}-${i}`} 
//               className="label-sticker flex flex-col items-center justify-center bg-white"
//               style={{ width: '40mm', height: '30mm', pageBreakAfter: 'always' }}
//             >
//               <p className="text-[10px] font-bold uppercase">{product.vendor}</p>
//               <div className="my-1">
//                 <QRCode value={product.barcode} size={65} level="H" />
//               </div>
//               <p className="text-[9px] font-mono">{product.barcode}</p>
//               <p className="text-[11px] font-black">₹{product.price}</p>
//             </div>
//           ));
//         })}
//       </div>
//     );
//   }
// );

// import React, { useState, useEffect } from 'react';
// import QRCode from "react-qr-code";

// export const PrintLabels = ({ selectedProducts, quantities }) => {
//   return (
//     <div className="a4-grid-container bg-white">
//       {selectedProducts.map((product) => {
//         const qty = quantities[String(product.id)] || 1;
//         return Array.from({ length: qty }).map((_, i) => (
//           <LabelItem key={`${product.id}-${i}`} product={product} />
//         ));
//       })}
//     </div>
//   );
// };

// const LabelItem = ({ product }) => {
//   const [imgSrc, setImgSrc] = useState("");

//   useEffect(() => {
//     // Generate the image once the component mounts
//     const svg = document.getElementById(`qr-source-${product.id}`);
//     if (svg && !imgSrc) {
//       const canvas = document.createElement("canvas");
//       const svgData = new XMLSerializer().serializeToString(svg);
//       const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
//       const url = URL.createObjectURL(svgBlob);
//       const img = new Image();

//       img.onload = () => {
//         // Use 4x scale for sharp printing (High DPI)
//         canvas.width = img.width * 4; 
//         canvas.height = img.height * 4;
//         const ctx = canvas.getContext("2d");
//         if (ctx) {
//           ctx.fillStyle = "white";
//           ctx.fillRect(0, 0, canvas.width, canvas.height);
//           ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
//           setImgSrc(canvas.toDataURL("image/png"));
//         }
//         URL.revokeObjectURL(url);
//       };
//       img.src = url;
//     }
//   }, [product, imgSrc]);

//   return (
//     <div className="a4-label-item">
//       <p className="vendor-name">{product.vendor || "-"}</p>
      
//       {/* Invisible source for the conversion */}
//       <div style={{ position: 'absolute', visibility: 'hidden', height: 0 }}>
//         <QRCode id={`qr-source-${product.id}`} value={product.barcode} size={100} />
//       </div>

//       {/* The <img> tag is the key to mobile/desktop print success */}
//       <div className="qr-image-container">
//         {imgSrc ? (
//           <img src={imgSrc} alt="QR Code" className="qr-img" />
//         ) : (
//           <div className="qr-placeholder" />
//         )}
//       </div>

//       <p className="barcode-text">{product.barcode}</p>
//       <p className="price-text">₹{product.price}</p>
//     </div>
//   );
// };

import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";

interface LabelItemProps {
  product: any;
}

const LabelItem = ({ product }: LabelItemProps) => {
  const [imgSrc, setImgSrc] = useState<string>("");

  useEffect(() => {
    // 1. Ensure the component is mounted and SVG exists
    const svgId = `qr-source-${product.id}`;
    const svg = document.getElementById(svgId);
    
    if (svg && !imgSrc) {
      try {
        const canvas = document.createElement("canvas");
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
          // Use 4x scale for High DPI print quality
          canvas.width = img.width * 4; 
          canvas.height = img.height * 4;
          const ctx = canvas.getContext("2d");
          
          if (ctx) {
            // White background is critical for thermal scanners
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setImgSrc(canvas.toDataURL("image/png"));
          }
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } catch (err) {
        console.error("QR Conversion Error for product:", product.barcode, err);
      }
    }
  }, [product.id, imgSrc]);

  return (
    <div className="a4-label-item">
      <p className="vendor-name">{product.vendor || "No Vendor"}</p>
      
      {/* 2. Hidden source SVG with unique ID */}
      <div style={{ position: 'absolute', visibility: 'hidden', height: 0, overflow: 'hidden' }}>
        <QRCode 
          id={`qr-source-${product.id}`} 
          value={product.barcode || "0000"} 
          size={100} 
        />
      </div>

      {/* 3. The stable Image tag for the printer */}
      <div className="qr-image-container">
        {imgSrc ? (
          <img src={imgSrc} alt="QR Code" className="qr-img" />
        ) : (
          <div className="qr-placeholder" />
        )}
      </div>

      <p className="barcode-text">{product.barcode}</p>
      <p className="price-text">₹{product.price}</p>
    </div>
  );
};

export const PrintLabels = ({ selectedProducts, quantities }: any) => {
  if (!selectedProducts || selectedProducts.length === 0) return null;

  return (
    <div className="a4-grid-container bg-white">
      {selectedProducts.map((product: any) => {
        const qty = quantities[String(product.id)] || 1;
        // Generate multiple labels based on requested quantity
        return Array.from({ length: qty }).map((_, i) => (
          <LabelItem key={`${product.id}-${i}`} product={product} />
        ));
      })}
    </div>
  );
};