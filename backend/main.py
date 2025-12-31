import os
import urllib
from fastapi import FastAPI, Query
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
    shop_id: str
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
                if not res: return {"error": "Product not found"}
                price = res['selling_price']

                # 2. Get or Create Bucket Order
                cur.execute("""
                    SELECT id FROM orders 
                    WHERE shop_id = %s AND status = 'bucket' 
                    ORDER BY created_at DESC LIMIT 1
                """, (item.shop_id,))
                order = cur.fetchone()
                
                if not order:
                    cur.execute("INSERT INTO orders (shop_id, status) VALUES (%s, 'bucket') RETURNING id", (item.shop_id,))
                    order_id = cur.fetchone()['id']
                else:
                    order_id = order['id']

                # 3. Upsert Order Item
                cur.execute("""
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (order_id, product_id) DO UPDATE 
                    SET quantity = order_items.quantity + EXCLUDED.quantity
                """, (order_id, item.product_id, item.qty, price))
                
                conn.commit()
                return {"status": "success"}
    except Exception as e:
        return {"error": str(e)}

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
        
# 4. Mount the frontend LAST
# This is a "catch-all". If you put it at the top, it might block your API routes.
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/manifest+json', '.json')
# app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")        