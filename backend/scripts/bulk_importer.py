# # import os
# # import io
# # import urllib.parse
# # import psycopg2
# # import boto3
# # from botocore.client import Config
# # from openpyxl import load_workbook
# # from dotenv import load_dotenv
# # from pathlib import Path

# # # 1. Configuration & Path Setup
# # load_dotenv()
# # SCRIPT_DIR = Path(__file__).parent
# # EXCEL_PATH = SCRIPT_DIR / "TLC FULL RECORD.xlsx"

# # # Credentials from .env
# # PROJECT_ID = os.getenv("SUPABASE_PROJECT_ID")
# # SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
# # SHOP_ID = "102e6445-6462-4cb6-bcbf-e9dd43a70b7e" # Ensure this matches your DB

# # # 2. Database & S3 Connection Helpers
# # def get_db_conn():
# #     encoded_pass = urllib.parse.quote_plus(os.getenv("DB_PASS"))
# #     conn_str = f"postgresql://{os.getenv('DB_USER')}:{encoded_pass}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}?sslmode=require"
# #     return psycopg2.connect(conn_str)

# # def get_s3_client():
# #     project_id = os.getenv("SUPABASE_PROJECT_ID")
# #     access_key = os.getenv("S3_ACCESS_KEY")
# #     secret_key = os.getenv("S3_SECRET_KEY")

# #     # The endpoint remains the same
# #     endpoint = f"https://{project_id}.supabase.co/storage/v1/s3"
    
# #     return boto3.client(
# #         's3',
# #         endpoint_url=endpoint,
# #         aws_access_key_id=access_key,
# #         aws_secret_access_key=secret_key,
# #         config=Config(signature_version='s3v4'),
# #         region_name='ap-south-1' 
# #     )

# # def get_image_for_row(sheet, target_row):
# #     for image in sheet._images:
# #         row = image.anchor._from.row + 1
# #         col = image.anchor._from.col + 1
# #         if row == target_row and col == 3:
# #             return image
# #     return None

# # # 3. Execution Logic
# # def run_pilot_upload():
# #     conn = get_db_conn()
# #     s3 = get_s3_client()
# #     wb = load_workbook(EXCEL_PATH, data_only=True)
# #     sheet = wb.worksheets[0] # Explicitly use the first sheet
    
# #     print(f"🚀 Starting 3-row pilot upload to: product-images/102e6445-6462-4cb6-bcbf-e9dd43a70b7e/products/\n")

# #     try:
# #         for row_idx in range(2, 5): # Rows 2, 3, and 4
# #             item_code = sheet.cell(row=row_idx, column=2).value
# #             print(f"📦 Processing Row {row_idx}: {item_code}")
            
# #             img = get_image_for_row(sheet, row_idx)
# #             photo_url = None

# #             if img:
# #                 safe_name = f"{str(item_code).replace('/', '_')}.png"
# #                 storage_path = f"102e6445-6462-4cb6-bcbf-e9dd43a70b7e/products/{safe_name}"
# #                 image_data = io.BytesIO(img._data())
                
# #                 # Upload to Supabase Storage via S3
# #                 s3.put_object(
# #                     Bucket='product-images',
# #                     Key=storage_path,
# #                     Body=image_data.getvalue(),
# #                     ContentType='image/png'
# #                 )
# #                 # Construct Public URL
# #                 photo_url = f"https://{PROJECT_ID}.supabase.co/storage/v1/object/public/product-images/{storage_path}"
# #                 print(f"  ✅ Image Uploaded: {safe_name}")

# #             # Insert into Database
# #             with conn.cursor() as cur:
# #                 cur.execute("""
# #                     INSERT INTO products (shop_id, item_code, photo_url, qty_display, qty_godown, cost_price, overhead_expense, selling_price, vendor_name, remark)
# #                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
# #                 """, (
# #                     SHOP_ID, item_code, photo_url,
# #                     int(sheet.cell(row=row_idx, column=4).value or 0),
# #                     int(sheet.cell(row=row_idx, column=5).value or 0),
# #                     float(sheet.cell(row=row_idx, column=6).value or 0),
# #                     float(sheet.cell(row=row_idx, column=7).value or 0),
# #                     float(sheet.cell(row=row_idx, column=8).value or 0),
# #                     sheet.cell(row=row_idx, column=9).value,
# #                     sheet.cell(row=row_idx, column=10).value
# #                 ))
        
# #         conn.commit()
# #         print("\n✨ Pilot completed successfully! Check your Supabase Dashboard.")

# #     except Exception as e:
# #         print(f"\n❌ Error during pilot: {e}")
# #         conn.rollback()
# #     finally:
# #         conn.close()

# # if __name__ == "__main__":
# #     run_pilot_upload()


# import os
# import io
# import urllib.parse
# import psycopg2
# from psycopg2.extras import RealDictCursor
# import boto3
# from botocore.client import Config
# from openpyxl import load_workbook
# from dotenv import load_dotenv
# from pathlib import Path
# from tqdm import tqdm
# import re

# # 1. Configuration
# load_dotenv()
# SCRIPT_DIR = Path(__file__).parent
# EXCEL_PATH = SCRIPT_DIR / "RECORD OF NEW SHOWROOM_9.xlsx"
# SHOP_ID = "102e6445-6462-4cb6-bcbf-e9dd43a70b7e" # <--- YOUR SHOP ID

