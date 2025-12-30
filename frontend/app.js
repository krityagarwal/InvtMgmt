/**
 * INVENTORY OS - CORE APPLICATION LOGIC
 * Includes: Scanner, Shop Search, Inventory Filtering, and Label Printing
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Use a relative path without a leading slash to be safe
        navigator.serviceWorker.register('sw.js') 
            .then(reg => console.log('SW Registered!', reg))
            .catch(err => console.error('SW Registration Failed!', err));
    });
}

// Global State Management
let CURRENT_SHOP_ID = null;
let html5QrCode = null;
let ALL_ITEMS = []; // Holds current shop items for high-speed live filtering

/**
 * SECTION 1: QR SCANNER LOGIC
 */

window.toggleScanner = function() {
    const readerDiv = document.getElementById('reader');
    if (!readerDiv) return;

    // If scanner is running, stop it
    if (readerDiv.style.display === 'block') {
        window.stopScanner();
        return;
    }

    // Show scanner container
    readerDiv.style.display = 'block';
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0 
    };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        window.onScanSuccess
    ).catch(err => {
        console.error("Scanner failed to start:", err);
        alert("Camera Error: " + err);
        readerDiv.style.display = 'none';
    });
};

window.stopScanner = function() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').style.display = 'none';
        }).catch(err => console.error("Failed to stop scanner", err));
    } else {
        document.getElementById('reader').style.display = 'none';
    }
};

window.onScanSuccess = async function(decodedText) {
    console.log("Scanned Text:", decodedText);
    window.stopScanner();
    
    // Use Query Parameter to safely handle slashes in item codes
    const url = `http://127.0.0.1:8000/product/by-code?item_code=${encodeURIComponent(decodedText)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);

        const item = await response.json();
        
        // Handle case where backend might return an array or an object
        const product = Array.isArray(item) ? item[0] : item;

        if (product && product.id && !product.error) {
            const resDiv = document.getElementById('results');
            resDiv.innerHTML = `
                <div class="search-card" style="border: 2px solid var(--success); text-align:center; flex-direction:column; align-items:center;">
                    <div style="width:100%; display:flex; justify-content:flex-start;">
                        <button class="btn-secondary" onclick="location.reload()">← Clear Search</button>
                    </div>
                    <h2 style="margin:20px 0 5px 0;">${product.item_code}</h2>
                    <div style="color:var(--text-muted); margin-bottom:15px;">${product.category_name || 'General Category'}</div>
                    <div style="font-size:32px; font-weight:800; color:var(--text-main); margin-bottom:20px;">₹${product.selling_price}</div>
                    <button class="btn-primary" onclick="handleAddToBasket('${product.id}', '${product.item_code}')" style="width:100%; justify-content:center; padding:15px;">Add to Basket</button>
                </div>`;
        } else {
            alert("Product not found in database: " + decodedText);
        }
    } catch (e) {
        console.error("Lookup error:", e);
        alert("Server Logic Error: " + e.message);
    }
};

/**
 * SECTION 2: SHOP & INVENTORY LOGIC
 */

window.searchShop = async function() {
    const query = document.getElementById('shopSearch').value;
    const resultsDiv = document.getElementById('results');
    if (!query) return;

    resultsDiv.innerHTML = "<p style='text-align:center;'>Searching enterprise database...</p>";
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/search?name=${encodeURIComponent(query)}`);
        const data = await response.json();

        let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">';
        data.forEach(shop => {
            html += `
                <div class="search-card" onclick="viewInventory('${shop.id}')" style="cursor:pointer; flex-direction:column; align-items:flex-start; margin:0;">
                    <div style="font-weight:700; font-size:18px;">${shop.name}</div>
                    <div style="color:var(--text-muted); font-size:12px;">Store ID: ${shop.id}</div>
                    <div style="margin-top:15px; color:var(--primary); font-size:14px; font-weight:600;">Open Inventory →</div>
                </div>`;     
        });
        resultsDiv.innerHTML = html + '</div>';
    } catch (error) {
        resultsDiv.innerHTML = "<p>Error: Could not reach the API server.</p>";
    }
};

window.viewInventory = async function(shopId) {
    CURRENT_SHOP_ID = shopId;
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = "<p style='text-align:center;'>Loading inventory records...</p>";
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/inventory/${shopId}`);
        ALL_ITEMS = await response.json(); 
        renderInventoryTable(ALL_ITEMS);
    } catch (e) { 
        resultsDiv.innerHTML = "<p>Error: Failed to load shop inventory.</p>";
    }
};

function renderInventoryTable(items) {
    const resultsDiv = document.getElementById('results');
    
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap: wrap; gap: 15px;">
            <button class="btn-secondary" onclick="location.reload()">← Back</button>
            <div style="flex: 1; min-width: 300px; position: relative; display: flex; align-items: center;">
                <span style="position: absolute; left: 12px; color: var(--text-muted);">🔍</span>
                <input type="text" id="tableFilter" 
                       placeholder="Filter by Code, Category, or Vendor..." 
                       onkeyup="filterInventory()"
                       style="width: 100%; padding: 10px 10px 10px 35px; border-radius: 8px; border: 1px solid var(--border); font-size: 14px;">
            </div>
            <button class="btn-primary" onclick="showBasketPreview()" style="background:var(--success)">🛒 Live Basket</button>
        </div>

        <table class="data-table" style="table-layout: fixed; width: 100%;">
            <thead>
                <tr>
                    <th style="width: 40px;"><input type="checkbox" id="selectAll" onclick="toggleAll(this)"></th>
                    <th style="width: 25%;">Item Details</th>
                    <th style="width: 20%;">Vendor</th>
                    <th style="width: 25%;">Inventory Status</th>
                    <th style="width: 15%;">Price</th>
                    <th style="width: 10%; text-align:right;">Action</th>
                </tr>
            </thead>
            <tbody id="inventoryBody">`;

    html += generateRowsHtml(items);
    resultsDiv.innerHTML = html + "</tbody></table>";
}

