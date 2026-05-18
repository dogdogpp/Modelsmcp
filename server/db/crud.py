"""CRUD helpers for DB operations."""

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    ModelMeta,
    Incident,
    Metric,
    CommunicationLog,
    Subscription,
    SubscriptionAggregate,
)


# ---------------------------------------------------------------------------
# Incidents
# ---------------------------------------------------------------------------

async def get_incidents(session: AsyncSession, limit: int = 50) -> list[Incident]:
    result = await session.execute(
        select(Incident).order_by(desc(Incident.created_at)).limit(limit)
    )
    return list(result.scalars().all())


async def create_incident(session: AsyncSession, **kwargs: Any) -> Incident:
    incident = Incident(**kwargs)
    session.add(incident)
    await session.commit()
    await session.refresh(incident)
    return incident


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

async def get_metrics_history(
    session: AsyncSession,
    metric_type: str,
    metric_name: str | None = None,
    hours: int = 24,
) -> list[Metric]:
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    stmt = select(Metric).where(
        Metric.metric_type == metric_type,
        Metric.timestamp >= cutoff,
    ).order_by(Metric.timestamp)
    if metric_name:
        stmt = stmt.where(Metric.metric_name == metric_name)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def create_metric(session: AsyncSession, **kwargs: Any) -> Metric:
    metric = Metric(**kwargs)
    session.add(metric)
    await session.commit()
    await session.refresh(metric)
    return metric


async def create_metrics_batch(session: AsyncSession, metrics: list[dict[str, Any]]) -> None:
    session.add_all([Metric(**m) for m in metrics])
    await session.commit()


# ---------------------------------------------------------------------------
# Model performance
# ---------------------------------------------------------------------------

async def get_models_performance(session: AsyncSession) -> list[ModelMeta]:
    result = await session.execute(select(ModelMeta).order_by(ModelMeta.name))
    return list(result.scalars().all())


async def update_model_performance(
    session: AsyncSession,
    model_id: str,
    latency_ms: float,
    throughput_rps: float,
    status: str | None = None,
) -> None:
    result = await session.execute(select(ModelMeta).where(ModelMeta.id == model_id))
    model = result.scalar_one_or_none()
    if model:
        model.latency_ms = latency_ms
        model.throughput_rps = throughput_rps
        if status:
            model.status = status
        model.updated_at = datetime.utcnow()
        await session.commit()


# ---------------------------------------------------------------------------
# Model lookup by MCP tool name
# ---------------------------------------------------------------------------

async def get_model_meta_by_mcp_tool(session: AsyncSession, mcp_tool: str) -> ModelMeta | None:
    result = await session.execute(select(ModelMeta).where(ModelMeta.mcp_tool == mcp_tool))
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Communication logs
# ---------------------------------------------------------------------------

async def get_communication_logs(
    session: AsyncSession,
    limit: int = 50,
    days: int = 7,
) -> list[CommunicationLog]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await session.execute(
        select(CommunicationLog)
        .where(CommunicationLog.timestamp >= cutoff)
        .order_by(desc(CommunicationLog.timestamp))
        .limit(limit)
    )
    return list(result.scalars().all())


async def create_communication_log(session: AsyncSession, **kwargs: Any) -> CommunicationLog:
    log = CommunicationLog(**kwargs)
    session.add(log)
    await session.commit()
    await session.refresh(log)
    return log


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------

async def get_subscriptions(session: AsyncSession) -> list[Subscription]:
    result = await session.execute(select(Subscription).order_by(Subscription.created_at))
    return list(result.scalars().all())


async def create_subscription(session: AsyncSession, **kwargs: Any) -> Subscription:
    sub = Subscription(**kwargs)
    session.add(sub)
    await session.commit()
    await session.refresh(sub)
    return sub


async def upsert_subscription_stats(
    session: AsyncSession,
    model_id: str,
    model_name: str,
    latency_ms: float,
    success: bool,
) -> Subscription:
    """Update subscription stats or create a new one. Does NOT commit."""
    result = await session.execute(select(Subscription).where(Subscription.model_id == model_id))
    sub: Subscription | None = result.scalar_one_or_none()
    now = datetime.utcnow()
    if sub is None:
        sub = Subscription(
            id=f"sub-{model_id}",
            model_id=model_id,
            model_name=model_name,
            status="active",
            subscribed_at=now,
            last_active_at=now,
            total_calls=1,
            success_rate=1.0 if success else 0.0,
            avg_latency_ms=round(latency_ms, 2),
        )
        session.add(sub)
    else:
        sub.total_calls += 1
        # Cumulative moving average for success_rate and avg_latency_ms
        prev_calls = sub.total_calls - 1
        sub.success_rate = round(
            (sub.success_rate * prev_calls + (1.0 if success else 0.0)) / sub.total_calls, 4
        )
        sub.avg_latency_ms = round(
            (sub.avg_latency_ms * prev_calls + latency_ms) / sub.total_calls, 2
        )
        sub.last_active_at = now
    return sub


# ---------------------------------------------------------------------------
# Subscription aggregates
# ---------------------------------------------------------------------------

async def get_latest_subscription_aggregates(
    session: AsyncSession,
) -> list[SubscriptionAggregate]:
    """Return the most recent aggregate row for each metric_type."""
    subq = (
        select(
            SubscriptionAggregate.metric_type,
            func.max(SubscriptionAggregate.timestamp).label("max_ts"),
        )
        .group_by(SubscriptionAggregate.metric_type)
        .subquery()
    )
    result = await session.execute(
        select(SubscriptionAggregate)
        .join(
            subq,
            (SubscriptionAggregate.metric_type == subq.c.metric_type)
            & (SubscriptionAggregate.timestamp == subq.c.max_ts),
        )
    )
    return list(result.scalars().all())


async def create_subscription_aggregate(
    session: AsyncSession, **kwargs: Any
) -> SubscriptionAggregate:
    agg = SubscriptionAggregate(**kwargs)
    session.add(agg)
    await session.commit()
    await session.refresh(agg)
    return agg


# ---------------------------------------------------------------------------
# Stats helpers
# ---------------------------------------------------------------------------

async def get_latency_distribution(session: AsyncSession, days: int = 7) -> dict[str, float]:
    """Compute P50/P95/P99 from communication_logs latency_ms."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await session.execute(
        select(
            func.percentile_cont(0.5).within_group(CommunicationLog.latency_ms),
            func.percentile_cont(0.95).within_group(CommunicationLog.latency_ms),
            func.percentile_cont(0.99).within_group(CommunicationLog.latency_ms),
        ).where(CommunicationLog.timestamp >= cutoff)
    )
    row = result.one()
    if row[0] is None:
        return {"p50_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0}
    return {"p50_ms": round(row[0] or 0.0, 2), "p95_ms": round(row[1] or 0.0, 2), "p99_ms": round(row[2] or 0.0, 2)}


async def get_mode_ratios(session: AsyncSession, days: int = 7) -> list[dict[str, Any]]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    result = await session.execute(
        select(
            CommunicationLog.mode,
            func.count().label("count"),
        )
        .where(CommunicationLog.timestamp >= cutoff)
        .group_by(CommunicationLog.mode)
        .order_by(desc("count"))
    )
    rows = result.all()
    total = sum(r[1] for r in rows) or 1
    return [
        {"mode": r[0], "count": r[1], "percentage": round(r[1] / total * 100, 1)}
        for r in rows
    ]
