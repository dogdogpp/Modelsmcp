"""Async database engine and session factory."""

import sys
from pathlib import Path

# Allow `import config` when this module is imported from outside server/
_db_dir = Path(__file__).resolve().parent
_server_dir = _db_dir.parent
if str(_server_dir) not in sys.path:
    sys.path.insert(0, str(_server_dir))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from config import DATABASE_URL, DB_POOL_SIZE, DB_MAX_OVERFLOW

engine = create_async_engine(
    DATABASE_URL,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a DB session."""
    async with AsyncSessionLocal() as session:
        yield session