# # 2. Helpers
# def clean_filename(s):
#     """STRICT CLEANER: Removes everything except basic English letters, numbers, and dots."""
#     s = str(s).strip().replace('/', '_').replace(' ', '_')
#     # This regex removes Chinese characters, emojis, and symbols
#     # Keeping only: a-z, A-Z, 0-9, underscores, dots, and hyphens
#     return re.sub(r'[^a-zA-Z0-9\._-]', '_', s)

# def get_db_conn():
#     encoded_pass = urllib.parse.quote_plus(os.getenv("DB_PASS"))
#     conn_str = f"postgresql://{os.getenv('DB_USER')}:{encoded_pass}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}?sslmode=require"
#     return psycopg2.connect(conn_str, cursor_factory=RealDictCursor)

# def get_s3_client():
#     project_id = os.getenv("SUPABASE_PROJECT_ID")
#     endpoint = f"https://{project_id}.supabase.co/storage/v1/s3"
#     return boto3.client(
#         's3',
#         endpoint_url=endpoint,
#         aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
#         aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
#         config=Config(signature_version='s3v4'),
#         region_name='ap-south-1'
#     )

# def get_or_create_category(cur, sheet_name):
#     clean_name = sheet_name.strip().lower()
#     if clean_name == "CHANDELLIER": clean_name = "chandelier"
#     #clean_name = "wall light"
#     cur.execute("SELECT id FROM categories WHERE LOWER(name) = %s AND shop_id = %s", (clean_name, SHOP_ID))
#     result = cur.fetchone()
#     if result: return result['id']
#     cur.execute("INSERT INTO categories (name, shop_id) VALUES (%s, %s) RETURNING id", (clean_name, SHOP_ID))
#     return cur.fetchone()['id']

# # 3. Migration Logic
# def run_final_migration():
#     if not EXCEL_PATH.exists(): return print("❌ File not found")

#     print(f"📂 Loading Workbook into Memory...")
#     wb_images = load_workbook(EXCEL_PATH)
#     wb_values = load_workbook(EXCEL_PATH, data_only=True)
#     s3 = get_s3_client()
    
#     total_added = 0

#     for sheet_name in wb_values.sheetnames:
#         sheet_v = wb_values[sheet_name]
#         sheet_i = wb_images[sheet_name]
        
#         header = sheet_v.cell(row=1, column=2).value
#         if not header or str(header).strip().upper() != "CODE": continue

#         conn = get_db_conn()
#         try:
#             with conn.cursor() as cur:
#                 cat_id = get_or_create_category(cur, sheet_name)
#                 image_map = {}
#                 if hasattr(sheet_i, '_images'):
#                     for img in sheet_i._images:
#                         r = img.anchor._from.row + 1
#                         image_map[r] = io.BytesIO(img._data())

#                 print(f"\n🚀 Processing: {sheet_name.lower()}")
                
#                 for row_idx in tqdm(range(2, sheet_v.max_row + 1), desc="   Uploading"):
#                     code_cell = sheet_v.cell(row=row_idx, column=2).value
#                     if not code_cell: continue
                    
#                     item_code = str(code_cell).strip()
#                     img_data = image_map.get(row_idx) or image_map.get(row_idx-1) or image_map.get(row_idx+1)
#                     photo_url = None

#                     if img_data:
#                         safe_name = f"{clean_filename(item_code)}.png"
#                         storage_path = f"{SHOP_ID}/products/{safe_name}"
                        
#                         s3.put_object(
#                             Bucket='product-images',
#                             Key=storage_path,
#                             Body=img_data.getvalue(),
#                             ContentType='image/png'
#                         )
#                         photo_url = f"https://{os.getenv('SUPABASE_PROJECT_ID')}.supabase.co/storage/v1/object/public/product-images/{storage_path}"

#                     # UPSERT: Insert OR Update if item_code exists
#                     cur.execute("""
#                         INSERT INTO products (
#                             shop_id, category_id, item_code, photo_url, 
#                             qty_display, qty_godown, cost_price, 
#                             overhead_expense, selling_price, vendor_name, remark
#                         ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
#                         ON CONFLICT (shop_id, item_code) 
#                         DO UPDATE SET 
#                             photo_url = COALESCE(EXCLUDED.photo_url, products.photo_url),
#                             selling_price = EXCLUDED.selling_price,
#                             qty_display = EXCLUDED.qty_display,
#                             qty_godown = EXCLUDED.qty_godown,
#                             cost_price = EXCLUDED.cost_price;
#                     """, (
#                         SHOP_ID, cat_id, item_code, photo_url,
#                         int(sheet_v.cell(row=row_idx, column=4).value or 0),
#                         int(sheet_v.cell(row=row_idx, column=5).value or 0),
#                         float(sheet_v.cell(row=row_idx, column=6).value or 0),
#                         float(sheet_v.cell(row=row_idx, column=7).value or 0),
#                         float(sheet_v.cell(row=row_idx, column=8).value or 0),
#                         sheet_v.cell(row=row_idx, column=9).value,
#                         sheet_v.cell(row=row_idx, column=10).value
#                     ))
#                     total_added += 1
                
#                 conn.commit()
#                 print(f"✅ Finished {sheet_name}. Progress saved.")

#         except Exception as e:
#             print(f"❌ Error in {sheet_name}: {e}")
#             conn.rollback()
#         finally:
#             conn.close()

#     print(f"\n✨ COMPLETE: All items imported/updated.")

# if __name__ == "__main__":
#     run_final_migration()