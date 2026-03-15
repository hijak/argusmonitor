import random
import math
from uuid import UUID
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Dashboard, Host, HostMetric, Service, Transaction, AlertInstance, User
from app.schemas import DashboardCreate, DashboardOut
from app.auth import get_current_user

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("", response_model=list[DashboardOut])
async def list_dashboards(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Dashboard).order_by(Dashboard.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=DashboardOut, status_code=201)
async def create_dashboard(
    req: DashboardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dashboard = Dashboard(**req.model_dump())
    db.add(dashboard)
    await db.flush()
    await db.refresh(dashboard)
    return dashboard


@router.get("/{dashboard_id}", response_model=DashboardOut)
async def get_dashboard(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.delete("/{dashboard_id}", status_code=204)
async def delete_dashboard(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    await db.delete(dashboard)


def _ts_range(points: int = 24):
    now = datetime.now(timezone.utc)
    return [now - timedelta(hours=points - 1 - i) for i in range(points)]


def _fmt(dt: datetime) -> str:
    return dt.strftime("%H:%M")


@router.get("/{dashboard_id}/widgets")
async def get_dashboard_widgets(
    dashboard_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    config = dashboard.config or {}
    preset = config.get("preset", dashboard.name)
    widgets = await _build_widgets(preset, db)
    return widgets


async def _build_widgets(preset: str, db: AsyncSession) -> list[dict]:
    if "Alert" in preset or "alert" in preset:
        return await _alert_hosts_widgets(db)
    elif "Infrastructure" in preset:
        return await _infra_widgets(db)
    elif "API" in preset or "Performance" in preset:
        return await _api_widgets(db)
    elif "Transaction" in preset:
        return await _tx_widgets(db)
    elif "Database" in preset:
        return await _db_widgets(db)
    elif "Network" in preset:
        return await _network_widgets(db)
    elif "SLA" in preset:
        return await _sla_widgets(db)
    else:
        return await _infra_widgets(db)


async def _infra_widgets(db: AsyncSession) -> list[dict]:
    hosts_result = await db.execute(select(Host).order_by(Host.name))
    hosts = hosts_result.scalars().all()
    ts = _ts_range(24)

    cpu_series = []
    for h in hosts:
        base = h.cpu_percent
        cpu_series.append({
            "id": str(h.id),
            "name": h.name,
            "status": h.status,
            "type": h.type,
            "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-12, 8) * math.sin(i / 3))), 1)} for i, t in enumerate(ts)],
        })

    mem_series = []
    for h in hosts:
        base = h.memory_percent
        mem_series.append({
            "id": str(h.id),
            "name": h.name,
            "status": h.status,
            "type": h.type,
            "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-5, 5))), 1)} for i, t in enumerate(ts)],
        })

    disk_nodes = []
    for h in hosts:
        disk_nodes.append({
            "id": str(h.id),
            "name": h.name,
            "status": h.status,
            "type": h.type,
            "current": round(h.disk_percent, 1),
            "data": [{"time": _fmt(t), "value": round(h.disk_percent + random.uniform(-1, 1), 1)} for t in ts],
        })

    status_counts = {"healthy": 0, "warning": 0, "critical": 0, "unknown": 0}
    for h in hosts:
        status_counts[h.status] = status_counts.get(h.status, 0) + 1

    host_table = []
    for h in hosts:
        host_table.append({
            "id": str(h.id),
            "name": h.name,
            "type": h.type,
            "status": h.status,
            "ip": h.ip_address,
            "cpu": round(h.cpu_percent, 1),
            "mem": round(h.memory_percent, 1),
            "disk": round(h.disk_percent, 1),
            "uptime": h.uptime or "N/A",
            "os": h.os or "N/A",
            "tags": h.tags or [],
        })

    return [
        {"id": "w1", "type": "line_chart", "title": "CPU Usage Over Time", "size": "large", "nodes": cpu_series},
        {"id": "w2", "type": "line_chart", "title": "Memory Usage Over Time", "size": "large", "nodes": mem_series},
        {"id": "w3", "type": "bar_chart", "title": "Disk Usage by Host", "size": "medium", "nodes": disk_nodes},
        {"id": "w4", "type": "pie_chart", "title": "Host Status Distribution", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
        {"id": "w5", "type": "gauge_grid", "title": "Current CPU", "size": "medium", "nodes": [{"id": s["id"], "name": s["name"], "status": s["status"], "value": s["current"], "label": "CPU %"} for s in cpu_series]},
        {"id": "w6", "type": "gauge_grid", "title": "Current Memory", "size": "medium", "nodes": [{"id": s["id"], "name": s["name"], "status": s["status"], "value": s["current"], "label": "MEM %"} for s in mem_series]},
        {"id": "w7", "type": "stat_row", "title": "Quick Stats", "size": "full", "stats": [
            {"label": "Total Hosts", "value": len(hosts)},
            {"label": "Healthy", "value": status_counts.get("healthy", 0)},
            {"label": "Warning", "value": status_counts.get("warning", 0)},
            {"label": "Critical", "value": status_counts.get("critical", 0)},
        ]},
        {"id": "w8", "type": "table", "title": "Host Inventory", "size": "full", "rows": host_table},
    ]


async def _api_widgets(db: AsyncSession) -> list[dict]:
    svcs_result = await db.execute(select(Service).order_by(Service.name))
    svcs = svcs_result.scalars().all()
    ts = _ts_range(24)

    latency_nodes = []
    for s in svcs:
        base = s.latency_ms
        latency_nodes.append({
            "id": str(s.id),
            "name": s.name,
            "status": s.status,
            "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(1, base + random.uniform(-20, 20) * math.sin(i / 4)), 1)} for i, t in enumerate(ts)],
        })

    rps_nodes = []
    for s in svcs:
        base = s.requests_per_min
        rps_nodes.append({
            "id": str(s.id),
            "name": s.name,
            "status": s.status,
            "current": round(base, 0),
            "data": [{"time": _fmt(t), "value": round(max(0, base + random.uniform(-200, 200)), 0)} for i, t in enumerate(ts)],
        })

    error_nodes = []
    for s in svcs:
        base_err = 100 - s.uptime_percent
        error_nodes.append({
            "id": str(s.id),
            "name": s.name,
            "status": s.status,
            "current": round(base_err, 2),
            "data": [{"time": _fmt(t), "value": round(max(0, base_err + random.uniform(-0.5, 0.5)), 2)} for i, t in enumerate(ts)],
        })

    svc_table = []
    for s in svcs:
        svc_table.append({
            "id": str(s.id), "name": s.name, "status": s.status,
            "latency": round(s.latency_ms, 1), "uptime": s.uptime_percent,
            "rps": round(s.requests_per_min, 0), "endpoints": s.endpoints_count,
        })

    return [
        {"id": "w1", "type": "line_chart", "title": "Response Latency (ms)", "size": "large", "nodes": latency_nodes},
        {"id": "w2", "type": "area_chart", "title": "Requests per Minute", "size": "large", "nodes": rps_nodes},
        {"id": "w3", "type": "line_chart", "title": "Error Rate (%)", "size": "medium", "nodes": error_nodes},
        {"id": "w4", "type": "gauge_grid", "title": "Current Latency", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "ms"} for n in latency_nodes]},
        {"id": "w5", "type": "stat_row", "title": "Service Overview", "size": "full", "stats": [
            {"label": "Total Services", "value": len(svcs)},
            {"label": "Avg Latency", "value": f"{round(sum(s.latency_ms for s in svcs) / max(len(svcs),1), 0)}ms"},
            {"label": "Total RPS", "value": f"{round(sum(s.requests_per_min for s in svcs), 0)}"},
            {"label": "Healthy", "value": sum(1 for s in svcs if s.status == "healthy")},
        ]},
        {"id": "w6", "type": "table", "title": "Service Details", "size": "full", "rows": svc_table},
    ]


async def _tx_widgets(db: AsyncSession) -> list[dict]:
    txs_result = await db.execute(select(Transaction).order_by(Transaction.name))
    txs = txs_result.scalars().all()
    ts = _ts_range(24)

    success_nodes = []
    for tx in txs:
        base = tx.success_rate
        success_nodes.append({
            "id": str(tx.id), "name": tx.name, "status": tx.status,
            "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(80, min(100, base + random.uniform(-2, 1))), 1)} for i, t in enumerate(ts)],
        })

    dur_nodes = []
    for tx in txs:
        base = tx.avg_duration_ms
        dur_nodes.append({
            "id": str(tx.id), "name": tx.name, "status": tx.status,
            "current": round(base, 0),
            "data": [{"time": _fmt(t), "value": round(max(50, base + random.uniform(-300, 300)), 0)} for i, t in enumerate(ts)],
        })

    status_counts = {"healthy": 0, "warning": 0, "critical": 0}
    for tx in txs:
        status_counts[tx.status] = status_counts.get(tx.status, 0) + 1

    return [
        {"id": "w1", "type": "line_chart", "title": "Success Rate Over Time (%)", "size": "large", "nodes": success_nodes},
        {"id": "w2", "type": "area_chart", "title": "Duration Over Time (ms)", "size": "large", "nodes": dur_nodes},
        {"id": "w3", "type": "pie_chart", "title": "Transaction Health", "size": "small", "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
        {"id": "w4", "type": "gauge_grid", "title": "Current Success Rates", "size": "medium", "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in success_nodes]},
        {"id": "w5", "type": "stat_row", "title": "Transaction Summary", "size": "full", "stats": [
            {"label": "Total Monitors", "value": len(txs)},
            {"label": "Avg Success", "value": f"{round(sum(tx.success_rate for tx in txs) / max(len(txs),1), 1)}%"},
            {"label": "Avg Duration", "value": f"{round(sum(tx.avg_duration_ms for tx in txs) / max(len(txs),1), 0)}ms"},
            {"label": "Healthy", "value": status_counts.get("healthy", 0)},
        ]},
    ]


async def _db_widgets(db: AsyncSession) -> list[dict]:
    hosts_result = await db.execute(select(Host).where(Host.type == "database").order_by(Host.name))
    hosts = hosts_result.scalars().all()
    ts = _ts_range(24)

    cpu_nodes = []
    for h in hosts:
        base = h.cpu_percent
        cpu_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "type": "database", "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-10, 10))), 1)} for i, t in enumerate(ts)],
        })

    conn_nodes = []
    for h in hosts:
        base_conn = random.randint(30, 180)
        conn_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "current": base_conn,
            "data": [{"time": _fmt(t), "value": max(0, base_conn + random.randint(-20, 20))} for t in ts],
        })

    query_nodes = []
    for h in hosts:
        base_qps = random.randint(500, 3000)
        query_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "current": base_qps,
            "data": [{"time": _fmt(t), "value": max(0, base_qps + random.randint(-500, 500))} for t in ts],
        })

    repl_data = [{"time": _fmt(t), "value": round(random.uniform(0, 8), 1)} for t in ts]

    return [
        {"id": "w1", "type": "line_chart", "title": "Database CPU Usage", "size": "large", "nodes": cpu_nodes},
        {"id": "w2", "type": "area_chart", "title": "Active Connections", "size": "large", "nodes": conn_nodes},
        {"id": "w3", "type": "line_chart", "title": "Queries Per Second", "size": "medium", "nodes": query_nodes},
        {"id": "w4", "type": "line_chart", "title": "Replication Lag (s)", "size": "medium",
         "nodes": [{"id": "repl", "name": "Replication Lag", "status": "warning", "current": repl_data[-1]["value"], "data": repl_data}]},
        {"id": "w5", "type": "gauge_grid", "title": "Current CPU", "size": "medium",
         "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "CPU %"} for n in cpu_nodes]},
        {"id": "w6", "type": "stat_row", "title": "Database Summary", "size": "full", "stats": [
            {"label": "DB Hosts", "value": len(hosts)},
            {"label": "Avg CPU", "value": f"{round(sum(h.cpu_percent for h in hosts) / max(len(hosts),1), 0)}%"},
            {"label": "Avg Memory", "value": f"{round(sum(h.memory_percent for h in hosts) / max(len(hosts),1), 0)}%"},
            {"label": "Healthy", "value": sum(1 for h in hosts if h.status == "healthy")},
        ]},
        {"id": "w7", "type": "table", "title": "Database Hosts", "size": "full",
         "rows": [{"id": str(h.id), "name": h.name, "status": h.status, "cpu": round(h.cpu_percent, 1), "mem": round(h.memory_percent, 1), "disk": round(h.disk_percent, 1), "uptime": h.uptime or "N/A"} for h in hosts]},
    ]


async def _network_widgets(db: AsyncSession) -> list[dict]:
    hosts_result = await db.execute(select(Host).order_by(Host.name))
    hosts = hosts_result.scalars().all()
    ts = _ts_range(24)

    bw_in_nodes, bw_out_nodes = [], []
    for h in hosts[:6]:
        base_in = random.uniform(10, 500)
        base_out = random.uniform(5, 200)
        bw_in_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "current": round(base_in, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, base_in + random.uniform(-50, 50)), 1)} for t in ts],
        })
        bw_out_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "current": round(base_out, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, base_out + random.uniform(-30, 30)), 1)} for t in ts],
        })

    packet_loss = [{"time": _fmt(t), "value": round(random.uniform(0, 0.5), 3)} for t in ts]

    return [
        {"id": "w1", "type": "area_chart", "title": "Bandwidth In (MB/s)", "size": "large", "nodes": bw_in_nodes},
        {"id": "w2", "type": "area_chart", "title": "Bandwidth Out (MB/s)", "size": "large", "nodes": bw_out_nodes},
        {"id": "w3", "type": "line_chart", "title": "Packet Loss (%)", "size": "medium",
         "nodes": [{"id": "pkt", "name": "Packet Loss", "status": "healthy", "current": packet_loss[-1]["value"], "data": packet_loss}]},
        {"id": "w4", "type": "stat_row", "title": "Network Overview", "size": "full", "stats": [
            {"label": "Monitored Hosts", "value": len(hosts)},
            {"label": "Avg BW In", "value": f"{round(sum(n['current'] for n in bw_in_nodes) / max(len(bw_in_nodes),1), 0)} MB/s"},
            {"label": "Avg BW Out", "value": f"{round(sum(n['current'] for n in bw_out_nodes) / max(len(bw_out_nodes),1), 0)} MB/s"},
            {"label": "Packet Loss", "value": f"{packet_loss[-1]['value']}%"},
        ]},
    ]


