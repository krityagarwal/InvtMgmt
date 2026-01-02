import os
import urllib
from fastapi import FastAPI, Query
from fastapi import Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional
import psycopg2  # <--- This is the missing line
from psycopg2.extras import RealDictCursor
import urllib.parse
from fastapi.staticfiles import StaticFiles
import mimetypes
from pydantic_settings import BaseSettings, SettingsConfigDict
from fastapi import HTTPException
import logging

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
    "http://localhost:5500",      # Local Live Server
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

def get_db_conn():
    # You must access them from the 'settings' object you created above
    encoded_pass = urllib.parse.quote_plus(settings.DB_PASS)
    
    conn_str = f"postgresql://{settings.DB_USER}:{encoded_pass}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?sslmode=require"
    
    return psycopg2.connect(
        conn_str, 
        cursor_factory=RealDictCursor,
        connect_timeout=10
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
    query = """
        SELECT 
            p.id, p.item_code, p.photo_url, p.cost_price, p.selling_price, p.vendor_name, p.remark,
            c.name as category_name,
            i.qty_display, i.qty_godown
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.shop_id = %s
    """
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (shop_id,))
                return cur.fetchall()
    except Exception as e:
        return {"error": str(e)}


class BasketItem(BaseModel):
    order_id: str  # Changed from shop_id to order_id
    product_id: str
    qty: int = 1

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
                # We use ON CONFLICT to increase quantity if the item is already in the basket
                cur.execute("""
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (order_id, product_id) DO UPDATE 
                    SET quantity = order_items.quantity + EXCLUDED.quantity
                """, (item.order_id, item.product_id, item.qty, price))
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
    query = """
        SELECT p.*, c.name as category_name, i.qty_display, i.qty_godown
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.item_code = %s
        LIMIT 1
    """
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (item_code,))
            res = cur.fetchone()
            if res is None:
                return {"error": "not_found"} # Always return a dictionary
            return res    
            
class BasketCreate(BaseModel):
    shop_id: str
    client_name: str

@app.post("/basket/create")
async def create_basket(req: BasketCreate = Body(...)):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # Use req.shop_id and req.client_name instead of just shop_id/client_name
                # 1. Create or find client
                cur.execute(
                    "INSERT INTO clients (shop_id, name) VALUES (%s, %s) RETURNING id", 
                    (req.shop_id, req.client_name)
                )
                client_id = cur.fetchone()['id']
                
                # 2. Create the Order (Basket)
                cur.execute("""
                    INSERT INTO orders (shop_id, client_id, status, discount_percent, final_total) 
                    VALUES (%s, %s, 'bucket', 0, 0) RETURNING id
                """, (req.shop_id, client_id))
                
                new_id = cur.fetchone()['id']
                conn.commit()
                
                # Return the new ID and the name from the request
                return {"order_id": new_id, "client_name": req.client_name}
    except Exception as e:
        # It's helpful to print the error to your terminal for debugging
        print(f"Error creating basket: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/order/finalize")
async def finalize_order(order_id: str):
    # This logic moves status from 'pi' or 'bucket' to 'sold'
    # and executes the Godown -> Display waterfall deduction.
    query_items = "SELECT product_id, quantity FROM order_items WHERE order_id = %s"
    
    with get_db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(query_items, (order_id,))
            items = cur.fetchall()
            
            for item in items:
                # Waterfall Deduction Logic
                cur.execute("SELECT qty_godown, qty_display FROM inventory WHERE product_id = %s", (item['product_id'],))
                stock = cur.fetchone()
                
                if stock['qty_godown'] >= item['quantity']:
                    cur.execute("UPDATE inventory SET qty_godown = qty_godown - %s WHERE product_id = %s", 
                                (item['quantity'], item['product_id']))
                else:
                    rem = item['quantity'] - stock['qty_godown']
                    cur.execute("UPDATE inventory SET qty_godown = 0, qty_display = qty_display - %s WHERE product_id = %s", 
                                (rem, item['product_id']))
            
            cur.execute("UPDATE orders SET status = 'sold' WHERE id = %s", (order_id,))
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
    # CRITICAL: Added oi.product_id to the SELECT statement
    query_items = """
        SELECT 
            oi.product_id, 
            oi.quantity, 
            oi.unit_price, 
            p.item_code
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = %s
    """
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query_items, (order_id,))
                items = cur.fetchall()
                
                # Also fetch the current discount for the UI
                cur.execute("SELECT status, discount_percent FROM orders WHERE id = %s", (order_id,))
                order_data = cur.fetchone()
                
                return {
                    "order_items": items if items else [],
                    "status": order_data['status'],
                    "discount_percent": order_data['discount_percent'] if order_data else 0
                }
    except Exception as e:
        logger.error(f"Error fetching basket details: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
async def get_basket_details(order_id: str):
    # Query to get items specifically for the requested order/basket
    query_items = """
        SELECT oi.quantity, oi.unit_price, p.item_code, o.discount_percent
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.order_id = %s
    """
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query_items, (order_id,))
                items = cur.fetchall()
                
                # If no items found, return an empty list instead of None
                return {"order_items": items if items else []}
    except Exception as e:
        logger.error(f"Error fetching basket details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/orders/list/{shop_id}")
