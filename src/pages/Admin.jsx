import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { isAppOwner } from '../utils/admin';
import {
  Users, Crown, Zap, Clock, TrendingUp, IndianRupee, Search,
  Download, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck,
  Calendar, Phone, MapPin, Briefcase, Mail, Filter, Sparkles, Tag, Plus, Trash2, ArrowUpRight,
  Edit2, X, Copy
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const STARTER_ANNUAL_PRICE = 499;
const PRO_ANNUAL_PRICE = 999;

const Admin = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'coupons'
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('all'); // 'all' | 'pro' | 'starter' | 'trial' | 'expired'
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name'

  // New coupon modal / form
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDays, setNewCouponDays] = useState('30');
  const [couponCreating, setCouponCreating] = useState(false);
  // Edit customer modal / form
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editProfession, setEditProfession] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const handleOpenEditCustomer = (u) => {
    setEditingCustomer(u);
    const email = u.email || u.profile?.email || '';
    const fullName = [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(' ') || u.displayName || (email ? email.split('@')[0] : '');
    setEditName(fullName);
    setEditEmail(email);
    setEditMobile(u.profile?.mobile || '');
    setEditProfession(u.profile?.profession || '');
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setSavingCustomer(true);
    try {
      const cleanName = editName.trim();
      const cleanEmail = editEmail.trim();
      const cleanMobile = editMobile.trim();
      const cleanProfession = editProfession.trim();

      const updates = {
        displayName: cleanName || (cleanEmail ? cleanEmail.split('@')[0] : 'User'),
        email: cleanEmail,
        profile: {
          ...(editingCustomer.profile || {}),
          firstName: cleanName.split(' ')[0] || '',
          lastName: cleanName.split(' ').slice(1).join(' ') || '',
          mobile: cleanMobile,
          profession: cleanProfession,
        },
      };

      await setDoc(doc(db, 'users', editingCustomer.id), updates, { merge: true });

      setUsers((prev) =>
        prev.map((u) => (u.id === editingCustomer.id ? { ...u, ...updates, profile: { ...(u.profile || {}), ...updates.profile } } : u))
      );
      showSuccessBanner(`Customer ${cleanName || cleanEmail || 'details'} saved successfully!`);
      setEditingCustomer(null);
    } catch (err) {
      console.error('[Admin] Failed to update customer:', err);
      alert(`Failed to save customer: ${err.message}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const showSuccessBanner = (msg) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(''), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const userList = [];
      usersSnap.forEach((docSnap) => {
        userList.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
      setUsers(userList);

      // 2. Fetch Coupons
      try {
        const couponsSnap = await getDocs(collection(db, 'coupons'));
        const couponList = [];
        couponsSnap.forEach((docSnap) => {
          couponList.push({
            code: docSnap.id,
            ...docSnap.data(),
          });
        });
        setCoupons(couponList);
      } catch (couponErr) {
        console.warn('[Admin] Could not load coupons collection:', couponErr);
      }
    } catch (err) {
      console.error('[Admin] Failed to fetch admin data:', err);
      setError(err.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ─── Plan & Subscription Controls ──────────────────────────────────────────
  const handleUpdateUserPlan = async (user, newPlan, bonusDays = 30) => {
    try {
      const userRef = doc(db, 'users', user.id);
      let updates = {};

      if (newPlan === 'pro') {
        updates = {
          subscription: 'pro',
          subscriptionStatus: 'active',
          subscriptionUpdatedAt: new Date().toISOString(),
        };
      } else if (newPlan === 'starter') {
        updates = {
          subscription: 'starter',
          subscriptionStatus: 'active',
          subscriptionUpdatedAt: new Date().toISOString(),
        };
      } else if (newPlan === 'trial') {
        const base = user.trialEndDate && new Date(user.trialEndDate) > new Date()
          ? new Date(user.trialEndDate)
          : new Date();
        const newTrialEnd = new Date(base.getTime() + bonusDays * 24 * 60 * 60 * 1000).toISOString();
        updates = {
          subscription: 'trial',
          trialEndDate: newTrialEnd,
          subscriptionStatus: 'active',
        };
      } else if (newPlan === 'expired') {
        updates = {
          subscription: 'trial',
          trialEndDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          subscriptionStatus: 'expired',
        };
      }

      await setDoc(userRef, updates, { merge: true });

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updates } : u))
      );

      showSuccessBanner(`Updated ${user.email || user.displayName || 'Customer'} to ${newPlan.toUpperCase()} successfully!`);
    } catch (err) {
      console.error('[Admin] Plan update error:', err);
      alert(`Failed to update plan: ${err.message}`);
    }
  };

  // ─── Coupon Management ─────────────────────────────────────────────────────
  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    const cleanCode = newCouponCode.trim().toUpperCase();
    const days = parseInt(newCouponDays, 10);
    if (!cleanCode || isNaN(days) || days <= 0) {
      alert('Please provide a valid coupon code and positive bonus days.');
      return;
    }

    setCouponCreating(true);
    try {
      const couponRef = doc(db, 'coupons', cleanCode);
      const couponData = {
        bonusDays: days,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.email || 'admin',
      };
      await setDoc(couponRef, couponData);
      setCoupons((prev) => [{ code: cleanCode, ...couponData }, ...prev.filter(c => c.code !== cleanCode)]);
      setNewCouponCode('');
      setNewCouponDays('30');
      showSuccessBanner(`Coupon "${cleanCode}" created with +${days} days free trial!`);
    } catch (err) {
      console.error('[Admin] Create coupon error:', err);
      alert(`Failed to create coupon: ${err.message}`);
    } finally {
      setCouponCreating(false);
    }
  };

  const handleDeleteCoupon = async (code) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${code}"?`)) return;
    try {
      await deleteDoc(doc(db, 'coupons', code));
      setCoupons((prev) => prev.filter((c) => c.code !== code));
      showSuccessBanner(`Coupon "${code}" deleted.`);
    } catch (err) {
      console.error('[Admin] Delete coupon error:', err);
      alert(`Failed to delete coupon: ${err.message}`);
    }
  };

  // ─── SaaS Metrics Computation ──────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalCustomers = users.length;
    let proCount = 0;
    let starterCount = 0;
    let trialCount = 0;
    let expiredCount = 0;
    let totalRevenue = 0;

    const now = new Date();

    users.forEach((u) => {
      const sub = u.subscription || 'trial';
      const isPaidActive = u.subscriptionStatus === 'active';

      if (sub === 'pro') {
        proCount++;
        totalRevenue += PRO_ANNUAL_PRICE;
      } else if (sub === 'starter') {
        starterCount++;
        totalRevenue += STARTER_ANNUAL_PRICE;
      } else {
        const isTrialActive = u.trialEndDate ? new Date(u.trialEndDate) > now : true;
        if (isTrialActive && u.subscriptionStatus !== 'expired') {
          trialCount++;
        } else {
          expiredCount++;
        }
      }
    });

    const paidCount = proCount + starterCount;
    const paidConversionRate = totalCustomers > 0
      ? ((paidCount / totalCustomers) * 100).toFixed(1)
      : '0.0';

    return {
      totalCustomers,
      totalRevenue,
      proCount,
      starterCount,
      paidCount,
      trialCount,
      expiredCount,
      paidConversionRate,
    };
  }, [users]);

  // ─── Filtered & Sorted Customer List ───────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const now = new Date();

    return users.filter((u) => {
      // 1. Search Query
      const email = (u.email || u.profile?.email || (u.householdMembers && Object.values(u.householdMembers).find(m => m.email)?.email) || '').toLowerCase();
      const name = `${u.profile?.firstName || ''} ${u.profile?.lastName || ''} ${u.displayName || ''} ${u.id || ''}`.toLowerCase();
      const mobile = (u.profile?.mobile || '').toLowerCase();
      const place = (u.profile?.place || '').toLowerCase();
      const profession = (u.profile?.profession || '').toLowerCase();

      const matchesSearch = !query ||
        name.includes(query) ||
        email.includes(query) ||
        mobile.includes(query) ||
        place.includes(query) ||
        profession.includes(query);

      if (!matchesSearch) return false;

      // 2. Plan Filter
      const sub = u.subscription || 'trial';
      const isTrialActive = u.trialEndDate ? new Date(u.trialEndDate) > now : true;
      const isExpired = sub === 'trial' && (!isTrialActive || u.subscriptionStatus === 'expired');

      if (selectedPlanFilter === 'pro') return sub === 'pro';
      if (selectedPlanFilter === 'starter') return sub === 'starter';
      if (selectedPlanFilter === 'trial') return sub === 'trial' && !isExpired;
      if (selectedPlanFilter === 'expired') return isExpired;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = (a.profile?.firstName || a.displayName || a.email || '').toLowerCase();
        const nameB = (b.profile?.firstName || b.displayName || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'oldest') {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      // 'newest' default
      const timeA = new Date(a.createdAt || a.trialEndDate || 0).getTime();
      const timeB = new Date(b.createdAt || b.trialEndDate || 0).getTime();
      return timeB - timeA;
    });
  }, [users, searchQuery, selectedPlanFilter, sortBy]);

  // ─── CSV Export Functionality ──────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!users.length) {
      alert('No customer data to export.');
      return;
    }

    const headers = [
      'UID',
      'Name',
      'Email',
      'Phone',
      'Place',
      'Profession',
      'Age',
      'Subscription Plan',
      'Status',
      'Trial End Date',
      'Total Estimated Revenue (INR)',
    ];

    const rows = users.map((u) => {
      const email = u.email || u.profile?.email || (u.householdMembers && Object.values(u.householdMembers).find(m => m.email)?.email) || '';
      const name = [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(' ') || u.displayName || (email ? email.split('@')[0] : '') || `User (${u.id.slice(0, 6)})`;
      const sub = u.subscription || 'trial';
      const rev = sub === 'pro' ? PRO_ANNUAL_PRICE : sub === 'starter' ? STARTER_ANNUAL_PRICE : 0;
      return [
        u.id,
        `"${name.replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${(u.profile?.mobile || '').replace(/"/g, '""')}"`,
        `"${(u.profile?.place || '').replace(/"/g, '""')}"`,
        `"${(u.profile?.profession || '').replace(/"/g, '""')}"`,
        u.profile?.age || '',
        sub.toUpperCase(),
        u.subscriptionStatus || 'active',
        u.trialEndDate || '',
        rev,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BudgetTracker_Customers_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* ── Top Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 shadow-sm">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                SaaS Owner Dashboard
                <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Admin Only
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Real-time customers, revenue metrics & subscription controls for Suresh
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground border border-border transition-all shadow-sm disabled:opacity-50"
            title="Refresh Directory"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-sm"
            title="Export all customers to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccessMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-semibold animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Firestore Rule Permission Error Guide (if rules not deployed to console) */}
      {error && (
        <div className="p-4 sm:p-5 bg-destructive/10 border border-destructive/20 rounded-2xl space-y-2 text-foreground">
          <div className="flex items-center gap-2 text-destructive font-bold text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Firestore Access Notice</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error.includes('Missing or insufficient permissions')
              ? 'Firestore security rules in Firebase Console need to allow owner read access. Please run "firebase deploy --only firestore:rules" or copy the updated rules from firestore.rules into Firebase Console > Firestore Database > Rules tab.'
              : error}
          </p>
          <button
            onClick={fetchData}
            className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-all"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── Key Business Stat Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Stat 1: Total Customers */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-neutral-950 to-black p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Customers</span>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {loading ? '...' : metrics.totalCustomers}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3 h-3 text-emerald-400 inline" />
            Registered accounts
          </p>
        </div>

        {/* Stat 2: Total Revenue */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-neutral-950 to-black p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Platform Revenue</span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
            {loading ? '...' : `₹${metrics.totalRevenue.toLocaleString('en-IN')}`}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Pro (₹999) + Starter (₹499)
          </p>
        </div>

        {/* Stat 3: Paid Subscribers */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-neutral-950 to-black p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Paid Subscriptions</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-foreground font-mono">
            {loading ? '...' : metrics.paidCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {metrics.proCount} Pro • {metrics.starterCount} Starter ({metrics.paidConversionRate}% conversion)
          </p>
        </div>

        {/* Stat 4: Active Free Trials */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-neutral-950 to-black p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Trials</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-cyan-400 font-mono">
            {loading ? '...' : metrics.trialCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {metrics.expiredCount} expired/inactive
          </p>
        </div>
      </div>

      {/* ── Segmented Tabs: Customers vs Coupons ──────────────────── */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('customers')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px',
            activeTab === 'customers'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" />
          <span>Customers & Subscriptions ({filteredUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('coupons')}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px',
            activeTab === 'coupons'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Tag className="w-4 h-4" />
          <span>Coupons & Promotions ({coupons.length})</span>
        </button>
      </div>

      {/* ── TAB 1: CUSTOMERS DIRECTORY ────────────────────────────── */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {/* Search & Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, phone, city, profession..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'pro', label: '👑 Pro' },
                { id: 'starter', label: '⚡ Starter' },
                { id: 'trial', label: '⏳ Trial' },
                { id: 'expired', label: '⚠️ Expired' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedPlanFilter(f.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                    selectedPlanFilter === f.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {f.label}
                </button>
              ))}

              {/* Sort By Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Customers Table / Card List */}
          {loading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading registered customers...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-2">
              <Users className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">No customers found</p>
              <p className="text-xs text-muted-foreground">Try clearing your search query or filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const email = u.email || u.profile?.email || (u.householdMembers && Object.values(u.householdMembers).find(m => m.email)?.email) || '';
                const memberName = u.householdMembers && u.householdMembers[u.id]?.name;
                const fullName = [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(' ')
                  || u.displayName
                  || memberName
                  || (email ? email.split('@')[0] : '')
                  || (u.id ? `Account (${u.id.slice(0, 8)})` : 'Customer');

                const sub = u.subscription || 'trial';
                const now = new Date();
                const isTrialActive = u.trialEndDate ? new Date(u.trialEndDate) > now : true;
                const isExpired = sub === 'trial' && (!isTrialActive || u.subscriptionStatus === 'expired');

                return (
                  <div
                    key={u.id}
                    className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm hover:border-border/80 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Customer Info */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center shrink-0 uppercase text-sm">
                        {fullName.charAt(0) || email?.charAt(0) || 'U'}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-foreground">
                            {fullName}
                          </h3>

                          {/* Plan Badge */}
                          {sub === 'pro' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                              <Crown className="w-3 h-3" /> Pro
                            </span>
                          )}
                          {sub === 'starter' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                              <Zap className="w-3 h-3" /> Starter
                            </span>
                          )}
                          {sub === 'trial' && !isExpired && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                              <Clock className="w-3 h-3" /> Trial
                            </span>
                          )}
                          {isExpired && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              Expired
                            </span>
                          )}
                        </div>

                        {/* Contact details */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
                          {email ? (
                            <span className="flex items-center gap-1 text-foreground/90 font-medium">
                              <Mail className="w-3.5 h-3.5 text-primary" />
                              {email}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                              <Mail className="w-3 h-3 text-muted-foreground/40" />
                              Syncing email on next visit...
                            </span>
                          )}

                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground" title={u.id}>
                            UID: {u.id?.slice(0, 10)}...
                          </span>

                          {u.profile?.mobile && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-muted-foreground/70" />
                              {u.profile.mobile}
                            </span>
                          )}
                        </div>

                        {/* Profile Meta pills */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {u.profile?.profession && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium">
                              <Briefcase className="w-3 h-3" />
                              {u.profile.profession}
                            </span>
                          )}
                          {u.profile?.place && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium">
                              <MapPin className="w-3 h-3" />
                              {u.profile.place}
                            </span>
                          )}
                          {u.trialEndDate && sub === 'trial' && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                              <Calendar className="w-3 h-3" />
                              Expires: {format(new Date(u.trialEndDate), 'dd MMM yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Owner Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40">
                      {sub !== 'pro' && (
                        <button
                          onClick={() => handleUpdateUserPlan(u, 'pro')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
                          title="Upgrade to Pro Plan"
                        >
                          <Crown className="w-3 h-3" />
                          <span>Make Pro</span>
                        </button>
                      )}

                      {sub !== 'starter' && (
                        <button
                          onClick={() => handleUpdateUserPlan(u, 'starter')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
                          title="Set Starter Plan"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Make Starter</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleUpdateUserPlan(u, 'trial', 30)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-all"
                        title="Extend trial by 30 days"
                      >
                        <Clock className="w-3 h-3" />
                        <span>+30d Trial</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditCustomer(u)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-all"
                        title="Edit customer name, email, or notes"
                      >
                        <Edit2 className="w-3 h-3 text-primary" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: COUPONS & MARKETING ───────────────────────────── */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          {/* Create Coupon Box */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-foreground">Create Promotional Coupon Code</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Coupons can be redeemed by users in <strong>Account &gt; Subscription</strong> to unlock extended free trials.
            </p>

            <form onSubmit={handleCreateCoupon} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={newCouponCode}
                onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                placeholder="Coupon Code (e.g. SPECIAL90)"
                className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold bg-background border border-border text-foreground uppercase placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 flex-1"
                required
              />

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={newCouponDays}
                  onChange={(e) => setNewCouponDays(e.target.value)}
                  placeholder="Days"
                  className="w-24 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-mono bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-center"
                  required
                />
                <span className="text-xs text-muted-foreground font-semibold">Bonus Days</span>
              </div>

              <button
                type="submit"
                disabled={couponCreating}
                className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{couponCreating ? 'Creating...' : 'Create Coupon'}</span>
              </button>
            </form>
          </div>

          {/* Existing Coupons List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Active Coupons ({coupons.length})</h3>

            {coupons.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-1">
                <Tag className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">No coupons created yet</p>
                <p className="text-xs text-muted-foreground">Create your first promotion code above for users to redeem.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {coupons.map((c) => (
                  <div
                    key={c.code}
                    className="p-4 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-amber-500 tracking-wider">
                          {c.code}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          +{c.bonusDays} Days
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Created: {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy') : 'Active'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteCoupon(c.code)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                      title="Delete Coupon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Edit Customer Details ── */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Edit Customer Details</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">UID: {editingCustomer.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Customer / Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. John Doe, Friend Karthik..."
                  className="w-full h-10 px-3 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. user@gmail.com"
                  className="w-full h-10 px-3 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full h-10 px-3 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Profession / Note
                  </label>
                  <input
                    type="text"
                    value={editProfession}
                    onChange={(e) => setEditProfession(e.target.value)}
                    placeholder="e.g. Doctor, Friend..."
                    className="w-full h-10 px-3 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingCustomer ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
