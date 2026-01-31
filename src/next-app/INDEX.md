# 📚 Rappit Frontend - Master Index

Complete navigation guide for all documentation and files.

---

## 🎯 **Quick Links**

### **Getting Started**
- 📖 [README.md](./README.md) - **START HERE** - Complete project documentation
- 🚀 [Setup Script](./scripts/setup-dev.sh) - Automated development setup
- 📝 [Environment Template](./.env.local.example) - Configuration template

### **Implementation Details**
- ✅ [Implementation Complete](./IMPLEMENTATION_COMPLETE.md) - What was delivered
- 📊 [Complete Summary](./COMPLETE_IMPLEMENTATION_SUMMARY.md) - Detailed summary
- 📁 This file (INDEX.md) - Navigation guide

### **Testing**
- 🧪 [Testing Guide](./TESTING.md) - Complete testing documentation
- 🔬 [Login API Tests](./tests/integration/api.auth.login.spec.ts)
- 🛡️ [Middleware Tests](./tests/integration/middleware.spec.ts)
- 🔧 [Auth Flow Test Script](./scripts/test-auth-flow.sh)

---

## 📂 **File Organization**

### **Configuration & Setup**
```
next-app/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── next.config.js            # Next.js configuration
├── tailwind.config.js        # Tailwind CSS + RTL
├── postcss.config.js         # PostCSS
├── jest.config.js            # Jest test config
├── jest.setup.js             # Jest setup
├── .eslintrc.json            # ESLint rules
├── .prettierrc               # Prettier formatting
├── .gitignore                # Git ignore rules
└── .env.local.example        # Environment template
```

### **Source Code**
```
app/
├── layout.tsx                # Root layout (TopBar + RightSideNav)
├── page.tsx                  # Dashboard (protected)
├── globals.css               # Global styles (RTL)
├── (auth)/
│   ├── login/page.tsx        # Login page
│   └── signup/page.tsx       # Signup page (optional)
├── select-org/
│   ├── page.tsx              # Org selection page
│   └── OrgSelector.tsx       # Org selector component
├── settings/
│   └── billing/
│       ├── page.tsx          # Billing page
│       └── BillingContent.tsx
└── api/
    ├── auth/
    │   ├── login/route.ts    # Login API
    │   └── logout/route.ts   # Logout API
    └── account/
        └── switch-org/route.ts   # Org switching API
```

### **Components**
```
components/
├── UI/
│   ├── Button.tsx            # Reusable button
│   └── Input.tsx             # Reusable input
├── Auth/
│   ├── LoginForm.tsx         # Login form (client)
│   └── SignupForm.tsx        # Signup form (client)
├── OrgSwitcher/
│   └── OrgSwitcher.tsx       # Org switcher dropdown
└── AppShell/
    ├── TopBar.tsx            # Top navigation bar
    └── RightSideNav.tsx      # Right sidebar (RTL)
```

### **Library & Utilities**
```
lib/
├── auth/
│   └── getServerAccountContext.ts   # Server auth helper ⭐
├── cookies.ts                # Cookie utilities
├── fetcher.ts                # Type-safe fetch
├── types.ts                  # TypeScript types
└── constants.ts              # Application constants
```

### **Middleware**
```
middleware.ts                 # Global auth middleware ⭐
```

### **Tests**
```
tests/
├── integration/
│   ├── api.auth.login.spec.ts    # Login API tests
│   └── middleware.spec.ts        # Middleware tests
└── (future)
    ├── unit/                     # Unit tests
    └── e2e/                      # E2E tests
```

### **Scripts**
```
scripts/
├── setup-dev.sh              # Development setup
└── test-auth-flow.sh         # Auth flow testing (curl)
```

### **Documentation**
```
docs/
├── README.md                 # Main documentation ⭐
├── IMPLEMENTATION_COMPLETE.md    # Implementation summary
├── TESTING.md                # Testing guide
├── COMPLETE_IMPLEMENTATION_SUMMARY.md
└── INDEX.md                  # This file
```

---

## 🔑 **Key Files to Understand**

### **Critical Files** ⭐
1. **`lib/auth/getServerAccountContext.ts`**
   - Server-side auth helper
   - Calls backend `/auth/me`
   - Resolves selected org
   - Used by all protected pages

2. **`middleware.ts`**
   - Global auth check
   - Redirects unauthenticated users
   - Enforces org selection
   - Protects all routes

3. **`app/api/auth/login/route.ts`**
   - Login endpoint
   - Sets httpOnly cookies
   - Auto-selects single org

4. **`app/layout.tsx`**
   - Root layout
   - Renders TopBar + RightSideNav
   - Provides auth context

