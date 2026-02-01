
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    TrendingUp, Shield, BarChart3, CheckCircle2,
    ArrowRight, Lock, Smartphone, Zap,
    PieChart, Calendar, Menu, X, ChevronDown
} from 'lucide-react';
import { cn } from "../lib/utils";

const Landing = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { loginAsDemoUser } = useAuth();
    const navigate = useNavigate();

    const handleDemo = async () => {
        await loginAsDemoUser();
        navigate('/dashboard');
    };

    // FAQ Data
    const faqs = [
        { q: "Is my data safe?", a: "Yes. We use industry-standard encryption and secure cloud storage. Your data is private and never shared." },
        { q: "Can I use it on mobile?", a: "Absolutely. BudgetTracker is fully responsive and works perfectly on smartphones, tablets, and desktops." },
        { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time. No questions asked." },
        { q: "Is it suitable for small businesses?", a: "The Pro plan is designed with freelancers and small businesses in mind, offering unlimited tracking and detailed reports." }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-primary/20">
            {/* --- HEADER --- */}
            <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
                <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl text-slate-800">
                        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        BudgetTracker
                    </div>

                    {/* Desktop Nav */}
                    <div className="hidden md:flex items-center gap-6">
                        <a href="#features" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">Features</a>
                        <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">Pricing</a>
                        <a href="#faq" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">FAQ</a>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-primary transition-colors">
                            Log in
                        </Link>
                        <Link to="/signup" className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 hover:shadow active:scale-95">
                            Get Started Free
                        </Link>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        {isMobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </header>

            {/* Mobile Nav Dropdown */}
            {isMobileMenuOpen && (
                <div className="fixed top-16 left-0 w-full bg-white border-b border-slate-200 p-4 md:hidden z-40 flex flex-col gap-4 shadow-xl animate-in slide-in-from-top-5">
                    <a href="#features" className="text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
                    <a href="#pricing" className="text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
                    <a href="#faq" className="text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>FAQ</a>
                    <hr className="border-slate-100" />
                    <Link to="/login" className="text-sm font-semibold text-center py-2" onClick={() => setIsMobileMenuOpen(false)}>Log in</Link>
                    <Link to="/signup" className="text-sm font-semibold bg-primary text-white text-center py-2 rounded-lg" onClick={() => setIsMobileMenuOpen(false)}>Get Started Free</Link>
                </div>
            )}

            <main className="pt-16">
                {/* --- SECTION 1: HERO --- */}
                <section className="py-20 md:py-32 lg:py-40 relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10" />
                    <div className="container mx-auto px-4 md:px-8 text-center max-w-4xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-6 animate-in fade-in slide-in-from-bottom-3 duration-700">
                            ✨ Smart Money Management
                        </div>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                            Take Control of Your Money <br className="hidden md:block" />
                            <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">Simply & Securely</span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
                            Stop wondering where your money went. Track income, expenses, and savings with the easiest personal finance tool designed for real people.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
                            <Link to="/signup" className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-xl">
                                Get Started Free <ArrowRight className="ml-2 w-4 h-4" />
                            </Link>
                            <button onClick={handleDemo} className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-xl bg-orange-100 border border-orange-200 px-8 text-base font-bold text-orange-700 shadow-sm transition-all hover:bg-orange-200">
                                Try Demo
                            </button>
                            <Link to="/login" className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-xl bg-white border border-slate-200 px-8 text-base font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-primary">
                                Login
                            </Link>
                        </div>

                        {/* Dashboard Placeholder / Image */}
                        <div className="mt-16 relative mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
                            <div className="bg-slate-50 border-b border-slate-100 p-2 flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                                <div className="w-3 h-3 rounded-full bg-green-400/80" />
                            </div>
                            <div className="aspect-[16/9] bg-slate-50 flex items-center justify-center">
                                {/* Use an actual screenshot here if available, using a placeholder for now */}
                                <div className="text-center p-8">
                                    <BarChart3 className="w-24 h-24 text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-400 font-medium">Dashboard Preview</p>
                                    <p className="text-slate-300 text-sm">Visual charts, recent transactions, and goal tracking.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- SECTION 2: PROBLEM --- */}
                <section className="py-20 bg-white">
                    <div className="container mx-auto px-4 md:px-8">
                        <div className="max-w-3xl mx-auto text-center mb-16">
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why is managing money so hard?</h2>
                            <p className="text-lg text-slate-600">Most people fail at budgeting because the tools are too complicated.</p>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                { title: "Confusing Spreadsheets", desc: "Complex formulas and endless rows that break easily.", icon: "📉" },
                                { title: "No Monthly Clarity", desc: "Not knowing if you're overspending until it's too late.", icon: "🤷" },
                                { title: "Manual Calculations", desc: "Wasting hours adding up receipts and bills.", icon: "🧮" },
                                { title: "Fear of Data Loss", desc: "Worrying about losing your local files or notes.", icon: "💾" }
                            ].map((item, i) => (
                                <div key={i} className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors text-center border border-slate-100">
                                    <div className="text-4xl mb-4">{item.icon}</div>
                                    <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                                    <p className="text-sm text-slate-600">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- SECTION 3: SOLUTION --- */}
                <section className="py-20 bg-slate-900 text-white">
                    <div className="container mx-auto px-4 md:px-8">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-8">
                                <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                                    The solution you've been <br /><span className="text-primary">waiting for.</span>
                                </h2>
                                <p className="text-slate-300 text-lg">BudgetTracker removes the friction from personal finance. We do the heavy lifting so you can focus on living.</p>
                                <ul className="space-y-4">
                                    {[
                                        "Easy daily income & expense entry",
                                        "Automatic summaries & visual reports",
                                        "Simple, intuitive dashboard",
                                        "No technical knowledge required"
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-center gap-3 text-slate-200">
                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-purple-500/20 rounded-2xl blur-2xl"></div>
                                <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-8 aspect-square flex items-center justify-center">
                                    <div className="text-center">
                                        <Zap className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                                        <p className="font-bold text-xl">Fast & Simple</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- SECTION 4: FEATURES --- */}
                <section id="features" className="py-20 bg-slate-50">
                    <div className="container mx-auto px-4 md:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <h2 className="text-3xl font-bold text-slate-900">Features that matter</h2>
                            <p className="text-slate-600 mt-2">Everything you need to manage your finances, nothing you don't.</p>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                { title: "Secure Account", desc: "Private personal account protected by industry standards.", icon: Lock },
                                { title: "Smart Tracking", desc: "Log income and expenses in seconds, not minutes.", icon: TrendingUp },
                                { title: "Visual Reports", desc: "Category-wise breakdowns to spot spending habits.", icon: PieChart },
                                { title: "Monthly Summary", desc: "See your month at a glance: Income vs Expenses.", icon: Calendar },
                                { title: "Anywhere Access", desc: "Works seamlessly on your mobile, tablet, or desktop.", icon: Smartphone },
                                { title: "Cloud Sync", desc: "Your data is backed up instantly. Never lose a record.", icon: Zap },
                            ].map((f, i) => (
                                <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                                        <f.icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-bold text-xl text-slate-900 mb-2">{f.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- SECTION 5: HOW IT WORKS --- */}
                <section className="py-20 bg-white">
                    <div className="container mx-auto px-4 md:px-8">
                        <h2 className="text-3xl font-bold text-center text-slate-900 mb-16">How it works</h2>
                        <div className="grid md:grid-cols-3 gap-8 relative">
                            {/* Connector Line (Desktop) */}
                            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-transparent via-slate-200 to-transparent -z-10" />

                            {[
                                { step: "01", title: "Create Account", desc: "Sign up for free in 30 seconds." },
                                { step: "02", title: "Add Entries", desc: "Log your daily income and expenses." },
                                { step: "03", title: "View Insights", desc: "See reports and start saving more." }
                            ].map((s, i) => (
                                <div key={i} className="text-center bg-white">
                                    <div className="w-24 h-24 mx-auto bg-white border-4 border-slate-50 rounded-full flex items-center justify-center text-2xl font-black text-slate-200 mb-6 shadow-sm">
                                        {s.step}
                                    </div>
                                    <h3 className="font-bold text-xl text-slate-900 mb-2">{s.title}</h3>
                                    <p className="text-slate-600">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- SECTION 6: SECURITY & TRUST --- */}
                <section className="py-16 bg-slate-50 border-y border-slate-200">
                    <div className="container mx-auto px-4 md:px-8 text-center">
                        <div className="inline-flex items-center gap-2 mb-4 text-primary font-semibold">
                            <Shield className="w-5 h-5" /> Bank-Grade Security
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-8">Your data belongs to you.</h2>
                        <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-slate-500 font-medium">
                            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Secure Login</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Encrypted Storage</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Private Data</span>
                            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No Ad Sharing</span>
                        </div>
                    </div>
                </section>

                {/* --- SECTION 7: PRICING --- */}
                <section id="pricing" className="py-20 bg-white">
                    <div className="container mx-auto px-4 md:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <h2 className="text-3xl font-bold text-slate-900">Simple Pricing</h2>
                            <p className="text-slate-600 mt-2">Start for free, upgrade when you grow.</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            {/* Free Plan */}
                            <div className="p-8 rounded-3xl border border-slate-200 bg-white hover:border-slate-300 transition-all">
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Free Plan</h3>
                                <div className="text-4xl font-black text-slate-900 mb-6">₹0<span className="text-base font-medium text-slate-500">/mo</span></div>
                                <p className="text-slate-600 mb-8 pb-8 border-b border-slate-100">For individuals getting started.</p>
                                <ul className="space-y-4 mb-8">
                                    <li className="flex items-center gap-3 text-sm text-slate-700"><CheckCircle2 className="w-5 h-5 text-green-500" /> Basic Income/Expense Tracking</li>
                                    <li className="flex items-center gap-3 text-sm text-slate-700"><CheckCircle2 className="w-5 h-5 text-green-500" /> Limited Entries (50/mo)</li>
                                    <li className="flex items-center gap-3 text-sm text-slate-700"><CheckCircle2 className="w-5 h-5 text-green-500" /> Basic Summary</li>
                                </ul>
                                <Link to="/signup" className="block w-full py-3 px-6 text-center rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors">Start Free</Link>
                            </div>

                            {/* Pro Plan */}
                            <div className="relative p-8 rounded-3xl border-2 border-primary bg-slate-900 text-white shadow-2xl">
                                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">RECOMMENDED</div>
                                <h3 className="text-2xl font-bold mb-2">Pro Plan</h3>
                                <div className="text-4xl font-black mb-6">₹199<span className="text-base font-medium text-slate-400">/mo</span></div>
                                <p className="text-slate-300 mb-8 pb-8 border-b border-slate-800">For serious savers and businesses.</p>
                                <ul className="space-y-4 mb-8">
                                    <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary" /> <strong>Unlimited</strong> Entries</li>
                                    <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary" /> Advanced Reports & Insights</li>
                                    <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary" /> Priority Email Support</li>
                                    <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="w-5 h-5 text-primary" /> Export Data</li>
                                </ul>
                                <Link to="/account" className="block w-full py-3 px-6 text-center rounded-xl bg-primary font-bold text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">Upgrade to Pro</Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- SECTION 8: FAQ --- */}
                <section id="faq" className="py-20 bg-slate-50">
                    <div className="container mx-auto px-4 md:px-8 max-w-3xl">
                        <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Frequently Asked Questions</h2>
                        <div className="space-y-4">
                            {faqs.map((faq, i) => (
                                <div key={i} className="bg-white rounded-xl p-6 border border-slate-200">
                                    <h3 className="font-bold text-lg text-slate-900 mb-2">{faq.q}</h3>
                                    <p className="text-slate-600">{faq.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* --- SECTION 9: FINAL CTA --- */}
                <section className="py-24 bg-primary text-white text-center">
                    <div className="container mx-auto px-4 md:px-8">
                        <h2 className="text-3xl md:text-5xl font-extrabold mb-6">Start tracking your money <br />the smart way.</h2>
                        <p className="text-primary-foreground/80 text-xl mb-10 max-w-2xl mx-auto">Join thousands of users who are taking control of their financial future today.</p>
                        <Link to="/signup" className="inline-flex h-14 items-center justify-center rounded-2xl bg-white px-10 text-lg font-bold text-primary shadow-xl transition-all hover:bg-slate-50 hover:scale-105">
                            Create Free Account
                        </Link>
                    </div>
                </section>

                {/* --- SECTION 10: FOOTER --- */}
                <footer className="py-12 bg-slate-900 text-slate-400 text-sm">
                    <div className="container mx-auto px-4 md:px-8">
                        <div className="grid md:grid-cols-4 gap-8 mb-8 border-b border-slate-800 pb-8">
                            <div className="col-span-2">
                                <div className="flex items-center gap-2 font-bold text-xl text-white mb-4">
                                    <TrendingUp className="w-5 h-5 text-primary" /> BudgetTracker
                                </div>
                                <p className="max-w-xs">Simple, secure, and smart personal finance tracking for everyone.</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-4">Product</h4>
                                <ul className="space-y-2">
                                    <li><a href="#features" className="hover:text-primary">Features</a></li>
                                    <li><a href="#pricing" className="hover:text-primary">Pricing</a></li>
                                    <li><Link to="/login" className="hover:text-primary">Login</Link></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-bold text-white mb-4">Legal</h4>
                                <ul className="space-y-2">
                                    <li><a href="#" className="hover:text-primary">Privacy Policy</a></li>
                                    <li><a href="#" className="hover:text-primary">Terms & Conditions</a></li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <p>&copy; {new Date().getFullYear()} BudgetTracker. All rights reserved.</p>
                            <p>support@budgettracker.com</p>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default Landing;
