import os
from typing import List


DEEPMCP_API_KEY: str = os.getenv("DEEPMCP_API_KEY", "")

CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://deepmcp.example.com",
]

SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8080"))
