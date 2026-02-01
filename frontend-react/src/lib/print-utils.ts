import { renderToStaticMarkup } from "react-dom/server";

export const printComponent = (component: React.ReactElement) => {
  const html = renderToStaticMarkup(component);
  const iframe = document.createElement("iframe");
  
  // Hide iframe completely
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  // Pull existing project styles (Tailwind/index.css) into the iframe
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(style => style.outerHTML)
    .join('');

  doc.write(`
    <html>
      <head>
        ${styles}
        <style>
          @page { margin: 0; size: 40mm 30mm; }
          body { margin: 0; padding: 0; background: white; }
          /* Ensure QR Codes (SVGs) are visible */
          svg { display: block; margin: 0 auto; width: 65px; height: 65px; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  // Small timeout to ensure the browser processes the injected SVGs
  setTimeout(() => {
    iframe.contentWindow?.print();
    document.body.removeChild(iframe);
  }, 250);
};