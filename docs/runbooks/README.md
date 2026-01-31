# RAPPIT Operations Runbooks

## Overview

This directory contains operational runbooks for common RAPPIT platform issues. Each runbook provides step-by-step guidance for diagnosing and resolving specific alert scenarios.

## Runbook Index

| # | Runbook | Trigger Alert | Severity |
|---|---------|---------------|----------|
| 1 | [High Queue Depth](./01-high-queue-depth.md) | Queue depth > 1000 for 5 min | Critical |
| 2 | [Database Connection Failure](./02-database-connection-failure.md) | DB errors > 10/min | Critical |
| 3 | [Carrier API Outage](./03-carrier-api-outage.md) | Carrier errors > 50% for 5 min | Critical |
| 4 | [Memory/CPU Threshold](./04-memory-cpu-threshold.md) | Memory > 90% or CPU > 95% | Warning |
| 5 | [Failed Payment Webhook](./05-failed-payment-webhook.md) | Stripe failures > 5 | Critical |

## Runbook Structure

Each runbook follows a standard structure:
1. **Alert Definition** — What triggers this runbook
2. **Impact Assessment** — What systems/users are affected
3. **Diagnostic Steps** — How to investigate
4. **Remediation Steps** — How to fix
5. **Escalation Path** — When/who to escalate to

## Quick Reference

### Key Metrics URLs
- Prometheus: `http://metrics.rappit.io/graph`
- Grafana: `http://grafana.rappit.io/dashboards`
- PagerDuty: `https://rappit.pagerduty.com`

### On-Call Contacts
- Primary: Check PagerDuty schedule
- Secondary: Slack #oncall-backup
- Escalation: engineering-leads@rappit.io