// New helper function to ensure both initial load and filter use EXACTLY the same row HTML
function generateRowsHtml(items) {
    return items.map(item => {
        const itemData = JSON.stringify({item_code: item.item_code});
        return `
            <tr>
                <td style="width: 40px;"><input type="checkbox" class="print-selector" value='${itemData}' onclick="updateSelectedCount()"></td>
                <td style="width: 25%;">
                    <div style="font-weight:600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.item_code}</div>
                    <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">${item.category_name || 'General'}</div>
                </td>
                <td style="width: 20%; font-size: 13px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${item.vendor_name || '-'}
                </td>
                <td style="width: 25%;">
                    <span class="badge">D: ${item.qty_display}</span>
                    <span class="badge" style="background:#f1f5f9; color:#475569;">G: ${item.qty_godown}</span>
                </td>
                <td style="width: 15%; font-weight:bold;">₹${item.selling_price.toLocaleString()}</td>
                <td style="width: 10%; text-align:right;">
                    <button class="btn-secondary" onclick="handleAddToBasket('${item.id}', '${item.item_code}')" style="padding: 6px 12px; font-size: 12px;">+ Add</button>
                </td>
            </tr>`;
    }).join('');
}

window.filterInventory = function() {
    const term = document.getElementById('tableFilter').value.toLowerCase();
    const filtered = ALL_ITEMS.filter(item => {
        const searchableText = `${item.item_code} ${item.category_name} ${item.vendor_name}`.toLowerCase();
        return searchableText.includes(term);
    });

    const tbody = document.getElementById('inventoryBody');
    tbody.innerHTML = generateRowsHtml(filtered); // Uses the same helper for consistency
};

/**
 * SECTION 3: FILTER & UI INTERACTION
 */

// window.filterInventory = function() {
//     const term = document.getElementById('tableFilter').value.toLowerCase();
    
//     const filtered = ALL_ITEMS.filter(item => {
//         const searchableText = `${item.item_code} ${item.category_name} ${item.vendor_name}`.toLowerCase();
//         return searchableText.includes(term);
//     });

//     const tbody = document.getElementById('inventoryBody');
//     tbody.innerHTML = filtered.map(item => {
//         const itemData = JSON.stringify({item_code: item.item_code});
//         return `
//             <tr>
//                 <td><input type="checkbox" class="print-selector" value='${itemData}' onclick="updateSelectedCount()"></td>
//                 <td>
//                     <div style="font-weight:600;">${item.item_code}</div>
//                     <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">${item.category_name || ''}</div>
//                 </td>
//                 <td style="font-size: 13px; color: var(--text-muted);">${item.vendor_name || '-'}</td>
//                 <td><span class="badge">D: ${item.qty_display}</span></td>
//                 <td style="font-weight:bold;">₹${item.selling_price}</td>
//                 <td style="text-align:right;">
//                     <button class="btn-secondary" onclick="handleAddToBasket('${item.id}', '${item.item_code}')" style="padding: 6px 12px; font-size: 12px;">+ Add</button>
//                 </td>
//             </tr>`;
//     }).join('');
// };

window.toggleAll = function(master) {
    document.querySelectorAll('.print-selector').forEach(cb => cb.checked = master.checked);
    window.updateSelectedCount();
};

window.updateSelectedCount = function() {
    const selected = document.querySelectorAll('.print-selector:checked').length;
    const bar = document.getElementById('bulk-actions');
    if (bar) {
        bar.style.display = selected > 0 ? 'flex' : 'none';
        document.getElementById('selected-count').innerText = `${selected} items selected for printing`;
    }
};

/**
 * SECTION 4: BULK PRINTING
 */

window.generateLabels = function() {
    const selectedItems = Array.from(document.querySelectorAll('.print-selector:checked'))
                               .map(cb => JSON.parse(cb.value));
    
    const printWindow = window.open('', '_blank');
    
    let labelHtml = `
        <html>
        <head>
            <style>
                @media print { @page { margin: 0.5cm; } }
                body { 
                    font-family: 'Courier New', monospace; 
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 10px; 
                    padding: 20px;
                }
                .label-card { 
                    border: 1px solid #eee; 
                    padding: 10px; 
                    text-align: center; 
                    page-break-inside: avoid;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .code { font-size: 12px; font-weight: bold; margin-bottom: 5px; }
                img { width: 110px; height: 110px; }
            </style>
        </head>
        <body>`;

    selectedItems.forEach(item => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.item_code)}`;
        labelHtml += `
            <div class="label-card">
                <div class="code">${item.item_code}</div>
                <img src="${qrUrl}">
            </div>`;
    });

    labelHtml += `</body></html>`;
    printWindow.document.write(labelHtml);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
    };
};

// File Upload Handler
window.handleFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const tempScanner = new Html5Qrcode("reader");
    tempScanner.scanFile(file, true)
        .then(window.onScanSuccess)
        .catch(err => alert("Could not find a valid QR code in this image."));
};

window.handleAddToBasket = async function(productId, code) {
    if (!CURRENT_SHOP_ID) {
        alert("Please select a shop first!");
        return;
    }
    try {
        const response = await fetch('http://127.0.0.1:8000/basket/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shop_id: CURRENT_SHOP_ID,
                product_id: productId,
                qty: 1
            })
        });
        const result = await response.json();
        if (result.status === "success") {
            alert(`Item ${code} added to basket!`);
        }
    } catch (e) {
        console.error("Basket Error:", e);
    }
};