"""PostgreSQL partition management utilities."""

from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def create_metric_partitions(engine: AsyncEngine, months: int = 3):
    """Create monthly partitions for the `metrics` table covering current month + N future months."""
    now = datetime.utcnow()
    async with engine.begin() as conn:
        for offset in range(-1, months):
            month_date = now + timedelta(days=offset * 30)
            partition_name = f"metrics_{month_date.strftime('%Y_%m')}"
            start_key = month_date.strftime("%Y-%m")
            # Calculate next month
            if month_date.month == 12:
                next_month = month_date.replace(year=month_date.year + 1, month=1)
            else:
                next_month = month_date.replace(month=month_date.month + 1)
            end_key = next_month.strftime("%Y-%m")

            # Create partition if not exists
            await conn.execute(
                text(
                    f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_class WHERE relname = '{partition_name}'
                        ) THEN
                            CREATE TABLE {partition_name} PARTITION OF metrics
                            FOR VALUES FROM ('{start_key}') TO ('{end_key}');
                        END IF;
                    END $$;
                    """
                )
            )


async def create_log_partitions(engine: AsyncEngine, days: int = 10):
    """Create daily partitions for the `communication_logs` table covering current day + N future days."""
    now = datetime.utcnow()
    async with engine.begin() as conn:
        for offset in range(-1, days):
            day_date = now + timedelta(days=offset)
            partition_name = f"communication_logs_{day_date.strftime('%Y_%m_%d')}"
            start_key = day_date.strftime("%Y-%m-%d")
            end_key = (day_date + timedelta(days=1)).strftime("%Y-%m-%d")

            await conn.execute(
                text(
                    f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_class WHERE relname = '{partition_name}'
                        ) THEN
                            CREATE TABLE {partition_name} PARTITION OF communication_logs
                            FOR VALUES FROM ('{start_key}') TO ('{end_key}');
                        END IF;
                    END $$;
                    """
                )
            )


async def drop_old_log_partitions(engine: AsyncEngine, retention_days: int):
    """Drop communication_logs partitions older than retention_days."""
    cutoff = (datetime.utcnow() - timedelta(days=retention_days)).strftime("%Y_%m_%d")
    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                SELECT relname FROM pg_class
                WHERE relname LIKE 'communication_logs_%'
                AND relname < :cutoff_name
                """
            ),
            {"cutoff_name": f"communication_logs_{cutoff}"},
        )
        rows = result.fetchall()
        for row in rows:
            partition_name = row[0]
            await conn.execute(text(f"DROP TABLE IF EXISTS {partition_name}"))


async def ensure_partitions(engine: AsyncEngine, retention_days: int = 7):
    """Idempotent partition creation + cleanup."""
    await create_metric_partitions(engine)
    await create_log_partitions(engine)
    await drop_old_log_partitions(engine, retention_days)