async def list_orders(shop_id: str):
    # This query joins orders with clients to show names in the list
    query = """
        SELECT o.id, o.status, o.final_total, o.created_at, o.discount_percent,
               c.name as client_name
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.id
        WHERE o.shop_id = %s
        ORDER BY o.created_at DESC
    """
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (shop_id,))
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
                # REMOVED manual update of total_price because it is a GENERATED column
                cur.execute("""
                    UPDATE order_items 
                    SET quantity = quantity + %s
                    WHERE order_id = %s AND product_id = %s
                    RETURNING quantity
                """, (req.change, req.order_id, req.product_id))
                
                res = cur.fetchone()
                
                # Logic: Remove item if qty hits 0
                if res and res['quantity'] <= 0:
                    cur.execute("DELETE FROM order_items WHERE order_id = %s AND product_id = %s", 
                                (req.order_id, req.product_id))
                # Recalculate after adding new item
                update_order_total(cur, req.order_id)
                conn.commit()
                return {"status": "success"}
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
async def finalize_sale(order_id: str):
    try:
        with get_db_conn() as conn:
            with conn.cursor() as cur:
                # 1. Fetch all items in this PI
                cur.execute("SELECT product_id, quantity FROM order_items WHERE order_id = %s", (order_id,))
                items = cur.fetchall()

                for item in items:
                    pid = item['product_id']
                    qty_needed = item['quantity']

                    # 2. Check current stock levels
                    cur.execute("SELECT qty_godown, qty_display FROM inventory WHERE product_id = %s", (pid,))
                    stock = cur.fetchone()

                    # 3. Waterfall Logic: Godown first, then Display
                    if stock['qty_godown'] >= qty_needed:
                        cur.execute("UPDATE inventory SET qty_godown = qty_godown - %s WHERE product_id = %s", (qty_needed, pid))
                    else:
                        remaining = qty_needed - stock['qty_godown']
                        cur.execute("UPDATE inventory SET qty_godown = 0, qty_display = qty_display - %s WHERE product_id = %s", (remaining, pid))

                # 4. Update order to 'sold'
                cur.execute("UPDATE orders SET status = 'sold', updated_at = NOW() WHERE id = %s", (order_id,))
                conn.commit()
                return {"status": "success", "message": "Sale finalized and stock updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))    
    
def update_order_total(cur, order_id):
    """Recalculates and persists the order total based on items and discount."""
    # 1. Sum up all individual item totals (generated columns)
    cur.execute("SELECT SUM(total_price) as subtotal FROM order_items WHERE order_id = %s", (order_id,))
    res = cur.fetchone()
    subtotal = res['subtotal'] if res and res['subtotal'] else 0
    
    # 2. Fetch the current discount percentage for this specific order
    cur.execute("SELECT discount_percent FROM orders WHERE id = %s", (order_id,))
    order_res = cur.fetchone()
    discount = order_res['discount_percent'] if order_res else 0
    
    # 3. Calculate final amount and persist it to the orders table
    final_total = float(subtotal) * (1 - (float(discount) / 100))
    cur.execute("UPDATE orders SET final_total = %s WHERE id = %s", (final_total, order_id))    

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

# 4. Mount the frontend LAST
# This is a "catch-all". If you put it at the top, it might block your API routes.
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/manifest+json', '.json')
# app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")        




