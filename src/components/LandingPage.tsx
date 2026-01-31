import { useState } from 'react';
import '../styles/landing.css';

// Lucide icons (using inline SVGs for landing page isolation)
const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const LayersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
    </svg>
);

const ServerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const AlertTriangleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const PackageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const TruckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
);

const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const ShoppingCartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
);

const BuildingIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M16 6h.01" />
        <path d="M12 6h.01" />
        <path d="M12 10h.01" />
        <path d="M12 14h.01" />
        <path d="M16 10h.01" />
        <path d="M16 14h.01" />
        <path d="M8 10h.01" />
        <path d="M8 14h.01" />
    </svg>
);

const CodeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
    </svg>
);

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const ZapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
);

const LinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

interface LandingPageProps {
    onRequestAccess: () => void;
}

export default function LandingPage({ onRequestAccess }: LandingPageProps) {
    const [language, setLanguage] = useState<'EN' | 'AR'>('EN');

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="landing-page" dir={language === 'AR' ? 'rtl' : 'ltr'}>
            {/* ==================== HERO SECTION ==================== */}
            <section className="landing-hero" id="hero">
                <div className="landing-container">
                    <div className="landing-hero-content">
                        <h1 className="landing-h1 landing-hero-headline">
                            Fulfillment, under control.
                        </h1>
                        <p className="landing-subtitle landing-hero-subheadline">
                            RAPPIT helps organizations manage orders, inventory, and shipping
                            across platforms — reliably, at scale, without chaos.
                        </p>
                        <p className="landing-caption landing-hero-supporting">
                            Built for operational teams who care about accuracy, automation, and growth.
                        </p>
                        <div className="landing-hero-ctas">
                            <button
                                className="landing-btn landing-btn-primary"
                                onClick={onRequestAccess}
                            >
                                Request early access
                            </button>
                            <button
                                className="landing-btn landing-btn-secondary"
                                onClick={() => scrollToSection('how-it-works')}
                            >
                                See how it works
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== TRUST STRIP ==================== */}
            <section className="landing-trust">
                <div className="landing-container">
                    <div className="landing-trust-grid">
                        <div className="landing-trust-item">
                            <span className="landing-trust-icon"><CheckCircleIcon /></span>
                            <span className="landing-trust-text">Built for real operations</span>
                        </div>
                        <div className="landing-trust-item">
                            <span className="landing-trust-icon"><LayersIcon /></span>
                            <span className="landing-trust-text">Multi-tenant by design</span>
                        </div>
                        <div className="landing-trust-item">
                            <span className="landing-trust-icon"><ServerIcon /></span>
                            <span className="landing-trust-text">Enterprise-ready architecture</span>
                        </div>
                        <div className="landing-trust-item">
                            <span className="landing-trust-icon"><ShieldIcon /></span>
                            <span className="landing-trust-text">Secure & auditable</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== PROBLEM SECTION ==================== */}
            <section className="landing-problem" id="problem">
                <div className="landing-container">
                    <div className="landing-problem-header">
                        <h2 className="landing-h2">The real pain of scaling fulfillment</h2>
                        <p className="landing-subtitle" style={{ margin: '1rem auto 0' }}>
                            Sound familiar? You're not alone.
                        </p>
                    </div>
                    <div className="landing-problem-grid">
                        <div className="landing-problem-card">
                            <span className="landing-problem-icon"><AlertTriangleIcon /></span>
                            <h3 className="landing-problem-title">Fragmented orders</h3>
                            <p className="landing-problem-desc">
                                Orders scattered across Shopify, WooCommerce, and other platforms with no unified view.
                            </p>
                        </div>
                        <div className="landing-problem-card">
                            <span className="landing-problem-icon"><AlertTriangleIcon /></span>
                            <h3 className="landing-problem-title">Inventory inaccuracies</h3>
                            <p className="landing-problem-desc">
                                Stock levels out of sync, leading to overselling or missed opportunities.
                            </p>
                        </div>
                        <div className="landing-problem-card">
                            <span className="landing-problem-icon"><AlertTriangleIcon /></span>
                            <h3 className="landing-problem-title">Manual fulfillment steps</h3>
                            <p className="landing-problem-desc">
                                Copy-pasting between systems, printing labels one at a time, error-prone processes.
                            </p>
                        </div>
                        <div className="landing-problem-card">
                            <span className="landing-problem-icon"><AlertTriangleIcon /></span>
                            <h3 className="landing-problem-title">No single source of truth</h3>
                            <p className="landing-problem-desc">
                                Different answers from different systems. Who's right?
                            </p>
                        </div>
                        <div className="landing-problem-card">
                            <span className="landing-problem-icon"><AlertTriangleIcon /></span>
                            <h3 className="landing-problem-title">Scaling chaos</h3>
                            <p className="landing-problem-desc">
                                What worked at 100 orders/day breaks at 1,000. Growth becomes a liability.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== SOLUTION SECTION ==================== */}
            <section className="landing-solution" id="solution">
                <div className="landing-container">
                    <div className="landing-solution-header">
                        <h2 className="landing-h2">One system. Total operational clarity.</h2>
                        <p className="landing-subtitle" style={{ margin: '1rem auto 0' }}>
                            RAPPIT brings everything together so your operations run smoothly.
                        </p>
                    </div>
                    <div className="landing-solution-grid">
                        <div className="landing-solution-card">
                            <span className="landing-solution-icon"><LinkIcon /></span>
                            <h3 className="landing-solution-title">Unified order ingestion</h3>
                            <p className="landing-solution-desc">
                                Connect all your sales channels. Every order flows into one system automatically.
                            </p>
                        </div>
                        <div className="landing-solution-card">
                            <span className="landing-solution-icon"><PackageIcon /></span>
                            <h3 className="landing-solution-title">Accurate inventory management</h3>
                            <p className="landing-solution-desc">
                                Real-time stock levels across warehouses. Reserve, adjust, and sync with confidence.
                            </p>
                        </div>
                        <div className="landing-solution-card">
                            <span className="landing-solution-icon"><ZapIcon /></span>
                            <h3 className="landing-solution-title">Automated fulfillment</h3>
                            <p className="landing-solution-desc">
                                From order to shipment without manual intervention. Rules-based automation that scales.
                            </p>
                        </div>
                        <div className="landing-solution-card">
                            <span className="landing-solution-icon"><TruckIcon /></span>
                            <h3 className="landing-solution-title">Reliable shipping workflows</h3>
                            <p className="landing-solution-desc">
                                FedEx, DHL, and more. Create labels, track shipments, handle exceptions gracefully.
                            </p>
                        </div>
                        <div className="landing-solution-card">
                            <span className="landing-solution-icon"><EyeIcon /></span>
                            <h3 className="landing-solution-title">Full operational visibility</h3>
                            <p className="landing-solution-desc">
                                Dashboards, alerts, and audit logs. Know what's happening and why.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== HOW IT WORKS ==================== */}
            <section className="landing-how" id="how-it-works">
                <div className="landing-container">
                    <div className="landing-how-header">
                        <h2 className="landing-h2">How RAPPIT works</h2>
                        <p className="landing-subtitle" style={{ margin: '1rem auto 0' }}>
                            Simple to understand. Powerful in practice.
                        </p>
                    </div>
                    <div className="landing-how-steps">
                        <div className="landing-how-step">
                            <span className="landing-how-number">1</span>
                            <div className="landing-how-content">
                                <h3 className="landing-how-title">Connect your platforms</h3>
                                <p className="landing-how-desc">
                                    Link Shopify, WooCommerce, and other channels via secure OAuth. No API keys to manage.
                                </p>
                            </div>
                        </div>
                        <div className="landing-how-step">
                            <span className="landing-how-number">2</span>
                            <div className="landing-how-content">
                                <h3 className="landing-how-title">Orders flow into RAPPIT</h3>
                                <p className="landing-how-desc">
                                    New orders sync automatically. See them all in one unified queue.
                                </p>
                            </div>
                        </div>
                        <div className="landing-how-step">
                            <span className="landing-how-number">3</span>
                            <div className="landing-how-content">
                                <h3 className="landing-how-title">Inventory is reserved accurately</h3>
                                <p className="landing-how-desc">
                                    Stock is locked at order time. No overselling, even under heavy load.
                                </p>
                            </div>
                        </div>
                        <div className="landing-how-step">
                            <span className="landing-how-number">4</span>
                            <div className="landing-how-content">
                                <h3 className="landing-how-title">Shipments are created automatically</h3>
                                <p className="landing-how-desc">
                                    Labels generated, carriers selected, tracking numbers assigned — hands-free.
                                </p>
                            </div>
                        </div>
                        <div className="landing-how-step">
                            <span className="landing-how-number">5</span>
                            <div className="landing-how-content">
                                <h3 className="landing-how-title">Operations stay in sync</h3>
                                <p className="landing-how-desc">
                                    Status updates flow back to sales channels. Customers stay informed.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== WHO IT'S FOR ==================== */}
            <section className="landing-personas" id="personas">
                <div className="landing-container">
                    <div className="landing-personas-header">
                        <h2 className="landing-h2">Who RAPPIT is for</h2>
                        <p className="landing-subtitle" style={{ margin: '1rem auto 0' }}>
                            Built for teams who take operations seriously.
                        </p>
                    </div>
                    <div className="landing-personas-grid">
                        <div className="landing-persona-card">
                            <span className="landing-persona-icon"><UsersIcon /></span>
                            <h3 className="landing-persona-title">Operations teams</h3>
                            <p className="landing-persona-desc">
                                Stop firefighting. Start operating with confidence and visibility.
                            </p>
                        </div>
                        <div className="landing-persona-card">
                            <span className="landing-persona-icon"><ShoppingCartIcon /></span>
                            <h3 className="landing-persona-title">Growing e-commerce brands</h3>
                            <p className="landing-persona-desc">
                                Scale your fulfillment without scaling your headcount.
                            </p>
                        </div>
                        <div className="landing-persona-card">
                            <span className="landing-persona-icon"><BuildingIcon /></span>
                            <h3 className="landing-persona-title">Multi-warehouse organizations</h3>
                            <p className="landing-persona-desc">
                                Unified inventory across locations. Smart allocation and routing.
                            </p>
                        </div>
                        <div className="landing-persona-card">
                            <span className="landing-persona-icon"><CodeIcon /></span>
                            <h3 className="landing-persona-title">CTOs & technical leaders</h3>
                            <p className="landing-persona-desc">
                                Enterprise-grade architecture. APIs that make sense. No vendor lock-in.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== PHILOSOPHY ==================== */}
            <section className="landing-philosophy" id="philosophy">
                <div className="landing-container">
                    <div className="landing-philosophy-header">
                        <h2 className="landing-h2">Our platform philosophy</h2>
                        <p className="landing-subtitle" style={{ margin: '1rem auto 0' }}>
                            Principles that guide everything we build.
                        </p>
                    </div>
                    <div className="landing-philosophy-grid">
                        <div className="landing-philosophy-item">
                            <p className="landing-philosophy-quote">Accuracy over hacks</p>
                            <p className="landing-philosophy-desc">
                                We don't cut corners. Every number is correct, every transaction is reliable.
                            </p>
                        </div>
                        <div className="landing-philosophy-item">
                            <p className="landing-philosophy-quote">Automation without loss of control</p>
                            <p className="landing-philosophy-desc">
                                Automate the routine. Stay in command of the exceptions.
                            </p>
                        </div>
                        <div className="landing-philosophy-item">
                            <p className="landing-philosophy-quote">Built to scale, not patched to survive</p>
                            <p className="landing-philosophy-desc">
                                Architecture designed for 10x growth from day one.
                            </p>
                        </div>
                        <div className="landing-philosophy-item">
                            <p className="landing-philosophy-quote">Designed for long-term operations</p>
                            <p className="landing-philosophy-desc">
                                Not a quick fix. A foundation you can build on for years.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== SECURITY ==================== */}
            <section className="landing-security" id="security">
                <div className="landing-container">
                    <div className="landing-security-header">
                        <h2 className="landing-h2">Security & reliability</h2>
                        <p className="landing-subtitle" style={{ margin: '1rem auto 0' }}>
                            Enterprise-grade infrastructure for serious operations.
                        </p>
                    </div>
                    <div className="landing-security-grid">
                        <div className="landing-security-item">
                            <span className="landing-security-icon"><CheckCircleIcon /></span>
                            <span className="landing-security-text">Organization-level data isolation</span>
                        </div>
                        <div className="landing-security-item">
                            <span className="landing-security-icon"><CheckCircleIcon /></span>
                            <span className="landing-security-text">Complete audit logs</span>
                        </div>
                        <div className="landing-security-item">
                            <span className="landing-security-icon"><CheckCircleIcon /></span>
                            <span className="landing-security-text">Secure OAuth integrations</span>
                        </div>
                        <div className="landing-security-item">
                            <span className="landing-security-icon"><CheckCircleIcon /></span>
                            <span className="landing-security-text">Reliable background processing</span>
                        </div>
                        <div className="landing-security-item">
                            <span className="landing-security-icon"><CheckCircleIcon /></span>
                            <span className="landing-security-text">Production-grade architecture</span>
                        </div>
                        <div className="landing-security-item">
                            <span className="landing-security-icon"><CheckCircleIcon /></span>
                            <span className="landing-security-text">Role-based access control</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== FINAL CTA ==================== */}
            <section className="landing-cta" id="cta">
                <div className="landing-container">
                    <div className="landing-cta-content">
                        <h2 className="landing-h2 landing-cta-headline">
                            Build fulfillment you can trust.
                        </h2>
                        <p className="landing-subtitle landing-cta-subtext">
                            RAPPIT is currently onboarding early partners.
                        </p>
                        <div className="landing-cta-buttons">
                            <button
                                className="landing-btn landing-btn-primary"
                                onClick={onRequestAccess}
                            >
                                Request access
                            </button>
                            <button className="landing-btn landing-btn-secondary">
                                Talk to the team
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== FOOTER ==================== */}
            <footer className="landing-footer">
                <div className="landing-container">
                    <div className="landing-footer-content">
                        <div className="landing-footer-brand">
                            <span className="landing-footer-logo">RAPPIT</span>
                            <p className="landing-footer-desc">
                                Multi-tenant fulfillment & inventory management for modern operations.
                            </p>
                        </div>
                        <div className="landing-footer-links">
                            <a href="mailto:hello@rappit.io" className="landing-footer-link">
                                hello@rappit.io
                            </a>
                            <span className="landing-footer-link">
                                Privacy Policy
                            </span>
                            <span className="landing-footer-link">
                                Terms of Service
                            </span>
                            <div className="landing-footer-lang">
                                <button
                                    className={`landing-footer-lang-btn ${language === 'EN' ? 'active' : ''}`}
                                    onClick={() => setLanguage('EN')}
                                >
                                    EN
                                </button>
                                <button
                                    className={`landing-footer-lang-btn ${language === 'AR' ? 'active' : ''}`}
                                    onClick={() => setLanguage('AR')}
                                >
                                    AR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
