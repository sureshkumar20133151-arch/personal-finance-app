
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFinanceData } from '../hooks/useFinanceData';
import {
    Plus, Search, Filter, Trash2, Edit2, X, TrendingUp, TrendingDown,
    PiggyBank, CreditCard, Download, MessageSquare, RefreshCw, Share2,
    MessageCircle, CheckCircle, CheckSquare, Square, Home, User, Users,
    Send, Smile, Calendar, Check, ChevronLeft, ChevronRight, ChevronDown, ArrowUpDown, ArrowLeftRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { parseStatement } from '../lib/StatementParser';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';
// SMS scan module moved to archive/sms-scanner
import { triggerHapticNotification } from '../lib/haptics';
import { useAuth } from '../context/AuthContext';
import { PaymentStatusPicker, PaymentStatusBadge } from '../components/SalaryPocketSystem';

const SORT_OPTIONS = [
    { value: 'date-desc', label: 'Newest First', icon: '📅' },
    { value: 'date-asc', label: 'Oldest First', icon: '📅' },
    { value: 'amount-desc', label: 'Amount: High to Low', icon: '💰' },
    { value: 'amount-asc', label: 'Amount: Low to High', icon: '💵' },
    { value: 'category-asc', label: 'Category (A to Z)', icon: '🏷️' },
    { value: 'person-asc', label: 'Person Who Spent', icon: '👤' },
];

const SCOPE_OPTIONS = [
    { value: 'all', label: 'Expense For: All', icon: '👥' },
    { group: 'Household Scope' },
    { value: 'ours', label: 'Home (Joint)', icon: '🏠' },
    { value: 'mine', label: 'Suresh (Personal)', icon: '👤' },
    { value: 'partner', label: 'Rosy (Personal)', icon: '🌸' },
    { group: 'Paid By' },
    { value: 'paid:Suresh', label: 'Paid by: Suresh', icon: '👤' },
    { value: 'paid:Rosy', label: 'Paid by: Rosy', icon: '🌸' },
    { value: 'paid:Both', label: 'Paid by: Both', icon: '🤝' },
    { group: 'Updated By' },
    { value: 'updated:Suresh', label: 'Updated by: Suresh', icon: '👤' },
    { value: 'updated:Rosy', label: 'Updated by: Rosy', icon: '🌸' },
    { value: 'updated:Claude', label: 'Updated by: Claude AI', icon: '🤖' },
];

const CustomSelect = ({
    value,
    onChange,
    options,
    icon: TriggerIcon,
    align = 'left',
    placeholder = 'Select...',
    className = '',
    menuWidth = 'w-56',
    triggerWidth = 'w-full',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
            document.addEventListener('touchstart', handleOutsideClick);
        }
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [isOpen]);

    const selectedOption = options.find(o => !o.group && o.value === value);

    return (
        <div ref={containerRef} className={cn("relative", triggerWidth)}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full h-9 px-2.5 sm:px-3 text-xs font-semibold bg-muted/60 hover:bg-muted border border-border/50 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-xl text-foreground flex items-center justify-between gap-1.5 transition-all cursor-pointer shadow-xs",
                    isOpen && "border-primary/60 ring-2 ring-primary/20 bg-muted",
                    className
                )}
            >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                    {TriggerIcon && <TriggerIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    {selectedOption?.icon && <span className="text-xs shrink-0">{selectedOption.icon}</span>}
                    <span className="truncate font-semibold">{selectedOption?.label || placeholder}</span>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div
                    className={cn(
                        "absolute top-full mt-1.5 z-50 max-h-64 overflow-y-auto bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 scrollbar-none",
                        menuWidth,
                        align === 'right' ? "right-0" : "left-0"
                    )}
                >
                    <div className="space-y-0.5">
                        {options.map((item, idx) => {
                            if (item.group) {
                                return (
                                    <div
                                        key={`grp-${idx}`}
                                        className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-2.5 pt-2 pb-1 border-t border-border/30 first:border-t-0 first:pt-1 select-none"
                                    >
                                        {item.group}
                                    </div>
                                );
                            }

                            const isSelected = item.value === value;
                            return (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(item.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-all cursor-pointer text-left",
                                        isSelected
                                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                            : "text-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-2 min-w-0 truncate">
                                        {item.icon && <span className="text-xs shrink-0">{item.icon}</span>}
                                        <span className="truncate">{item.label}</span>
                                    </div>
                                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const Transactions = () => {
    const {
        transactions,
        categories,
        addTransaction,
        addTransactions,
        importData,
        deleteTransaction,
        updateTransaction,
        addTransactionComment,
        addRecurringTransaction,
        deleteRecurringTransaction,
        toggleBillPaid,
        isSmsUnlocked,
        isPro,
        subscription,
        transactionLimitReached,
        monthlyTransactionCount,
        FREE_PLAN_MONTHLY_TX_LIMIT,

        recurring,
        loans,
        formatMoney,
        rescanTransactions,

        householdId,
        householdMembers,
        addTransferTransaction,
        currentActorName,
        profile,
        bankAccountBalances,
    } = useFinanceData();
    const { currentUser } = useAuth();
    const currentUserUid = currentUser?.uid;

    const defaultActor = useMemo(() => {
        if (currentActorName) return currentActorName;
        const uid = currentUser?.uid;
        if (uid === 'mlbLQkDo0Ef95hns8p81TkQdUK83' || uid === 'mlbLQkDo0Ef95hns8p8iTkQdUK83') return 'Suresh';
        if (uid === 'do139V31SkRXMSpkLIW1AroA9ZO2') return 'Rosy';
        const name = profile?.firstName || currentUser?.displayName || '';
        if (name.toLowerCase().includes('ros')) return 'Rosy';
        if (name.toLowerCase().includes('sur')) return 'Suresh';
        return 'Suresh';
    }, [currentActorName, currentUser, profile]);

    // Form State
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('expense');
    const [categoryId, setCategoryId] = useState('');
    const [paidBy, setPaidBy] = useState('Suresh');
    const [updatedBy, setUpdatedBy] = useState('Suresh');

    // Self-Transfer State ('bank_to_cash' | 'cash_to_bank')
    const [transferDirection, setTransferDirection] = useState('bank_to_cash');
    const [selectedBankKey, setSelectedBankKey] = useState('');

    // Feature 1: Scope State ('ours' = Joint, 'mine' = Personal, 'partner' = Partner's personal)
    const [scope, setScope] = useState('ours');
    const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'ours' | 'mine'

    // Feature 3: Comments State
    const [activeCommentTxId, setActiveCommentTxId] = useState(null);
    const [commentText, setCommentText] = useState('');
    const [commentEmoji, setCommentEmoji] = useState('');

    // Feature 6: Bill Assignment & Due Day
    const [assignedTo, setAssignedTo] = useState('Both');
    const [dueDay, setDueDay] = useState(5);

    const [loanId, setLoanId] = useState(''); // New State for linking repayment
    const [isRecurring, setIsRecurring] = useState(false);

    // Editing State
    const [editingTx, setEditingTx] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const quickAddAmountRef = useRef(null);

    const handleAddTransactionClick = () => {
        resetForm();
        setShowAddForm(true);
    };

    // Sync paidBy & updatedBy with defaultActor if not actively editing
    useEffect(() => {
        if (!editingTx && defaultActor) {
            setPaidBy(defaultActor);
            setUpdatedBy(defaultActor);
            setScope(householdId ? 'ours' : 'mine');
        }
    }, [defaultActor, editingTx, householdId]);

    // Household "Share" transfer state
    const [shareWithUid, setShareWithUid] = useState('');
    const [showShareOptions, setShowShareOptions] = useState(false);

    // Lock body scroll when Add Transaction modal or Edit modal is open
    React.useEffect(() => {
        if (editingTx || (showAddForm && window.innerWidth < 1024)) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showAddForm, editingTx]);
    const [showSMSScan, setShowSMSScan] = useState(false);

    // List View State
    const [viewMode, setViewMode] = useState('transactions'); // 'transactions' or 'recurring'
    const [displayMode, setDisplayMode] = useState('table'); // 'table' (Excel Sheet) or 'cards'

    // Filter State
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // e.g. '2026-09'
    const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

    const handlePrevMonth = () => {
        const cur = selectedMonth || new Date().toISOString().slice(0, 7);
        const [y, m] = cur.split('-').map(Number);
        const prev = new Date(y, m - 2, 1);
        setSelectedMonth(format(prev, 'yyyy-MM'));
    };

    const handleNextMonth = () => {
        const cur = selectedMonth || new Date().toISOString().slice(0, 7);
        const [y, m] = cur.split('-').map(Number);
        const next = new Date(y, m, 1);
        setSelectedMonth(format(next, 'yyyy-MM'));
    };

    const [recurringFreq, setRecurringFreq] = useState('monthly');
    const [recurringInterval, setRecurringInterval] = useState(28);
    const [recurringDay, setRecurringDay] = useState(1); // 0=Sun, 1=Mon (Default)
    const [recurringTenure, setRecurringTenure] = useState(''); // New State

    // Payment Mode State
    const [paymentMode, setPaymentMode] = useState('upi');

    // ── Payment Status (Paid / Deferred / Borrowed) ────────────────────────
    const [paymentStatus, setPaymentStatus] = useState('paid');
    const [deferredTo, setDeferredTo] = useState('');
    const [deferredNote, setDeferredNote] = useState('');
    const [borrowedFrom, setBorrowedFrom] = useState('');

    // Debt Repayment Specific State
    const [debtType, setDebtType] = useState('personal'); // 'immediate' | 'personal' | 'emi'
    const [repaymentType, setRepaymentType] = useState('principal'); // 'principal' | 'interest'

    // Upload State
    const [showUploadPreview, setShowUploadPreview] = useState(false);
    const [parsedTransactions, setParsedTransactions] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // PDF Password State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [pdfPassword, setPdfPassword] = useState('');
    const [pendingFile, setPendingFile] = useState(null);

    const handleSyncSms = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            const result = await rescanTransactions();
            const count = result?.count || 0;
            const scanned = result?.totalScanned || 0;
            alert(`Scanned ${scanned} SMS messages.\nFound ${count} new transactions!`);
        } catch (e) {
            console.error('[Transactions] Rescan error:', e);
            alert("Failed to scan SMS: " + e.message);
        }
        setTimeout(() => setRefreshing(false), 1000);
    };

    // Reset Form
    const resetForm = () => {
        setAmount('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setType('expense');
        setCategoryId('');
        setEditingTx(null);
        setIsRecurring(false);
        setRecurringFreq('monthly');
        setRecurringInterval(28);
        setRecurringDay(1);
        setRecurringTenure('');
        setLoanId('');
        setRepaymentType('principal');
        setDebtType('personal');
        setPaymentMode('upi');
        setPaymentStatus('paid');
        setDeferredTo('');
        setDeferredNote('');
        setBorrowedFrom('');
        setShareWithUid('');
        setShowShareOptions(false);
        setPaidBy(defaultActor || 'Suresh');
        setUpdatedBy(defaultActor || 'Suresh');
        setScope(householdId ? 'ours' : 'mine');
        setAssignedTo('Both');
        setDueDay(5);
        setTransferDirection('bank_to_cash');
        setSelectedBankKey(bankAccountBalances?.[0] ? `${bankAccountBalances[0].bankName}_${bankAccountBalances[0].accountEnding}` : '');
    };

    // Derived Logic
    const typeConfig = [
        { id: 'income', label: 'Income', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
        { id: 'expense', label: 'Expense', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
        { id: 'savings', label: 'Savings', icon: PiggyBank, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        { id: 'debt', label: 'Debt', icon: CreditCard, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
        { id: 'transfer', label: 'Transfer', icon: ArrowLeftRight, color: 'text-cyan-500 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    ];

    const availableCategories = useMemo(() => {
        return categories.filter(c => c.type === type);
    }, [categories, type]);

    const categoryOptions = useMemo(() => [
        { value: 'all', label: 'Category: All', icon: '🏷️' },
        { group: 'Types' },
        { value: 'expense', label: 'Expense', icon: '🔴' },
        { value: 'income', label: 'Income', icon: '🟢' },
        { value: 'savings', label: 'Savings', icon: '🔵' },
        { value: 'debt', label: 'Debt', icon: '🟠' },
        { value: 'transfer', label: 'Self Transfer', icon: '🔄' },
        ...(categories && categories.length > 0 ? [
            { group: 'Specific Categories' },
            ...categories.map(c => ({
                value: `cat:${c.id}`,
                label: c.name,
                icon: c.icon || '🏷️',
            }))
        ] : [])
    ], [categories]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesMonth = !selectedMonth || (t.date && t.date.startsWith(selectedMonth));
            const matchesType = filterType === 'all'
                || (filterType.startsWith('cat:') ? t.categoryId === filterType.replace('cat:', '') : t.type === filterType);
            const matchesScope = scopeFilter === 'all'
                || (scopeFilter === 'ours' && (t.scope === 'ours' || !t.scope))
                || (scopeFilter === 'mine' && t.scope === 'mine')
                || (scopeFilter === 'partner' && t.scope === 'partner')
                || (scopeFilter === 'paid:Suresh' && ((t.paidBy || '').toLowerCase().includes('sur') || (!t.paidBy && (!t.scope || t.scope === 'mine' || t.scope === 'ours'))))
                || (scopeFilter === 'paid:Rosy' && ((t.paidBy || '').toLowerCase().includes('ros') || (!t.paidBy && t.scope === 'partner')))
                || (scopeFilter === 'paid:Both' && ((t.paidBy || '').toLowerCase().includes('both') || (t.paidBy || '').toLowerCase().includes('joint')))
                || (scopeFilter === 'updated:Suresh' && ((t.updatedBy || '').toLowerCase().includes('sur') || (t.createdBy || '').toLowerCase().includes('sur') || (!t.updatedBy && !t.createdBy && t.source !== 'mcp')))
                || (scopeFilter === 'updated:Rosy' && ((t.updatedBy || '').toLowerCase().includes('ros') || (t.createdBy || '').toLowerCase().includes('ros')))
                || (scopeFilter === 'updated:Claude' && ((t.updatedBy || '').toLowerCase().includes('claude') || (t.createdBy || '').toLowerCase().includes('claude') || t.source === 'mcp'));
            const desc = t.description || '';
            const matchesSearch = desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.paidBy || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.updatedBy || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.comments || []).some(cm => (cm.text || '').toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesMonth && matchesType && matchesScope && matchesSearch;
        }).sort((a, b) => {
            if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
            if (sortBy === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
            if (sortBy === 'amount-asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
            if (sortBy === 'category-asc') {
                const catA = categories.find(c => c.id === a.categoryId)?.name || a.type || '';
                const catB = categories.find(c => c.id === b.categoryId)?.name || b.type || '';
                const cmp = catA.localeCompare(catB);
                if (cmp !== 0) return cmp;
                return new Date(b.date) - new Date(a.date);
            }
            if (sortBy === 'person-asc') {
                const personA = a.paidBy || a.updatedBy || a.createdBy || 'Suresh';
                const personB = b.paidBy || b.updatedBy || b.createdBy || 'Suresh';
                const cmp = personA.localeCompare(personB);
                if (cmp !== 0) return cmp;
                return new Date(b.date) - new Date(a.date);
            }
            return new Date(b.date) - new Date(a.date);
        });
    }, [transactions, selectedMonth, filterType, scopeFilter, searchQuery, categories, sortBy]);

    // Handlers
    const handleSubmit = (e) => {
        e.preventDefault();
        // Validation: Amount required. Category required UNLESS it's a debt repayment (then loanId or just general is fine) OR self transfer
        if (!amount || (type !== 'debt' && type !== 'transfer' && !categoryId)) return;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert('Please enter a valid amount greater than 0.');
            return;
        }

        let finalBankName = null;
        let finalAccountEnding = null;
        if (type === 'transfer') {
            if (selectedBankKey) {
                const parts = selectedBankKey.split('_');
                finalBankName = parts[0] || null;
                finalAccountEnding = parts[1] || null;
            } else if (bankAccountBalances && bankAccountBalances.length > 0) {
                finalBankName = bankAccountBalances[0].bankName;
                finalAccountEnding = bankAccountBalances[0].accountEnding;
            } else {
                finalBankName = 'Primary Bank';
                finalAccountEnding = '';
            }
        }

        const defaultDesc = type === 'transfer'
            ? (transferDirection === 'bank_to_cash' ? 'GPay/Bank to Cash' : 'Cash to GPay/Bank')
            : '';

        const txData = {
            amount: numAmount,
            description: (description || defaultDesc).trim(),
            date,
            type,
            ...(type === 'transfer' ? {
                transferDirection,
                bankName: finalBankName,
                accountEnding: finalAccountEnding,
            } : {}),
            categoryId: type === 'transfer' ? null : categoryId,
            ...(type === 'debt' && loanId ? { loanId, repaymentType } : {}),
            paymentMode: type === 'transfer' ? (transferDirection === 'bank_to_cash' ? 'cash' : 'upi') : paymentMode,
            paidBy: paidBy || defaultActor || 'Suresh',
            updatedBy: updatedBy || defaultActor || 'Suresh',
            ...(!editingTx ? { createdBy: updatedBy || defaultActor || 'Suresh' } : {}),
            scope: scope || (householdId ? 'ours' : 'mine'),
            // ── Payment Status ─────────────────────────────────────────────
            paymentStatus: type === 'transfer' ? 'paid' : (paymentStatus || 'paid'),
            ...(paymentStatus === 'deferred' && type !== 'transfer' ? {
                deferredTo: deferredTo || null,
                deferredNote: (deferredNote || '').trim() || null,
            } : {}),
            ...(paymentStatus === 'borrowed' && type !== 'transfer' ? {
                borrowedFrom: (borrowedFrom || '').trim() || null,
            } : {}),
        };

        if (editingTx) {
            updateTransaction(editingTx.id, txData);
            if (isRecurring && addRecurringTransaction) {
                addRecurringTransaction({
                    amount: parseFloat(amount),
                    description: description || '',
                    type,
                    categoryId,
                    frequency: recurringFreq,
                    interval: recurringFreq === 'custom' ? (parseInt(recurringInterval) || 1) : 1,
                    ...(recurringFreq === 'weekly' && recurringDay ? { weeklyDay: recurringDay } : {}),
                    dueDay: parseInt(dueDay) || 5,
                    assignedTo: assignedTo || 'Both',
                    paidMonths: [],
                    tenure: recurringTenure ? parseInt(recurringTenure) : null,
                    processedCount: 0,
                    lastProcessedDate: new Date().toISOString()
                });
            }
        } else {
            const result = shareWithUid
                ? addTransferTransaction(txData, shareWithUid)
                : addTransaction(txData);
            if (result && result.success === false) {
                setUploadError(`Free plan limit reached — ${result.limit} transactions/month used. Upgrade to Starter for unlimited entries.`);
                return;
            }
            if (isRecurring) {
                // Ensure the function exists before calling
                if (addRecurringTransaction) {
                    addRecurringTransaction({
                        amount: parseFloat(amount),
                        description: description || '',
                        type,
                        categoryId,
                        frequency: recurringFreq,
                        interval: recurringFreq === 'custom' ? (parseInt(recurringInterval) || 1) : 1,
                        ...(recurringFreq === 'weekly' && recurringDay ? { weeklyDay: recurringDay } : {}),
                        dueDay: parseInt(dueDay) || 5,
                        assignedTo: assignedTo || 'Both',
                        paidMonths: [],
                        tenure: recurringTenure ? parseInt(recurringTenure) : null,
                        processedCount: 0,
                        lastProcessedDate: new Date().toISOString()
                    });
                }
            }
        }

        triggerHapticNotification('SUCCESS');
        resetForm();
        setShowAddForm(false);
    };

    const handleEditClick = (tx) => {
        setEditingTx(tx);
        setAmount(tx.amount.toString());
        setDescription(tx.description || '');
        
        let parsedDate = '';
        try {
            if (tx.date) {
                const dateObj = new Date(tx.date);
                if (!isNaN(dateObj.getTime())) {
                    parsedDate = dateObj.toISOString().split('T')[0];
                } else if (typeof tx.date === 'string') {
                    const parts = tx.date.split('-');
                    if (parts.length === 3 && parts[2].length === 4) {
                        parsedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                    } else {
                        parsedDate = new Date().toISOString().split('T')[0];
                    }
                } else {
                    parsedDate = new Date().toISOString().split('T')[0];
                }
            } else {
                parsedDate = new Date().toISOString().split('T')[0];
            }
        } catch {
            parsedDate = new Date().toISOString().split('T')[0];
        }
        setDate(parsedDate);
        
        setType(tx.type || 'expense');
        setCategoryId(tx.categoryId || '');
        setPaymentMode(tx.paymentMode || 'upi');
        setPaidBy(tx.paidBy || (tx.scope === 'partner' ? 'Rosy' : defaultActor || 'Suresh'));
        setUpdatedBy(tx.updatedBy || tx.createdBy || (tx.source === 'mcp' ? 'Claude' : defaultActor || 'Suresh'));
        setScope(tx.scope || 'ours');
        if (tx.type === 'transfer') {
            setTransferDirection(tx.transferDirection || 'bank_to_cash');
            if (tx.bankName) {
                setSelectedBankKey(`${tx.bankName}_${tx.accountEnding || ''}`);
            }
        }
        if (tx.loanId) setLoanId(tx.loanId);
        if (tx.repaymentType) setRepaymentType(tx.repaymentType);
        // Payment Status restore
        setPaymentStatus(tx.paymentStatus || 'paid');
        setDeferredTo(tx.deferredTo || '');
        setDeferredNote(tx.deferredNote || '');
        setBorrowedFrom(tx.borrowedFrom || '');
    };


    const handleImportConfirm = () => {
        // Check/Create 'Pending' category if needed
        let pendingCatId = categories.find(c => c.name.toLowerCase() === 'pending')?.id;
        const catsToAdd = [];

        if (!pendingCatId) {
            // Create pending category if it doesn't exist
            pendingCatId = uuidv4();
            catsToAdd.push({
                id: pendingCatId,
                name: 'Pending',
                type: 'expense',
                icon: 'Clock',
                color: '#94a3b8', // Slate-400
                budget: 0
            });
        }

        // Assign 'Pending' to transactions without a category
        const finalizedTransactions = parsedTransactions.map(t => ({
            ...t,
            categoryId: t.categoryId || pendingCatId
        }));

        importData({
            categories: catsToAdd,
            transactions: finalizedTransactions
        });

        setShowUploadPreview(false);
        setParsedTransactions([]);
        setViewMode('transactions');
    };

    // Process file for parsing (shared by upload and drag&drop)
    const processFile = async (file, password = null) => {
        if (!file) return;

        if (subscription === 'free' || !isPro) {
            setUploadError('Bank statement PDF & CSV upload requires a Starter or Pro plan. Upgrade to upload statements!');
            return;
        }

        setIsParsing(true);
        setUploadError('');

        try {
            const results = await parseStatement(file, password);
            
            // If successful, reset password states
            setShowPasswordModal(false);
            setPdfPassword('');
            setPendingFile(null);

            if (results.length === 0) {
                setUploadError('No transactions found in file.');
            } else {
                setParsedTransactions(results);
                setShowUploadPreview(true);
            }
        } catch (err) {
            console.error(err);
            if (err.name === 'PasswordException') {
                setPendingFile(file);
                setShowPasswordModal(true);
                setUploadError('Password required to open this PDF.');
            } else {
                setUploadError(err.message || 'Failed to parse file.');
            }
        } finally {
            setIsParsing(false);
        }
    };

    const handlePasswordSubmit = () => {
        if (pendingFile && pdfPassword) {
            processFile(pendingFile, pdfPassword);
        }
    };

    // Drag & Drop Handlers
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if we're leaving the drop zone entirely
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    };


    const removeParsedTransaction = (index) => {
        setParsedTransactions(prev => prev.filter((_, i) => i !== index));
    };

    const getCategoryName = (id) => categories.find(c => c.id === id)?.name || 'Unknown';
    const getCategoryColor = (id) => categories.find(c => c.id === id)?.color || '#ccc';

    // Render Reusable Form Inputs for Add & Edit
    const renderFormInputs = (isEdit = false) => (
        <>
            {/* Row 1: Type & Category Dropdowns */}
            <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                    <label htmlFor={isEdit ? "edit-type" : "type"} className="text-xs font-semibold text-muted-foreground">
                        Type
                    </label>
                    <select
                        id={isEdit ? "edit-type" : "type"}
                        value={type}
                        onChange={(e) => {
                            const newType = e.target.value;
                            setType(newType);
                            setCategoryId('');
                            setIsRecurring(false);
                            if (newType === 'transfer') {
                                if (!description) setDescription('GPay/Bank to Cash');
                            }
                        }}
                        className="w-full h-9 bg-background border border-input rounded-lg px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                    >
                        <option value="expense">📉 Expense</option>
                        <option value="income">📈 Income</option>
                        <option value="savings">🐷 Savings</option>
                        <option value="debt">💳 Debt Repayment</option>
                        <option value="transfer">🔄 Self Transfer</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor={isEdit ? "edit-category" : "category"} className="text-xs font-semibold text-muted-foreground">
                        {type === 'transfer' ? 'Transfer Direction' : 'Category'}
                    </label>
                    {type === 'transfer' ? (
                        <select
                            id={isEdit ? "edit-transfer-dir" : "transfer-dir"}
                            value={transferDirection}
                            onChange={(e) => {
                                const dir = e.target.value;
                                setTransferDirection(dir);
                                if (dir === 'bank_to_cash') setDescription('GPay/Bank to Cash');
                                else setDescription('Cash to GPay/Bank');
                            }}
                            className="w-full h-9 bg-background border border-input rounded-lg px-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                        >
                            <option value="bank_to_cash">📱 GPay / Bank ➔ 💵 Cash</option>
                            <option value="cash_to_bank">💵 Cash ➔ 📱 GPay / Bank</option>
                        </select>
                    ) : type === 'debt' ? (
                        <select
                            id={isEdit ? "edit-debt-type" : "debt-type"}
                            value={debtType}
                            onChange={(e) => {
                                const val = e.target.value;
                                setDebtType(val);
                                if (val === 'immediate' || val === 'personal') {
                                    setLoanId('');
                                    setAmount('');
                                } else if (val === 'emi') {
                                    const emiLoans = loans.filter(l => l.type === 'emi');
                                    if (emiLoans.length === 1) {
                                        const loan = emiLoans[0];
                                        setLoanId(loan.id);
                                        setAmount(loan.monthlyAmount.toString());
                                        setDescription(`EMI for ${loan.name}`);
                                    } else {
                                        setLoanId('');
                                        setAmount('');
                                    }
                                }
                            }}
                            className="w-full h-9 bg-background border border-input rounded-lg px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                        >
                            <option value="immediate">Immediate Repayment</option>
                            <option value="personal">Personal Debt Account</option>
                            <option value="emi">EMI Loan Account</option>
                        </select>
                    ) : (
                        <select
                            id={isEdit ? "edit-category" : "category"}
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full h-9 bg-background border border-input rounded-lg px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                            required={type !== 'debt' && type !== 'transfer'}
                        >
                            <option value="" disabled>Select Category</option>
                            {availableCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* If Self-Transfer: Visual explanation banner */}
            {type === 'transfer' && (
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-4 h-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                        <span>
                            {transferDirection === 'bank_to_cash' 
                                ? '📱 GPay / Bank balance decreases ➔ 💵 Cash in Hand increases.' 
                                : '💵 Cash in Hand balance decreases ➔ 📱 GPay / Bank balance increases.'}
                        </span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 uppercase tracking-wider shrink-0">
                        Self Transfer
                    </span>
                </div>
            )}

            {/* If Debt type requires account selection */}
            {type === 'debt' && debtType === 'personal' && (
                <div className="space-y-2 p-2 bg-muted/40 rounded-xl border border-border/60 animate-in fade-in">
                    <select
                        id={isEdit ? "edit-loan-account" : "loan-account"}
                        value={loanId}
                        onChange={(e) => {
                            setLoanId(e.target.value);
                            setAmount('');
                        }}
                        className="w-full h-9 bg-background border border-input rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    >
                        <option value="">Select Debt Account</option>
                        {loans.filter(l => l.type === 'debt').map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                    {loanId && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setRepaymentType('principal')}
                                className={cn("flex-1 text-[11px] font-semibold py-1 rounded-md transition-all cursor-pointer", repaymentType === 'principal' ? "bg-background shadow text-primary" : "text-muted-foreground hover:text-foreground")}
                            >
                                Principal
                            </button>
                            <button
                                type="button"
                                onClick={() => setRepaymentType('interest')}
                                className={cn("flex-1 text-[11px] font-semibold py-1 rounded-md transition-all cursor-pointer", repaymentType === 'interest' ? "bg-background shadow text-orange-600" : "text-muted-foreground hover:text-foreground")}
                            >
                                Interest
                            </button>
                        </div>
                    )}
                </div>
            )}

            {type === 'debt' && debtType === 'emi' && (
                <div className="space-y-2 p-2 bg-muted/40 rounded-xl border border-border/60 animate-in fade-in">
                    <select
                        id={isEdit ? "edit-emi-loan" : "emi-loan"}
                        value={loanId}
                        onChange={(e) => {
                            const selectedId = e.target.value;
                            setLoanId(selectedId);
                            const loan = loans.find(l => l.id === selectedId);
                            if (loan) {
                                setAmount(loan.monthlyAmount.toString());
                                setDescription(`EMI for ${loan.name}`);
                            }
                        }}
                        className="w-full h-9 bg-background border border-input rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                    >
                        <option value="">Select EMI Loan</option>
                        {loans.filter(l => l.type === 'emi').map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({formatMoney(l.monthlyAmount)}/mo)</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Row 2: Amount & Date */}
            <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                    <label htmlFor={isEdit ? "edit-amount" : "amount"} className="text-xs font-semibold text-muted-foreground">Amount (₹)</label>
                    <input
                        id={isEdit ? "edit-amount" : "amount"}
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label htmlFor={isEdit ? "edit-date" : "date"} className="text-xs font-semibold text-muted-foreground">Date</label>
                    <input
                        id={isEdit ? "edit-date" : "date"}
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs cursor-pointer"
                        required
                    />
                </div>
            </div>

            {/* Row 3: Description */}
            <div className="space-y-1">
                <label htmlFor={isEdit ? "edit-description" : "description"} className="text-xs font-semibold text-muted-foreground">Description / Notes</label>
                <input
                    id={isEdit ? "edit-description" : "description"}
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Petrol, Groceries, Dinner"
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs"
                />
            </div>

            {/* Row 4: Payment Mode, Paid By, and Updated By Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {type === 'transfer' ? (
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground truncate block">
                            {transferDirection === 'bank_to_cash' ? 'From Bank' : 'To Bank'}
                        </label>
                        <select
                            value={selectedBankKey}
                            onChange={(e) => setSelectedBankKey(e.target.value)}
                            className="w-full h-9 bg-background border border-input rounded-lg px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer truncate"
                        >
                            {(bankAccountBalances || []).map(b => (
                                <option key={`${b.bankName}_${b.accountEnding}`} value={`${b.bankName}_${b.accountEnding}`}>
                                    🏦 {b.bankName} {b.accountEnding ? `(..${b.accountEnding})` : ''}
                                </option>
                            ))}
                            {(!bankAccountBalances || bankAccountBalances.length === 0) && (
                                <option value="Primary Bank_">🏦 Primary Bank / GPay</option>
                            )}
                        </select>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <label htmlFor={isEdit ? "edit-payment-mode" : "payment-mode"} className="text-xs font-semibold text-muted-foreground">
                            Payment Mode
                        </label>
                        <select
                            id={isEdit ? "edit-payment-mode" : "payment-mode"}
                            value={paymentMode}
                            onChange={(e) => setPaymentMode(e.target.value)}
                            className="w-full h-9 bg-background border border-input rounded-lg px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                        >
                            <option value="upi">📱 UPI</option>
                            <option value="cash">💵 Cash</option>
                            <option value="card">💳 Card</option>
                            <option value="netbanking">🏦 Net Banking</option>
                        </select>
                    </div>
                )}

                <div className="space-y-1">
                    <label htmlFor={isEdit ? "edit-paid-by" : "paid-by"} className="text-xs font-semibold text-muted-foreground">
                        Paid By
                    </label>
                    <select
                        id={isEdit ? "edit-paid-by" : "paid-by"}
                        value={paidBy || defaultActor || 'Suresh'}
                        onChange={(e) => setPaidBy(e.target.value)}
                        className="w-full h-9 bg-background border border-input rounded-lg px-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                    >
                        <option value="Suresh">👤 Suresh (Husband)</option>
                        <option value="Rosy">🌸 Rosy</option>
                        <option value="Both">🤝 Both</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor={isEdit ? "edit-updated-by" : "updated-by"} className="text-xs font-semibold text-muted-foreground">
                        Updated By
                    </label>
                    <select
                        id={isEdit ? "edit-updated-by" : "updated-by"}
                        value={updatedBy || defaultActor || 'Suresh'}
                        onChange={(e) => setUpdatedBy(e.target.value)}
                        className="w-full h-9 bg-background border border-input rounded-lg px-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                    >
                        <option value="Suresh">👤 Suresh (Husband)</option>
                        <option value="Rosy">🌸 Rosy</option>
                        <option value="Claude">🤖 Claude</option>
                    </select>
                </div>
            </div>

            {/* Row 5: Expense Scope Dropdown */}
            <div className="space-y-1">
                <label htmlFor={isEdit ? "edit-scope" : "scope"} className="text-xs font-semibold text-muted-foreground">
                    Expense Scope
                </label>
                <select
                    id={isEdit ? "edit-scope" : "scope"}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full h-9 bg-background border border-input rounded-lg px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-xs cursor-pointer"
                >
                    <option value="ours">🏠 Home Expenses (Family / Veedu)</option>
                    <option value="mine">👤 Suresh Personal (Petrol / Snacks)</option>
                    <option value="partner">🌸 Rosy Personal</option>
                </select>
            </div>

            {/* ── Payment Status (Paid / Deferred / Borrowed) ── */}
            {type === 'expense' && (
                <PaymentStatusPicker
                    value={paymentStatus}
                    deferredTo={deferredTo}
                    borrowedFrom={borrowedFrom}
                    onChange={setPaymentStatus}
                    onDeferredToChange={setDeferredTo}
                    onBorrowedFromChange={setBorrowedFrom}
                />
            )}
            {type === 'expense' && paymentStatus === 'deferred' && (
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Note (optional)</label>
                    <input
                        type="text"
                        value={deferredNote}
                        onChange={e => setDeferredNote(e.target.value)}
                        placeholder='e.g. "Anna said next week ok"'
                        className="w-full h-9 px-3 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            )}

            {/* Share with Member (Add mode only) */}
            {!isEdit && householdId && type === 'expense' && (
                <div className="space-y-1.5">
                    <button
                        type="button"
                        onClick={() => setShowShareOptions(v => !v)}
                        className="w-full flex items-center justify-between text-xs font-medium py-1.5 px-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                        <span className="flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5" />
                            {shareWithUid ? `Sharing with ${householdMembers[shareWithUid]?.name || 'member'}` : 'Share with household member'}
                        </span>
                        {shareWithUid && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); setShareWithUid(''); setShowShareOptions(false); }}
                                className="text-destructive cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </span>
                        )}
                    </button>
                    {showShareOptions && !shareWithUid && (
                        <div className="grid grid-cols-2 gap-1.5 p-1">
                            {Object.entries(householdMembers)
                                .filter(([uid]) => uid !== currentUserUid)
                                .map(([uid, m]) => (
                                    <button
                                        key={uid}
                                        type="button"
                                        onClick={() => { setShareWithUid(uid); setShowShareOptions(false); }}
                                        className="text-xs font-medium py-1.5 px-2 rounded-lg border border-border hover:bg-muted/50 truncate cursor-pointer"
                                    >
                                        {m.name || 'Member'}
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            )}

            {/* Recurring toggle (Add mode) */}
            {!isEdit && (type === 'expense' || type === 'savings') && (
                <div className="flex items-center gap-2 pt-0.5">
                    <input
                        type="checkbox"
                        id="recurring"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="recurring" className="text-xs font-semibold leading-none cursor-pointer text-foreground">
                        Recurring {type === 'savings' ? 'Saving' : 'Expense'}
                    </label>
                </div>
            )}

            {/* Recurring fields if enabled */}
            {!isEdit && isRecurring && (
                <div className="p-2.5 bg-muted/40 rounded-xl space-y-2.5 border border-border animate-in slide-in-from-top-2">
                    <div className="space-y-1">
                        <label htmlFor="frequency" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Frequency</label>
                        <select
                            id="frequency"
                            value={recurringFreq}
                            onChange={(e) => setRecurringFreq(e.target.value)}
                            className="w-full text-xs bg-background border border-input rounded-md px-2 py-1 focus:ring-1 focus:ring-primary h-8"
                        >
                            <option value="monthly">Monthly</option>
                            <option value="weekly">Weekly</option>
                            <option value="custom">Custom (Every X Days)</option>
                        </select>
                    </div>

                    {recurringFreq === 'weekly' && (
                        <div className="space-y-1 animate-in fade-in">
                            <label htmlFor="weeklyDay" className="text-[10px] font-medium text-muted-foreground">Day of Week</label>
                            <select
                                id="weeklyDay"
                                value={recurringDay}
                                onChange={(e) => setRecurringDay(Number(e.target.value))}
                                className="w-full text-xs bg-background border border-input rounded-md px-2 py-1 focus:ring-1 focus:ring-primary h-8"
                            >
                                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                                    <option key={day} value={idx}>{day}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {recurringFreq === 'custom' && (
                        <div className="space-y-1 animate-in fade-in">
                            <label htmlFor="interval" className="text-[10px] font-medium text-muted-foreground">Interval (days)</label>
                            <input
                                id="interval"
                                type="number"
                                min="1"
                                value={recurringInterval}
                                onChange={(e) => setRecurringInterval(e.target.value)}
                                className="w-full text-xs bg-background border border-input rounded-md px-2 py-1 focus:ring-1 focus:ring-primary h-8"
                            />
                        </div>
                    )}

                    {/* Bill Assignment & Due Day */}
                    <div className="pt-2 border-t border-border/50 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill Assigned To</label>
                            <select
                                value={assignedTo}
                                onChange={(e) => setAssignedTo(e.target.value)}
                                className="h-7 text-xs bg-background border border-input rounded-md px-2 focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                            >
                                <option value="Both">👥 Both</option>
                                <option value="Suresh">👤 Suresh</option>
                                <option value="Rosy">🌸 Rosy</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="dueDay" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Day of Month</label>
                            <input
                                id="dueDay"
                                type="number"
                                min="1"
                                max="31"
                                value={dueDay}
                                onChange={(e) => setDueDay(Number(e.target.value))}
                                className="w-16 text-xs bg-background border border-input rounded-md px-2 py-1 text-center font-bold h-7"
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    const renderMonthSelector = () => (
        <div className="flex items-center gap-1.5 shrink-0">
            {/* Month Calendar Selector */}
            <div className="flex items-center bg-card border border-border/80 rounded-xl p-0.5 shadow-2xs">
                <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Previous Month"
                >
                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                <label className="relative flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 sm:py-1.5 hover:bg-muted/70 rounded-lg cursor-pointer transition-colors" title="Click to choose month">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-foreground select-none whitespace-nowrap">
                        {selectedMonth ? format(new Date(selectedMonth + '-01T00:00:00'), 'MMM yyyy') : 'All Months'}
                    </span>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                </label>

                <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Next Month"
                >
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
            </div>

            {selectedMonth ? (
                <button
                    type="button"
                    onClick={() => setSelectedMonth('')}
                    className="px-2 sm:px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-xl border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                    title="Show transactions from all months"
                >
                    All
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
                    className="px-2 sm:px-2.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-xl border bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                    title="Jump to current month"
                >
                    This Month
                </button>
            )}
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {/* Dedicated Centered Add Transaction Modal */}
            {showAddForm && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
                    <div 
                        className="fixed inset-0 cursor-default" 
                        onClick={() => {
                            setShowAddForm(false);
                            resetForm();
                        }}
                    />
                    <div className="relative z-10 w-full max-w-lg md:max-w-5xl lg:max-w-7xl bg-card rounded-2xl sm:rounded-3xl border border-primary/40 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold">Add Transaction</h2>
                                    <p className="text-[11px] text-muted-foreground">Record a new expense, income, or savings entry</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    resetForm();
                                }}
                                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 pr-3.5 space-y-3">
                            {transactionLimitReached && (
                                <div className="mb-3 p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs rounded-md flex items-start gap-2 border border-amber-500/20">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <p>Free plan limit reached — {monthlyTransactionCount}/{FREE_PLAN_MONTHLY_TX_LIMIT} transactions used this month. Upgrade to Starter for unlimited entries.</p>
                                </div>
                            )}

                            {uploadError && (
                                <div className="mb-3 p-2 bg-destructive/10 text-destructive text-xs rounded-md flex items-start gap-2">
                                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                    <p>{uploadError}</p>
                                </div>
                            )}

                            <form id="tx-form" onSubmit={handleSubmit} className="space-y-4 pb-2">
                                {/* Desktop Horizontal Section - Matching Screenshot Exactly */}
                                <div className="hidden md:block space-y-2">
                                    <div className="grid grid-cols-12 gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 select-none">
                                        <div className="col-span-2">Date</div>
                                        <div className="col-span-1">Type</div>
                                        <div className="col-span-2">Category</div>
                                        <div className="col-span-2">Description</div>
                                        <div className="col-span-1">Payment</div>
                                        <div className="col-span-1">Paid By</div>
                                        <div className="col-span-1">Updated By</div>
                                        <div className="col-span-1">Scope</div>
                                        <div className="col-span-1 text-right pr-1">Amount (₹)</div>
                                    </div>
                                    <div className="grid grid-cols-12 gap-1.5 items-center bg-muted/20 p-2.5 rounded-xl border border-border/60">
                                        {/* Date */}
                                        <div className="col-span-2">
                                            <input
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="w-full h-9 px-2 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                                                required
                                            />
                                        </div>

                                        {/* Type */}
                                        <div className="col-span-1">
                                            <select
                                                value={type}
                                                onChange={(e) => {
                                                    const newType = e.target.value;
                                                    setType(newType);
                                                    setCategoryId('');
                                                    if (newType === 'transfer') {
                                                        if (!description) setDescription('GPay/Bank to Cash');
                                                    }
                                                }}
                                                className="w-full h-9 px-1 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-semibold cursor-pointer"
                                            >
                                                <option value="expense">📉 Expense</option>
                                                <option value="income">📈 Income</option>
                                                <option value="savings">🐷 Savings</option>
                                                <option value="debt">💳 Debt</option>
                                                <option value="transfer">🔄 Transfer</option>
                                            </select>
                                        </div>

                                        {/* Category */}
                                        <div className="col-span-2">
                                            {type === 'transfer' ? (
                                                <select
                                                    value={transferDirection}
                                                    onChange={(e) => {
                                                        const dir = e.target.value;
                                                        setTransferDirection(dir);
                                                        if (dir === 'bank_to_cash') setDescription('GPay/Bank to Cash');
                                                        else setDescription('Cash to GPay/Bank');
                                                    }}
                                                    className="w-full h-9 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-semibold text-cyan-600 dark:text-cyan-400 cursor-pointer"
                                                >
                                                    <option value="bank_to_cash">📱 Bank ➔ 💵 Cash</option>
                                                    <option value="cash_to_bank">💵 Cash ➔ 📱 Bank</option>
                                                </select>
                                            ) : type === 'debt' ? (
                                                <select
                                                    value={debtType}
                                                    onChange={(e) => setDebtType(e.target.value)}
                                                    className="w-full h-9 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                                                >
                                                    <option value="personal">🤝 Personal</option>
                                                    <option value="emi">🏦 Bank EMI</option>
                                                    <option value="immediate">⚡ Quick Pay</option>
                                                </select>
                                            ) : (
                                                <select
                                                    value={categoryId}
                                                    onChange={(e) => setCategoryId(e.target.value)}
                                                    className="w-full h-9 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                                                    required={type !== 'debt' && type !== 'transfer'}
                                                >
                                                    <option value="">Select Category...</option>
                                                    {availableCategories.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <div className="col-span-2">
                                            <input
                                                type="text"
                                                placeholder="e.g. Petrol, Groceries..."
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSubmit(e);
                                                }}
                                                className="w-full h-9 px-2.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary"
                                            />
                                        </div>

                                        {/* Payment */}
                                        <div className="col-span-1">
                                            <select
                                                value={paymentMode}
                                                onChange={(e) => setPaymentMode(e.target.value)}
                                                className="w-full h-9 px-1 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                                            >
                                                <option value="upi">📱 UPI</option>
                                                <option value="cash">💵 Cash</option>
                                                <option value="card">💳 Card</option>
                                                <option value="netbanking">🏦 NetBank</option>
                                            </select>
                                        </div>

                                        {/* Paid By */}
                                        <div className="col-span-1">
                                            <select
                                                value={paidBy || defaultActor || 'Suresh'}
                                                onChange={(e) => setPaidBy(e.target.value)}
                                                className="w-full h-9 px-1 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-semibold cursor-pointer"
                                            >
                                                <option value="Suresh">👤 Suresh</option>
                                                <option value="Rosy">🌸 Rosy</option>
                                                <option value="Both">🤝 Both</option>
                                            </select>
                                        </div>

                                        {/* Updated By */}
                                        <div className="col-span-1">
                                            <select
                                                value={updatedBy || defaultActor || 'Suresh'}
                                                onChange={(e) => setUpdatedBy(e.target.value)}
                                                className="w-full h-9 px-1 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-semibold cursor-pointer"
                                            >
                                                <option value="Suresh">👤 Suresh</option>
                                                <option value="Rosy">🌸 Rosy</option>
                                                <option value="Claude">🤖 Claude</option>
                                            </select>
                                        </div>

                                        {/* Scope */}
                                        <div className="col-span-1">
                                            <select
                                                value={scope}
                                                onChange={(e) => setScope(e.target.value)}
                                                className="w-full h-9 px-1 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                                            >
                                                <option value="ours">🏠 Home</option>
                                                <option value="mine">👤 Suresh</option>
                                                <option value="partner">🌸 Rosy</option>
                                            </select>
                                        </div>

                                        {/* Amount */}
                                        <div className="col-span-1">
                                            <div className="relative">
                                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">₹</span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="0.00"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSubmit(e);
                                                    }}
                                                    className="w-full h-9 pl-4 pr-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-mono font-bold text-right"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Mobile Phones: Vertical Stacked Form */}
                                <div className="md:hidden">
                                    {renderFormInputs(false)}
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border bg-muted/20 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    resetForm();
                                }}
                                className="px-4 py-2 rounded-xl text-sm font-semibold border border-input hover:bg-muted text-foreground transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="tx-form"
                                className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Transaction</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dedicated Centered Edit Transaction Modal */}
            {editingTx && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
                    <div 
                        className="fixed inset-0 cursor-default" 
                        onClick={() => {
                            setEditingTx(null);
                            resetForm();
                        }}
                    />
                    <div className="relative z-10 w-full max-w-lg bg-card rounded-2xl sm:rounded-3xl border border-primary/40 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                    <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold">Edit Transaction</h2>
                                    <p className="text-[11px] text-muted-foreground">Modify amount, category, or household attribution</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingTx(null);
                                    resetForm();
                                }}
                                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 pr-3.5">
                            <form id="edit-modal-form" onSubmit={handleSubmit} className="space-y-3 pb-6">
                                {renderFormInputs(true)}
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-border bg-muted/20 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingTx(null);
                                    resetForm();
                                }}
                                className="px-4 py-2 rounded-xl text-sm font-semibold border border-input hover:bg-muted text-foreground transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="edit-modal-form"
                                className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                            >
                                <Check className="w-4 h-4" />
                                <span>Save Changes</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Transactions</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">Record and manage your household financial activities.</p>
                    </div>

                    {/* On Mobile: Month Selector on top right (directly under profile avatar in navbar) */}
                    <div className="sm:hidden">
                        {renderMonthSelector()}
                    </div>
                </div>

                <p className="text-xs text-muted-foreground -mt-1 sm:hidden">Record and manage your household financial activities.</p>

                {/* Actions Row */}
                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto">
                    {/* On Desktop: Month Selector */}
                    <div className="hidden sm:block">
                        {renderMonthSelector()}
                    </div>

                    <input
                        id="file-upload-input"
                        type="file"
                        accept=".csv,.pdf,.xlsx,.xls,.docx,.doc,.txt"
                        onChange={(e) => { processFile(e.target.files[0]); e.target.value = null; }}
                        className="hidden"
                        disabled={isParsing}
                    />
                    <button
                        type="button"
                        onClick={() => document.getElementById('file-upload-input')?.click()}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        disabled={isParsing}
                        className={cn(
                            "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer shadow-xs",
                            isDragging
                                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                                : "bg-card hover:bg-muted text-foreground border-border hover:border-primary/40",
                            isParsing && "opacity-60 cursor-not-allowed"
                        )}
                        title="Upload Statement (PDF, CSV, Excel - Click or Drag & Drop)"
                    >
                        {isParsing ? (
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4 text-primary shrink-0" />
                        )}
                        <span>{isParsing ? 'Parsing...' : 'Upload Statement'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleAddTransactionClick}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-md shadow-primary/20 shrink-0 whitespace-nowrap"
                        title="Add a new transaction"
                    >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>Add Transaction</span>
                    </button>
                </div>
            </header>

            {uploadError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl flex items-center justify-between gap-3 border border-destructive/20 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
                        <p className="text-xs sm:text-sm font-medium">{uploadError}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setUploadError('')}
                        className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-destructive/10 text-destructive shrink-0 cursor-pointer"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Main Content - Full Width Spreadsheet & Activity Register */}
            <div className="space-y-6 w-full">
                    <div className="flex flex-col gap-3 bg-card p-3 sm:p-4 rounded-2xl border shadow-sm">
                        {/* Search & Actions Row */}
                        <div className="flex items-center justify-between gap-2.5 w-full">
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    id="search-transactions"
                                    name="searchTransactions"
                                    type="text"
                                    placeholder="Search transactions..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                                />
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {/* Excel Sheet vs Cards View Toggle (Desktop) */}
                                <div className="hidden md:flex bg-muted/80 p-0.5 rounded-xl border border-border/50 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setDisplayMode('table')}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                                            displayMode === 'table' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title="Excel Sheet View"
                                    >
                                        <span>📊</span>
                                        <span>Sheet</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDisplayMode('cards')}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                                            displayMode === 'cards' ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title="Cards View"
                                    >
                                        <span>📱</span>
                                        <span>Cards</span>
                                    </button>
                                </div>



                                {/* Sort By Filter Dropdown */}
                                <CustomSelect
                                    value={sortBy}
                                    onChange={setSortBy}
                                    options={SORT_OPTIONS}
                                    icon={ArrowUpDown}
                                    align="right"
                                    menuWidth="w-52"
                                    triggerWidth="w-auto shrink-0"
                                    className="min-w-[125px] sm:min-w-[155px]"
                                />
                            </div>
                        </div>

                        {/* Filters Row: Expense For & Category Dropdowns */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-border/40 w-full min-w-0">
                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 w-full sm:w-auto">
                                {/* Dropdown 1: Expense For (Scope & Person) */}
                                <div className="relative flex-1 sm:w-56 min-w-0">
                                    <CustomSelect
                                        value={scopeFilter}
                                        onChange={setScopeFilter}
                                        options={SCOPE_OPTIONS}
                                        icon={Users}
                                        align="left"
                                        menuWidth="w-56"
                                    />
                                </div>

                                {/* Dropdown 2: Category (Type & Categories) */}
                                <div className="relative flex-1 sm:w-56 min-w-0">
                                    <CustomSelect
                                        value={filterType}
                                        onChange={setFilterType}
                                        options={categoryOptions}
                                        icon={Filter}
                                        align="right"
                                        menuWidth="w-56"
                                    />
                                </div>

                                {/* Clear Filters (if active) */}
                                {(scopeFilter !== 'all' || filterType !== 'all') && (
                                    <button
                                        type="button"
                                        onClick={() => { setScopeFilter('all'); setFilterType('all'); }}
                                        className="col-span-2 sm:col-span-1 h-9 px-3 rounded-xl border border-dashed border-border/60 hover:border-destructive/40 text-muted-foreground hover:text-destructive text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                        title="Reset filters"
                                    >
                                        <X className="w-3 h-3" />
                                        <span>Reset</span>
                                    </button>
                                )}
                            </div>

                            {/* Active filter count / summary badge on desktop */}
                            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                <span>Showing:</span>
                                <span className="font-semibold text-foreground">
                                    {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                        <div className="divide-y">
                            {viewMode === 'recurring' ? (
                                recurring.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground">
                                        <PiggyBank className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        <p>No recurring bills or fixed expenses set up yet.</p>
                                        <p className="text-xs mt-2">Add a transaction and check "Recurring" to assign bills to Suresh or Rosy!</p>
                                    </div>
                                ) : (
                                    recurring.map(rule => {
                                        const typeInfo = typeConfig.find(t => t.id === rule.type) || typeConfig[1];
                                        const currentMonthStr = new Date().toISOString().slice(0, 7);
                                        const isPaidThisMonth = (rule.paidMonths || []).includes(currentMonthStr);

                                        return (
                                            <div key={rule.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-muted/50 transition-all group">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 text-lg sm:text-xl border-2 shadow-sm", typeInfo.bg, "border-primary/20")}>
                                                        {(() => {
                                                            const cat = categories.find(c => c.id === rule.categoryId);
                                                            if (cat) return <CategoryIcon iconName={cat.icon || cat.emoji} size={18} color={cat.color} />;
                                                            return <typeInfo.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", typeInfo.color)} />;
                                                        })()}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <p className="font-semibold text-xs sm:text-sm truncate">{rule.description || getCategoryName(rule.categoryId)}</p>
                                                            <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider">Bill</span>
                                                            {rule.assignedTo && (
                                                                <span className={cn(
                                                                    "px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                                                                    rule.assignedTo === 'Rosy'
                                                                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                                                        : rule.assignedTo === 'Suresh'
                                                                        ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                                                        : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                                                )}>
                                                                    {rule.assignedTo === 'Rosy' ? '🌸 Rosy' : rule.assignedTo === 'Suresh' ? '👤 Suresh' : '🤝 Both'}
                                                                </span>
                                                            )}
                                                            {rule.dueDay && (
                                                                <span className="px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-semibold border border-amber-500/20">
                                                                    Due {rule.dueDay}th
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground flex-wrap mt-0.5">
                                                            <span>
                                                                {rule.frequency === 'weekly'
                                                                    ? `Weekly (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][rule.weeklyDay ?? 1]})`
                                                                    : rule.frequency === 'custom' ? `Every ${rule.interval} Days`
                                                                        : 'Monthly'}
                                                            </span>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(rule.categoryId) }} />
                                                                {getCategoryName(rule.categoryId)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBillPaid(rule.id, currentMonthStr)}
                                                        className={cn(
                                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border shadow-2xs",
                                                            isPaidThisMonth
                                                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                                                : "bg-muted text-muted-foreground hover:text-foreground border-border"
                                                        )}
                                                        title="Toggle paid status for current month"
                                                    >
                                                        {isPaidThisMonth ? (
                                                            <>
                                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                                                <span>Paid {rule.lastPaidBy ? `by ${rule.lastPaidBy}` : '✓'}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Square className="w-3.5 h-3.5" />
                                                                <span>Mark Paid</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <span className={cn("font-bold text-xs sm:text-sm", typeInfo.color)}>
                                                        {formatMoney(rule.amount)} / mo
                                                    </span>
                                                    <button onClick={() => deleteRecurringTransaction(rule.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Remove Fixed Rule">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )
                            ) : (
                                <>
                                    {/* Desktop: Excel Sheet Table View (hidden on mobile, shown on desktop when displayMode === 'table') */}
                                    <div className={cn("hidden md:block overflow-x-auto scrollbar-thin", displayMode === 'cards' && "md:hidden")}>
                                        <table className="w-full text-left text-xs border-collapse">
                                             <thead>
                                                <tr className="bg-muted/70 border-b border-border/80 text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                                                    <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                                                    <th className="py-2.5 px-2 whitespace-nowrap">Type</th>
                                                    <th className="py-2.5 px-2.5 whitespace-nowrap">Category</th>
                                                    <th className="py-2.5 px-3 min-w-[130px]">Description</th>
                                                    <th className="py-2.5 px-2 whitespace-nowrap">Payment</th>
                                                    <th className="py-2.5 px-2 whitespace-nowrap">Paid By</th>
                                                    <th className="py-2.5 px-2 whitespace-nowrap">Updated By</th>
                                                    <th className="py-2.5 px-2 whitespace-nowrap">Scope</th>
                                                    <th className="py-2.5 px-2.5 whitespace-nowrap text-right">Amount</th>
                                                    <th className="py-2.5 px-3 whitespace-nowrap text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/30 font-sans">
                                                {/* Desktop / Web App: Horizontal Excel Quick Entry Row (Identical to petrol entry row) */}
                                                {viewMode === 'transactions' && (
                                                    <tr className="bg-primary/5 hover:bg-primary/10 border-b-2 border-primary/30 transition-colors focus-within:bg-primary/15 group">
                                                        {/* Date */}
                                                        <td className="py-2 px-1.5 whitespace-nowrap">
                                                            <input
                                                                type="date"
                                                                value={date}
                                                                onChange={(e) => setDate(e.target.value)}
                                                                className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium w-[105px]"
                                                            />
                                                        </td>

                                                        {/* Type */}
                                                        <td className="py-2 px-1.5 whitespace-nowrap">
                                                            <select
                                                                value={type}
                                                                onChange={(e) => {
                                                                    const newType = e.target.value;
                                                                    setType(newType);
                                                                    setCategoryId('');
                                                                    if (newType === 'transfer') {
                                                                        if (!description) setDescription('GPay/Bank to Cash');
                                                                    }
                                                                }}
                                                                className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-semibold cursor-pointer min-w-[90px]"
                                                            >
                                                                <option value="expense">📉 Expense</option>
                                                                <option value="income">📈 Income</option>
                                                                <option value="savings">🐷 Savings</option>
                                                                <option value="debt">💳 Debt</option>
                                                                <option value="transfer">🔄 Transfer</option>
                                                            </select>
                                                        </td>

                                                        {/* Category */}
                                                        <td className="py-2 px-1.5 whitespace-nowrap">
                                                            {type === 'transfer' ? (
                                                                <select
                                                                    value={transferDirection}
                                                                    onChange={(e) => {
                                                                        const dir = e.target.value;
                                                                        setTransferDirection(dir);
                                                                        if (dir === 'bank_to_cash') setDescription('GPay/Bank to Cash');
                                                                        else setDescription('Cash to GPay/Bank');
                                                                    }}
                                                                    className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-semibold text-cyan-600 dark:text-cyan-400 cursor-pointer w-[110px]"
                                                                >
                                                                    <option value="bank_to_cash">Bank ➔ Cash</option>
                                                                    <option value="cash_to_bank">Cash ➔ Bank</option>
                                                                </select>
                                                            ) : type === 'debt' ? (
                                                                <select
                                                                    value={debtType}
                                                                    onChange={(e) => setDebtType(e.target.value)}
                                                                    className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer w-[110px]"
                                                                >
                                                                    <option value="personal">🤝 Personal</option>
                                                                    <option value="emi">🏦 Bank EMI</option>
                                                                    <option value="immediate">⚡ Quick Pay</option>
                                                                </select>
                                                            ) : (
                                                                <select
                                                                    value={categoryId}
                                                                    onChange={(e) => setCategoryId(e.target.value)}
                                                                    className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer w-[110px]"
                                                                >
                                                                    <option value="">Select Category...</option>
                                                                    {availableCategories.map(c => (
                                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </td>

                                                        {/* Description */}
                                                        <td className="py-2 px-2">
                                                            <input
                                                                type="text"
                                                                placeholder="e.g. Petrol, Groceries..."
                                                                value={description}
                                                                onChange={(e) => setDescription(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleSubmit(e);
                                                                }}
                                                                className="h-8 px-2.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary w-full min-w-[130px]"
                                                            />
                                                        </td>

                                                        {/* Payment */}
                                                        <td className="py-2 px-1.5 whitespace-nowrap">
                                                            <select
                                                                value={paymentMode}
                                                                onChange={(e) => setPaymentMode(e.target.value)}
                                                                className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer w-[82px]"
                                                            >
                                                                <option value="upi">📱 UPI</option>
                                                                <option value="cash">💵 Cash</option>
                                                                <option value="card">💳 Card</option>
                                                                <option value="netbanking">🏦 NetBank</option>
                                                            </select>
                                                        </td>

                                                        {/* Paid By */}
                                                        <td className="py-2 px-1.5 whitespace-nowrap">
                                                            <select
                                                                value={paidBy || defaultActor || 'Suresh'}
                                                                onChange={(e) => setPaidBy(e.target.value)}
                                                                className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-semibold cursor-pointer w-[86px]"
                                                            >
                                                                <option value="Suresh">👤 Suresh</option>
                                                                <option value="Rosy">🌸 Rosy</option>
                                                                <option value="Both">🤝 Both</option>
                                                            </select>
                                                        </td>

                                                        {/* Updated By */}
                                                        <td className="py-2 px-1.5 whitespace-nowrap">
                                                            <select
                                                                value={updatedBy || defaultActor || 'Suresh'}
                                                                onChange={(e) => setUpdatedBy(e.target.value)}
                                                                className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-semibold cursor-pointer w-[88px]"
                                                            >
                                                                <option value="Suresh">👤 Suresh</option>
                                                                <option value="Rosy">🌸 Rosy</option>
                                                                <option value="Claude">🤖 Claude</option>
                                                            </select>
                                                        </td>

                                                        {/* Scope */}
                                                        <td className="py-2 px-1.5 whitespace-nowrap">
                                                            <select
                                                                value={scope}
                                                                onChange={(e) => setScope(e.target.value)}
                                                                className="h-8 px-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-medium cursor-pointer w-[82px]"
                                                            >
                                                                <option value="ours">🏠 Home</option>
                                                                <option value="mine">👤 Suresh</option>
                                                                <option value="partner">🌸 Rosy</option>
                                                            </select>
                                                        </td>

                                                        {/* Amount */}
                                                        <td className="py-2 px-1.5 whitespace-nowrap text-right">
                                                            <div className="relative inline-block w-[80px]">
                                                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">₹</span>
                                                                <input
                                                                    ref={quickAddAmountRef}
                                                                    type="number"
                                                                    step="any"
                                                                    placeholder="0.00"
                                                                    value={amount}
                                                                    onChange={(e) => setAmount(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSubmit(e);
                                                                    }}
                                                                    className="h-8 pl-4 pr-1.5 py-1 text-xs bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary font-mono font-bold text-right w-full"
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="py-2 px-2 whitespace-nowrap text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleSubmit}
                                                                    disabled={!amount || (type !== 'debt' && !categoryId)}
                                                                    className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                                                    title="Add Entry to Sheet (or press Enter)"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                    <span>Add</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => document.getElementById('file-upload-input').click()}
                                                                    className="h-8 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                                    title="Upload Statement (CSV/PDF)"
                                                                >
                                                                    <Upload className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}

                                                {filteredTransactions.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={10} className="py-12 text-center text-muted-foreground">
                                                            <Filter className="w-10 h-10 mx-auto mb-2 opacity-25" />
                                                            <p className="font-medium text-xs">No transactions match your current filters.</p>
                                                            <p className="text-[11px] opacity-75 mt-0.5">Use the row above to quickly record a new entry!</p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredTransactions.map((tx, idx) => {
                                                        const typeInfo = typeConfig.find(t => t.id === tx.type) || typeConfig[1];
                                                        const hasComments = Array.isArray(tx.comments) && tx.comments.length > 0;
                                                        const isCommentOpen = activeCommentTxId === tx.id;
                                                        const isEven = idx % 2 === 0;

                                                        const actor = tx.updatedBy || tx.createdBy || (tx.source === 'mcp' ? 'Claude' : null);
                                                        const isSuresh = actor ? actor.toLowerCase().includes('sur') : true;
                                                        const isRosy = actor ? actor.toLowerCase().includes('ros') : false;
                                                        const isClaude = actor ? (actor.toLowerCase().includes('claude') || tx.source === 'mcp') : false;
                                                        const actorLabel = isClaude ? 'Claude' : isRosy ? 'Rosy' : isSuresh ? 'Suresh' : (actor || 'Suresh');

                                                        return (
                                                            <React.Fragment key={tx.id}>
                                                                <tr className={cn(
                                                                    "hover:bg-primary/5 transition-colors group text-xs",
                                                                    isEven ? "bg-background" : "bg-muted/15"
                                                                )}>
                                                                    {/* Date */}
                                                                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground text-xs">
                                                                        {format(new Date(tx.date), 'dd MMM yyyy')}
                                                                    </td>

                                                                    {/* Type */}
                                                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                                        <span className={cn(
                                                                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                                                                            typeInfo.bg, typeInfo.color
                                                                        )}>
                                                                            <typeInfo.icon className="w-3 h-3" />
                                                                            <span>{typeInfo.label}</span>
                                                                        </span>
                                                                    </td>

                                                                    {/* Category */}
                                                                    <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                                                                        {tx.type === 'transfer' ? (
                                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                                                                <span>{tx.transferDirection === 'cash_to_bank' ? '💵➔📱' : '📱➔💵'}</span>
                                                                                <span>{tx.transferDirection === 'cash_to_bank' ? 'Cash to Bank' : 'GPay to Cash'}</span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1.5">
                                                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(tx.categoryId) }} />
                                                                                <span className="truncate max-w-[120px]">{getCategoryName(tx.categoryId)}</span>
                                                                            </span>
                                                                        )}
                                                                    </td>

                                                                    {/* Description */}
                                                                    <td className="py-2.5 px-3 text-foreground font-medium truncate max-w-[200px]" title={tx.description}>
                                                                        {tx.description || '-'}
                                                                    </td>

                                                                    {/* Payment Mode */}
                                                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                                        {tx.type === 'transfer' ? (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-semibold border border-cyan-500/30">
                                                                                <ArrowLeftRight className="w-3 h-3" />
                                                                                <span>{tx.bankName ? `${tx.bankName}` : 'Self Transfer'}</span>
                                                                            </span>
                                                                        ) : (
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-medium border border-border/40">
                                                                                    <span>{tx.paymentMode === 'cash' ? '💵' : tx.paymentMode === 'card' ? '💳' : tx.paymentMode === 'netbanking' ? '🏦' : '📱'}</span>
                                                                                    <span className="capitalize">{tx.paymentMode || 'UPI'}</span>
                                                                                </span>
                                                                                <PaymentStatusBadge status={tx.paymentStatus} deferredTo={tx.deferredTo} />
                                                                            </div>
                                                                        )}
                                                                    </td>

                                                                    {/* Paid By */}
                                                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                                        {(() => {
                                                                            const payer = tx.paidBy || (tx.scope === 'partner' ? 'Rosy' : 'Suresh');
                                                                            const isRosyPayer = payer.toLowerCase().includes('ros');
                                                                            const isBoth = payer.toLowerCase().includes('both') || payer.toLowerCase().includes('joint');
                                                                            return (
                                                                                <span className={cn(
                                                                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border",
                                                                                    isBoth
                                                                                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30"
                                                                                        : isRosyPayer
                                                                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                                                                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                                                                )}>
                                                                                    <span>{isBoth ? '🤝' : isRosyPayer ? '🌸' : '👤'}</span>
                                                                                    <span>{isBoth ? 'Both' : isRosyPayer ? 'Rosy' : 'Suresh'}</span>
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </td>

                                                                    {/* Updated By */}
                                                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                                        <span className={cn(
                                                                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border",
                                                                            isClaude
                                                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                                                                : isRosy
                                                                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                                                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                                                                        )}>
                                                                            <span>{isClaude ? '🤖' : isRosy ? '🌸' : '👤'}</span>
                                                                            <span>{actorLabel}</span>
                                                                        </span>
                                                                    </td>

                                                                    {/* Scope */}
                                                                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                                        <span className={cn(
                                                                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border",
                                                                            tx.scope === 'mine'
                                                                                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                                                                                : tx.scope === 'partner'
                                                                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                                                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                                        )}>
                                                                            <span>{tx.scope === 'mine' ? '👤' : tx.scope === 'partner' ? '🌸' : '🏠'}</span>
                                                                            <span>{tx.scope === 'mine' ? 'Suresh' : tx.scope === 'partner' ? 'Rosy' : 'Home'}</span>
                                                                        </span>
                                                                    </td>

                                                                    {/* Amount */}
                                                                    <td className={cn(
                                                                        "py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap text-xs sm:text-sm font-mono",
                                                                        typeInfo.color
                                                                    )}>
                                                                        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : tx.type === 'transfer' ? '⇄ ' : ''}{formatMoney(tx.amount)}
                                                                    </td>

                                                                    {/* Actions */}
                                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                                        <div className="inline-flex items-center gap-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setActiveCommentTxId(isCommentOpen ? null : tx.id)}
                                                                                className={cn(
                                                                                    "p-1 rounded-lg transition-colors relative cursor-pointer",
                                                                                    hasComments
                                                                                        ? "text-primary hover:bg-primary/10 bg-primary/10"
                                                                                        : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                                                )}
                                                                                title="Comments & Questions"
                                                                            >
                                                                                <MessageCircle className="w-3.5 h-3.5" />
                                                                                {hasComments && (
                                                                                    <span className="absolute -top-1 -right-1 px-1 min-w-[13px] h-[13px] rounded-full bg-primary text-primary-foreground text-[8px] font-black flex items-center justify-center leading-none">
                                                                                        {tx.comments.length}
                                                                                    </span>
                                                                                )}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleEditClick(tx)}
                                                                                className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                                                                                title="Edit Transaction"
                                                                            >
                                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => deleteTransaction(tx.id)}
                                                                                className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                                                                title="Delete Transaction"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>

                                                                {/* Inline Comment Thread Drawer */}
                                                                {isCommentOpen && (
                                                                    <tr className="bg-muted/30">
                                                                        <td colSpan={10} className="p-3">
                                                                            <div className="max-w-xl mx-auto space-y-2 bg-card p-3 rounded-xl border border-border/60 shadow-xs animate-in slide-in-from-top-1">
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                                                                                        <MessageCircle className="w-3.5 h-3.5 text-primary" />
                                                                                        Comments & Questions ({tx.comments?.length || 0})
                                                                                    </span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setActiveCommentTxId(null)}
                                                                                        className="p-1 rounded-full text-muted-foreground hover:bg-muted text-xs cursor-pointer"
                                                                                    >
                                                                                        <X className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                </div>

                                                                                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                                                    {(!tx.comments || tx.comments.length === 0) ? (
                                                                                        <p className="text-xs text-muted-foreground italic py-1">No comments yet. Ask a question or leave a note!</p>
                                                                                    ) : (
                                                                                        tx.comments.map(c => (
                                                                                            <div key={c.id} className="p-2 rounded-lg bg-muted/40 border border-border/50 text-xs space-y-0.5">
                                                                                                <div className="flex items-center justify-between">
                                                                                                    <span className="font-bold flex items-center gap-1">
                                                                                                        {c.author === 'Rosy' ? '🌸' : c.author === 'Claude' ? '🤖' : '👤'} {c.author}
                                                                                                        {c.emoji && <span className="text-sm ml-1">{c.emoji}</span>}
                                                                                                    </span>
                                                                                                    <span className="text-[10px] text-muted-foreground">
                                                                                                        {format(new Date(c.createdAt), 'MMM dd, h:mm a')}
                                                                                                    </span>
                                                                                                </div>
                                                                                                {c.text && <p className="text-foreground leading-relaxed pl-1">{c.text}</p>}
                                                                                            </div>
                                                                                        ))
                                                                                    )}
                                                                                </div>

                                                                                <form
                                                                                    onSubmit={(e) => {
                                                                                        e.preventDefault();
                                                                                        if (!commentText.trim() && !commentEmoji) return;
                                                                                        addTransactionComment(tx.id, commentText, commentEmoji);
                                                                                        setCommentText('');
                                                                                        setCommentEmoji('');
                                                                                    }}
                                                                                    className="space-y-1.5 pt-1 border-t border-border/40"
                                                                                >
                                                                                    <div className="flex gap-1.5">
                                                                                        <input
                                                                                            type="text"
                                                                                            placeholder="Ask or note (e.g. What was this for?)..."
                                                                                            value={commentText}
                                                                                            onChange={(e) => setCommentText(e.target.value)}
                                                                                            className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                                                                                        />
                                                                                        <button
                                                                                            type="submit"
                                                                                            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1 shadow-sm hover:opacity-90 transition-all shrink-0 cursor-pointer"
                                                                                        >
                                                                                            <Send className="w-3 h-3" />
                                                                                            <span>Send</span>
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                                        <span className="text-[10px] font-medium">Quick reaction:</span>
                                                                                        {['👍', '❤️', '❓', '🛒', '⚡', '🎉'].map(emoji => (
                                                                                            <button
                                                                                                key={emoji}
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    addTransactionComment(tx.id, '', emoji);
                                                                                                }}
                                                                                                className="hover:scale-125 transition-transform p-0.5 text-sm cursor-pointer"
                                                                                                title={`React with ${emoji}`}
                                                                                            >
                                                                                                {emoji}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </form>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile: ALWAYS Card View | Desktop: shown when displayMode === 'cards' */}
                                    <div className={cn("divide-y divide-border/20", displayMode === 'table' ? "md:hidden" : "md:block")}>
                                        {filteredTransactions.length === 0 ? (
                                        <div className="p-12 text-center text-muted-foreground">
                                            <Filter className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                            <p>No transactions found.</p>
                                        </div>
                                    ) : (
                                        filteredTransactions.map(tx => {
                                            const typeInfo = typeConfig.find(t => t.id === tx.type) || typeConfig[1];
                                            const hasComments = Array.isArray(tx.comments) && tx.comments.length > 0;
                                            const isCommentOpen = activeCommentTxId === tx.id;

                                            return (
                                                <div key={tx.id} className="p-3 sm:p-4 hover:bg-muted/40 transition-all border-b border-border/30 last:border-b-0">
                                                    {/* Row 1: Left icon + Title + Compact Meta Badges */}
                                                    <div className="flex items-center gap-3">
                                                        {/* Category Icon */}
                                                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm", typeInfo.bg)}>
                                                            {(() => {
                                                                if (tx.type === 'transfer') {
                                                                    return <ArrowLeftRight className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />;
                                                                }
                                                                const cat = categories.find(c => c.id === tx.categoryId);
                                                                if (cat) return <CategoryIcon iconName={cat.icon || cat.emoji} size={18} color={cat.color} />;
                                                                return <typeInfo.icon className={cn("w-5 h-5", typeInfo.color)} />;
                                                            })()}
                                                        </div>

                                                        {/* Title + Meta Row */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-sm text-foreground truncate leading-tight">
                                                                {tx.description || (tx.type === 'transfer' ? (tx.transferDirection === 'cash_to_bank' ? 'Cash to Bank' : 'GPay to Cash') : getCategoryName(tx.categoryId))}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] text-muted-foreground">
                                                                {/* Date */}
                                                                <span>{format(new Date(tx.date), 'MMM dd, yyyy')}</span>
                                                                <span className="text-muted-foreground/40 text-[10px]">•</span>

                                                                {/* Category Dot + Name OR Transfer Direction Badge */}
                                                                {tx.type === 'transfer' ? (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                                                                        <ArrowLeftRight className="w-2.5 h-2.5" />
                                                                        {tx.transferDirection === 'cash_to_bank' ? '💵➔📱 Cash to Bank' : '📱➔💵 GPay to Cash'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1">
                                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(tx.categoryId) }} />
                                                                        <span>{getCategoryName(tx.categoryId)}</span>
                                                                    </span>
                                                                )}

                                                                {/* Payment Mode Badge (UPI, Cash, etc) or Bank Name for Transfer */}
                                                                {tx.type === 'transfer' ? (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider bg-cyan-500/15 text-cyan-500 dark:text-cyan-400 border border-cyan-500/30">
                                                                        🏦 {tx.bankName || 'Bank'}
                                                                    </span>
                                                                ) : tx.paymentMode ? (
                                                                    <span className={cn(
                                                                        "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider",
                                                                        tx.paymentMode === 'upi'        && "bg-purple-500/15 text-purple-400 border border-purple-500/30",
                                                                        tx.paymentMode === 'cash'       && "bg-green-500/15 text-green-400 border border-green-500/30",
                                                                        tx.paymentMode === 'card'       && "bg-blue-500/15 text-blue-400 border border-blue-500/30",
                                                                        tx.paymentMode === 'netbanking' && "bg-orange-500/15 text-orange-400 border border-orange-500/30",
                                                                    )}>
                                                                        {tx.paymentMode === 'netbanking' ? 'NetBank' : tx.paymentMode.toUpperCase()}
                                                                    </span>
                                                                ) : null}

                                                                {/* Paid By Badge */}
                                                                {(() => {
                                                                    const payer = tx.paidBy || (tx.scope === 'partner' ? 'Rosy' : 'Suresh');
                                                                    const isRosyPayer = payer.toLowerCase().includes('ros');
                                                                    const isBoth = payer.toLowerCase().includes('both') || payer.toLowerCase().includes('joint');
                                                                    return (
                                                                        <span
                                                                            title={`Paid by ${isBoth ? 'Both' : isRosyPayer ? 'Rosy' : 'Suresh'}`}
                                                                            className={cn(
                                                                                "inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold border",
                                                                                isBoth
                                                                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                                                                    : isRosyPayer
                                                                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                                                                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                                                            )}
                                                                        >
                                                                            <span>{isBoth ? '🤝' : isRosyPayer ? '🌸' : '👤'}</span>
                                                                            <span>Paid: {isBoth ? 'Both' : isRosyPayer ? 'Rosy' : 'Suresh'}</span>
                                                                        </span>
                                                                    );
                                                                })()}

                                                                {/* Updated By Badge (Suresh / Rosy / Claude) */}
                                                                {(() => {
                                                                    const actor = tx.updatedBy || tx.createdBy || (tx.source === 'mcp' ? 'Claude' : 'Suresh');
                                                                    const isRosy = actor.toLowerCase().includes('ros');
                                                                    const isClaude = actor.toLowerCase().includes('claude') || tx.source === 'mcp';
                                                                    const label = isClaude ? 'Claude' : isRosy ? 'Rosy' : 'Suresh';
                                                                    return (
                                                                        <span
                                                                            title={`Updated by ${label}`}
                                                                            className={cn(
                                                                                "inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold border",
                                                                                isClaude
                                                                                    ? "bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/30"
                                                                                    : isRosy
                                                                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                                                                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                                                            )}
                                                                        >
                                                                            <span>{isClaude ? '🤖' : isRosy ? '🌸' : '👤'}</span>
                                                                            <span>By: {label}</span>
                                                                        </span>
                                                                    );
                                                                })()}

                                                                {/* Scope Badge (Home / Suresh / Rosy) */}
                                                                {(() => {
                                                                    const scope = tx.scope || 'ours';
                                                                    return (
                                                                        <span className={cn(
                                                                            "inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold border",
                                                                            scope === 'ours'
                                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                                                : scope === 'partner'
                                                                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                                                                : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                                                        )}>
                                                                            <span>{scope === 'ours' ? '🏠' : scope === 'partner' ? '🌸' : '👤'}</span>
                                                                            <span>{scope === 'ours' ? 'Home' : scope === 'partner' ? 'Rosy' : 'Suresh'}</span>
                                                                        </span>
                                                                    );
                                                                })()}

                                                                {/* Payment Status Badge */}
                                                                <PaymentStatusBadge
                                                                    status={tx.paymentStatus}
                                                                    deferredTo={tx.deferredTo}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Amount (LEFT) + Actions (RIGHT) - Exactly matching reference screenshot */}
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
                                                        <span className={cn("font-bold text-sm font-mono tracking-tight", typeInfo.color)}>
                                                            {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : tx.type === 'transfer' ? '⇄ ' : ''}{formatMoney(tx.amount)}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setActiveCommentTxId(isCommentOpen ? null : tx.id)}
                                                                className={cn(
                                                                    "p-1.5 rounded-lg transition-colors relative cursor-pointer",
                                                                    hasComments ? "text-primary hover:bg-primary/10 bg-primary/10" : "text-muted-foreground/60 hover:text-primary hover:bg-primary/10"
                                                                )}
                                                                title="Comments & Questions"
                                                            >
                                                                <MessageCircle className="w-3.5 h-3.5" />
                                                                {hasComments && (
                                                                    <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-[14px] rounded-full bg-primary text-primary-foreground text-[8.5px] font-black flex items-center justify-center leading-none">
                                                                        {tx.comments.length}
                                                                    </span>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleEditClick(tx)}
                                                                className="p-1.5 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                                                                title="Edit Transaction"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteTransaction(tx.id)}
                                                                className="p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                                                                title="Delete Transaction"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Feature 3: Expandable Comment Thread Drawer */}
                                                    {isCommentOpen && (
                                                        <div className="mt-2.5 pt-2.5 space-y-2 bg-muted/30 p-3 rounded-xl border border-border/40 animate-in slide-in-from-top-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                                                                    <MessageCircle className="w-3.5 h-3.5 text-primary" />
                                                                    Comments & Questions ({tx.comments?.length || 0})
                                                                </span>
                                                                <button
                                                                    onClick={() => setActiveCommentTxId(null)}
                                                                    className="p-1 rounded-full text-muted-foreground hover:bg-muted text-xs cursor-pointer"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>

                                                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                                {(!tx.comments || tx.comments.length === 0) ? (
                                                                    <p className="text-xs text-muted-foreground italic py-1">No comments yet. Ask a question or leave a note!</p>
                                                                ) : (
                                                                    tx.comments.map(c => (
                                                                        <div key={c.id} className="p-2 rounded-lg bg-card border border-border/60 text-xs space-y-0.5 shadow-2xs">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="font-bold flex items-center gap-1">
                                                                                    {c.author === 'Rosy' ? '🌸' : c.author === 'Claude' ? '🤖' : '👤'} {c.author}
                                                                                    {c.emoji && <span className="text-sm ml-1">{c.emoji}</span>}
                                                                                </span>
                                                                                <span className="text-[10px] text-muted-foreground">
                                                                                    {format(new Date(c.createdAt), 'MMM dd, h:mm a')}
                                                                                </span>
                                                                            </div>
                                                                            {c.text && <p className="text-foreground leading-relaxed pl-1">{c.text}</p>}
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>

                                                            <form
                                                                onSubmit={(e) => {
                                                                    e.preventDefault();
                                                                    if (!commentText.trim() && !commentEmoji) return;
                                                                    addTransactionComment(tx.id, commentText, commentEmoji);
                                                                    setCommentText('');
                                                                    setCommentEmoji('');
                                                                }}
                                                                className="space-y-1.5 pt-1 border-t border-border/40"
                                                            >
                                                                <div className="flex gap-1.5">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Ask or note (e.g. What was this for?)..."
                                                                        value={commentText}
                                                                        onChange={(e) => setCommentText(e.target.value)}
                                                                        className="flex-1 px-3 py-1.5 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                                                                    />
                                                                    <button
                                                                        type="submit"
                                                                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1 shadow-sm hover:opacity-90 transition-all shrink-0 cursor-pointer"
                                                                    >
                                                                        <Send className="w-3 h-3" />
                                                                        <span>Send</span>
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                    <span className="text-[10px] font-medium">Quick reaction:</span>
                                                                    {['👍', '❤️', '❓', '🛒', '⚡', '🎉'].map(emoji => (
                                                                        <button
                                                                            key={emoji}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                addTransactionComment(tx.id, '', emoji);
                                                                            }}
                                                                            className="hover:scale-125 transition-transform p-0.5 text-sm cursor-pointer"
                                                                            title={`React with ${emoji}`}
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </form>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Excel Status Bar (Counts & Totals) */}
                        {viewMode === 'transactions' && filteredTransactions.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 border-t border-border/50 text-[11px] text-muted-foreground font-mono select-none">
                                <div className="flex items-center gap-3">
                                    <span>COUNT: <strong className="text-foreground">{filteredTransactions.length}</strong></span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span>EXPENSE: <strong className="text-rose-600 font-bold">{formatMoney(filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0))}</strong></span>
                                    <span>INCOME: <strong className="text-emerald-600 font-bold">{formatMoney(filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0))}</strong></span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            {/* Upload Preview Modal */}
            {
                showUploadPreview && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-background rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-border">
                            <div className="p-6 border-b border-border flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-primary" />
                                        Review Imported Transactions
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Found {parsedTransactions.length} transactions. Please review before importing.
                                    </p>
                                </div>
                                <button onClick={() => setShowUploadPreview(false)} className="p-2 hover:bg-muted rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto p-0">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3 text-right">Amount</th>
                                            <th className="px-6 py-3 text-center">Type</th>
                                            <th className="px-6 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {parsedTransactions.map((tx, idx) => (
                                            <tr key={idx} className="hover:bg-muted/30">
                                                <td className="px-6 py-3 font-medium whitespace-nowrap">
                                                    {format(new Date(tx.date), 'MMM dd, yyyy')}
                                                </td>
                                                <td className="px-6 py-3 max-w-xs truncate" title={tx.description}>
                                                    {tx.description}
                                                </td>
                                                <td className={cn("px-6 py-3 text-right font-medium", tx.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                                                    {formatMoney(tx.amount)}
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                        tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    )}>
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <button
                                                        onClick={() => removeParsedTransaction(idx)}
                                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-6 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setShowUploadPreview(false)}
                                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleImportConfirm}
                                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
                                >
                                    <Check className="w-4 h-4" />
                                    Import {parsedTransactions.length} Transactions
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }



            {/* PDF Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                🔒 Encrypted PDF
                            </h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                This bank statement is password protected. Please enter the password (often your Customer ID or DOB) to unlock it.
                            </p>
                            
                            <div className="space-y-4">
                                <input
                                    type="password"
                                    value={pdfPassword}
                                    onChange={(e) => setPdfPassword(e.target.value)}
                                    placeholder="Enter PDF password"
                                    className="w-full h-12 rounded-xl border border-input bg-background px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handlePasswordSubmit();
                                    }}
                                />
                                {uploadError && uploadError.includes('Password required') && (
                                    <p className="text-xs text-red-500 font-medium">{uploadError}</p>
                                )}
                            </div>
                        </div>
                        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPendingFile(null);
                                    setPdfPassword('');
                                    setUploadError('');
                                }}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasswordSubmit}
                                disabled={!pdfPassword || isParsing}
                                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {isParsing ? 'Decrypting...' : 'Unlock & Parse'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Transactions;
