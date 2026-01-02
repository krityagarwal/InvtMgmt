/**
 * INVENTORY OS - CORE APPLICATION LOGIC
 * Includes: Scanner, Shop Search, Inventory Filtering, and Label Printing
 */
// CHANGE BEFORE DE
const API_BASE_URL = "https://invtmgmt.onrender.com";
// const API_BASE_URL = "http://127.0.0.1:8000";
/**
 * INVENTORY OS - CORE APPLICATION LOGIC
 * Features: QR Scanner, Shop Search, Live Inventory Filtering, and Bulk Label Printing
 */


// Force unregister Service Workers to ensure mobile reflects latest changes
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister();
        }
    });
}

// 2. GLOBAL STATE
let CURRENT_SHOP_ID = null;
let CURRENT_SHOP_NAME = "";
let html5QrCode = null;
let ALL_ITEMS = []; // High-speed local cache for filtering
window.CURRENT_SHOP_NAME = "";

/**
 * SECTION 1: QR SCANNER LOGIC
 */
function renderInventoryTable(items) {
    const resultsDiv = document.getElementById('results');
    const displayName = window.CURRENT_SHOP_NAME || "Inventory List";

    let html = `
        <div id="inventory-view-wrapper">
            <h1 style="margin: 0 0 20px 0; color: var(--text-main); font-size: 28px; font-weight: 800;">
                ${displayName}
            </h1>

            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="width: 45px;">
                            <input type="checkbox" id="selectAll" onclick="toggleAll(this)">
                        </th>
                        <th>Item Details</th>
                        <th>Vendor</th>
                        <th>Stock (D/G)</th>
                        <th>Price</th>
                        <th style="text-align:right;">Action</th>
                    </tr>
                </thead>
                <tbody id="inventoryBody">
                    ${generateRowsHtml(items)}
                </tbody>
            </table>
        </div>`;

    resultsDiv.innerHTML = html;
}

window.stopScanner = function() {
    const readerDiv = document.getElementById('reader');
    const scanBtn = document.querySelector('button[onclick="toggleScanner()"]');

    const resetUI = () => {
        if (readerDiv) readerDiv.style.display = 'none';
        if (scanBtn) {
            scanBtn.innerHTML = "📷 Scan";
            scanBtn.style.background = "transparent";
            scanBtn.style.color = "var(--primary)";
            scanBtn.style.borderColor = "var(--primary)";
        }
    };

    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(resetUI).catch(resetUI);
    } else {
        resetUI();
    }
};

