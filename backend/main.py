import json
import os
import urllib
from fastapi import FastAPI, Query, Body, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Any, Optional, Dict, List
import psycopg2  # <--- This is the missing line
from psycopg2.extras import RealDictCursor
import urllib.parse
import mimetypes
from pydantic_settings import BaseSettings, SettingsConfigDict
import logging
from config import get_db_conn
from datetime import datetime
from typing import Dict, Any

load_dotenv()

# Define settings to pull from Environment Variables
class Settings(BaseSettings):
    DB_USER: str
    DB_PASS: str
    DB_HOST: str
    DB_PORT: str
    DB_NAME: str
    FRONTEND_URL: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

app = FastAPI()
import os
print(f"DEBUG: Current Directory is {os.getcwd()}")
print(f"DEBUG: DB_NAME in Environment: {os.getenv('DB_NAME')}")

origins = [
    "http://localhost:5500",
          "http://localhost:5173", "http://localhost:5174",      # Local Live Server
    "http://127.0.0.1:5500",
      "http://127.0.0.1:8000"      # Alternative Localhost
]

# Add your Render Frontend URL from an environment variable
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Use the specific list instead of ["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up logging to see errors in Render logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.get("/search")
async def search_shops(name: str):
    # 1. Validation
    if not name or len(name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search term too short")

    query = "SELECT id, name FROM shops WHERE name ILIKE %s"
    
    conn = None
    try:
        # 2. Get the connection
        conn = get_db_conn()
        # 3. Use the cursor within the connection context
        with conn.cursor() as cur:
            logger.info(f"Searching for: {name}")
            cur.execute(query, (f"%{name}%",))
            
            # Since you are using RealDictCursor, cur.fetchall() 
            # already returns a list of dictionaries!
            results = cur.fetchall()
            
            return {"results": results, "count": len(results)}

    except Exception as e:
        logger.error(f"Database error during search: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    finally:
        # 4. CRITICAL: Always close the connection on Render
        # to prevent "Too many connections" errors in Supabase
        if conn:
            conn.close()

@app.get("/inventory/{shop_id}")
async def get_inventory(shop_id: str):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        p.id, p.item_code, p.selling_price, p.cost_price, p.overhead_expense, p.remark, p.vendor_name, p.photo_url,
                        p.qty_display, p.qty_godown, c.name as category_name, p.created_at
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    WHERE p.shop_id = %s
                    ORDER BY p.created_at DESC
                """, (shop_id,))
                return cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.patch("/inventory/{product_id}")
async def update_inventory_item(product_id: str, updates: Dict[str, Any] = Body(...)):
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Build the dynamic SET clause
                # Filter out keys that aren't valid columns to prevent SQL injection
                allowed_cols = {
                    "item_code", "selling_price", "cost_price", 
                    "overhead_expense", "remark", "vendor_name", 
                    "photo_url", "qty_display", "qty_godown", "category_id"
                }
                
                # Create a list of "column = %s" strings
                set_parts = []
                values = []
                
                for key, value in updates.items():
                    if key in allowed_cols:
                        set_parts.append(f"{key} = %s")
                        values.append(value)
                
                if not set_parts:
                    raise HTTPException(status_code=400, detail="No valid fields provided")

                # 2. Finalize the query with updated_at
                set_clause = ", ".join(set_parts)
                query = f"""
                    UPDATE products 
                    SET {set_clause}, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = %s 
                    RETURNING id
                """
                
                # Append product_id to values for the WHERE clause
                values.append(product_id)
                
                cur.execute(query, tuple(values))
                conn.commit()

                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Product not found")

                return {"status": "success", "updated_id": product_id}

    except Exception as e:
        print(f"Update Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

class BasketItem(BaseModel):
    order_id: str  # Changed from shop_id to order_id
    product_id: str
    qty: int = 1
    attribute_metadata: Optional[List[Dict[str, Any]]] = []

@app.post("/basket/add")
async def add_to_basket(item: BasketItem):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Get Product Price
                cur.execute("SELECT selling_price FROM products WHERE id = %s", (item.product_id,))
                res = cur.fetchone()
                if not res: 
                    raise HTTPException(status_code=404, detail="Product not found")
                price = res['selling_price']

                # 2. Add or Update the item in the specific basket (order_id)
                # We now also update the attribute_metadata column
                cur.execute("""
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, attribute_metadata)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (order_id, product_id) DO UPDATE 
                    SET 
                        quantity = order_items.quantity + EXCLUDED.quantity,
                        attribute_metadata = EXCLUDED.attribute_metadata
                """, (
                    item.order_id, 
                    item.product_id, 
                    item.qty, 
                    price, 
                    # We expect the frontend to send the full updated JSON array
                    json.dumps(item.attribute_metadata) if hasattr(item, 'attribute_metadata') else '[]'
                ))
                
                # Recalculate after adding new item
                update_order_total(cur, item.order_id)
                conn.commit()
                return {"status": "success", "message": "Item added to session"}
    except Exception as e:
        logger.error(f"Error adding to basket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/basket/{shop_id}")
async def get_active_basket(shop_id: str):
    query_order = """
        SELECT id, status FROM orders 
        WHERE shop_id = %s AND status = 'bucket' 
        ORDER BY created_at DESC LIMIT 1
    """
    query_items = """
        SELECT oi.quantity, oi.unit_price, p.item_code
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = %s
    """
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query_order, (shop_id,))
                order = cur.fetchone()
                if not order: return {}
                
                cur.execute(query_items, (order['id'],))
                order['order_items'] = cur.fetchall()
                return order
    except Exception as e:
        return {"error": str(e)}
    
@app.get("/product/by-code")
async def get_product_by_code(item_code: str):
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM products WHERE item_code = %s", (item_code,))
            return cur.fetchone() 
            
class BasketCreate(BaseModel):
    shop_id: str
    client_name: str
    initial_product_id: str = None  # Added this field
    client_phone: Optional[str] = None
    referral_source: Optional[str] = None
    delivery_address: Optional[str] = None
    qty: Optional[int] = 1

@app.post("/basket/create")
async def create_basket(req: BasketCreate):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                client_id = None
                
                # 1. Identity Resolution: Check if client exists IN THIS SHOP
                if req.client_phone:
                    cur.execute(
                        "SELECT id FROM clients WHERE shop_id = %s AND phone = %s", 
                        (req.shop_id, req.client_phone)
                    )
                    existing = cur.fetchone()
                    if existing:
                        client_id = existing['id']

                # 2. Create new client record if not found
                if not client_id:
                    # Original logic maintained: shop_id is passed during client creation
                    cur.execute(
                        "INSERT INTO clients (shop_id, name, phone) VALUES (%s, %s, %s) RETURNING id", 
                        (req.shop_id, req.client_name, req.client_phone)
                    )
                    client_id = cur.fetchone()['id']
                
                # 3. Create the Order with Transactional Snapshot
                cur.execute("""
                    INSERT INTO orders (
                        shop_id, client_id, status, client_name, 
                        client_phone, referral_source, delivery_address,
                        discount_percent, tax_percent
                    ) 
                    VALUES (%s, %s, 'bucket', %s, %s, %s, %s, 0, 18) RETURNING id
                """, (
                    req.shop_id, 
                    client_id, 
                    req.client_name, 
                    req.client_phone,
                    req.referral_source, 
                    req.delivery_address,
                ))
                new_order_id = cur.fetchone()['id']

                # 4. Insert the first item if provided
                if req.initial_product_id:
                    cur.execute("""
                        INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                        VALUES (%s, %s, %s, (SELECT selling_price FROM products WHERE id = %s))
                    """, (new_order_id, req.initial_product_id, req.qty, req.initial_product_id))

                # 5. Finalize totals and commit
                update_order_total(cur, new_order_id)
                conn.commit()
                
                return {
                    "order_id": new_order_id, 
                    "client_id": client_id,
                    "client_name": req.client_name
                }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# @app.post("/basket/create")
# async def create_basket(req: BasketCreate):
#     try:
#         with get_db_conn() as conn:
#             with conn.cursor() as cur:
#                 # 1. Create client
#                 cur.execute(
#                     "INSERT INTO clients (shop_id, name) VALUES (%s, %s) RETURNING id", 
#                     (req.shop_id, req.client_name)
#                 )
#                 client_id = cur.fetchone()['id']
                
#                 # 2. Create the Order (Basket)
#                 cur.execute("""
#                     INSERT INTO orders (shop_id, client_id, status, discount_percent, tax_percent) 
#                     VALUES (%s, %s, 'bucket', 0, 0) RETURNING id
#                 """, (req.shop_id, client_id))
#                 new_order_id = cur.fetchone()['id']

#                 # 3. NEW: Insert the first item if provided
#                 if req.initial_product_id:
#                     cur.execute("""
#                         INSERT INTO order_items (order_id, product_id, quantity, unit_price)
#                         VALUES (%s, %s, %s, (SELECT selling_price FROM products WHERE id = %s))
#                     """, (new_order_id, req.initial_product_id, req.qty,req.initial_product_id))

#                 # 4. Finalize totals and commit
#                 update_order_total(cur, new_order_id)
#                 conn.commit()
                
#                 return {"order_id": new_order_id, "client_name": req.client_name}
#     except Exception as e:
#         print(f"Error: {e}")
#         raise HTTPException(status_code=500, detail=str(e))    

# @app.post("/basket/create")
# async def create_basket(req: BasketCreate = Body(...)):
#     try:
#         with get_db_conn() as conn:
#             with conn.cursor() as cur:
#                 # Use req.shop_id and req.client_name instead of just shop_id/client_name
#                 # 1. Create or find client
#                 cur.execute(
#                     "INSERT INTO clients (shop_id, name) VALUES (%s, %s) RETURNING id", 
#                     (req.shop_id, req.client_name)
#                 )
#                 client_id = cur.fetchone()['id']
                
#                 # 2. Create the Order (Basket)
#                 cur.execute("""
#                     INSERT INTO orders (shop_id, client_id, status, discount_percent, final_total) 
#                     VALUES (%s, %s, 'bucket', 0, 0) RETURNING id
#                 """, (req.shop_id, client_id))
                
#                 new_id = cur.fetchone()['id']
#                 conn.commit()
                
#                 # Return the new ID and the name from the request
#                 return {"order_id": new_id, "client_name": req.client_name}
#     except Exception as e:
#         # It's helpful to print the error to your terminal for debugging
#         print(f"Error creating basket: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/order/finalize")
# async def finalize_order(order_id: str):
#     # This logic moves status from 'pi' or 'bucket' to 'sold'
#     # and executes the Godown -> Display waterfall deduction directly on the products table.
#     query_items = "SELECT product_id, quantity FROM order_items WHERE order_id = %s"
    
#     # We use get_db_conn from config.py
#     with get_db_conn() as conn:
#         with conn.cursor() as cur:
#             cur.execute(query_items, (order_id,))
#             items = cur.fetchall()
            
#             for item in items:
#                 # Waterfall Deduction Logic updated for unified 'products' table
#                 cur.execute("SELECT qty_godown, qty_display FROM products WHERE id = %s", (item['product_id'],))
#                 stock = cur.fetchone()
                
#                 if not stock:
#                     continue

#                 qty_needed = item['quantity']
                
#                 if stock['qty_godown'] >= qty_needed:
#                     # Deduct entirely from Godown
#                     cur.execute("UPDATE products SET qty_godown = qty_godown - %s WHERE id = %s", 
#                                 (qty_needed, item['product_id']))
#                 else:
#                     # Deduct what's left in Godown, then the rest from Display
#                     remainder = qty_needed - stock['qty_godown']
#                     cur.execute("UPDATE products SET qty_godown = 0, qty_display = qty_display - %s WHERE id = %s", 
#                                 (remainder, item['product_id']))
            
#             # Finalize the order status
#             cur.execute("UPDATE orders SET status = 'sold', updated_at = NOW() WHERE id = %s", (order_id,))
#             conn.commit()
            
#     return {"status": "success"}


# 1. Define the schema to match your React payload
class FinalizeOrderRequest(BaseModel):
    order_id: str
    discount_percent: float
    tax_percent: float
    paid_amount: float
    referral_source: str = ""
    delivery_address: str = ""
    client_phone: str = ""

@app.post("/order/finalize-sale")
async def finalize_order(req: FinalizeOrderRequest): # Now accepts the full object
    # Define queries
    query_items = "SELECT product_id, quantity FROM order_items WHERE order_id = %s"
    
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            # A. Fetch items for stock deduction
            cur.execute(query_items, (req.order_id,))
            items = cur.fetchall()
            
            for item in items:
                cur.execute("SELECT qty_godown, qty_display FROM products WHERE id = %s", (item['product_id'],))
                stock = cur.fetchone()
                
                if not stock: continue

                qty_needed = item['quantity']
                
                if stock['qty_godown'] >= qty_needed:
                    cur.execute("UPDATE products SET qty_godown = qty_godown - %s WHERE id = %s", 
                                (qty_needed, item['product_id']))
                else:
                    remainder = qty_needed - stock['qty_godown']
                    cur.execute("UPDATE products SET qty_godown = 0, qty_display = qty_display - %s WHERE id = %s", 
                                (remainder, item['product_id']))
            
            # B. Finalize the order status AND save the metadata
            # We use req.attribute to access the data from the JSON body
            cur.execute("""
                UPDATE orders 
                SET status = 'sold', 
                    discount_percent = %s, 
                    tax_percent = %s, 
                    paid_amount = %s,
                    referral_source = %s,
                    delivery_address = %s,
                    client_phone = %s,
                    updated_at = NOW() 
                WHERE id = %s
            """, (
                req.discount_percent, 
                req.tax_percent, 
                req.paid_amount, 
                req.referral_source, 
                req.delivery_address, 
                req.client_phone, 
                req.order_id
            ))
            
            conn.commit()
            
    return {"status": "success"}

class PIRequest(BaseModel):
    order_id: str
    discount_percent: float

@app.post("/order/convert-to-pi")
async def convert_to_pi(req: PIRequest):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Calculate the subtotal from order_items
                cur.execute("SELECT SUM(total_price) as subtotal FROM order_items WHERE order_id = %s", (req.order_id,))
                subtotal = cur.fetchone()['subtotal'] or 0
                
                # 2. Apply discount
                final_total = float(subtotal) * (1 - (req.discount_percent / 100))
                
                # 3. Update Order status to 'pi' and save totals
                cur.execute("""
                    UPDATE orders 
                    SET status = 'pi', 
                        discount_percent = %s, 
                        final_total = %s 
                    WHERE id = %s
                """, (req.discount_percent, final_total, req.order_id))
                # Recalculate total with the new discount
                update_order_total(cur, req.order_id)
                conn.commit()
                return {"status": "success", "final_total": final_total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/basket/details/{order_id}")
async def get_basket_details(order_id: str):
    # 1. Added attribute_metadata to the SELECT query
    query_items = """
        SELECT oi.product_id, oi.quantity, oi.unit_price, p.item_code, oi.attribute_metadata, p.photo_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = %s
    """
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query_items, (order_id,))
                raw_items = cur.fetchall()
                
                # 2. Parse the JSON metadata for each item
                formatted_items = []
                for item in raw_items:
                    # Handle potential string-to-JSON parsing
                    metadata = item['attribute_metadata']
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = []
                    
                    formatted_items.append({
                        "product_id": item['product_id'],
                        "quantity": item['quantity'],
                        "unit_price": float(item['unit_price']),
                        "item_code": item['item_code'],
                        "photo_url": item['photo_url'],
                        "attribute_metadata": metadata if metadata else []
                    })

                cur.execute("""
                    SELECT 
                        status, discount_percent, tax_percent,
                        subtotal, discount_amount, tax_amount, final_total,
                        referral_source, delivery_address, client_phone, paid_amount
                    FROM orders 
                    WHERE id = %s
                """, (order_id,))
                order_data = cur.fetchone()
                
                if not order_data:
                    raise HTTPException(status_code=404, detail="Order not found")

                return {
                    "order_items": formatted_items,
                    "status": order_data['status'],
                    "discount_percent": order_data['discount_percent'] or 0,
                    "discount_amount": float(order_data['discount_amount'] or 0),
                    "tax_percent": order_data['tax_percent'] or 18,
                    "tax_amount": float(order_data['tax_amount'] or 0),
                    "subtotal": float(order_data['subtotal'] or 0),
                    "final_total": float(order_data['final_total'] or 0),
                    "referral_source": order_data['referral_source'] or "",
                    "delivery_address": order_data['delivery_address'] or "",
                    "client_phone": order_data['client_phone'] or "",
                    "paid_amount": float(order_data['paid_amount'] or 0)
                }
    except Exception as e:
        logger.error(f"Error fetching basket details: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/orders/list/{shop_id}")
async def list_orders(shop_id: str, status: str = None):
    query = """
        SELECT id, status, final_total, created_at, 
               discount_percent, tax_percent, paid_amount,
               client_name, referral_source, delivery_address, client_phone, discount_amount, tax_amount
        FROM orders 
        WHERE shop_id = %s
    """
    params = [shop_id]

    if status:
        query += " AND status = %s"
        params.append(status)

    query += " ORDER BY created_at DESC"
    
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, tuple(params))
                return cur.fetchall()
    except Exception as e:
        logger.error(f"Error listing orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class QtyUpdate(BaseModel):
    order_id: str
    product_id: str
    change: int

@app.post("/order/update-qty")
async def update_order_item_qty(req: QtyUpdate):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Fetch current quantity first to validate the change
                cur.execute(
                    "SELECT quantity FROM order_items WHERE order_id = %s AND product_id = %s",
                    (req.order_id, req.product_id)
                )
                res = cur.fetchone()
                
                if not res:
                    raise HTTPException(status_code=404, detail="Item not found")

                current_qty = res['quantity']
                new_qty = current_qty + req.change

                # 2. Conditional Logic: Delete if 0, otherwise Update
                if new_qty <= 0:
                    cur.execute(
                        "DELETE FROM order_items WHERE order_id = %s AND product_id = %s",
                        (req.order_id, req.product_id)
                    )
                else:
                    cur.execute("""
                        UPDATE order_items 
                        SET quantity = %s
                        WHERE order_id = %s AND product_id = %s
                    """, (new_qty, req.order_id, req.product_id))
                
                # 3. Recalculate totals and commit
                update_order_total(cur, req.order_id)
                conn.commit()
                return {"status": "success", "new_qty": max(0, new_qty)}
                
    except Exception as e:
        logger.error(f"Update Qty Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/order/remove-item")
async def remove_order_item(order_id: str, product_id: str):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM order_items WHERE order_id = %s AND product_id = %s",
                    (order_id, product_id)
                )
                # Recalculate after item removal
                update_order_total(cur, order_id)
                conn.commit()
                return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

@app.post("/order/finalize-sale")
async def create_sale(order_id: str, discount: float = 0.0, tax: float = 0.0, paid_amount: float = 0.0): # Default to 0.0 to allow flexibility
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Fetch items with their current stock levels for validation
                cur.execute("""
                    SELECT oi.product_id, oi.quantity, oi.unit_price, p.qty_display, p.qty_godown 
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.id
                    WHERE oi.order_id = %s
                """, (order_id,))
                items = cur.fetchall()
                
                if not items:
                    raise HTTPException(status_code=400, detail="Cart is empty")

                # 2. Math Logic
                subtotal = sum(float(item['unit_price']) * item['quantity'] for item in items)
                discount_amount = subtotal * (discount / 100.0) 
                taxable_amount = subtotal - discount_amount
                # Logic works perfectly even if tax is 0.0
                tax_amount = taxable_amount * (tax / 100.0)
                final_total = taxable_amount + tax_amount

                # 3. Stock Deduction Logic (CRITICAL FIX)
                for item in items:
                    qty_to_deduct = item['quantity']
                    
                    # Logic: Try to deduct from display first, then from godown
                    if item['qty_display'] >= qty_to_deduct:
                        cur.execute("UPDATE products SET qty_display = qty_display - %s WHERE id = %s", 
                                   (qty_to_deduct, item['product_id']))
                    else:
                        # If display isn't enough, empty display and take remainder from godown
                        remainder = qty_to_deduct - item['qty_display']
                        cur.execute("""
                            UPDATE products 
                            SET qty_display = 0, 
                                qty_godown = qty_godown - %s 
                            WHERE id = %s
                        """, (remainder, item['product_id']))

                # 4. Finalize the Order status
                cur.execute("""
                    UPDATE orders 
                    SET discount_percent = %s, 
                        tax_percent = %s,
                        subtotal = %s, 
                        discount_amount = %s, 
                        tax_amount = %s, 
                        final_total = %s, 
                        paid_amount = %s,
                        status = 'sold'
                    WHERE id = %s
                """, (discount, tax, subtotal, discount_amount, tax_amount, final_total, paid_amount,order_id))

                conn.commit()
                return {
                    "status": "success", 
                    "final_total": final_total, 
                    "paid_amount": paid_amount,
                    "balance_due": final_total - paid_amount
                }
    except Exception as e:
        # It's better to log the actual error for debugging
        print(f"Checkout Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during stock deduction")


def update_order_total(cur, order_id):
    """Recalculates and persists the subtotal, discount, tax, and final total."""
    # 1. Calculate the raw subtotal from items
    cur.execute("SELECT SUM(total_price) as subtotal FROM order_items WHERE order_id = %s", (order_id,))
    res = cur.fetchone()
    subtotal = float(res['subtotal']) if res and res['subtotal'] else 0.0
    
    # 2. Fetch both discount and tax percentages for the order
    cur.execute("SELECT discount_percent, tax_percent FROM orders WHERE id = %s", (order_id,))
    order_res = cur.fetchone()
    
    discount_percent = float(order_res['discount_percent']) if order_res else 0.0
    tax_percent = float(order_res['tax_percent']) if order_res else 0.0
    
    # 3. Step-by-Step Mathematical Calculation
    # Calculate Discount Amount
    discount_amount = subtotal * (discount_percent / 100.0)
    
    # Taxable Amount is Subtotal minus Discount
    taxable_amount = subtotal - discount_amount
    
    # Calculate Tax on the discounted amount
    tax_amount = taxable_amount * (tax_percent / 100.0)
    
    # Final Total
    final_total = taxable_amount + tax_amount
    
    # 4. Persist all values to the orders table
    cur.execute("""
        UPDATE orders 
        SET subtotal = %s, 
            discount_amount = %s, 
            tax_amount = %s, 
            final_total = %s 
        WHERE id = %s
    """, (subtotal, discount_amount, tax_amount, final_total, order_id))

@app.delete("/order/delete/{order_id}")
async def delete_order(order_id: str):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Verify status is 'bucket' before allowing delete
                cur.execute("SELECT status FROM orders WHERE id = %s", (order_id,))
                res = cur.fetchone()
                if not res or res['status'] != 'bucket':
                    raise HTTPException(status_code=400, detail="Only draft buckets can be deleted.")

                # 2. Delete items first (Foreign Key constraint)
                cur.execute("DELETE FROM order_items WHERE order_id = %s", (order_id,))
                
                # 3. Delete the order
                cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
                
                conn.commit()
                return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ProductAdd(BaseModel):
    item_code: str
    category_id: str
    vendor_name: str
    display_qty: int
    godown_qty: int
    cost_price: float
    overhead: float
    unit_price: float # Selling Price
    remark: str
    shop_id: str
    image_url: str

@app.get("/categories")
async def get_categories():
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id,name FROM categories ORDER BY name ASC")
                return cur.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    

@app.post("/inventory/add")
async def add_inventory(req: ProductAdd):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO products (
                        item_code, category, vendor_name, display_qty, godown_qty, 
                        cost_price, overhead, unit_price, remark, shop_id, image_url, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """, (
                    req.item_code, req.category, req.vendor_name, req.display_qty, 
                    req.godown_qty, req.cost_price, req.overhead, req.unit_price, 
                    req.remark, req.shop_id, req.image_url
                ))
                conn.commit()
                return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
from typing import List

class BulkProductAdd(BaseModel):
    shop_id: str
    category_id: str
    item_code: str
    image_url: str
    cost_price: float
    overhead: float
    unit_price: float
    vendor_name: str
    display_qty: int
    godown_qty: int

# 1. Unified Bulk Insert
@app.post("/inventory/bulk-add")
async def bulk_add_inventory(items: List[BulkProductAdd]):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                query = """
                    INSERT INTO products (
                        shop_id, category_id, item_code, photo_url, 
                        cost_price, overhead_expense, selling_price, 
                        vendor_name, qty_display, qty_godown, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """
                values = [
                    (
                        i.shop_id, i.category_id, i.item_code, i.image_url, 
                        i.cost_price, i.overhead, i.unit_price, 
                        i.vendor_name, i.display_qty, i.godown_qty
                    ) for i in items
                ]
                cur.executemany(query, values)
                conn.commit()
                return {"status": "success", "count": len(items)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Mount the frontend LAST
# This is a "catch-all". If you put it at the top, it might block your API routes.
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/manifest+json', '.json')
# app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")        



# 1. Define the request schema to match your App.tsx payload
class StatusUpdateRequest(BaseModel):
    order_id: str
    status: str
    discount_percent: Optional[float] = 0.0
    tax_percent: Optional[float] = 18.0
    paid_amount: float = 0.0
    referral_source: str = ""   
    delivery_address: str = "" 
    client_phone: str = ""     

@app.post("/order/update-status")
async def update_order_status(request: StatusUpdateRequest):
    # Establish connection to your PostgreSQL database
    conn = get_db_conn()
    cur = conn.cursor()
    
    try:
        # 2. Update the order status and discount in the database
        cur.execute("""
            UPDATE orders 
            SET status = %s, 
                discount_percent = %s,
                tax_percent = %s,
                paid_amount = %s,
                referral_source = %s,
                delivery_address = %s,
                client_phone = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (request.status, request.discount_percent, request.tax_percent, request.paid_amount, request.referral_source, request.delivery_address, request.client_phone, request.order_id))

        update_order_total(cur, request.order_id)
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Order not found")
            
        conn.commit()
        return {"message": f"Order status updated to {request.status}", "order_id": request.order_id}
        
    except Exception as e:
        logger.info(f"Error updating order status: {e}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/order/record-payment")
async def record_payment(data: dict):
    order_id = data.get("order_id")
    amount = float(data.get("amount", 0))
    method = data.get("method", "Cash")
    notes = data.get("notes", "")

    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Record the individual transaction
                cur.execute("""
                    INSERT INTO payments (order_id, amount, payment_method, notes)
                    VALUES (%s, %s, %s, %s)
                """, (order_id, amount, method, notes))

                # 2. Update the cached 'paid_amount' in orders table for quick UI loading
                cur.execute("""
                    UPDATE orders 
                    SET paid_amount = paid_amount + %s 
                    WHERE id = %s
                """, (amount, order_id))

                conn.commit()
                return {"status": "success", "amount_added": amount}
    except Exception as e:
        print(f"Payment Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to record payment")