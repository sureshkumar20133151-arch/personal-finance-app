
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, Settings, Receipt,
  User, Building2, TrendingUp, PieChart,
  Sparkles, ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import ClockWidget from './ClockWidget';
import { useAuth } from '../context/AuthContext';
import { useFinanceData } from '../hooks/useFinanceData';

const desktopNavItems = [
  { name: 'Dashboard',    path: '/dashboard',    icon: LayoutDashboard, color: 'text-violet-400' },
  { name: 'Transactions', path: '/transactions', icon: Receipt,         color: 'text-blue-400'   },
  { name: 'Budget',       path: '/budget',       icon: PieChart,        color: 'text-emerald-400'},
  { name: 'Loans',        path: '/loans',        icon: Building2,       color: 'text-amber-400'  },
  { name: 'Setup',        path: '/setup',        icon: Settings,        color: 'text-pink-400'   },
  { name: 'Account',      path: '/account',      icon: User,            color: 'text-cyan-400'   },
];

const mobileNavItems = [
  { name: 'Home',    path: '/dashboard',    icon: LayoutDashboard },
  { name: 'Txns',   path: '/transactions', icon: Receipt         },
  { name: 'Budget', path: '/budget',       icon: PieChart        },
  { name: 'Loans',  path: '/loans',        icon: Building2       },
  { name: 'Setup',  path: '/setup',        icon: Settings        },
];

const Layout = () => {
  const { currentUser } = useAuth();
  const { isPro, subscription } = useFinanceData();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 10);
    main.addEventListener('scroll', onScroll);
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  const userInitial = (currentUser?.displayName || currentUser?.email || 'U')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans selection:bg-primary/20 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/8 via-background to-background">

      {/* ── Mobile Header ─────────────────────────────────────── */}
      <header className={cn(
        "md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-card/90 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-gradient-to-br from-primary to-purple-600 rounded-lg shadow-md shadow-primary/30">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent tracking-tight">
            BudgetTracker
          </span>
        </div>

        {/* Avatar / Account link */}
        <NavLink
          to="/account"
          className={({ isActive }) => cn(
            "relative w-9 h-9 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all duration-200 shadow-sm",
            isActive
              ? "border-primary ring-2 ring-primary/30"
              : "border-border hover:border-primary/50"
          )}
        >
          {currentUser?.photoURL ? (
            <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center text-primary font-bold text-sm">
              {userInitial}
            </div>
          )}
          {(isPro || subscription === 'trial') && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full border-2 border-background" />
          )}
        </NavLink>
      </header>

      {/* ── Desktop Sidebar ────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 lg:w-72 bg-card/50 backdrop-blur-2xl border-r border-border/60 shadow-2xl h-screen sticky top-0 flex-col">
        <div className="h-full flex flex-col p-5 lg:p-6">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-6 px-1">
            <div className="p-2.5 bg-gradient-to-br from-primary via-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-primary/30 shrink-0">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-foreground">BudgetTracker</span>
              <div className="flex items-center gap-1 mt-0.5">
                <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">
                  {subscription === 'trial' ? 'Free Trial' : isPro ? 'Pro' : 'Starter'}
                </span>
              </div>
            </div>
          </div>

          {/* Clock */}
          <div className="mb-5">
            <ClockWidget />
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {desktopNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "bg-primary text-white shadow-lg nav-active-glow font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn(
                      "w-4.5 h-4.5 shrink-0 transition-all duration-200",
                      isActive
                        ? "text-white"
                        : cn("group-hover:scale-110", item.color)
                    )} />
                    <span className="text-sm font-medium flex-1">{item.name}</span>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-white/60" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Pro tip / upgrade nudge */}
          <div className="mt-4 pt-4 border-t border-border/50">
            {/* User info pill */}
            <div className="flex items-center gap-2.5 px-2 mb-4">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-border shrink-0 flex items-center justify-center bg-primary/10">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-bold text-xs">{userInitial}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {currentUser?.email}
                </p>
              </div>
            </div>

            {/* Pro tip card */}
            <div className="bg-gradient-to-br from-primary/10 via-purple-500/8 to-indigo-500/10 p-4 rounded-xl border border-primary/15 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="w-3 h-3 text-primary" />
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Pro Tip</p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Categorize expenses daily for 30% better spending insights & budget accuracy.
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Navigation ───────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Blur + border */}
        <div className="bg-card/95 backdrop-blur-2xl border-t border-border/80 shadow-2xl">
          <div className="flex justify-around items-center px-2 py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            {mobileNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[52px] relative",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {({ isActive }) => (
                  <>
                    {/* Active background pill */}
                    {isActive && (
                      <span className="absolute inset-0 bg-primary/10 rounded-xl animate-in zoom-in-75 fade-in duration-200" />
                    )}
                    <item.icon className={cn(
                      "w-5 h-5 transition-all duration-200 relative z-10",
                      isActive ? "text-primary scale-110 stroke-[2.2]" : "text-muted-foreground stroke-[1.8]"
                    )} />
                    <span className={cn(
                      "text-[9.5px] font-medium tracking-tight relative z-10 transition-all duration-200",
                      isActive ? "text-primary font-bold" : "text-muted-foreground"
                    )}>
                      {item.name}
                    </span>
                    {/* Active dot indicator */}
                    {isActive && (
                      <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary animate-in zoom-in-50 duration-300" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main
        id="main-content"
        className="flex-1 p-4 md:p-6 lg:p-8 pb-24 md:pb-8 overflow-y-auto w-full"
        style={{ maxWidth: 'calc(100vw)' }}
      >
        <div className="max-w-7xl mx-auto animate-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