async def _sla_widgets(db: AsyncSession) -> list[dict]:
    svcs_result = await db.execute(select(Service).order_by(Service.name))
    svcs = svcs_result.scalars().all()
    txs_result = await db.execute(select(Transaction).order_by(Transaction.name))
    txs = txs_result.scalars().all()
    ts = _ts_range(24)

    uptime_nodes = []
    for s in svcs:
        uptime_nodes.append({
            "id": str(s.id), "name": s.name, "status": s.status,
            "current": s.uptime_percent,
            "data": [{"time": _fmt(t), "value": round(max(95, min(100, s.uptime_percent + random.uniform(-0.5, 0.2))), 2)} for t in ts],
        })

    apdex_nodes = []
    for s in svcs:
        base_apdex = 1.0 - (s.latency_ms / 1000)
        base_apdex = max(0.5, min(1.0, base_apdex))
        apdex_nodes.append({
            "id": str(s.id), "name": s.name, "status": s.status,
            "current": round(base_apdex, 2),
            "data": [{"time": _fmt(t), "value": round(max(0.5, min(1.0, base_apdex + random.uniform(-0.05, 0.03))), 2)} for t in ts],
        })

    return [
        {"id": "w1", "type": "line_chart", "title": "Service Uptime (%)", "size": "large", "nodes": uptime_nodes},
        {"id": "w2", "type": "line_chart", "title": "Apdex Score", "size": "large", "nodes": apdex_nodes},
        {"id": "w3", "type": "gauge_grid", "title": "Current SLA", "size": "medium",
         "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "%"} for n in uptime_nodes]},
        {"id": "w4", "type": "stat_row", "title": "SLA Summary", "size": "full", "stats": [
            {"label": "Services", "value": len(svcs)},
            {"label": "Avg Uptime", "value": f"{round(sum(s.uptime_percent for s in svcs) / max(len(svcs),1), 2)}%"},
            {"label": "Transactions", "value": len(txs)},
            {"label": "Avg TX Success", "value": f"{round(sum(tx.success_rate for tx in txs) / max(len(txs),1), 1)}%"},
        ]},
    ]


async def _alert_hosts_widgets(db: AsyncSession) -> list[dict]:
    hosts_result = await db.execute(
        select(Host).where(Host.status.in_(["warning", "critical"])).order_by(Host.status.desc(), Host.name)
    )
    alert_hosts = hosts_result.scalars().all()

    all_result = await db.execute(select(Host))
    all_hosts = all_result.scalars().all()
    ts = _ts_range(24)

    alerts_result = await db.execute(
        select(AlertInstance).where(AlertInstance.resolved == False).order_by(AlertInstance.created_at.desc()).limit(20)
    )
    active_alerts = alerts_result.scalars().all()

    status_counts = {"healthy": 0, "warning": 0, "critical": 0, "unknown": 0}
    for h in all_hosts:
        status_counts[h.status] = status_counts.get(h.status, 0) + 1

    cpu_nodes = []
    for h in alert_hosts:
        base = h.cpu_percent
        cpu_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "type": h.type, "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-15, 10) * math.sin(i / 3))), 1)} for i, t in enumerate(ts)],
        })

    mem_nodes = []
    for h in alert_hosts:
        base = h.memory_percent
        mem_nodes.append({
            "id": str(h.id), "name": h.name, "status": h.status,
            "type": h.type, "current": round(base, 1),
            "data": [{"time": _fmt(t), "value": round(max(0, min(100, base + random.uniform(-8, 8))), 1)} for i, t in enumerate(ts)],
        })

    host_table = []
    for h in alert_hosts:
        host_table.append({
            "id": str(h.id), "name": h.name, "type": h.type,
            "status": h.status, "ip": h.ip_address or "N/A",
            "cpu": round(h.cpu_percent, 1), "mem": round(h.memory_percent, 1),
            "disk": round(h.disk_percent, 1), "uptime": h.uptime or "N/A",
        })

    alert_table = []
    for a in active_alerts:
        alert_table.append({
            "id": str(a.id), "name": a.message or "Alert",
            "severity": a.severity,
            "status": "acknowledged" if a.acknowledged else "firing",
            "fired": a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "N/A",
        })

    widgets = [
        {"id": "w1", "type": "stat_row", "title": "Alert Summary", "size": "full", "stats": [
            {"label": "Total Hosts", "value": len(all_hosts)},
            {"label": "In Alert", "value": len(alert_hosts)},
            {"label": "Warning", "value": status_counts.get("warning", 0)},
            {"label": "Critical", "value": status_counts.get("critical", 0)},
        ]},
        {"id": "w2", "type": "pie_chart", "title": "Host Status Breakdown", "size": "small",
         "data": [{"name": k, "value": v} for k, v in status_counts.items() if v > 0]},
        {"id": "w3", "type": "gauge_grid", "title": "Alerting Host CPU", "size": "medium",
         "nodes": [{"id": n["id"], "name": n["name"], "status": n["status"], "value": n["current"], "label": "CPU %"} for n in cpu_nodes]},
    ]

    if cpu_nodes:
        widgets.append({"id": "w4", "type": "line_chart", "title": "CPU Trend (Alerting Hosts)", "size": "large", "nodes": cpu_nodes})
    if mem_nodes:
        widgets.append({"id": "w5", "type": "area_chart", "title": "Memory Trend (Alerting Hosts)", "size": "large", "nodes": mem_nodes})

    widgets.append({"id": "w6", "type": "table", "title": "Hosts in Alert", "size": "full", "rows": host_table})

    if alert_table:
        widgets.append({"id": "w7", "type": "table", "title": "Active Alerts", "size": "full", "rows": alert_table})

    return widgets
