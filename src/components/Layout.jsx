import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, Settings, Receipt,
  User, Building2, PieChart, Home,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useFinanceData } from '../hooks/useFinanceData';
import { triggerHapticSelection } from '../lib/haptics';
import AvatarFallback from './AvatarFallback';
import NotificationCenter from './NotificationCenter';

// Desktop top-nav items (no Account — it's the avatar on the right)
const desktopNavItems = [
  { name: 'Home',         path: '/dashboard',    icon: Home            },
  { name: 'Transactions', path: '/transactions', icon: Receipt         },
  { name: 'Budget',       path: '/budget',       icon: PieChart        },
  { name: 'Loans',        path: '/loans',        icon: Building2       },
  { name: 'Setup',        path: '/setup',        icon: Settings        },
];

// Mobile bottom-nav items
const mobileNavItems = [
  { name: 'Home',    path: '/dashboard',    icon: Home            },
  { name: 'Txns',   path: '/transactions', icon: Receipt         },
  { name: 'Budget', path: '/budget',       icon: PieChart        },
  { name: 'Loans',  path: '/loans',        icon: Building2       },
  { name: 'Setup',  path: '/setup',        icon: Settings        },
];

const Layout = () => {
  const { currentUser } = useAuth();
  const { isPro, subscription, activeAlerts } = useFinanceData();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 10);
    main.addEventListener('scroll', onScroll);
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20 w-full max-w-full overflow-x-hidden">

      {/* ── Desktop Top Navigation Bar ─────────────────────────── */}
      <header className={cn(
        "hidden md:flex items-center justify-between px-6 py-2.5 sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "bg-card/95 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-card/80 backdrop-blur-md border-b border-border/50"
      )}>
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-1.5 bg-primary/10 text-primary rounded-xl border border-primary/20 shadow-sm">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-foreground">BudgetTracker</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            {subscription === 'trial' ? 'Free Trial' : isPro ? 'Pro' : 'Starter'}
          </span>
        </div>

        {/* Center: Nav Links */}
        <nav className="flex items-center gap-1">
          {desktopNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={triggerHapticSelection}
              className={({ isActive }) => cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  )} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right: Notifications & Profile Avatar */}
        <div className="flex items-center gap-2.5">
          <NotificationCenter alerts={activeAlerts || []} />
          <NavLink
            to="/account"
            onClick={triggerHapticSelection}
            className={({ isActive }) => cn(
              "relative w-9 h-9 rounded-full border-2 overflow-hidden flex items-center justify-center transition-all duration-200 shadow-sm shrink-0",
              isActive
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-primary/50"
            )}
            title="Account"
          >
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <AvatarFallback />
            )}
            {(isPro || subscription === 'trial') && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-background" />
            )}
          </NavLink>
        </div>
      </header>

      {/* ── Mobile Header ─────────────────────────────────────── */}
      <header className={cn(
        "md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "bg-card/95 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-background/80 backdrop-blur-md"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 text-primary rounded-xl border border-primary/20 shadow-sm">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">
            BudgetTracker
          </span>
        </div>

        {/* Mobile Right: Notifications & Avatar */}
        <div className="flex items-center gap-2">
          <NotificationCenter alerts={activeAlerts || []} />
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
              <AvatarFallback />
            )}
            {(isPro || subscription === 'trial') && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-background" />
            )}
          </NavLink>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main
        id="main-content"
        className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-28 md:pb-8 w-full max-w-full overflow-x-auto"
      >
        <div className="max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile Bottom Navigation ───────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 w-full max-w-full">
        <div className="bg-card/95 backdrop-blur-2xl border-t border-border/80 shadow-2xl">
          <div className="flex justify-around items-center px-2 py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            {mobileNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={triggerHapticSelection}
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
    </div>
  );
};

export default Layout;
