"""Seed the database with realistic demo data."""
import asyncio
import random
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import select
from app.database import async_session
from app.models import (
    User, Host, HostMetric, Service, Transaction, TransactionStep,
    TransactionRun, TransactionRunStep, AlertRule, AlertInstance,
    Incident, IncidentEvent, LogEntry, Dashboard, Monitor,
    NotificationChannel, Integration, UserPreference,
    OnCallTeam, OnCallTeamMember, OnCallShift,
    Organization, Workspace, WorkspaceMembership, MaintenanceWindow, AlertSilence,
)
from app.auth import hash_password


async def seed():
    async with async_session() as db:
        existing = await db.execute(select(User).limit(1))
        if existing.scalar_one_or_none():
            print("Database already seeded, skipping.")
            return

        # --- Users ---
        admin = User(
            email="admin@argus.io",
            password_hash=hash_password("admin123"),
            name="Admin User",
            role="admin",
        )
        db.add(admin)
        await db.flush()

        now = datetime.now(timezone.utc)

        # --- Enterprise seed: org, workspace, memberships, maintenance, silences ---
        org = Organization(name="Acme Corp", slug="acme-corp")
        db.add(org)
        await db.flush()

        workspace = Workspace(
            organization_id=org.id,
            name="Production",
            slug="production",
            timezone="Europe/London",
        )
        db.add(workspace)
        await db.flush()

        db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=admin.id, role="owner"))
        await db.flush()

        db.add(MaintenanceWindow(
            workspace_id=workspace.id,
            name="Scheduled upgrade",
            starts_at=now + timedelta(days=7),
            ends_at=now + timedelta(days=7, hours=2),
            scope_type="all",
            scope={},
            reason="Planned platform upgrade",
            created_by_user_id=admin.id,
        ))

        db.add(AlertSilence(
            workspace_id=workspace.id,
            name="Silence low-priority alerts",
            matcher={"severity": "info"},
            starts_at=now,
            ends_at=now + timedelta(days=1),
            reason="Reducing noise during rollout",
            created_by_user_id=admin.id,
        ))

        # --- On-call ---
        primary_team = OnCallTeam(
            workspace_id=workspace.id,
            name="Primary Ops",
            timezone="Europe/London",
            description="Default operational on-call rotation",
        )
        db.add(primary_team)
        await db.flush()
        db.add(OnCallTeamMember(team_id=primary_team.id, user_id=admin.id, role="lead"))
        db.add(OnCallShift(
            team_id=primary_team.id,
            user_id=admin.id,
            person_name=admin.name,
            email=admin.email,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=6),
            escalation_level=1,
            notes="Primary coverage",
        ))

        # --- Hosts ---
        hosts_data = [
            {"name": "api-prod-01", "type": "server", "status": "healthy", "ip_address": "10.0.1.10", "os": "Ubuntu 22.04", "cpu_percent": 34, "memory_percent": 62, "disk_percent": 45, "uptime": "45d", "tags": ["production", "api"]},
            {"name": "api-prod-02", "type": "server", "status": "healthy", "ip_address": "10.0.1.11", "os": "Ubuntu 22.04", "cpu_percent": 28, "memory_percent": 55, "disk_percent": 38, "uptime": "45d", "tags": ["production", "api"]},
            {"name": "db-primary", "type": "database", "status": "warning", "ip_address": "10.0.2.5", "os": "Ubuntu 22.04", "cpu_percent": 78, "memory_percent": 85, "disk_percent": 72, "uptime": "120d", "tags": ["production", "database"]},
            {"name": "db-replica-01", "type": "database", "status": "healthy", "ip_address": "10.0.2.6", "os": "Ubuntu 22.04", "cpu_percent": 45, "memory_percent": 70, "disk_percent": 68, "uptime": "120d", "tags": ["production", "database"]},
            {"name": "web-prod-01", "type": "server", "status": "healthy", "ip_address": "10.0.1.20", "os": "Alpine 3.18", "cpu_percent": 22, "memory_percent": 41, "disk_percent": 30, "uptime": "30d", "tags": ["production", "web"]},
            {"name": "cache-redis-01", "type": "database", "status": "healthy", "ip_address": "10.0.3.10", "os": "Debian 12", "cpu_percent": 15, "memory_percent": 72, "disk_percent": 20, "uptime": "90d", "tags": ["production", "cache"]},
            {"name": "worker-03", "type": "container", "status": "critical", "ip_address": "10.0.4.3", "os": "Docker", "cpu_percent": 95, "memory_percent": 92, "disk_percent": 55, "uptime": "2d", "tags": ["production", "worker"]},
            {"name": "lb-prod-01", "type": "network", "status": "healthy", "ip_address": "10.0.0.1", "os": "HAProxy 2.8", "cpu_percent": 8, "memory_percent": 22, "disk_percent": 15, "uptime": "365d", "tags": ["production", "loadbalancer"]},
            {"name": "k8s-node-01", "type": "container", "status": "healthy", "ip_address": "10.0.5.1", "os": "Flatcar", "cpu_percent": 52, "memory_percent": 68, "disk_percent": 40, "uptime": "15d", "tags": ["production", "kubernetes"]},
            {"name": "monitor-01", "type": "server", "status": "healthy", "ip_address": "10.0.1.100", "os": "Ubuntu 22.04", "cpu_percent": 42, "memory_percent": 58, "disk_percent": 35, "uptime": "60d", "tags": ["internal", "monitoring"]},
        ]
        host_objects = []
        for hd in hosts_data:
            h = Host(**hd, workspace_id=workspace.id, last_seen=datetime.now(timezone.utc))
            db.add(h)
            host_objects.append(h)

        await db.flush()

        # Create historical host metrics
        for host in host_objects:
            base_cpu = host.cpu_percent
            for i in range(7):
                metric = HostMetric(
                    host_id=host.id,
                    cpu_percent=max(0, min(100, base_cpu + random.uniform(-10, 5) * (7 - i) / 7)),
                    memory_percent=max(0, min(100, host.memory_percent + random.uniform(-5, 5))),
                    disk_percent=host.disk_percent,
                    recorded_at=now - timedelta(minutes=30 * (7 - i)),
                )
                db.add(metric)

        # --- Services ---
        services_data = [
            {"name": "API Gateway", "status": "healthy", "url": "https://api.example.com", "uptime_percent": 99.99, "latency_ms": 45, "requests_per_min": 12400, "endpoints_count": 24},
            {"name": "User Service", "status": "healthy", "url": "https://users.example.com", "uptime_percent": 99.98, "latency_ms": 62, "requests_per_min": 8200, "endpoints_count": 12},
            {"name": "Payment Service", "status": "warning", "url": "https://payments.example.com", "uptime_percent": 99.95, "latency_ms": 189, "requests_per_min": 2100, "endpoints_count": 8},
            {"name": "Auth Service", "status": "healthy", "url": "https://auth.example.com", "uptime_percent": 99.99, "latency_ms": 28, "requests_per_min": 15800, "endpoints_count": 6},
            {"name": "Notification Service", "status": "healthy", "url": "https://notify.example.com", "uptime_percent": 99.97, "latency_ms": 35, "requests_per_min": 4500, "endpoints_count": 4},
            {"name": "Search Service", "status": "critical", "url": "https://search.example.com", "uptime_percent": 98.50, "latency_ms": 520, "requests_per_min": 6300, "endpoints_count": 3},
        ]
        for sd in services_data:
            db.add(Service(workspace_id=workspace.id, **sd))

        # --- Transactions ---
        transactions_data = [
            {
                "name": "User Login Flow", "status": "healthy", "success_rate": 99.2, "avg_duration_ms": 1200,
                "schedule": "Every 5 min", "interval_seconds": 300,
                "steps": [
                    {"order": 1, "type": "navigate", "label": "Navigate to login page", "config": {"url": "https://app.example.com/login"}},
                    {"order": 2, "type": "input", "label": "Enter Email", "config": {"selector": "input#email", "value": "test@example.com"}},
                    {"order": 3, "type": "input", "label": "Enter Password", "config": {"selector": "input#password", "value": "********"}},
                    {"order": 4, "type": "click", "label": "Click Login Button", "config": {"selector": "button.login-btn"}},
                    {"order": 5, "type": "assert", "label": "Verify Dashboard Loaded", "config": {"assertion": "text_contains", "value": "Welcome back"}},
                ],
            },
            {
                "name": "Checkout Process", "status": "warning", "success_rate": 97.8, "avg_duration_ms": 3400,
                "schedule": "Every 5 min", "interval_seconds": 300,
                "steps": [
                    {"order": 1, "type": "navigate", "label": "Navigate to products", "config": {"url": "https://shop.example.com/products"}},
                    {"order": 2, "type": "click", "label": "Add to cart", "config": {"selector": "button.add-to-cart"}},
                    {"order": 3, "type": "navigate", "label": "Go to cart", "config": {"url": "https://shop.example.com/cart"}},
                    {"order": 4, "type": "assert", "label": "Verify cart items", "config": {"assertion": "element_exists", "selector": ".cart-item"}},
                    {"order": 5, "type": "click", "label": "Proceed to checkout", "config": {"selector": "button.checkout"}},
                    {"order": 6, "type": "input", "label": "Enter shipping info", "config": {"selector": "input#address", "value": "123 Test St"}},
                    {"order": 7, "type": "click", "label": "Place order", "config": {"selector": "button.place-order"}},
                    {"order": 8, "type": "assert", "label": "Verify confirmation", "config": {"assertion": "text_contains", "value": "Order confirmed"}},
                ],
            },
            {
                "name": "API Authentication", "status": "healthy", "success_rate": 99.9, "avg_duration_ms": 300,
                "schedule": "Every 1 min", "interval_seconds": 60,
                "steps": [
                    {"order": 1, "type": "api", "label": "POST login", "config": {"method": "POST", "url": "https://api.example.com/auth/login"}},
                    {"order": 2, "type": "assert", "label": "Verify 200 OK", "config": {"assertion": "status_code", "value": 200}},
                    {"order": 3, "type": "api", "label": "GET protected resource", "config": {"method": "GET", "url": "https://api.example.com/me"}},
                ],
            },
            {
                "name": "Report Export", "status": "critical", "success_rate": 94.1, "avg_duration_ms": 8200,
                "schedule": "Every 15 min", "interval_seconds": 900,
                "steps": [
                    {"order": 1, "type": "navigate", "label": "Navigate to reports", "config": {"url": "https://app.example.com/reports"}},
                    {"order": 2, "type": "click", "label": "Select date range", "config": {"selector": ".date-picker"}},
                    {"order": 3, "type": "click", "label": "Click export", "config": {"selector": "button.export"}},
                    {"order": 4, "type": "wait", "label": "Wait for generation", "config": {"timeout_ms": 10000}},
                    {"order": 5, "type": "assert", "label": "Verify download started", "config": {"assertion": "element_exists", "selector": ".download-link"}},
                    {"order": 6, "type": "assert", "label": "Verify file size > 0", "config": {"assertion": "custom"}},
                ],
            },
            {
                "name": "User Registration", "status": "healthy", "success_rate": 99.5, "avg_duration_ms": 2100,
                "schedule": "Every 10 min", "interval_seconds": 600,
                "steps": [
                    {"order": 1, "type": "navigate", "label": "Go to signup", "config": {"url": "https://app.example.com/register"}},
                    {"order": 2, "type": "input", "label": "Enter name", "config": {"selector": "input#name", "value": "Test User"}},
                    {"order": 3, "type": "input", "label": "Enter email", "config": {"selector": "input#email", "value": "test@example.com"}},
                    {"order": 4, "type": "input", "label": "Enter password", "config": {"selector": "input#password", "value": "********"}},
                    {"order": 5, "type": "click", "label": "Accept terms", "config": {"selector": "input#terms"}},
                    {"order": 6, "type": "click", "label": "Click register", "config": {"selector": "button.register"}},
                    {"order": 7, "type": "assert", "label": "Verify welcome page", "config": {"assertion": "text_contains", "value": "Welcome"}},
                ],
            },
            {
                "name": "Password Reset", "status": "healthy", "success_rate": 99.8, "avg_duration_ms": 1800,
                "schedule": "Every 30 min", "interval_seconds": 1800,
                "steps": [
                    {"order": 1, "type": "navigate", "label": "Go to reset page", "config": {"url": "https://app.example.com/forgot-password"}},
                    {"order": 2, "type": "input", "label": "Enter email", "config": {"selector": "input#email", "value": "test@example.com"}},
                    {"order": 3, "type": "click", "label": "Submit reset", "config": {"selector": "button.submit"}},
                    {"order": 4, "type": "assert", "label": "Verify email sent", "config": {"assertion": "text_contains", "value": "Check your email"}},
                ],
            },
        ]

        for td in transactions_data:
            steps_data = td.pop("steps")
            tx = Transaction(workspace_id=workspace.id, **td)
            db.add(tx)
            await db.flush()

            for sd in steps_data:
                step = TransactionStep(transaction_id=tx.id, **sd)
                db.add(step)

            await db.flush()

            # Create some run history
            for i in range(5):
                run_status = "success" if random.random() > 0.1 else "failed"
                started = now - timedelta(minutes=td.get("interval_seconds", 300) / 60 * (5 - i))
                dur = td.get("avg_duration_ms", 1000) + random.uniform(-200, 200)
                run = TransactionRun(
                    transaction_id=tx.id,
                    status=run_status,
                    duration_ms=round(dur, 1),
                    started_at=started,
                    completed_at=started + timedelta(milliseconds=dur),
                )
                db.add(run)

        # --- Alert Rules ---
        rules = [
            AlertRule(workspace_id=workspace.id, name="High CPU Alert", severity="critical", type="threshold", condition={"metric": "cpu_percent", "operator": ">", "value": 90, "duration_minutes": 5}),
            AlertRule(workspace_id=workspace.id, name="High Memory Alert", severity="warning", type="threshold", condition={"metric": "memory_percent", "operator": ">", "value": 85}),
            AlertRule(workspace_id=workspace.id, name="SSL Certificate Expiry", severity="warning", type="expiry", condition={"days_before": 7}),
            AlertRule(workspace_id=workspace.id, name="Transaction Failure Alert", severity="critical", type="threshold", condition={"metric": "success_rate", "operator": "<", "value": 98}),
        ]
        for r in rules:
            db.add(r)
        await db.flush()

        # --- Alert Instances ---
        alerts_data = [
            {"rule_id": rules[0].id, "message": "CPU usage > 90% for 5 minutes", "severity": "critical", "service": "Worker Pool", "host": "worker-03", "acknowledged": False},
            {"rule_id": rules[1].id, "message": "Database replication lag exceeds 5s", "severity": "warning", "service": "Database", "host": "db-primary", "acknowledged": False},
            {"rule_id": rules[2].id, "message": "SSL certificate expires in 7 days", "severity": "warning", "service": "API Gateway", "host": "lb-prod-01", "acknowledged": True, "acknowledged_by": "Alice"},
            {"rule_id": rules[3].id, "message": "Transaction 'Checkout' success rate below 98%", "severity": "critical", "service": "E-Commerce", "host": "api-prod-01", "acknowledged": True, "acknowledged_by": "Bob"},
            {"rule_id": rules[1].id, "message": "Disk usage > 80%", "severity": "warning", "service": "Monitoring", "host": "monitor-01", "acknowledged": False},
            {"rule_id": rules[1].id, "message": "Memory usage > 85%", "severity": "warning", "service": "Database", "host": "db-primary", "acknowledged": True, "acknowledged_by": "Alice"},
            {"rule_id": None, "message": "Response time > 2s on /api/users", "severity": "info", "service": "API", "host": "api-prod-02", "acknowledged": True, "acknowledged_by": "Charlie"},
            {"rule_id": rules[0].id, "message": "Container restart detected", "severity": "critical", "service": "Worker Pool", "host": "worker-03", "acknowledged": True, "acknowledged_by": "Bob"},
        ]
        for i, ad in enumerate(alerts_data):
            alert = AlertInstance(
                workspace_id=workspace.id,
                **ad,
                assigned_user_id=admin.id if not ad.get("acknowledged") else None,
                created_at=now - timedelta(hours=i * 2),
            )
            db.add(alert)

        # --- Incidents ---
        inc1 = Incident(
            workspace_id=workspace.id,
            ref="INC-2026-001",
            title="Elevated error rates on API endpoints",
            status="investigating",
            severity="warning",
            assigned_user_id=admin.id,
            affected_hosts=["api-prod-01", "api-prod-02"],
            started_at=now - timedelta(minutes=23),
        )
        db.add(inc1)
        await db.flush()

        inc1_events = [
            {"type": "alert", "event_text": "Alert triggered: Error rate > 5% on /api/orders", "offset_min": 0},
            {"type": "system", "event_text": "Incident created automatically", "offset_min": 1},
            {"type": "ai", "event_text": "AI Analysis: Spike correlates with deployment v2.4.1 at 14:30", "offset_min": 3},
            {"type": "action", "event_text": "Assigned to On-Call: Alice Chen", "offset_min": 6},
            {"type": "action", "event_text": "Root cause identified: Database connection pool exhaustion", "offset_min": 10},
            {"type": "action", "event_text": "Mitigation: Increased connection pool size to 200", "offset_min": 16},
            {"type": "system", "event_text": "Error rates returning to normal", "offset_min": 23},
        ]
        for ev in inc1_events:
            db.add(IncidentEvent(
                incident_id=inc1.id,
                type=ev["type"],
                event_text=ev["event_text"],
                created_at=inc1.started_at + timedelta(minutes=ev["offset_min"]),
            ))

        inc2 = Incident(
            workspace_id=workspace.id,
            ref="INC-2026-002",
            title="Worker pool saturation causing job delays",
            status="identified",
            severity="critical",
            assigned_user_id=admin.id,
            affected_hosts=["worker-03"],
            started_at=now - timedelta(minutes=68),
        )
        db.add(inc2)
        await db.flush()

        inc2_events = [
            {"type": "alert", "event_text": "Alert triggered: CPU > 90% on worker-03", "offset_min": 0},
            {"type": "system", "event_text": "Incident created automatically", "offset_min": 1},
            {"type": "ai", "event_text": "AI Analysis: Worker processing backlog of 15,000 jobs", "offset_min": 3},
            {"type": "action", "event_text": "Assigned to On-Call: Bob Martinez", "offset_min": 8},
            {"type": "action", "event_text": "Horizontal scaling initiated: 2 additional workers", "offset_min": 23},
        ]
        for ev in inc2_events:
            db.add(IncidentEvent(
                incident_id=inc2.id,
                type=ev["type"],
                event_text=ev["event_text"],
                created_at=inc2.started_at + timedelta(minutes=ev["offset_min"]),
            ))

        # --- Log Entries ---
        log_entries = [
            {"level": "error", "service": "api-prod-01", "message": "Connection refused to db-primary:5432 - pool exhausted"},
            {"level": "warn", "service": "worker-03", "message": "Job queue depth exceeds threshold: 15,234 pending"},
            {"level": "info", "service": "api-prod-02", "message": "Request completed: GET /api/users - 200 OK (45ms)"},
            {"level": "error", "service": "api-prod-01", "message": "Timeout waiting for database connection after 5000ms"},
            {"level": "info", "service": "auth-service", "message": "Token validated for user_id=usr_8x2k9 scope=api:read"},
            {"level": "debug", "service": "cache-redis-01", "message": "Cache hit: session:usr_8x2k9 TTL=3600s"},
            {"level": "warn", "service": "payment-svc", "message": "Stripe API response time elevated: 189ms (threshold: 100ms)"},
            {"level": "info", "service": "api-prod-02", "message": "Request completed: POST /api/orders - 201 Created (62ms)"},
            {"level": "error", "service": "search-svc", "message": "Elasticsearch cluster health: RED - 2 shards unassigned"},
            {"level": "info", "service": "lb-prod-01", "message": "Health check passed for api-prod-02 (28ms)"},
            {"level": "debug", "service": "api-prod-01", "message": "Rate limit check: usr_3j4k2 - 45/100 requests remaining"},
            {"level": "info", "service": "notification-svc", "message": "Email queued: password_reset to user@example.com"},
        ]
        for i, le in enumerate(log_entries):
            db.add(LogEntry(
                **le,
                timestamp=now - timedelta(seconds=i),
            ))

        # --- Dashboards ---
        dashboards_data = [
            {"name": "Infrastructure Overview", "type": "system", "widgets_count": 8},
            {"name": "API Performance", "type": "custom", "widgets_count": 6},
            {"name": "Transaction Health", "type": "ai", "widgets_count": 5},
            {"name": "Database Metrics", "type": "system", "widgets_count": 7},
            {"name": "Network Overview", "type": "custom", "widgets_count": 4},
            {"name": "SLA Report", "type": "ai", "widgets_count": 3},
            {"name": "Hosts in Alert", "type": "system", "widgets_count": 7, "config": {"preset": "Hosts in Alert"}},
        ]
        for dd in dashboards_data:
            db.add(Dashboard(workspace_id=workspace.id, **dd))

        # --- Notification Channels ---
        notif_channels = [
            {"name": "Ops Team Email", "type": "email", "enabled": True, "config": {"recipients": ["ops@example.com", "oncall@example.com"], "min_severity": "warning"}},
            {"name": "#alerts Slack Channel", "type": "slack", "enabled": True, "config": {"channel": "#alerts", "note": "Configure webhook in Slack settings"}},
            {"name": "PagerDuty Escalation", "type": "pagerduty", "enabled": True, "config": {"integration_key": "PLACEHOLDER", "severity_map": {"critical": "critical", "warning": "warning"}}},
            {"name": "Webhook - StatusPage", "type": "webhook", "enabled": False, "config": {"url": "https://statuspage.example.com/api/incidents", "method": "POST"}},
        ]
        for nc in notif_channels:
            db.add(NotificationChannel(workspace_id=workspace.id, **nc))

        # --- Integrations ---
        integrations_data = [
            {"name": "Slack", "type": "slack", "status": "connected", "config": {"workspace": "example-workspace", "default_channel": "#monitoring"}},
            {"name": "PagerDuty", "type": "pagerduty", "status": "connected", "config": {"subdomain": "example", "service_count": 3}},
            {"name": "Jira", "type": "jira", "status": "disconnected", "config": {"instance_url": "https://example.atlassian.net"}},
            {"name": "GitHub", "type": "github", "status": "disconnected", "config": {"org": "example-org"}},
            {"name": "Webhook - Custom", "type": "webhook", "status": "connected", "config": {"url": "https://api.example.com/webhooks/argus", "events": ["alert.fired", "incident.created"]}},
            {"name": "Microsoft Teams", "type": "teams", "status": "disconnected", "config": {}},
            {"name": "OpsGenie", "type": "opsgenie", "status": "disconnected", "config": {}},
        ]
        for integ in integrations_data:
            db.add(Integration(workspace_id=workspace.id, **integ))

        # --- User Preferences ---
        await db.flush()
        db.add(UserPreference(user_id=admin.id, theme="dark", timezone="UTC", date_format="YYYY-MM-DD"))

        # --- Monitors ---
        monitors_data = [
            {"name": "API Gateway HTTP", "type": "http", "target": "https://api.example.com/health", "status": "up", "interval_seconds": 30},
            {"name": "DB Primary TCP", "type": "tcp", "target": "10.0.2.5:5432", "status": "up", "interval_seconds": 60},
            {"name": "Redis Ping", "type": "ping", "target": "10.0.3.10", "status": "up", "interval_seconds": 30},
            {"name": "Search Service HTTP", "type": "http", "target": "https://search.example.com/health", "status": "down", "interval_seconds": 30},
            {"name": "SSL Certificate Check", "type": "ssl", "target": "api.example.com", "status": "warning", "interval_seconds": 3600},
        ]
        for md in monitors_data:
            db.add(Monitor(workspace_id=workspace.id, **md))

        await db.commit()
        print("Database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