window.onScanSuccess = async function(decodedText) {
    window.stopScanner();
    const url = `${API_BASE_URL}/product/by-code?item_code=${encodeURIComponent(decodedText)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const product = await response.json();

        if (product && product.id && !product.error) {
            document.getElementById('results').innerHTML = `
                <div class="search-card" style="border: 2px solid var(--success); text-align:center; flex-direction:column; align-items:center;">
                    <div style="width:100%; display:flex; justify-content:flex-start;">
                        <button class="btn-secondary" onclick="viewInventory('${CURRENT_SHOP_ID}')">← Back to List</button>
                    </div>
                    <h2 style="margin:20px 0;">${product.item_code}</h2>
                    <div style="font-size:32px; font-weight:800; color:var(--text-main); margin-bottom:20px;">₹${product.selling_price}</div>
                    <button class="btn-primary" onclick="handleAddToBasket('${product.id}', '${product.item_code}')" style="width:100%;">Add to Basket</button>
                </div>`;
        } else {
            alert("Product not found: " + decodedText);
            if (CURRENT_SHOP_ID) viewInventory(CURRENT_SHOP_ID);
        }
    } catch (e) {
        console.error("Lookup error:", e);
    }
};

/**
 * SECTION 2: SHOP & INVENTORY LOGIC
 */
window.searchShop = async function() {
    const query = document.getElementById('shopSearch').value;
    const resultsDiv = document.getElementById('results');
    if (!query) return;

    resultsDiv.innerHTML = "<p style='text-align:center;'>Searching database...</p>";
    
    try {
        const response = await fetch(`${API_BASE_URL}/search?name=${encodeURIComponent(query)}`);
        const data = await response.json();
        const shops = data.results; // Access the array inside the dictionary

        let html = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">';
        // Inside the shops.forEach loop in searchShop
          shops.forEach(shop => {
              // We wrap shop.name in double quotes to handle names with single quotes
              const nameForAttr = shop.name.replace(/'/g, "\\'"); 
              html += `
                  <div class="search-card" 
                      onclick="window.CURRENT_SHOP_NAME='${nameForAttr}'; viewInventory('${shop.id}')" 
                      style="cursor:pointer; flex-direction:column; align-items:flex-start;">
                      <div style="font-weight:700; font-size:18px;">${shop.name}</div>
                      <div style="color:var(--text-muted); font-size:12px;">ID: ${shop.id}</div>
                  </div>`;     
          });        
        resultsDiv.innerHTML = html + '</div>';
    } catch (error) {
        resultsDiv.innerHTML = "<p>Error: Could not reach API server.</p>";
    }
};

window.viewInventory = async function(shopId) {
    CURRENT_SHOP_ID = shopId;
    hidePrintBar(); 
    
    // 1. Reveal the navigation buttons group
    const headerActions = document.getElementById('header-actions');
    if (headerActions) {
        headerActions.style.display = 'flex';
    }

    // 2. Hide the shop search card
    document.getElementById('search-section').style.display = 'none';

    const resultsDiv = document.getElementById('results');
    // Add the 'inventory-page-marker' so syncUIState knows we are here
    resultsDiv.innerHTML = `
        <div id="inventory-page-marker"></div>
        <p style='text-align:center;'>Initializing Inventory...</p>
    `;
    
    try {
        const response = await fetch(`${API_BASE_URL}/inventory/${shopId}`);
        ALL_ITEMS = await response.json(); 
        renderInventoryTable(ALL_ITEMS);
        
        // 3. Trigger sync after rendering to highlight the "Inventory" tab
        syncUIState(); 
    } catch (e) { 
        resultsDiv.innerHTML = "<p>Error loading inventory.</p>";
    }
};

function renderInventoryTable(items) {
    const resultsDiv = document.getElementById('results');
    
    // Check if name exists, otherwise use a fallback
    const displayName = window.CURRENT_SHOP_NAME || "Inventory List";

    let html = `
        <div id="inventory-view-wrapper">
            <h1 id="active-shop-title" style="margin: 0 0 20px 0; color: var(--text-main); font-size: 28px; font-weight: 800;">
                ${displayName}
            </h1>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <input type="text" id="tableFilter" 
                           placeholder="Search by Code, Vendor, or Category..." 
                           onkeyup="filterInventory()"
                           style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 14px;">
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-secondary" onclick="toggleScanner()" style="border: 1px solid var(--primary); color: var(--primary);">📷 Scan</button>
                    <button class="btn-primary" onclick="showBasketPreview()" style="background:var(--success)">🛒 Basket</button>
                </div>
            </div>
            
            <div id="reader" style="margin-bottom: 20px; border-radius: 12px; overflow: hidden; display: none; border: 3px solid var(--primary); background: #000;"></div>

            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="width: 45px;"><input type="checkbox" id="selectAll" onclick="toggleAll(this)"></th>
                        <th>Item Details</th>
                        <th>Vendor</th>
                        <th>Stock (D/G)</th>
                        <th>Price</th>
                        <th style="text-align:right;">Action</th>
                    </tr>
                </thead>
                <tbody id="inventoryBody">
                    ${generateRowsHtml(items)}
                </tbody>
            </table>
        </div>`;

    resultsDiv.innerHTML = html;
}

function generateRowsHtml(items) {
    return items.map(item => {
        // This is the data used for the QR code
        const itemData = JSON.stringify({item_code: item.item_code});
        return `
            <tr>
                <td style="width: 45px;">
                    <input type="checkbox" class="print-selector" value='${itemData}' onclick="updateSelectedCount()">
                </td>
                <td>
                    <div style="font-weight:600;">${item.item_code}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${item.category_name || 'General'}</div>
                </td>
                <td>${item.vendor_name || '-'}</td>
                <td>
                    <span class="badge">D: ${item.qty_display}</span>
                    <span class="badge" style="background:#f1f5f9;">G: ${item.qty_godown}</span>
                </td>
                <td style="font-weight:bold;">₹${item.selling_price.toLocaleString()}</td>
                <td style="text-align:right;">
                    <button class="btn-secondary" onclick="handleAddToBasket('${item.id}', '${item.item_code}')" style="padding: 6px 12px; font-size: 12px;">+ Add</button>
                </td>
            </tr>`;
    }).join('');
}

window.filterInventory = function() {
    hidePrintBar(); // Auto-hide prompt on filter
    const term = document.getElementById('tableFilter').value.toLowerCase();
    const filtered = ALL_ITEMS.filter(item => 
        `${item.item_code} ${item.category_name} ${item.vendor_name}`.toLowerCase().includes(term)
    );
    document.getElementById('inventoryBody').innerHTML = generateRowsHtml(filtered);
};

/**
 * SECTION 3: UTILITIES & ACTIONS
 */
// function hidePrintBar() {
//     const bar = document.getElementById('bulk-actions');
//     if (bar) bar.style.display = 'none';
//     document.querySelectorAll('.print-selector').forEach(cb => cb.checked = false);
// }
// This function clears selection when switching views
function hidePrintBar() {
    const bar = document.getElementById('bulk-actions');
    if (bar) bar.style.display = 'none';
    const master = document.getElementById('selectAll');
    if (master) master.checked = false;
}

window.toggleAll = function(master) {
    document.querySelectorAll('.print-selector').forEach(cb => cb.checked = master.checked);
    window.updateSelectedCount();
};

window.updateSelectedCount = function() {
    const selected = document.querySelectorAll('.print-selector:checked').length;
    const bar = document.getElementById('bulk-actions');
    if (bar) {
        bar.style.display = selected > 0 ? 'flex' : 'none';
        document.getElementById('selected-count').innerText = `${selected} items selected`;
    }
};

window.handleAddToBasket = async function(productId, itemCode) {
    // If no active session, show the client entry modal
    if (!ACTIVE_BASKET_ID) {
        console.log("No active session. Opening client modal...");
        openClientModal(); // This must match the ID in your index.html
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/basket/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: ACTIVE_BASKET_ID,
                product_id: productId,
                qty: 1
            })
        });

        if (response.ok) {
            showToast(`Added ${itemCode}`);
            updateMiniBasket(); 
            updateFloatingBarCount(); 
        }
    } catch (e) {
        console.error("Add failed", e);
    }
};

window.updateMiniBasket = async function() {
    if (!ACTIVE_BASKET_ID) return;

    const sidebar = document.getElementById('live-basket-sidebar');
    const container = document.getElementById('mini-basket-items');
    
    try {
        const response = await fetch(`${API_BASE_URL}/basket/details/${ACTIVE_BASKET_ID}`);
        const data = await response.json();
        const items = data.order_items || [];

        // 1. Force sidebar visibility if we have items and screen is wide enough
        if (items.length > 0 && window.innerWidth > 1100) {
            sidebar.style.display = 'block';
        }

        // 2. Render items
        container.innerHTML = items.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:10px 0; border-bottom:1px solid #f1f5f9;">
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:700; color:var(--text-main);">${item.item_code}</span>
                    <span style="font-size:11px; color:var(--text-muted);">Qty: ${item.quantity}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:600;">₹${(item.quantity * item.unit_price).toLocaleString()}</span>
                    <button onclick="removeItemFromOrder('${item.product_id}')" 
                            style="background:none; border:none; color:#ef4444; padding:0; cursor:pointer; font-size:14px;">
                        ✕
                    </button>
                </div>
            </div>
        `).join('');

        // 3. Update Total
        const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        document.getElementById('mini-total').innerText = `₹${total.toLocaleString()}`;
        
    } catch (e) {
        console.error("Sidebar update failed", e);
    }
};

