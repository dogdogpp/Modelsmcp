"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    String,
    Float,
    Integer,
    DateTime,
    JSON,
    Enum,
    Index,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ModelMeta(Base):
    """Static model metadata (seeded from frontend models.ts)."""

    __tablename__ = "models"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=False, default="")
    description: Mapped[str] = mapped_column(String, nullable=False, default="")
    long_description: Mapped[str] = mapped_column(String, nullable=False, default="")
    params: Mapped[str] = mapped_column(String, nullable=False, default="")
    framework: Mapped[str] = mapped_column(String, nullable=False, default="")
    license: Mapped[str] = mapped_column(String, nullable=False, default="")
    color: Mapped[str] = mapped_column(String, nullable=False, default="#00d4ff")
    icon: Mapped[str] = mapped_column(String, nullable=False, default="")
    mcp_tool: Mapped[str] = mapped_column(String, nullable=False, default="")
    input_types: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    output_types: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    use_cases: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="online")
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    throughput_rps: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        onupdate=text("NOW()"),
    )


class Incident(Base):
    """System incidents and events."""

    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    time: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    msg: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(String, nullable=False, default="system")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )


class Metric(Base):
    """Time-series metrics (latency, throughput, system resources).

    Partitioned by `partition_key` (YYYY-MM) for efficient range queries.
    """

    __tablename__ = "metrics"
    __table_args__ = (
        Index("ix_metrics_timestamp", "timestamp"),
        Index("ix_metrics_type_name", "metric_type", "metric_name"),
        {"postgresql_partition_by": "RANGE (partition_key)"},
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    metric_type: Mapped[str] = mapped_column(String, nullable=False)
    metric_name: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    partition_key: Mapped[str] = mapped_column(String, primary_key=True)


class CommunicationLog(Base):
    """Subscription communication logs.

    Partitioned by `partition_key` (YYYY-MM-DD) for 7-day retention.
    """

    __tablename__ = "communication_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    model_id: Mapped[str] = mapped_column(String, nullable=False)
    model_name: Mapped[str] = mapped_column(String, nullable=False)
    direction: Mapped[str] = mapped_column(String, nullable=False)
    log_type: Mapped[str] = mapped_column("type", String, nullable=False)
    mode: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    payload_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    summary: Mapped[str] = mapped_column(String, nullable=False, default="")
    partition_key: Mapped[str] = mapped_column(String, primary_key=True)

    __table_args__ = (
        Index("ix_logs_timestamp", "timestamp"),
        Index("ix_logs_model_id", "model_id"),
        {"postgresql_partition_by": "RANGE (partition_key)"},
    )


class Subscription(Base):
    """Model subscriptions (manually maintained)."""

    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    model_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    subscribed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_latency_ms: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("NOW()"),
        onupdate=text("NOW()"),
    )


class SubscriptionAggregate(Base):
    """Pre-aggregated subscription metrics (latency distribution, mode ratios, throughput).

    Written by background job every METRICS_COLLECTION_INTERVAL seconds.
    """

    __tablename__ = "subscription_aggregates"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    metric_type: Mapped[str] = mapped_column(String, nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
