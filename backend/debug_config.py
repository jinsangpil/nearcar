import sys
import os

# Add current directory to sys.path to ensure we can import app
sys.path.append(os.getcwd())

from app.core.config import settings

print(f"Current Working Directory: {os.getcwd()}")
print(f"DB_NAME from settings: {settings.DB_NAME}")
print(f"DATABASE_URL from settings: {settings.database_url}")
print(f"Environment variable DB_NAME: {os.environ.get('DB_NAME')}")