window.generateLabels = function() {
    const selectedItems = Array.from(document.querySelectorAll('.print-selector:checked'))
                               .map(cb => JSON.parse(cb.value));
    
    const printWindow = window.open('', '_blank');
    let labelHtml = `<html><body style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; font-family:monospace;">`;

    selectedItems.forEach(item => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(item.item_code)}`;
        labelHtml += `<div style="text-align:center; border:1px solid #eee; padding:10px;">
                        <div>${item.item_code}</div>
                        <img src="${qrUrl}" width="100">
                      </div>`;
    });

    labelHtml += `</body></html>`;
    printWindow.document.write(labelHtml);
    printWindow.document.close();
    printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
        hidePrintBar(); // Hide after printing
    };
};

window.toggleScanner = function() {
    const readerDiv = document.getElementById('reader');
    const scanBtn = document.querySelector('button[onclick="toggleScanner()"]');
    
    if (readerDiv.style.display === 'block') {
        window.stopScanner();
        return;
    }

    // Visual Loading State
    if (scanBtn) {
        scanBtn.innerHTML = "⏳ Starting...";
        scanBtn.style.opacity = "0.7";
        scanBtn.disabled = true;
    }

    hidePrintBar(); 
    readerDiv.style.display = 'block';
    
    html5QrCode = new Html5Qrcode("reader");

    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, window.onScanSuccess)
        .then(() => {
            // Success: Change to Close button
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerHTML = "❌ Close";
                scanBtn.style.color = "#b91c1c";
                scanBtn.style.borderColor = "#b91c1c";
            }
        })
        .catch(err => {
            console.error(err);
            window.stopScanner();
        });
};

async function openBasketManager() {
    if (!CURRENT_SHOP_ID) return alert("Select a shop first");

    // Fetch existing 'bucket' orders for this shop
    const response = await fetch(`${API_BASE_URL}/baskets/active/${CURRENT_SHOP_ID}`);
    const activeBaskets = await response.json();

    let html = `
        <div class="search-card" style="flex-direction:column; gap:20px; border: 1px solid var(--primary);">
            <h3>🛒 Basket Management</h3>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <button class="btn-primary" onclick="createNewBasketPrompt()">➕ New Basket</button>
                <button class="btn-secondary" onclick="showActiveBasketsList()">📂 Load Existing (${activeBaskets.length})</button>
            </div>
        </div>
    `;
    document.getElementById('results').insertAdjacentHTML('afterbegin', html);
}

window.handleAddToBasket = async function(productId, itemCode) {
    if (!ACTIVE_BASKET_ID) return openClientModal();

    try {
        const response = await fetch(`${API_BASE_URL}/basket/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                order_id: ACTIVE_BASKET_ID,
                product_id: productId,
                qty: 1
            })
        });

        if (response.ok) {
            showToast(`Added ${itemCode}`);
            // This is the trigger for the sidebar
            updateMiniBasket(); 
            updateFloatingBarCount(); 
        }
    } catch (e) {
        console.error("Add failed", e);
    }
};

