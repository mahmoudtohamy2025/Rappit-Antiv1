# Phase 1-4 Gap Analysis - Channel OAuth Flow

**Task ID:** GAP-18  
**Priority:** P0+ (Platform)  
**Est. Hours:** 8  
**Dependencies:** None  
**Status:** 🔄 In Progress

---

## Phase A+D: Planning & Design

### Problem Statement

Organizations cannot connect sales channels:
- No Shopify OAuth integration UI
- No WooCommerce OAuth integration UI
- No connection status display
- No credentials management

---

### Business Requirements

#### Core Features
1. **Channel Connect Wizard** - Step-by-step OAuth
2. **Platform Selection** - Shopify/WooCommerce cards
3. **OAuth Popup Handler** - Handle OAuth callbacks
4. **Connection Status** - Show connected channels
5. **Disconnect Channel** - Remove connections

#### Supported Platforms
- Shopify (OAuth 2.0)
- WooCommerce (REST API keys)

---

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/channels` | List connected channels |
| POST | `/api/v1/channels/connect/:platform` | Initiate OAuth |
| GET | `/api/v1/channels/callback/:platform` | OAuth callback |
| DELETE | `/api/v1/channels/:id` | Disconnect channel |

---

### Files to Create

```
src/hooks/
└── useChannels.ts

src/components/channels/
├── ChannelConnectWizard.tsx
├── PlatformSelectCard.tsx
├── ConnectedChannelList.tsx
├── ChannelStatusBadge.tsx
└── index.ts
```

---

## Phase B: Testing (15 tests)

1. getChannels - returns connected channels
2. initiateConnect - returns OAuth URL
3. disconnectChannel - removes channel
4. PlatformSelectCard - renders Shopify
5. PlatformSelectCard - renders WooCommerce
6. PlatformSelectCard - click initiates connect
7. ChannelConnectWizard - shows steps
8. ChannelConnectWizard - handles callback
9. ConnectedChannelList - renders channels
10. ConnectedChannelList - empty state
11. ConnectedChannelList - disconnect button
12. ChannelStatusBadge - shows connected
13. ChannelStatusBadge - shows error
14. OAuth popup opens correctly
15. Callback processes tokens

---

## Phase C: Implementation

- [ ] Create useChannels hook
- [ ] Create PlatformSelectCard
- [ ] Create ChannelConnectWizard
- [ ] Create ConnectedChannelList
- [ ] Create ChannelStatusBadge
- [ ] Add channels page/tab
