# Phase 1-4 Gap Analysis - Email Service

**Task ID:** GAP-22 (NEW)  
**Priority:** P0 (Critical Infrastructure)  
**Est. Hours:** 6  
**Dependencies:** None  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Application cannot send emails:
- No email service configured
- No invite emails sent
- No password reset emails
- No order notification emails

---

### Business Requirements

1. **Email Service** - Centralized email sending
2. **Templates** - HTML email templates (Arabic RTL)
3. **Invite Emails** - User invitation flow
4. **Password Reset** - Reset password flow
5. **Notifications** - Order/system alerts

---

### Recommended Provider: Resend

Why Resend:
- Modern API, developer-friendly
- React Email templates support
- Excellent deliverability
- Generous free tier (100 emails/day)

Alternative: SendGrid, AWS SES

---

### API Design

```typescript
// Email Service Interface
interface EmailService {
  sendInvite(email: string, inviteUrl: string, orgName: string): Promise<void>;
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
  sendOrderConfirmation(email: string, order: Order): Promise<void>;
  send(to: string, subject: string, html: string): Promise<void>;
}
```

---

### Files to Create

```
src/modules/email/
├── email.service.ts
├── email.module.ts
├── email.service.spec.ts
└── templates/
    ├── invite.template.ts
    ├── password-reset.template.ts
    └── order-confirmation.template.ts

.env
├── RESEND_API_KEY=re_xxx
└── EMAIL_FROM=noreply@rappit.app
```

---

## Phase B: Integration Tests (15 tests)

### Invite Flow Tests
1. Send invite email - success
2. Send invite email - invalid email error
3. Resend invite - generates new token
4. Resend invite - rate limiting (max 3/hour)
5. Invite token - expires after 24h
6. Invite accept - valid token activates user
7. Invite accept - expired token rejected
8. Invite accept - already used token rejected

### Email Service Tests
9. Email service - sends with correct from address
10. Email service - includes unsubscribe link
11. Email service - handles bounce/complaint
12. Email service - retries on failure
13. Template - RTL Arabic layout
14. Template - valid HTML structure
15. Template - personalization works

---

## Phase C: Implementation

- [ ] Install Resend SDK
- [ ] Create email.service.ts
- [ ] Create email templates
- [ ] Add invite email to user.service
- [ ] Add resend invite endpoint
- [ ] Create integration tests
- [ ] Add to .env.example