### **Important Components**
5. **`components/AppShell/TopBar.tsx`**
   - Account info display
   - Org switcher
   - User menu

6. **`components/AppShell/RightSideNav.tsx`**
   - Feature-gated navigation
   - RTL support
   - Plan-based access

7. **`components/OrgSwitcher/OrgSwitcher.tsx`**
   - Organization dropdown
   - Switching logic
   - Server-side cookie update

---

## 📖 **Documentation Map**

### **For First-Time Setup**
1. Read [README.md](./README.md) - Project overview
2. Run `npm run setup` - Automated setup
3. Read [TESTING.md](./TESTING.md) - Testing guide

### **For Understanding Implementation**
1. [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) - What was built
2. [COMPLETE_IMPLEMENTATION_SUMMARY.md](./COMPLETE_IMPLEMENTATION_SUMMARY.md) - Detailed breakdown
3. Code comments in source files

### **For Testing**
1. [TESTING.md](./TESTING.md) - Complete testing guide
2. Run `npm test` - Execute tests
3. Run `npm run test-auth` - Test auth flow

### **For Contributing**
1. README.md → "Development" section
2. ESLint + Prettier configs
3. TypeScript strict mode guidelines

---

## 🎓 **Learning Path**

### **Beginner** (New to project)
1. ✅ Read README.md
2. ✅ Run setup script
3. ✅ Start dev server
4. ✅ Explore login flow
5. ✅ Test in browser

### **Intermediate** (Understanding architecture)
1. ✅ Read IMPLEMENTATION_COMPLETE.md
2. ✅ Study `getServerAccountContext.ts`
3. ✅ Study `middleware.ts`
4. ✅ Review API routes
5. ✅ Run tests

### **Advanced** (Contributing/Extending)
1. ✅ Read COMPLETE_IMPLEMENTATION_SUMMARY.md
2. ✅ Understand multi-tenancy model
3. ✅ Study cookie security
4. ✅ Review test coverage
5. ✅ Add new features

---

## 🔧 **Common Tasks**

### **Add a New Page**
```typescript
// 1. Create page file
app/new-page/page.tsx

// 2. Use server context
import { getServerAccountContext } from '@/lib/auth/getServerAccountContext';

export default async function NewPage() {
  const context = await getServerAccountContext();
  if (!context) redirect('/auth/login');
  
  return <div>New Page</div>;
}

// 3. Add to navigation
components/AppShell/RightSideNav.tsx
```

### **Add a New API Route**
```typescript
// 1. Create route file
app/api/new-endpoint/route.ts

// 2. Implement handler
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Handle request
  return NextResponse.json({ ok: true });
}
```

### **Add a New Component**
```typescript
// 1. Create component file
components/NewComponent/NewComponent.tsx

// 2. Use UI components
import { Button } from '@/components/UI/Button';

export function NewComponent() {
  return <Button>Click me</Button>;
}

// 3. Import and use
import { NewComponent } from '@/components/NewComponent/NewComponent';
```

---

## 🧪 **Testing Checklist**

### **Before Committing**
- [ ] Run `npm run lint` - No errors
- [ ] Run `npm run type-check` - No errors
- [ ] Run `npm test` - All tests pass
- [ ] Run `npm run format` - Code formatted
- [ ] Manual test in browser

### **Before Deploying**
- [ ] All tests passing
- [ ] Coverage >80%
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Backend integration tested
- [ ] Cookie security verified

---

## 🐛 **Troubleshooting**

### **Common Issues**

**Issue: "Cannot find module '@/...'"**
→ Check `tsconfig.json` paths config

**Issue: "BACKEND_URL not configured"**
→ Create `.env.local` from `.env.local.example`

**Issue: "Cookies not set"**
→ Check `COOKIE_SECURE=false` in development

**Issue: "Tests failing"**
→ Check backend is running: `curl http://localhost:3001/health`

**Issue: "Redirect loop"**
→ Check backend `/auth/me` returns valid response

---

## 📚 **External Resources**

- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs
- **Jest**: https://jestjs.io/docs
- **Cookie Security**: https://owasp.org/www-community/controls/SecureCookieAttribute

---

## 👥 **Support & Contact**

- **Issues**: Check [README.md](./README.md) troubleshooting
- **Testing**: See [TESTING.md](./TESTING.md)
- **Architecture**: Read [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)
- **Contact**: frontend-team@rappit.com

---

## 🎉 **You're All Set!**

**Quick Start:**
```bash
# 1. Setup
npm run setup

# 2. Start
npm run dev

# 3. Test
npm test

# 4. Open browser
http://localhost:3000
```

**Happy Coding! 🚀**

---

**Last Updated:** December 15, 2024
**Version:** 1.0.0
**Status:** ✅ Complete & Production-Ready
