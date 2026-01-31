# Missing Frontend Tasks

This document tracks frontend tasks that were deferred and can be implemented later.

---

## Phase 7: Observability — Frontend Tasks

| Task ID | Title | Priority | Status |
|---------|-------|----------|--------|
| FE-OBS-01 | Queue Metrics Dashboard | Medium | ⬜ Pending |
| FE-OBS-02 | Alert Configuration UI | Low | ⬜ Pending |
| FE-OBS-03 | System Health Widget | Medium | ⬜ Pending |
| FE-OBS-04 | Runbook Viewer | Low | ⬜ Pending |

---

### FE-OBS-01: Queue Metrics Dashboard

**Description:** Admin panel showing real-time queue depths, job counts, and processing rates.

**Features:**
- Display `/jobs/metrics` data in charts
- Auto-refresh every 15 seconds
- Show orders, inventory, shipping queue depths
- Historical trend (24h rolling window)

**Access:** ADMIN, MANAGER

---

### FE-OBS-02: Alert Configuration UI

**Description:** Interface for ADMIN to configure alert thresholds, channels, and recipients.

**Features:**
- Configure PagerDuty/Slack/Email routing
- Set custom thresholds per metric
- Manage maintenance windows
- Test alert delivery

**Access:** ADMIN only

---

### FE-OBS-03: System Health Widget

**Description:** Dashboard widget showing overall system health status.

**Features:**
- Red/Yellow/Green health indicator
- Quick summary of active alerts
- Link to metrics dashboard
- Last update timestamp

**Access:** All authenticated users

---

### FE-OBS-04: Runbook Viewer

**Description:** In-app documentation viewer for operational runbooks.

**Features:**
- Searchable runbook index
- Syntax-highlighted code blocks
- Quick links from alerts
- PDF export

**Access:** ADMIN, MANAGER

---

## Notes

- All frontend tasks should follow the existing Figma design system
- RTL (Arabic) layout support required
- Mobile-responsive layouts
