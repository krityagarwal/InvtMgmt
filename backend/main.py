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
from psycopg2.extras import RealDictCursor, Json
import urllib.parse
import mimetypes
from pydantic_settings import BaseSettings, SettingsConfigDict
import logging
import uuid
import math
import decimal
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

def _sanitize_json(value):
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _sanitize_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_json(v) for v in value]
    return value

def _compute_changes(before: Dict[str, Any], after: Dict[str, Any], fields: List[str], labels: Dict[str, str]):
    changes = []
    for field in fields:
        before_val = before.get(field)
        after_val = after.get(field)
        if isinstance(before_val, decimal.Decimal):
            before_val = float(before_val)
        if isinstance(after_val, decimal.Decimal):
            after_val = float(after_val)
        if before_val != after_val:
            changes.append({
                "field": field,
                "label": labels.get(field, field),
                "from": before_val,
                "to": after_val,
            })
    return changes

def log_audit_event(
    cur,
    shop_id: str,
    entity_type: str,
    entity_id: str,
    action: str,
    before: Optional[Dict[str, Any]] = None,
    after: Optional[Dict[str, Any]] = None,
    notes: Optional[str] = None,
    source: str = "ui",
    actor_id: Optional[str] = None,
    actor_email: Optional[str] = None,
):
    cur.execute(
        """
        INSERT INTO audit_events (
            shop_id, entity_type, entity_id, action,
            actor_id, actor_email, source, notes, before, after
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            shop_id,
            entity_type,
            entity_id,
            action,
            actor_id,
            actor_email,
            source,
            notes,
            Json(_sanitize_json(before)) if before is not None else None,
            Json(_sanitize_json(after)) if after is not None else None,
        ),
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
        import traceback
        print("Delete order failed:", order_id, "error:", repr(e))
        traceback.print_exc()
        logger.exception("Delete order failed", extra={"order_id": order_id})
        raise HTTPException(status_code=500, detail=str(e))
    
@app.patch("/inventory/{product_id}")
async def update_inventory_item(product_id: str, updates: Dict[str, Any] = Body(...)):
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
                before_row = cur.fetchone()
                if not before_row:
                    raise HTTPException(status_code=404, detail="Product not found")

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

                cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
                after_row = cur.fetchone()

                changes = _compute_changes(
                    dict(before_row),
                    dict(after_row) if after_row else {},
                    fields=["qty_godown", "qty_display", "cost_price", "overhead_expense", "selling_price", "vendor_name", "category_id"],
                    labels={
                        "qty_godown": "Godown Qty",
                        "qty_display": "Display Qty",
                        "cost_price": "Cost Price",
                        "overhead_expense": "Landing Price",
                        "selling_price": "Selling Price",
                        "vendor_name": "Vendor",
                        "category_id": "Category",
                    },
                )

                log_audit_event(
                    cur,
                    shop_id=str(before_row.get("shop_id")),
                    entity_type="inventory",
                    entity_id=str(product_id),
                    action="inventory_update",
                    before=dict(before_row),
                    after={
                        **(dict(after_row) if after_row else {}),
                        "changes": changes,
                        "item_code": before_row.get("item_code"),
                    },
                )

                conn.commit()

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
                    VALUES (%s, %s, 'bucket', %s, %s, %s, %s, 0, 0) RETURNING id
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
    extra_discount_amount: float = 0.0
    paid_amount: float
    final_total_override: Optional[float] = None
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
                    extra_discount_amount = %s,
                    paid_amount = %s,
                    referral_source = %s,
                    delivery_address = %s,
                    client_phone = %s,
                    updated_at = NOW() 
                WHERE id = %s
            """, (
                req.discount_percent, 
                req.tax_percent, 
                req.extra_discount_amount,
                req.paid_amount, 
                req.referral_source, 
                req.delivery_address, 
                req.client_phone, 
                req.order_id
            ))

            # Keep SELL totals aligned with PI flow by recalculating persisted amounts
            # (subtotal, discount_amount, tax_amount, final_total) after % updates.
            update_order_total(cur, req.order_id, req.final_total_override)

            cur.execute(
                """
                SELECT shop_id, client_name, final_total, discount_percent, extra_discount_amount, paid_amount
                FROM orders
                WHERE id = %s
                """,
                (req.order_id,),
            )
            order_row = cur.fetchone()

            if order_row:
                log_audit_event(
                    cur,
                    shop_id=str(order_row.get("shop_id")),
                    entity_type="order",
                    entity_id=str(req.order_id),
                    action="order_sold",
                    before=None,
                    after={
                        "order_number": str(req.order_id)[:8].upper(),
                        "client_name": order_row.get("client_name"),
                        "final_total": order_row.get("final_total"),
                        "discount_percent": order_row.get("discount_percent"),
                        "extra_discount_amount": order_row.get("extra_discount_amount"),
                        "paid_amount": order_row.get("paid_amount"),
                    },
                )
            
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

                cur.execute("SELECT shop_id, client_name FROM orders WHERE id = %s", (req.order_id,))
                order_row = cur.fetchone()
                if order_row:
                    log_audit_event(
                        cur,
                        shop_id=str(order_row.get("shop_id")),
                        entity_type="order",
                        entity_id=str(req.order_id),
                        action="pi_created",
                        before=None,
                        after={
                            "order_number": str(req.order_id)[:8].upper(),
                            "client_name": order_row.get("client_name"),
                        },
                    )
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
                        subtotal, discount_amount, extra_discount_amount, tax_amount, final_total,
                        referral_source, delivery_address, client_phone, paid_amount, write_off_amount, write_off_notes
                    FROM orders 
                    WHERE id = %s
                """, (order_id,))
                order_data = cur.fetchone()
                
                if not order_data:
                    raise HTTPException(status_code=404, detail="Order not found")

                return {
                    "order_items": formatted_items,
                    "status": order_data['status'],
                    "discount_percent": order_data['discount_percent'] if order_data['discount_percent'] is not None else 0,
                    "discount_amount": float(order_data['discount_amount']) if order_data['discount_amount'] is not None else 0.0,
                    "extra_discount_amount": float(order_data['extra_discount_amount']) if order_data['extra_discount_amount'] is not None else 0.0,
                    "tax_percent": order_data['tax_percent'] if order_data['tax_percent'] is not None else 0,
                    "tax_amount": float(order_data['tax_amount']) if order_data['tax_amount'] is not None else 0.0,
                    "subtotal": float(order_data['subtotal']) if order_data['subtotal'] is not None else 0.0,
                    "final_total": float(order_data['final_total']) if order_data['final_total'] is not None else 0.0,
                    "referral_source": order_data['referral_source'] or "",
                    "delivery_address": order_data['delivery_address'] or "",
                    "client_phone": order_data['client_phone'] or "",
                    "paid_amount": float(order_data['paid_amount']) if order_data['paid_amount'] is not None else 0.0,
                    "write_off_amount": float(order_data['write_off_amount']) if order_data['write_off_amount'] is not None else 0.0,
                    "write_off_notes": order_data['write_off_notes'] or ""
                }
    except Exception as e:
        logger.error(f"Error fetching basket details: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/orders/list/{shop_id}")
async def list_orders(shop_id: str, status: str = None):
    query = """
        SELECT id, status, final_total, created_at, 
               discount_percent, tax_percent, paid_amount,
               client_name, referral_source, delivery_address, client_phone,
               discount_amount, extra_discount_amount, tax_amount, write_off_amount, write_off_notes
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


