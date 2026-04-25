
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Wallet, Settings, Receipt, Menu, X, User, Building2, TrendingUp, PieChart } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import ClockWidget from './ClockWidget';

const Layout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Transactions', path: '/transactions', icon: Receipt },
        { name: 'Budget', path: '/budget', icon: PieChart },
        { name: 'Loans', path: '/loans', icon: Building2 },
        { name: 'Setup', path: '/setup', icon: Settings },
        { name: 'Account', path: '/account', icon: User },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans selection:bg-primary/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">BudgetTracker</h1>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar (Desktop) / Mobile Menu */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-40 w-72 bg-card/60 backdrop-blur-2xl border-r border-white/20 dark:border-white/5 shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static md:h-screen md:block pt-16 md:pt-0",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-full flex flex-col p-6">
                    <div className="hidden md:flex items-center gap-3 mb-8 px-2">
                        <div className="p-2.5 bg-gradient-to-br from-primary to-purple-600 rounded-xl shadow-lg shadow-primary/20">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent tracking-tight">BudgetTracker</span>
                    </div>

                    {/* Clock Widget (Desktop Sidebar) */}
                    <div className="hidden md:block mb-8">
                        <ClockWidget />
                    </div>

                    <nav className="flex-1 space-y-1.5">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) => cn(
                                    "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                                    isActive
                                        ? "bg-primary text-white shadow-xl shadow-primary/25 font-medium"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5"
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
                                        <span className="relative z-10">{item.name}</span>
                                        {!isActive && <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300" />}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mt-auto pt-8">
                        <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 p-5 rounded-2xl border border-primary/10 backdrop-blur-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-primary/20 rounded-full">
                                    <TrendingUp className="w-3 h-3 text-primary" />
                                </div>
                                <p className="text-xs text-primary font-bold uppercase tracking-wider">Pro Tip</p>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">Categorize transactions consistently for 30% better spending insights.</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto md:ml-6">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
