# Branch Protection Rules Configuration (INFRA-02)

This document describes the branch protection rules to configure in GitHub.

## Setup Instructions

Go to: **Repository Settings → Branches → Add branch protection rule**

---

## `main` Branch (Production)

**Branch name pattern:** `main`

### Protect matching branches:
- ✅ Require a pull request before merging
  - ✅ Require approvals: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - **Required status checks:**
    - `🔍 Lint`
    - `📝 Type Check`
    - `🧪 Unit Tests`
    - `🔗 Integration Tests`
    - `📊 Coverage Check`
    - `🔒 Security Scan`
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push to matching branches
  - Only allow: `Administrators`

---

## `develop` Branch (Staging)

**Branch name pattern:** `develop`

### Protect matching branches:
- ✅ Require a pull request before merging
  - ✅ Require approvals: **1**
- ✅ Require status checks to pass before merging
  - **Required status checks:**
    - `🔍 Lint`
    - `📝 Type Check`
    - `🧪 Unit Tests`
    - `🔗 Integration Tests`
    - `📊 Coverage Check`
- ✅ Do not allow bypassing the above settings

---

## GitHub Environments

### Create Environments

Go to: **Repository Settings → Environments**

#### Staging Environment
- **Name:** `staging`
- **Deployment branches:** `develop` only
- **No protection rules** (auto-deploy)

#### Production Environment
- **Name:** `production`
- **Deployment branches:** `main` only
- **Protection rules:**
  - ✅ Required reviewers: Add at least 1 reviewer
  - ✅ Wait timer: 0 minutes (or configure delay)

---

## Required Secrets

Go to: **Repository Settings → Secrets and variables → Actions**

| Secret Name | Description |
|-------------|-------------|
| `SNYK_TOKEN` | Snyk security scanning token |
| `AWS_ACCESS_KEY_ID` | AWS credentials (when using AWS) |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials (when using AWS) |
| `SLACK_WEBHOOK_URL` | Slack notifications (optional) |