// Simple UI helper to update the number on the floating bar
function updateBasketCountUI() {
    const bar = document.getElementById('floating-basket-bar');
    const countSpan = document.getElementById('basket-count');
    bar.style.display = 'flex';
    
    // We increment a local counter or you can fetch total items from API
    let currentCount = parseInt(countSpan.innerText) || 0;
    countSpan.innerText = `${currentCount + 1} Items`;
}

// New Global State for Basket Session
let ACTIVE_BASKET_ID = null;
let ACTIVE_CLIENT_NAME = "";

// --- BASKET SESSION MANAGEMENT ---

window.showBasketPreview = function() {
    if (!ACTIVE_BASKET_ID) {
        // If no basket is active, trigger the "New Basket" modal
        document.getElementById('clientModal').style.display = 'block';
    } else {
        // If a basket is active, fetch its items and show the summary
        loadBasketDetails(ACTIVE_BASKET_ID);
    }
};

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
};

window.confirmCreateBasket = async function() {
    const clientName = document.getElementById('newClientName').value.trim();
    if (!clientName) return alert("Please enter a client name.");

    try {
        const response = await fetch(`${API_BASE_URL}/basket/create`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' // CRITICAL: Tells FastAPI to use the Pydantic model
            },
            body: JSON.stringify({
                shop_id: CURRENT_SHOP_ID, // Matches req.shop_id
                client_name: clientName   // Matches req.client_name
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Server Error:", errorData);
            return;
        }

        const data = await response.json();
        if (data.order_id) {
            ACTIVE_BASKET_ID = data.order_id;
            ACTIVE_CLIENT_NAME = clientName;
            closeModal('clientModal');
            syncUIState();
            showToast(`Session started for ${clientName}`);
        }
    } catch (e) {
        console.error("Network Error:", e);
    }
};

async function loadBasketDetails(orderId) {
    try {
        const response = await fetch(`${API_BASE_URL}/basket/details/${orderId}`);
        const data = await response.json();
        
        // Pass ONLY the data. viewOnlyId will default to null (correct for active editing)
        renderBasketModal(data); 
    } catch (e) {
        console.error("Error loading basket:", e);
    }
}

// Helper for UI feedback
function showToast(msg) {
    const toast = document.createElement('div');
    toast.style = "position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:#333; color:white; padding:10px 20px; border-radius:8px; z-index:5000; font-size:14px;";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

window.renderBasketModal = function(data, viewOnlyId = null) {
    const resultsDiv = document.getElementById('results');
    
    // Safety check for empty data
    if (!data) {
        resultsDiv.innerHTML = "<p style='text-align:center;'>No data found.</p>";
        return;
    }

    const items = data.order_items || [];
    const isSold = data.status === 'sold';
    const targetId = viewOnlyId || ACTIVE_BASKET_ID;
    const clientName = data.client_name || ACTIVE_CLIENT_NAME || "Client";

    // 1. TOP SECTION & TABLE
    let html = `
        <div class="search-card" style="flex-direction:column; background:#fff; padding: 0; border: 1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 20px; border-bottom: 1px solid var(--border);">
                <h2 style="margin:0;">🛒 ${isSold ? 'Order Summary' : 'Basket'}: ${clientName}</h2>
                <button class="btn-secondary" onclick="closeBasket()">Close</button>
            </div>
            
            <div style="padding: 20px;">
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--bg); color: var(--text-muted); font-size: 12px;">
                            <th style="padding:10px;">ITEM DETAILS</th>
                            <th style="text-align:center;">QTY</th>
                            <th style="text-align:right;">PRICE</th>
                            ${!isSold ? '<th style="text-align:right;">REMOVE</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${items.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:20px;">No items found.</td></tr>' : 
                          items.map(item => `
                            <tr style="border-bottom: 1px solid var(--bg);">
                                <td style="padding:15px 10px;"><b>${item.item_code}</b></td>
                                <td style="text-align:center;">
                                    ${isSold ? item.quantity : `
                                        <div style="display:inline-flex; align-items:center; gap:12px; background:var(--bg); padding:5px 12px; border-radius:20px;">
                                            <button onclick="updateItemQty('${item.product_id}', -1)" style="background:none; border:none; color:var(--primary); cursor:pointer; font-weight:bold;">-</button>
                                            <span style="font-weight:800; min-width:15px;">${item.quantity}</span>
                                            <button onclick="updateItemQty('${item.product_id}', 1)" style="background:none; border:none; color:var(--primary); cursor:pointer; font-weight:bold;">+</button>
                                        </div>
                                    `}
                                </td>
                                <td style="text-align:right;">₹${item.unit_price.toLocaleString()}</td>
                                ${!isSold ? `
                                    <td style="text-align:right;">
                                        <button onclick="removeItemFromOrder('${item.product_id}')" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:16px;">🗑️</button>
                                    </td>` : ''}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

    // 2. LOWER SECTION (Discount & Actions)
    if (isSold) {
        // Finalized View: Only Reprint option
        html += `
            <div style="background: #f0fdf4; padding: 25px; border-top: 1px solid #bbf7d0; text-align: center;">
                <p style="color: var(--success); font-weight: 700; margin-bottom: 15px;">✓ Finalized Transaction</p>
                <button class="btn-primary" style="width:100%; justify-content:center; background:#1e293b;" onclick="printDocument('${targetId}', true)">
                    📄 Download Tax Invoice
                </button>
            </div>`;
    } else {
        // Edit Mode: Negotiation and PI controls
        html += `
            <div style="background: #f8fafc; padding: 25px; border-top: 1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div>
                        <span style="display:block; font-weight:700; font-size:14px; color:var(--text-main);">Apply Negotiation Discount</span>
                        <span style="font-size:11px; color:var(--text-muted);">Adjusts final Proforma total</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="number" id="piDiscount" value="${data.discount_percent || 0}" 
                               style="width:80px; padding:12px; border-radius:8px; border:1px solid var(--border); font-weight:bold; text-align:center;">
                        <span style="font-weight:800;">%</span>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
                    <button class="btn-secondary" style="justify-content:center; padding:15px;" onclick="printDocument('${targetId}', false)">
                        📄 Preview PI
                    </button>
                    <button class="btn-primary" style="justify-content:center; padding:15px; background:var(--primary);" onclick="generatePI()">
                        ✅ Create PI
                    </button>
                </div>

                <button class="btn-success" style="width:100%; justify-content:center; padding:18px; background:#10b981; font-size:16px; color:white; font-weight:bold;" 
                        onclick="finalizeTransaction('${targetId}')">
                    💰 Finalize & Print Invoice
                </button>
            </div>`;
    }

    html += `</div>`;
    resultsDiv.innerHTML = html;
};

window.generatePI = async function() {
    const discount = document.getElementById('piDiscount').value || 0;
    
    if (!confirm(`Generate PI for ${ACTIVE_CLIENT_NAME} with ${discount}% discount?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/order/convert-to-pi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                order_id: ACTIVE_BASKET_ID, 
                discount_percent: parseFloat(discount) 
            })
        });

        const result = await response.json();
        if (result.status === "success") {
            alert("Proforma Invoice Created Successfully!");
            // Reset the session for the next customer
            ACTIVE_BASKET_ID = null;
            ACTIVE_CLIENT_NAME = "";
            document.getElementById('active-session-bar').style.display = 'none';
            document.getElementById('floating-basket-bar').style.display = 'none';
            location.reload(); 
        }
    } catch (e) {
        console.error("PI Conversion Error:", e);
    }
};

window.loadOrdersPage = async function() {
    if (!CURRENT_SHOP_ID) return alert("Please select a shop first");
    
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = "<p style='text-align:center;'>Loading order history...</p>";

    try {
        const response = await fetch(`${API_BASE_URL}/orders/list/${CURRENT_SHOP_ID}`);
        const orders = await response.json();

        let html = `
            <div id="orders-view-wrapper">
                <h1 style="margin-bottom: 20px; font-size: 24px; font-weight: 800;">Order Management</h1>
                
                <table class="data-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>DATE</th>
                            <th>CLIENT</th>
                            <th>STATUS</th>
                            <th>TOTAL</th>
                            <th style="text-align:right;">ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString();
            const statusColor = order.status === 'sold' ? 'var(--success)' : 
                               (order.status === 'pi' ? 'var(--warning)' : 'var(--primary)');
            
            // Logic for Action Buttons
            const isEditable = order.status === 'bucket' || order.status === 'pi';
            
            // Define Reprint Button based on status
            const printLabel = order.status === 'sold' ? 'Invoice' : 'PI';
            const isInvoiceFlag = order.status === 'sold';
            const printHtml = `<button class="btn-secondary" onclick="printDocument('${order.id}', ${isInvoiceFlag})" 
                                style="padding: 6px 10px; font-size: 12px; margin-right: 5px;">🖨️ ${printLabel}</button>`;
            const isBucket = order.status === 'bucket';
            const deleteBtn = isBucket 
                ? `<button class="btn-danger" onclick="deleteOrder('${order.id}')" style="padding: 6px 10px; font-size: 12px; margin-left:5px;">🗑️</button>` 
                : '';   
            // Define Main Action (Edit or View)
            const actionBtn = isEditable 
                ? `<button class="btn-primary" onclick="editOrder('${order.id}', '${order.client_name}')" 
                    style="padding: 6px 10px; font-size: 12px; background: var(--primary); color:white;">Edit</button>`
                : `<button class="btn-secondary" onclick="viewOrderDetails('${order.id}')" 
                    style="padding: 6px 10px; font-size: 12px;">View</button>`;

            html += `
                <tr>
                    <td style="font-size: 13px; color: var(--text-muted);">${date}</td>
                    <td>
                        <div style="font-weight: 700;">${order.client_name || 'Walking Customer'}</div>
                        <div style="font-size: 11px; opacity: 0.6;">ID: ${order.id.substring(0,8)}</div>
                    </td>
                    <td>
                        <span class="badge" style="background: ${statusColor}20; color: ${statusColor}; border: 1px solid ${statusColor}40;">
                            ${order.status.toUpperCase()}
                        </span>
                    </td>
                    <td style="font-weight: 700;">₹${(order.final_total || 0).toLocaleString()}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        ${deleteBtn}
                        ${printHtml}
                        ${actionBtn}
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        resultsDiv.innerHTML = html;
        syncUIState();
    } catch (e) {
        console.error("Orders Page Error:", e);
        resultsDiv.innerHTML = "<p style='color:red; text-align:center;'>Error rendering order list. Check console for details.</p>";
    }
};

window.editOrder = async function(orderId, clientName) {
    // 1. Set this order as the active session
    ACTIVE_BASKET_ID = orderId;
    ACTIVE_CLIENT_NAME = clientName;

    // 2. Update the UI to show we are in an edit session
    document.getElementById('active-session-bar').style.display = 'flex';
    document.getElementById('session-client-name').innerText = `Editing: ${clientName}`;
    document.getElementById('floating-basket-bar').style.display = 'flex';

    // 3. Navigate directly to the basket preview to see current items
    showBasketPreview();
};

// --- BASKET EDITING ACTIONS ---

window.updateItemQty = async function(productId, change) {
    if (!ACTIVE_BASKET_ID) return;

    try {
        const response = await fetch(`${API_BASE_URL}/order/update-qty`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                order_id: ACTIVE_BASKET_ID, // UUID string
                product_id: productId,      // UUID string
                change: parseInt(change)    // Integer
            })
        });

        if (!response.ok) {
            const err = await response.json();
            console.error("Server error:", err);
            return;
        }

        const result = await response.json();
        if (result.status === "success") {
            loadBasketDetails(ACTIVE_BASKET_ID);
        }
    } catch (e) {
        console.error("Network error updating quantity:", e);
    }
};

window.removeItemFromOrder = async function(productId) {
    if (!ACTIVE_BASKET_ID || !confirm("Remove this item?")) return;

    // The backend uses @app.delete("/order/remove-item") with query params
    const url = `${API_BASE_URL}/order/remove-item?order_id=${ACTIVE_BASKET_ID}&product_id=${productId}`;

    try {
        const response = await fetch(url, { method: 'DELETE' });

        if (response.ok) {
            loadBasketDetails(ACTIVE_BASKET_ID);
            showToast("Item removed");
        } else {
            console.error("Failed to remove item");
        }
    } catch (e) {
        console.error("Error:", e);
    }
};

window.finalizeTransaction = async function(orderId) {
    if (!confirm("Confirm Sale? This will deduct stock and generate the final Invoice.")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/order/finalize-sale?order_id=${orderId}`, {
            method: 'POST'
        });
        const result = await response.json();
        
        if (result.status === "success") {
            showToast("Sale Completed!");
            
            // 1. CLEAR THE SESSION so the bars disappear
            ACTIVE_BASKET_ID = null;
            ACTIVE_CLIENT_NAME = "";
            
            // 2. Refresh the UI bars
            syncUIState(); 
            
            // 3. Trigger the print (using the corrected function name)
            printDocument(orderId, true); 
            
            // 4. Return to order management
            loadOrdersPage(); 
        }
    } catch (e) {
        console.error("Finalization error:", e);
    }
};

// window.printDocument = async function(orderId, isInvoice = false) {
//     try {
//         const response = await fetch(`${API_BASE_URL}/basket/details/${orderId}`);
//         const data = await response.json();
//         const items = data.order_items;
//         const clientName = ACTIVE_CLIENT_NAME || "Valued Customer";

//         const printWindow = window.open('', '_blank');
//         const docTitle = isInvoice ? "TAX INVOICE" : "PROFORMA INVOICE";

//         let html = `
// <html>
// <head>
//     <style>
//         body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
//         .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
//         .main-title { text-align: center; border: 1px solid #000; font-weight: bold; padding: 5px; text-transform: uppercase; }
//         .info-section { width: 100%; border: 1px solid #000; padding: 10px; min-height: 100px; }
//         .data-table { width: 100%; border-collapse: collapse; margin-top: -1px; }
//         .data-table th, .data-table td { border: 1px solid #000; padding: 8px; text-align: left; }
//         .terms { font-size: 11px; margin-top: 20px; border: 1px solid #000; padding: 10px; }
//         .footer { display: flex; justify-content: space-between; margin-top: 40px; font-size: 13px; }
//         @media print { .no-print { display: none; } }
//     </style>
// </head>
// <body>
//     <div style="text-align:center;">
//         <h1 style="margin:0;">TLC LIGHTING</h1>
//         <p style="margin:5px 0; font-size:12px;">3rd Floor, Dwarika Heights, Eastern Bypass, Siliguri, WB-734001<br>
//         Ph: 7872663828 | Email: thelightcodetlc@gmail.com</p>
//     </div>

//     <div class="main-title">${docTitle}</div>
    
//     <table class="header-table">
//         <tr>
//             <td style="border:1px solid #000; width:50%; padding:10px;">To, <br><b>${clientName}</b></td>
//             <td style="border:1px solid #000; padding:10px;">
//                 DATE: ${new Date().toLocaleDateString()}<br>
//                 ORDER NO: ${orderId.substring(0,8)}
//             </td>
//         </tr>
//     </table>

//     <table class="data-table">
//         <thead>
//             <tr>
//                 <th>Sl.</th>
//                 <th>Product Description</th>
//                 <th>Qty</th>
//                 <th>Rate</th>
//                 <th>Total</th>
//             </tr>
//         </thead>
//         <tbody>
//             ${items.map((item, index) => `
//                 <tr>
//                     <td>${index + 1}</td>
//                     <td><b>${item.item_code}</b></td>
//                     <td>${item.quantity}</td>
//                     <td>₹${item.unit_price.toLocaleString()}</td>
//                     <td>₹${(item.quantity * item.unit_price).toLocaleString()}</td>
//                 </tr>
//             `).join('')}
//         </tbody>
//     </table>

//     <div class="terms">
//         <b>Terms and Conditions:</b><br>
//         1) Delivery within 20-25 Days for all items after confirmation<br>
//         2) Stock as per Subject to Availability<br>
//         3) Goods once Sold will not be Taken Back or Exchange
//     </div>

//     <div class="footer">
//         <div><b>BANK DETAILS:</b><br>TLC LIGHTING<br>A/C: XXXXXXXXXX</div>
//         <div style="text-align:right;">For, TLC LIGHTING<br><br><br>Partner</div>
//     </div>
//     <button class="no-print" onclick="window.print()" style="margin-top:20px; padding:10px;">Print Document</button>
// </body>
// </html>`;

//         printWindow.document.write(html);
//         printWindow.document.close();
//     } catch (e) {
//         console.error("Print error:", e);
//     }
// };

// Helper to sync UI visibility

window.printDocument = async function(orderId, isInvoice = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/basket/details/${orderId}`);
        const data = await response.json();
        const items = data.order_items;
        const clientName = ACTIVE_CLIENT_NAME || "Valued Customer";
        
        // Fetch discount percentage from backend data
        const discountPercent = data.discount_percent || 0;

        // Mathematical Calculations
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const discountAmount = (subtotal * discountPercent) / 100;
        const finalTotal = subtotal - discountAmount;

        const printWindow = window.open('', '_blank');
        const docTitle = isInvoice ? "TAX INVOICE" : "PROFORMA INVOICE";

        let html = `
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .main-title { text-align: center; border: 1px solid #000; font-weight: bold; padding: 5px; text-transform: uppercase; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: -1px; }
        .data-table th, .data-table td { border: 1px solid #000; padding: 8px; text-align: left; }
        .totals-section { width: 100%; border-collapse: collapse; margin-top: -1px; }
        .totals-section td { border: 1px solid #000; padding: 8px; }
        .terms { font-size: 11px; margin-top: 20px; border: 1px solid #000; padding: 10px; }
        .footer { display: flex; justify-content: space-between; margin-top: 40px; font-size: 13px; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <div style="text-align:center;">
        <h1 style="margin:0;">TLC LIGHTING</h1>
        <p style="margin:5px 0; font-size:12px;">3rd Floor, Dwarika Heights, Eastern Bypass, Siliguri, WB-734001<br>
        Ph: 7872663828 | Email: thelightcodetlc@gmail.com</p>
    </div>

    <div class="main-title">${docTitle}</div>
    
    <table class="header-table">
        <tr>
            <td style="border:1px solid #000; width:50%; padding:10px;">To, <br><b>${clientName}</b></td>
            <td style="border:1px solid #000; padding:10px;">
                DATE: ${new Date().toLocaleDateString()}<br>
                ORDER NO: ${orderId.substring(0,8)}
            </td>
        </tr>
    </table>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width:5%;">Sl.</th>
                <th style="width:55%;">Product Description</th>
                <th style="width:10%;">Qty</th>
                <th style="width:15%;">Rate</th>
                <th style="width:15%;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${items.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td><b>${item.item_code}</b></td>
                    <td>${item.quantity}</td>
                    <td>₹${item.unit_price.toLocaleString()}</td>
                    <td>₹${(item.quantity * item.unit_price).toLocaleString()}</td>
                </tr>
            `).join('')}
            
            <tr>
                <td colspan="4" style="text-align:right;"><b>Subtotal:</b></td>
                <td>₹${subtotal.toLocaleString()}</td>
            </tr>
            ${discountPercent > 0 ? `
            <tr>
                <td colspan="4" style="text-align:right; color: #d32f2f;"><b>Discount (${discountPercent}%):</b></td>
                <td style="color: #d32f2f;">- ₹${discountAmount.toLocaleString()}</td>
            </tr>
            ` : ''}
            <tr style="background-color: #f9f9f9;">
                <td colspan="4" style="text-align:right; font-size: 1.1em;"><b>Grand Total:</b></td>
                <td style="font-size: 1.1em;"><b>₹${finalTotal.toLocaleString()}</b></td>
            </tr>
        </tbody>
    </table>

    <div class="terms">
        <b>Terms and Conditions:</b><br>
        1) Delivery within 20-25 Days for all items after confirmation<br>
        2) Stock as per Subject to Availability<br>
        3) Goods once Sold will not be Taken Back or Exchange
    </div>

    <div class="footer">
        <div><b>BANK DETAILS:</b><br>TLC LIGHTING<br>A/C: XXXXXXXXXX</div>
        <div style="text-align:right;">For, TLC LIGHTING<br><br><br>Partner</div>
    </div>
    <div class="no-print" style="text-align:center; margin-top:30px;">
        <button onclick="window.print()" style="padding:10px 40px; background:#4f46e5; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">Print Document</button>
    </div>
</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
    } catch (e) {
        console.error("Print error:", e);
    }
};

function syncUIState() {
    const sessionBar = document.getElementById('active-session-bar');
    const basketBar = document.getElementById('floating-basket-bar');
    const sidebar = document.getElementById('live-basket-sidebar');

    // --- Part 1: Session Management (Fixed Count Logic) ---
    if (ACTIVE_BASKET_ID) {
        sessionBar.style.display = 'flex';
        basketBar.style.display = 'flex';
        
        // Show sidebar only on large screens
        if (sidebar && window.innerWidth > 900) {
            sidebar.style.display = 'block';
        }
        
        document.getElementById('session-client-name').innerText = `Editing: ${ACTIVE_CLIENT_NAME}`;
        
        // REFRESH: Ensures the '0 Items' bug is fixed
        updateMiniBasket(); 
        updateFloatingBarCount(); 
    } else {
        sessionBar.style.display = 'none';
        basketBar.style.display = 'none';
        if (sidebar) sidebar.style.display = 'none';
    }

    // --- Part 2: Navigation Tabs Styling (Enterprise Contrast) ---
    const navInv = document.getElementById('nav-inv');
    const navOrd = document.getElementById('nav-ord');
    
    // Check which marker is present in the DOM
    const isOrdersView = document.getElementById('orders-list-container') !== null;

    if (navInv && navOrd) {
        if (isOrdersView) {
            navOrd.classList.add('active');
            navInv.classList.remove('active');
        } else {
            navInv.classList.add('active');
            navOrd.classList.remove('active');
        }
    }
}

window.exitSession = function() {
    if(confirm("Exit current session? Items in basket will be saved as a draft.")) {
        ACTIVE_BASKET_ID = null;
        ACTIVE_CLIENT_NAME = "";
        syncUIState();
        loadOrdersPage(); // Go back to orders to see the draft
    }
};

window.deleteOrder = async function(orderId) {
    if (!confirm("Are you sure you want to permanently delete this draft?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/order/delete/${orderId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (result.status === "success") {
            if (ACTIVE_BASKET_ID === orderId) {
                ACTIVE_BASKET_ID = null;
                ACTIVE_CLIENT_NAME = "";
                syncUIState();
            }
            loadOrdersPage();
        } else {
            alert(result.detail);
        }
    } catch (e) {
        console.error("Delete error:", e);
    }
};

window.closeBasket = function() {
    // Re-check if we have an actual active session
    syncUIState(); 
    
    if (CURRENT_SHOP_ID) {
        viewInventory(CURRENT_SHOP_ID);
    } else {
        location.reload();
    }
};

window.viewOrderDetails = async function(orderId) {
    try {
        const response = await fetch(`${API_BASE_URL}/basket/details/${orderId}`);
        const data = await response.json();
        
        // Pass orderId as the second argument (viewOnlyId)
        renderBasketModal(data, orderId); 
        
        // Temporarily hide the active session bar so it doesn't confuse the user
        const floatingBar = document.getElementById('floating-basket-bar');
        if (floatingBar) floatingBar.style.display = 'none';
    } catch (e) {
        console.error("Error viewing order:", e);
    }
};

window.printInvoice = function(orderId) {
    printDocument(orderId, true);
};

window.openClientModal = function() {
    const modal = document.getElementById('clientModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('newClientName').focus();
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};

// Close modal if user clicks outside of it
window.onclick = function(event) {
    const modal = document.getElementById('clientModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

window.updateFloatingBarCount = async function() {
    if (!ACTIVE_BASKET_ID) return;

    try {
        const response = await fetch(`${API_BASE_URL}/basket/details/${ACTIVE_BASKET_ID}`);
        const data = await response.json();
        
        // Sum up the quantities of all items in the basket
        const items = data.order_items || [];
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

        // Update the UI elements
        const countLabel = document.getElementById('basket-count');
        if (countLabel) {
            countLabel.innerText = `${totalItems} Item${totalItems !== 1 ? 's' : ''}`;
        }
        
        // Ensure the bar is visible if there are items
        const basketBar = document.getElementById('floating-basket-bar');
        if (basketBar) basketBar.style.display = 'flex';

    } catch (e) {
        console.error("Error updating basket count:", e);
    }
};
