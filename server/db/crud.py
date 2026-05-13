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
    for percentile, label in [(0.5, "p50_ms"), (0.95, "p95_ms"), (0.99, "p99_ms")]:
        # PostgreSQL percentile_cont
        result = await session.execute(
            select(
                func.percentile_cont(percentile).within_group(
                    CommunicationLog.latency_ms
                )
            ).where(CommunicationLog.timestamp >= cutoff)
        )
        val = result.scalar()
        if val is None:
            return {"p50_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0}
    # Re-run all three in one query for efficiency
    result = await session.execute(
        select(
            func.percentile_cont(0.5).within_group(CommunicationLog.latency_ms),
            func.percentile_cont(0.95).within_group(CommunicationLog.latency_ms),
            func.percentile_cont(0.99).within_group(CommunicationLog.latency_ms),
        ).where(CommunicationLog.timestamp >= cutoff)
    )
    row = result.one()
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
