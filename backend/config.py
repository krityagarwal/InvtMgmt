import psycopg2
import urllib.parse
from psycopg2.extras import RealDictCursor
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DB_USER: str
    DB_PASS: str
    DB_HOST: str
    DB_PORT: str
    DB_NAME: str
    FRONTEND_URL: str
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

def get_db_conn():
    encoded_pass = urllib.parse.quote_plus(settings.DB_PASS)
    conn_str = f"postgresql://{settings.DB_USER}:{encoded_pass}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}?sslmode=require"
    return psycopg2.connect(conn_str, cursor_factory=RealDictCursor, connect_timeout=10)
