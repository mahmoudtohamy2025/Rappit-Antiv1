# Phase 1-4 Gap Analysis - User Management

**Task ID:** GAP-09  
**Priority:** P1 (High)  
**Est. Hours:** 8  
**Dependencies:** None  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Organizations cannot manage users:
- No user list view
- Cannot invite new users
- Cannot update roles
- Cannot remove users

---

### Business Requirements

1. **User List** - View all org users
2. **Invite User** - Send email invitation
3. **Role Management** - Assign/change roles
4. **Remove User** - Remove from org
5. **Resend Invite** - Resend pending invites

### Roles
- OWNER (cannot be changed)
- ADMIN
- MANAGER
- STAFF

---

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/users` | List org users |
| POST | `/api/v1/users/invite` | Send invite |
| PATCH | `/api/v1/users/:id/role` | Update role |
| DELETE | `/api/v1/users/:id` | Remove user |
| POST | `/api/v1/users/:id/resend-invite` | Resend invite |

---

### Files to Create

```
src/hooks/
└── useUsers.ts

src/components/users/
├── UserList.tsx
├── InviteUserModal.tsx
├── RoleSelect.tsx
├── UserStatusBadge.tsx
└── index.ts
```

---

## Phase B: Testing (15 tests)

1. getUsers - returns user list
2. inviteUser - sends invite
3. updateRole - changes role
4. removeUser - removes user
5. resendInvite - resends email
6. UserList - renders users
7. UserList - shows roles
8. UserList - empty state
9. InviteUserModal - validates email
10. InviteUserModal - submits invite
11. RoleSelect - shows options
12. RoleSelect - changes role
13. UserStatusBadge - pending
14. UserStatusBadge - active
15. Owner cannot be removed

---

## Phase C: Implementation

- [ ] Create useUsers hook
- [ ] Create UserList component
- [ ] Create InviteUserModal
- [ ] Create RoleSelect
- [ ] Create UserStatusBadge
- [ ] Add to settings page
