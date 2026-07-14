import psycopg
import urllib.parse
from psycopg.rows import dict_row
from pydantic_settings import BaseSettings, SettingsConfigDict
from fastapi import Depends

class Settings(BaseSettings):
    DB_USER: str
    DB_PASS: str
    DB_HOST: str
    DB_PORT: str
    DB_NAME: str
    FRONTEND_URL: str
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

def get_db():
    conn = None
    try:
        conn = get_db_conn() # Your existing connection logic
        yield conn
    finally:
        if conn:
            print("Cleanup: Closing database connection")
            conn.close() # SINGLE PLACE FOR ALL ROUTES

def get_db_conn():
    encoded_pass = urllib.parse.quote_plus(settings.DB_PASS)
    conn_str = f"postgresql://{settings.DB_USER}:{encoded_pass}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?sslmode=require"
    return psycopg.connect(conn_str, row_factory=dict_row, connect_timeout=10)