@app.get("/orders/summary/{shop_id}")
async def orders_summary(shop_id: str):
    """
    Financial summary for Orders dashboard.
    Uses SOLD orders as realized revenue base.
    """
    query = """
        WITH filtered_orders AS (
            SELECT id, final_total, paid_amount, subtotal, discount_amount, extra_discount_amount, write_off_amount
            FROM orders
            WHERE shop_id = %s AND status = 'sold'
        ),
        order_totals AS (
            SELECT
                COALESCE(SUM(final_total - COALESCE(write_off_amount, 0)), 0) AS total_revenue,
                COALESCE(SUM(paid_amount), 0) AS total_received,
                COALESCE(SUM(GREATEST(final_total - COALESCE(paid_amount, 0) - COALESCE(write_off_amount, 0), 0)), 0) AS total_due,
                COALESCE(SUM(COALESCE(write_off_amount, 0)), 0) AS total_write_off
            FROM filtered_orders
        ),
        profit_totals AS (
            SELECT
                COALESCE(SUM(
                    (COALESCE(o.final_total, 0) - COALESCE(o.write_off_amount, 0))
                    - COALESCE(cogs.landing_total, 0)
                ), 0) AS estimated_profit
            FROM filtered_orders o
            LEFT JOIN (
                SELECT
                    oi.order_id,
                    COALESCE(SUM(oi.quantity * COALESCE(p.overhead_expense, 0)), 0) AS landing_total
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                GROUP BY oi.order_id
            ) cogs ON cogs.order_id = o.id
        )
        SELECT
            ot.total_revenue,
            ot.total_received,
            ot.total_due,
            ot.total_write_off,
            pt.estimated_profit
        FROM order_totals ot
        CROSS JOIN profit_totals pt
    """
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (shop_id,))
                res = cur.fetchone() or {}
                return {
                    "total_revenue": float(res.get("total_revenue") or 0),
                    "total_received": float(res.get("total_received") or 0),
                    "total_due": float(res.get("total_due") or 0),
                    "total_write_off": float(res.get("total_write_off") or 0),
                    "estimated_profit": float(res.get("estimated_profit") or 0),
                }
    except Exception as e:
        logger.error(f"Error fetching order summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class QtyUpdate(BaseModel):
    order_id: str
    product_id: str
    change: int


class ItemMetadataUpdate(BaseModel):
    order_id: str
    product_id: str
    attribute_metadata: List[Dict[str, Any]]

class WriteOffRequest(BaseModel):
    order_id: str
    amount: float
    reason: Optional[str] = None
    notes: Optional[str] = None

@app.get("/audit/events/{shop_id}")
async def get_audit_events(
    shop_id: str,
    entity_type: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT id, entity_type, entity_id, action, actor_id, actor_email, source, notes, before, after, created_at
                    FROM audit_events
                    WHERE shop_id = %s
                """
                params = [shop_id]
                if entity_type:
                    query += " AND entity_type = %s"
                    params.append(entity_type)
                query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])
                cur.execute(query, tuple(params))
                rows = cur.fetchall()
                return rows
    except Exception as e:
        logger.error(f"Error fetching audit events: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

                cur.execute(
                    """
                    SELECT o.shop_id, o.status, o.client_name, p.item_code
                    FROM orders o
                    JOIN products p ON p.id = %s
                    WHERE o.id = %s
                    """,
                    (req.product_id, req.order_id),
                )
                order_row = cur.fetchone()

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

                if order_row and order_row.get("status") == "pi":
                    log_audit_event(
                        cur,
                        shop_id=str(order_row.get("shop_id")),
                        entity_type="order",
                        entity_id=str(req.order_id),
                        action="pi_edited",
                        before={"quantity": current_qty},
                        after={
                            "order_number": str(req.order_id)[:8].upper(),
                            "client_name": order_row.get("client_name"),
                            "item_code": order_row.get("item_code"),
                            "changes": [
                                {
                                    "field": "quantity",
                                    "label": "Quantity",
                                    "from": current_qty,
                                    "to": max(0, new_qty),
                                }
                            ],
                        },
                    )

                conn.commit()
                return {"status": "success", "new_qty": max(0, new_qty)}
                
    except Exception as e:
        logger.error(f"Update Qty Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/order/update-item-metadata")
async def update_order_item_metadata(req: ItemMetadataUpdate):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE order_items
                    SET attribute_metadata = %s, updated_at = NOW()
                    WHERE order_id = %s AND product_id = %s
                    """,
                    (json.dumps(req.attribute_metadata or []), req.order_id, req.product_id),
                )

                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Item not found")

                conn.commit()
                return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update item metadata error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/order/remove-item")
async def remove_order_item(order_id: str, product_id: str):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT o.shop_id, o.status, o.client_name, oi.quantity, p.item_code
                    FROM orders o
                    JOIN order_items oi ON oi.order_id = o.id AND oi.product_id = %s
                    JOIN products p ON p.id = %s
                    WHERE o.id = %s
                    """,
                    (product_id, product_id, order_id),
                )
                order_row = cur.fetchone()

                cur.execute(
                    "DELETE FROM order_items WHERE order_id = %s AND product_id = %s",
                    (order_id, product_id)
                )
                # Recalculate after item removal
                update_order_total(cur, order_id)

                if order_row and order_row.get("status") == "pi":
                    log_audit_event(
                        cur,
                        shop_id=str(order_row.get("shop_id")),
                        entity_type="order",
                        entity_id=str(order_id),
                        action="pi_edited",
                        before={"quantity": order_row.get("quantity")},
                        after={
                            "order_number": str(order_id)[:8].upper(),
                            "client_name": order_row.get("client_name"),
                            "item_code": order_row.get("item_code"),
                            "changes": [
                                {
                                    "field": "quantity",
                                    "label": "Quantity",
                                    "from": order_row.get("quantity"),
                                    "to": 0,
                                }
                            ],
                        },
                    )

                conn.commit()
                return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

def update_order_total(cur, order_id, final_total_override: Optional[float] = None):
    """Recalculates and persists the subtotal, discount, tax, and final total."""
    # 1. Calculate the raw subtotal from items
    cur.execute("SELECT SUM(total_price) as subtotal FROM order_items WHERE order_id = %s", (order_id,))
    res = cur.fetchone()
    subtotal = float(res['subtotal']) if res and res['subtotal'] else 0.0
    
    # 2. Fetch both discount and tax percentages for the order
    cur.execute("SELECT discount_percent, tax_percent, extra_discount_amount FROM orders WHERE id = %s", (order_id,))
    order_res = cur.fetchone()
    
    discount_percent = float(order_res['discount_percent']) if order_res else 0.0
    tax_percent = float(order_res['tax_percent']) if order_res else 0.0
    existing_extra_discount = float(order_res['extra_discount_amount']) if order_res and order_res['extra_discount_amount'] is not None else 0.0

    subtotal_int = max(0, int(round(subtotal)))
    base_discount_amount = float(math.floor(subtotal * (discount_percent / 100.0)))
    base_discount_int = max(0, int(round(base_discount_amount)))
    max_extra_discount = max(0, subtotal_int - base_discount_int)
    final_extra_discount_amount = float(max(0, min(max_extra_discount, int(math.floor(existing_extra_discount)))))

    if final_total_override is not None:
        target_final = max(0, int(round(float(final_total_override))))
        best_extra_discount = 0
        min_diff = float("inf")

        for extra_discount in range(0, max_extra_discount + 1):
            taxable_int = subtotal_int - base_discount_int - extra_discount
            tax_int = int(math.ceil(taxable_int * (tax_percent / 100.0)))
            computed_final = taxable_int + tax_int
            diff = abs(computed_final - target_final)

            if diff < min_diff or (diff == min_diff and extra_discount > best_extra_discount):
                min_diff = diff
                best_extra_discount = extra_discount
            if diff == 0:
                break

        discount_amount = base_discount_amount
        final_extra_discount_amount = float(best_extra_discount)
        taxable_amount = float(max(0, subtotal_int - base_discount_int - best_extra_discount))
        tax_amount = float(int(math.ceil(taxable_amount * (tax_percent / 100.0))))
        final_total = taxable_amount + tax_amount
    else:
        discount_amount = base_discount_amount
        taxable_amount = max(0.0, subtotal - discount_amount - final_extra_discount_amount)
        raw_tax = taxable_amount * (tax_percent / 100.0)
        tax_amount = float(math.ceil(raw_tax))
        final_total = taxable_amount + tax_amount
    
    # 4. Persist all values to the orders table
    cur.execute("""
        UPDATE orders 
        SET subtotal = %s, 
            discount_percent = %s,
            discount_amount = %s, 
            extra_discount_amount = %s,
            tax_amount = %s, 
            final_total = %s 
        WHERE id = %s
    """, (subtotal, discount_percent, discount_amount, final_extra_discount_amount, tax_amount, final_total, order_id))

@app.delete("/order/delete/{order_id}")
async def delete_order(order_id: str):
    try:
        uuid.UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid order_id format.")
    try:
        print(f"[delete_order] start order_id={order_id}")
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Verify status is deletable before allowing delete
                cur.execute("SELECT status, shop_id, client_name FROM orders WHERE id = %s", (order_id,))
                res = cur.fetchone()
                print(f"[delete_order] status={res}")
                if not res:
                    raise HTTPException(status_code=404, detail="Order not found.")
                if res['status'] not in {"bucket", "pi"}:
                    raise HTTPException(
                        status_code=400,
                        detail="Only draft carts (bucket) or proforma (pi) orders can be deleted.",
                    )

                # 2. Audit before delete (capture status without extra DB calls)
                log_audit_event(
                    cur,
                    shop_id=str(res.get("shop_id")),
                    entity_type="order",
                    entity_id=str(order_id),
                    action="order_delete",
                    before={"status": res.get("status"), "client_name": res.get("client_name")},
                    after=None,
                )

                # 3. Delete related rows first (guard against missing FK cascades)
                cur.execute("DELETE FROM payments WHERE order_id = %s", (order_id,))
                print(f"[delete_order] payments deleted={cur.rowcount}")
                cur.execute("DELETE FROM order_write_offs WHERE order_id = %s", (order_id,))
                print(f"[delete_order] write_offs deleted={cur.rowcount}")
                cur.execute("DELETE FROM order_items WHERE order_id = %s", (order_id,))
                print(f"[delete_order] items deleted={cur.rowcount}")
                
                # 4. Delete the order
                cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
                print(f"[delete_order] orders deleted={cur.rowcount}")
                
                conn.commit()
                print(f"[delete_order] success order_id={order_id}")
                return {"status": "success"}
    except HTTPException as e:
        # Preserve intended HTTP error codes (e.g., 400 for non-bucket deletes)
        raise e
    except Exception as e:
        import traceback
        print("Delete order failed:", order_id, "error:", repr(e))
        traceback.print_exc()
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
    tax_percent: Optional[float] = 0.0
    extra_discount_amount: Optional[float] = None
    paid_amount: float = 0.0
    final_total_override: Optional[float] = None
    referral_source: str = ""   
    delivery_address: str = "" 
    client_phone: str = ""     

@app.post("/order/update-status")
async def update_order_status(request: StatusUpdateRequest):
    # Establish connection to your PostgreSQL database
    conn = get_db_conn()
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT shop_id, status, discount_percent, extra_discount_amount, paid_amount, client_name FROM orders WHERE id = %s", (request.order_id,))
        before_order = cur.fetchone()
        if not before_order:
            raise HTTPException(status_code=404, detail="Order not found")

        # 2. Update the order status and discount in the database
        cur.execute("""
            UPDATE orders 
            SET status = %s, 
                discount_percent = %s,
                tax_percent = %s,
                extra_discount_amount = COALESCE(%s, extra_discount_amount),
                paid_amount = %s,
                referral_source = %s,
                delivery_address = %s,
                client_phone = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (request.status, request.discount_percent, request.tax_percent, request.extra_discount_amount, request.paid_amount, request.referral_source, request.delivery_address, request.client_phone, request.order_id))

        update_order_total(cur, request.order_id, request.final_total_override)
        
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Order not found")

        cur.execute("SELECT status, discount_percent, extra_discount_amount, final_total, paid_amount FROM orders WHERE id = %s", (request.order_id,))
        after_order = cur.fetchone()

        changes = _compute_changes(
            dict(before_order),
            dict(after_order) if after_order else {},
            fields=["status", "discount_percent", "extra_discount_amount", "paid_amount"],
            labels={
                "status": "Status",
                "discount_percent": "Discount %",
                "extra_discount_amount": "Extra Discount",
                "paid_amount": "Advance Paid",
            },
        )

        if request.status == "pi" and before_order.get("status") != "pi":
            log_audit_event(
                cur,
                shop_id=str(before_order.get("shop_id")),
                entity_type="order",
                entity_id=str(request.order_id),
                action="pi_created",
                before=dict(before_order),
                after={
                    "order_number": str(request.order_id)[:8].upper(),
                    "client_name": before_order.get("client_name"),
                    "changes": changes,
                },
            )
        elif before_order.get("status") == "pi":
            log_audit_event(
                cur,
                shop_id=str(before_order.get("shop_id")),
                entity_type="order",
                entity_id=str(request.order_id),
                action="pi_edited",
                before=dict(before_order),
                after={
                    "order_number": str(request.order_id)[:8].upper(),
                    "client_name": before_order.get("client_name"),
                    "changes": changes,
                },
            )
            
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
                cur.execute("SELECT shop_id, paid_amount FROM orders WHERE id = %s", (order_id,))
                order_row = cur.fetchone()
                if not order_row:
                    raise HTTPException(status_code=404, detail="Order not found")
                before_paid = float(order_row.get("paid_amount") or 0)

                # 1. Record the individual transaction
                cur.execute(
                    """
                    INSERT INTO payments (order_id, amount, payment_method, notes, transaction_date)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                    """,
                    (order_id, amount, method, notes),
                )

                # 2. Update the cached 'paid_amount' in orders table for quick UI loading
                cur.execute("""
                    UPDATE orders 
                    SET paid_amount = paid_amount + %s 
                    WHERE id = %s
                """, (amount, order_id))

                log_audit_event(
                    cur,
                    shop_id=str(order_row.get("shop_id")),
                    entity_type="order",
                    entity_id=str(order_id),
                    action="payment_recorded",
                    before={"paid_amount": before_paid},
                    after={"paid_amount": before_paid + amount, "payment_method": method, "payment_amount": amount},
                    notes=notes or None,
                )

                conn.commit()
                return {"status": "success", "amount_added": amount}
    except Exception as e:
        logger.error(f"Payment Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/order/write-off")
