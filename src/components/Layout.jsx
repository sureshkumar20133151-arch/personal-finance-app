
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
        <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans selection:bg-primary/20">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">BudgetTracker</h1>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar (Desktop) / Mobile Menu */}
            <aside className={cn(
                "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-300 md:translate-x-0 md:static md:h-screen md:block pt-16 md:pt-0",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-full flex flex-col p-6">
                    <div className="hidden md:flex items-center gap-2 mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Wallet className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">BudgetTracker</span>
                    </div>

                    {/* Clock Widget (Desktop Sidebar) */}
                    <div className="hidden md:block mb-4">
                        <ClockWidget />
                    </div>

                    <nav className="flex-1 space-y-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={({ isActive }) => cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-r-3xl transition-all duration-200 group mr-4", // Added mr-4 for spacing and rounded-r-3xl for the pill shape
                                    isActive
                                        ? "bg-orange-100 text-orange-950 font-bold shadow-sm" // Peach background, dark text
                                        : "text-muted-foreground hover:bg-orange-50 hover:text-orange-900"
                                )}
                            >
                                <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                                {item.name}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mt-auto pt-6 border-t border-border">
                        <div className="bg-gradient-to-br from-primary/10 to-transparent p-4 rounded-xl border border-primary/10">
                            <p className="text-xs text-primary font-medium mb-1">Pro Tip</p>
                            <p className="text-xs text-muted-foreground">Categorize transactions consistently for better insights.</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