async def write_off_balance(req: WriteOffRequest):
    if req.amount is None or req.amount <= 0:
        raise HTTPException(status_code=400, detail="Write-off amount must be greater than 0")

    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT shop_id, final_total, paid_amount, write_off_amount
                    FROM orders
                    WHERE id = %s
                    """,
                    (req.order_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Order not found")

                shop_id = row.get("shop_id")
                final_total = float(row["final_total"] or 0)
                paid_amount = float(row["paid_amount"] or 0)
                existing_write_off = float(row["write_off_amount"] or 0)
                remaining_due = max(0.0, final_total - paid_amount - existing_write_off)

                if remaining_due <= 0:
                    raise HTTPException(status_code=400, detail="No remaining balance to write off")

                write_off_amount = min(float(req.amount), remaining_due)

                cur.execute(
                    """
                    INSERT INTO order_write_offs (order_id, amount, reason, notes, created_at)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                    """,
                    (req.order_id, write_off_amount, req.reason, req.notes),
                )

                cur.execute(
                    """
                    UPDATE orders
                    SET write_off_amount = COALESCE(write_off_amount, 0) + %s,
                        write_off_notes = %s
                    WHERE id = %s
                    """,
                    (write_off_amount, req.notes or "", req.order_id),
                )

                log_audit_event(
                    cur,
                    shop_id=str(shop_id),
                    entity_type="order",
                    entity_id=str(req.order_id),
                    action="write_off",
                    before={"write_off_amount": existing_write_off},
                    after={"write_off_amount": existing_write_off + write_off_amount, "write_off_delta": write_off_amount},
                    notes=req.notes or req.reason or None,
                )

                conn.commit()
                return {"status": "success", "amount_written_off": write_off_amount}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Write-off error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/order/write-offs/{order_id}")
async def get_order_write_offs(order_id: str):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, amount, reason, notes, created_at
                    FROM order_write_offs
                    WHERE order_id = %s
                    ORDER BY created_at DESC
                    """,
                    (order_id,),
                )
                rows = cur.fetchall()
                def normalize(row):
                    if isinstance(row, dict):
                        return {
                            "id": row.get("id"),
                            "amount": float(row.get("amount") or 0),
                            "reason": row.get("reason"),
                            "notes": row.get("notes"),
                            "created_at": row.get("created_at"),
                        }
                    return {
                        "id": row[0],
                        "amount": float(row[1] or 0),
                        "reason": row[2],
                        "notes": row[3],
                        "created_at": row[4],
                    }
                return [normalize(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching write-offs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/order/payments/{order_id}")
async def get_order_payments(order_id: str):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, amount, payment_method, notes, transaction_date
                    FROM payments
                    WHERE order_id = %s
                    ORDER BY transaction_date DESC
                    """,
                    (order_id,),
                )
                rows = cur.fetchall()
                def normalize(row):
                    if isinstance(row, dict):
                        return {
                            "id": row.get("id"),
                            "amount": float(row.get("amount") or 0),
                            "payment_method": row.get("payment_method"),
                            "notes": row.get("notes"),
                            "transaction_date": row.get("transaction_date"),
                        }
                    return {
                        "id": row[0],
                        "amount": float(row[1] or 0),
                        "payment_method": row[2],
                        "notes": row[3],
                        "transaction_date": row[4],
                    }
                return [normalize(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching payments: {e}")
        raise HTTPException(status_code=500, detail=str(e))
