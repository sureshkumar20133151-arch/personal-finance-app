
import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFinanceData } from '../hooks/useFinanceData';
import {
    Plus, Search, Filter, Trash2, Edit2, X, TrendingUp, TrendingDown,
    PiggyBank, CreditCard, Download, MessageSquare, RefreshCw, Share2,
    MessageCircle, CheckCircle, CheckSquare, Square, Home, User, Users,
    Send, Smile, Calendar, Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { parseStatement } from '../lib/StatementParser';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';
import SMSScanModal from '../components/SMSScanModal';
import { triggerHapticNotification } from '../lib/haptics';
import { useAuth } from '../context/AuthContext';

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
    const [updatedBy, setUpdatedBy] = useState('Suresh');

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

    // Sync updatedBy with defaultActor if not actively editing
    useEffect(() => {
        if (!editingTx && defaultActor) {
            setUpdatedBy(defaultActor);
            setScope(householdId ? 'ours' : 'mine');
        }
    }, [defaultActor, editingTx, householdId]);

    // Household "Share" transfer state
    const [shareWithUid, setShareWithUid] = useState('');
    const [showShareOptions, setShowShareOptions] = useState(false);

    // Lock body scroll when Add Transaction modal is open on mobile
    React.useEffect(() => {
        if (showAddForm && window.innerWidth < 1024) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showAddForm]);
    const [showSMSScan, setShowSMSScan] = useState(false);

    // List View State
    const [viewMode, setViewMode] = useState('transactions'); // 'transactions' or 'recurring'

    // Filter State
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [recurringFreq, setRecurringFreq] = useState('monthly');
    const [recurringInterval, setRecurringInterval] = useState(28);
    const [recurringDay, setRecurringDay] = useState(1); // 0=Sun, 1=Mon (Default)
    const [recurringTenure, setRecurringTenure] = useState(''); // New State

    // Payment Mode State
    const [paymentMode, setPaymentMode] = useState('upi');

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
        setShareWithUid('');
        setShowShareOptions(false);
        setUpdatedBy(defaultActor || 'Suresh');
        setScope(householdId ? 'ours' : 'mine');
        setAssignedTo('Both');
        setDueDay(5);
    };

    // Derived Logic
    const typeConfig = [
        { id: 'income', label: 'Income', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
        { id: 'expense', label: 'Expense', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
        { id: 'savings', label: 'Savings', icon: PiggyBank, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        { id: 'debt', label: 'Debt', icon: CreditCard, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    ];

    const availableCategories = useMemo(() => {
        return categories.filter(c => c.type === type);
    }, [categories, type]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesType = filterType === 'all' || t.type === filterType;
            const matchesScope = scopeFilter === 'all'
                || (scopeFilter === 'ours' && (t.scope === 'ours' || !t.scope))
                || (scopeFilter === 'mine' && (t.scope === 'mine' || t.scope === 'partner'));
            const desc = t.description || '';
            const matchesSearch = desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.updatedBy || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.comments || []).some(cm => (cm.text || '').toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesType && matchesScope && matchesSearch;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, filterType, scopeFilter, searchQuery, categories]);

    // Handlers
    const handleSubmit = (e) => {
        e.preventDefault();
        // Validation: Amount required. Category required UNLESS it's a debt repayment (then loanId or just general is fine)
        if (!amount || (type !== 'debt' && !categoryId)) return;

        const txData = {
            amount: parseFloat(amount),
            description,
            date,
            type,
            categoryId,
            ...(type === 'debt' && loanId ? { loanId, repaymentType } : {}),
            paymentMode: paymentMode,
            updatedBy: updatedBy || defaultActor || 'Suresh',
            ...(!editingTx ? { createdBy: updatedBy || defaultActor || 'Suresh' } : {}),
            scope: scope || (householdId ? 'ours' : 'mine'),
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
        setUpdatedBy(tx.updatedBy || tx.createdBy || (tx.source === 'mcp' ? 'Claude' : defaultActor || 'Suresh'));
        setScope(tx.scope || 'ours');
        if (tx.loanId) setLoanId(tx.loanId);
        if (tx.repaymentType) setRepaymentType(tx.repaymentType);
        
        setShowAddForm(true);
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

    const handleExportData = () => {
        if (!transactions || transactions.length === 0) {
            alert("No transactions to export.");
            return;
        }

        // Format to CSV
        const headers = ["Description", "Date", "Type", "Category", "Amount", "Payment Mode"];
        const rows = transactions.map(t => {
            const dateStr = t.date ? format(new Date(t.date), 'yyyy-MM-dd') : '';
            const categoryName = getCategoryName(t.categoryId);
            return [
                `"${(t.description || '').replace(/"/g, '""')}"`,
                dateStr,
                t.type || '',
                `"${categoryName}"`,
                t.amount || 0,
                t.paymentMode || ''
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(e => e.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `budget_tracker_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Transactions</h1>
                    <p className="text-muted-foreground">Record and manage your financial activities.</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setShowAddForm(true);
                    }}
                    className="lg:hidden flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all cursor-pointer shadow-sm shadow-emerald-500/10 shrink-0"
                    title="Add a transaction manually"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Transaction</span>
                </button>
            </header>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Form Section - Pop-up Modal on Mobile, Sticky Inline Card on Desktop */}
                <div className={cn(
                    "fixed inset-0 z-50 bg-background/80 backdrop-blur-md p-2 sm:p-4 flex justify-center items-start sm:items-center py-3 sm:py-6 pb-24 sm:pb-6 transition-all duration-200",
                    "lg:relative lg:inset-auto lg:z-0 lg:flex-none lg:p-0 lg:bg-transparent lg:backdrop-blur-none lg:block lg:col-span-1",
                    showAddForm ? "block" : "hidden lg:block"
                )}>
                    <div 
                        className="fixed inset-0 cursor-default lg:hidden" 
                        onClick={() => {
                            setShowAddForm(false);
                            resetForm();
                        }}
                    />
                    <div className={cn(
                        "rounded-2xl sm:rounded-3xl border border-border bg-card shadow-2xl w-full max-w-full sm:max-w-xl lg:max-w-md relative z-10 transition-all",
                        "flex flex-col max-h-[92vh] sm:max-h-[85vh]",
                        "lg:shadow-sm lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)]",
                        editingTx ? "border-primary ring-1 ring-primary" : "border-border"
                    )}>
                        {/* Sticky Header - always visible while scrolling */}
                        <div className="flex items-center justify-between px-3.5 sm:px-5 lg:px-6 pt-3.5 sm:pt-5 lg:pt-6 pb-2 sm:pb-4 lg:pb-6 shrink-0">
                            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                                {editingTx ? <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> : <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />}
                                {editingTx ? 'Edit Transaction' : 'Add Transaction'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    resetForm();
                                }}
                                className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer lg:hidden"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Scrollable Body - header/footer stay fixed while this scrolls */}
                        <div className="flex-1 overflow-y-auto scrollbar-none px-3.5 sm:px-5 lg:px-6">

                        {/* Drag & Drop Zone - Compact Version */}
                        {!editingTx && (
                            <div
                                className={cn(
                                    "mb-2 border border-dashed rounded-lg p-2 sm:p-2.5 text-center transition-all cursor-pointer",
                                    isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
                                )}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById('file-upload-input').click()}
                            >
                                <input
                                    id="file-upload-input"
                                    type="file"
                                    accept=".csv,.pdf,.xlsx,.xls,.docx,.doc,.txt"
                                    onChange={(e) => { processFile(e.target.files[0]); e.target.value = null; }}
                                    className="hidden"
                                    disabled={isParsing}
                                />
                                <div className="flex items-center justify-center gap-2">
                                    {isParsing ? (
                                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Upload className={cn("w-4 h-4", isDragging ? "text-primary" : "text-muted-foreground")} />
                                    )}
                                    <span className={cn("text-xs font-medium", isDragging ? "text-primary" : "text-muted-foreground")}>
                                        {isParsing ? 'Parsing...' : 'Upload Statement (Drag or Click)'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {!editingTx && transactionLimitReached && (
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

                        <form id="tx-form" onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3 pb-4">
                            <div className="space-y-1 sm:space-y-1.5" role="radiogroup" aria-labelledby="type-label">
                                <span id="type-label" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Type</span>
                                <div className="grid grid-cols-4 gap-1 p-1 bg-muted/50 rounded-lg">
                                    {typeConfig.map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => { setType(t.id); setCategoryId(''); setIsRecurring(false); }}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-md text-[10px] font-semibold transition-all",
                                                type === t.id
                                                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                            )}
                                            title={t.label}
                                        >
                                            <t.icon className={cn("w-3.5 h-3.5", type === t.id ? t.color : "")} />
                                            <span className="leading-none text-center">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="category" className="text-xs font-medium">Category</label>
                                {/* Special case for Debt Repayment: Show Linked Loan Selector if type is debt */}
                                {type === 'debt' ? (
                                    <div className="space-y-2">
                                        {/* 1. Sub-Type Selector */}
                                        <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
                                            <button
                                                type="button"
                                                onClick={() => { setDebtType('immediate'); setLoanId(''); setAmount(''); }}
                                                className={cn("text-[10px] font-medium py-1.5 px-1 rounded-md transition-all leading-tight", debtType === 'immediate' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                Immediate
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setDebtType('personal'); setLoanId(''); setAmount(''); }}
                                                className={cn("text-[10px] font-medium py-1.5 px-1 rounded-md transition-all leading-tight", debtType === 'personal' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                Debt
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDebtType('emi');
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
                                                }}
                                                className={cn("text-[10px] font-medium py-1.5 px-1 rounded-md transition-all leading-tight", debtType === 'emi' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                EMI
                                            </button>
                                        </div>

                                        {/* 2. Logic based on Sub-Type */}
                                        {debtType === 'immediate' && (
                                            <div className="p-2 bg-muted/30 rounded-md border border-dashed border-border text-[10px] text-muted-foreground">
                                                One-off repayments not tracked in Loans.
                                            </div>
                                        )}

                                        {debtType === 'personal' && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                                <select
                                                    id="loan-account"
                                                    name="loanAccount"
                                                    value={loanId}
                                                    onChange={(e) => {
                                                        const selectedId = e.target.value;
                                                        setLoanId(selectedId);
                                                        setAmount(''); // Reset amount for manual entry
                                                    }}
                                                    className="w-full h-9 bg-background border border-input rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                                >
                                                    <option value="">Select Account</option>
                                                    {loans.filter(l => l.type === 'debt').map(l => (
                                                        <option key={l.id} value={l.id}>{l.name}</option>
                                                    ))}
                                                </select>

                                                {loanId && (
                                                    <div className="flex gap-2 p-1 bg-muted rounded-lg">
                                                        <button
                                                            type="button"
                                                            onClick={() => setRepaymentType('principal')}
                                                            className={cn("flex-1 text-[10px] font-medium py-1 rounded-md transition-all", repaymentType === 'principal' ? "bg-background shadow text-primary" : "text-muted-foreground hover:text-foreground")}
                                                        >
                                                            Principal
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setRepaymentType('interest')}
                                                            className={cn("flex-1 text-[10px] font-medium py-1 rounded-md transition-all", repaymentType === 'interest' ? "bg-background shadow text-orange-600" : "text-muted-foreground hover:text-foreground")}
                                                        >
                                                            Interest
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {debtType === 'emi' && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                                <select
                                                    id="emi-loan"
                                                    name="emiLoan"
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
                                                    className="w-full h-9 bg-background border border-input rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                                >
                                                    <option value="">Select EMI Loan</option>
                                                    {loans.filter(l => l.type === 'emi').map(l => (
                                                        <option key={l.id} value={l.id}>{l.name} ({formatMoney(l.monthlyAmount)}/mo)</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select
                                            id="category"
                                            name="category"
                                            value={categoryId}
                                            onChange={(e) => setCategoryId(e.target.value)}
                                            className="w-full h-9 bg-background border border-input rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                            required={type !== 'debt'}
                                        >
                                            <option value="" disabled>Select Category</option>
                                            {availableCategories.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {type !== 'debt' && availableCategories.length === 0 && (
                                    <p className="text-[10px] text-destructive">No categories found for {type}.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label htmlFor="amount" className="text-xs font-medium">Amount</label>
                                    <input
                                        id="amount"
                                        name="amount"
                                        type="number"
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm font-bold"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="date" className="text-xs font-medium">Date</label>
                                    <input
                                        id="date"
                                        name="date"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="description" className="text-xs font-medium">Description</label>
                                <input
                                    id="description"
                                    name="description"
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g. Monthly Rent"
                                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                                />
                            </div>

                            {householdId && type === 'expense' && !editingTx && (
                                <div className="space-y-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setShowShareOptions(v => !v)}
                                        className="w-full flex items-center justify-between text-xs font-medium py-2 px-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground"
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
                                                className="text-destructive"
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
                                                        className="text-xs font-medium py-2 px-2 rounded-lg border border-border hover:bg-muted/50 truncate"
                                                    >
                                                        {m.name || 'Member'}
                                                    </button>
                                                ))}
                                        </div>
                                    )}
                                    {shareWithUid && (
                                        <p className="text-[10px] text-muted-foreground px-1">
                                            This creates a matching income entry for them automatically — you don't need to add it twice.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Payment Mode</label>
                                <div className="grid grid-cols-4 gap-1 p-1 bg-muted/50 rounded-lg">
                                    {[
                                        { id: 'upi',        label: 'UPI',         emoji: '📱' },
                                        { id: 'cash',       label: 'Cash',        emoji: '💵' },
                                        { id: 'card',       label: 'Card',        emoji: '💳' },
                                        { id: 'netbanking', label: 'Net Banking', emoji: '🏦' },
                                    ].map(mode => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => setPaymentMode(mode.id)}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-md text-[10px] font-medium transition-all",
                                                paymentMode === mode.id
                                                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                            )}
                                        >
                                            <span style={{ fontSize: '14px' }}>{mode.emoji}</span>
                                            <span className="text-[8.5px] sm:text-xs leading-tight text-center font-medium mt-0.5">{mode.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Updated By / Added By Selector (Suresh / Rosy / Claude) */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium">
                                        {editingTx ? 'Updated By' : 'Recorded By'}
                                    </label>
                                    <span className="text-[10px] text-muted-foreground">Select author</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/50 rounded-lg">
                                    {[
                                        { id: 'Suresh', label: 'Suresh', emoji: '👤' },
                                        { id: 'Rosy',   label: 'Rosy',   emoji: '🌸' },
                                        { id: 'Claude', label: 'Claude', emoji: '🤖' },
                                    ].map(actor => (
                                        <button
                                            key={actor.id}
                                            type="button"
                                            onClick={() => setUpdatedBy(actor.id)}
                                            className={cn(
                                                "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all",
                                                updatedBy === actor.id
                                                    ? actor.id === 'Suresh'
                                                        ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600/30"
                                                        : actor.id === 'Rosy'
                                                        ? "bg-rose-600 text-white shadow-sm ring-1 ring-rose-600/30"
                                                        : "bg-amber-600 text-white shadow-sm ring-1 ring-amber-600/30"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                                            )}
                                        >
                                            <span className="text-xs">{actor.emoji}</span>
                                            <span>{actor.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Feature 1: Mine / Yours / Ours (Expense Scope) */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium">Expense Scope</label>
                                    <span className="text-[10px] text-muted-foreground">Personal vs Joint</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/50 rounded-lg">
                                    {[
                                        { id: 'ours',    label: 'Ours (Joint)',    emoji: '🏠' },
                                        { id: 'mine',    label: 'Mine (Personal)', emoji: '👤' },
                                        { id: 'partner', label: 'Partner',         emoji: '🌸' },
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setScope(item.id)}
                                            className={cn(
                                                "flex items-center justify-center gap-1.5 py-1.5 px-1.5 rounded-md text-xs font-semibold transition-all truncate",
                                                scope === item.id
                                                    ? item.id === 'ours'
                                                        ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600/30"
                                                        : item.id === 'mine'
                                                        ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600/30"
                                                        : "bg-rose-600 text-white shadow-sm ring-1 ring-rose-600/30"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                                            )}
                                        >
                                            <span className="text-xs">{item.emoji}</span>
                                            <span className="truncate">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(type === 'expense' || type === 'savings') && (
                                <div className="flex items-center gap-2 pt-1">
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

                            {isRecurring && (
                                <div className="p-3 bg-muted/50 rounded-lg space-y-3 border border-border animate-in slide-in-from-top-2">
                                    <div className="space-y-1.5">
                                        <label htmlFor="frequency" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Frequency</label>
                                        <select
                                            id="frequency"
                                            name="frequency"
                                            className="w-full text-xs bg-background border border-input rounded-md px-2 py-1 focus:ring-1 focus:ring-primary h-8"
                                            value={recurringFreq}
                                            onChange={(e) => setRecurringFreq(e.target.value)}
                                        >
                                            <option value="monthly">Monthly</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="custom">Custom (Every X Days)</option>
                                        </select>
                                    </div>

                                    {recurringFreq === 'weekly' && (
                                        <div className="space-y-1.5 animate-in fade-in leading-none">
                                            <label htmlFor="weeklyDay" className="text-[10px] font-medium text-muted-foreground">Day of Week</label>
                                            <select
                                                id="weeklyDay"
                                                name="weeklyDay"
                                                className="w-full text-xs bg-background border border-input rounded-md px-2 py-1 focus:ring-1 focus:ring-primary h-8"
                                                value={recurringDay}
                                                onChange={(e) => setRecurringDay(Number(e.target.value))}
                                            >
                                                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                                                    <option key={day} value={idx}>{day}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {recurringFreq === 'custom' && (
                                        <div className="space-y-1.5 animate-in fade-in leading-none">
                                            <label htmlFor="interval" className="text-[10px] font-medium text-muted-foreground">Interval (days)</label>
                                            <input
                                                id="interval"
                                                name="interval"
                                                type="number"
                                                min="1"
                                                value={recurringInterval}
                                                onChange={(e) => setRecurringInterval(e.target.value)}
                                                className="w-full text-xs bg-background border border-input rounded-md px-2 py-1 focus:ring-1 focus:ring-primary h-8"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-1.5 animate-in fade-in leading-none pt-2 border-t border-border/50">
                                        <label className="text-[10px] font-medium text-muted-foreground">
                                            Duration (Optional)
                                        </label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                id="duration"
                                                name="duration"
                                                type="number"
                                                min="1"
                                                placeholder="Forever"
                                                value={recurringTenure}
                                                onChange={(e) => setRecurringTenure(e.target.value)}
                                                className="w-16 text-xs bg-background border border-input rounded-md px-2 py-1 focus:ring-1 focus:ring-primary h-8"
                                            />
                                            <span className="text-[10px] text-muted-foreground">
                                                {recurringFreq === 'weekly' ? 'Wks' :
                                                    recurringFreq === 'custom' ? 'Times' : 'Mos'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Feature 6: Bill Assignment & Due Day */}
                                    <div className="pt-2 border-t border-border/50 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bill Assigned To</label>
                                            <div className="flex gap-1">
                                                {['Both', 'Suresh', 'Rosy'].map(name => (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        onClick={() => setAssignedTo(name)}
                                                        className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-semibold border transition-all",
                                                            assignedTo === name
                                                                ? "bg-primary text-primary-foreground border-primary"
                                                                : "border-border text-muted-foreground hover:bg-muted"
                                                        )}
                                                    >
                                                        {name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="dueDay" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due Day of Month</label>
                                            <input
                                                id="dueDay"
                                                name="dueDay"
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

                        </form>
                        </div>

                        {/* Sticky Footer - Cancel/Add always reachable, no scrolling needed */}
                        <div className="flex gap-2 px-3.5 sm:px-5 lg:px-6 py-3 border-t border-border/40 shrink-0 bg-card rounded-b-2xl sm:rounded-b-3xl">
                            {(editingTx || showAddForm) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        resetForm();
                                        setShowAddForm(false);
                                    }}
                                    className={cn(
                                        "flex-1 inline-flex items-center justify-center rounded-xl text-sm font-bold border border-input hover:bg-muted h-9 px-4 py-2 gap-2 shadow-sm cursor-pointer text-foreground",
                                        !editingTx && "lg:hidden"
                                    )}
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                form="tx-form"
                                className="flex-1 inline-flex items-center justify-center rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 gap-2 shadow-sm cursor-pointer whitespace-nowrap"
                            >
                                {editingTx ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                <span>
                                    {editingTx ? 'Update' : 'Add'}
                                    <span className="hidden lg:inline"> Transaction</span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col gap-3 bg-card p-3 sm:p-4 rounded-2xl border shadow-sm">
                        {/* Search & Actions Row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    id="search-transactions"
                                    name="searchTransactions"
                                    type="text"
                                    placeholder={viewMode === 'transactions' ? "Search transactions..." : "Search fixed expenses..."}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 shrink-0">
                                <button
                                    onClick={handleExportData}
                                    className="flex items-center gap-1.5 px-3 py-2 border rounded-xl hover:bg-muted text-xs font-medium transition-colors cursor-pointer shrink-0 shadow-sm"
                                    title="Export all transactions to CSV"
                                >
                                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>Export CSV</span>
                                </button>
                                {isSmsUnlocked && (
                                    <button
                                        onClick={handleSyncSms}
                                        disabled={refreshing}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 shadow-sm disabled:opacity-50"
                                        title="Auto-sync SMS receipts"
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                                        <span>Auto Sync</span>
                                    </button>
                                )}
                                {isSmsUnlocked && (
                                    <button
                                        onClick={() => setShowSMSScan(true)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 shadow-sm"
                                        title="Scan SMS Inbox for receipts"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        <span>Scan SMS</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* View Mode & Category Filter Pills */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-border/40 w-full min-w-0">
                            <div className="flex bg-muted/70 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                                <button
                                    onClick={() => setViewMode('transactions')}
                                    className={cn("px-3 py-1 rounded-lg text-xs font-semibold transition-all", viewMode === 'transactions' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                >
                                    History
                                </button>
                                <button
                                    onClick={() => setViewMode('recurring')}
                                    className={cn("px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1", viewMode === 'recurring' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Fixed / Recurring
                                </button>
                            </div>

                            {viewMode === 'transactions' && (
                                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                    {/* Scope Pills */}
                                    <div className="flex bg-muted/70 p-0.5 rounded-lg shrink-0">
                                        <button
                                            onClick={() => setScopeFilter('all')}
                                            className={cn("px-2 py-0.5 rounded text-[11px] font-semibold transition-all", scopeFilter === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setScopeFilter('ours')}
                                            className={cn("px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1", scopeFilter === 'ours' ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            <span>🏠</span>
                                            <span>Ours</span>
                                        </button>
                                        <button
                                            onClick={() => setScopeFilter('mine')}
                                            className={cn("px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1", scopeFilter === 'mine' ? "bg-indigo-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                        >
                                            <span>👤</span>
                                            <span>Mine</span>
                                        </button>
                                    </div>

                                    {/* Type Pills */}
                                    <div className="flex bg-muted/70 p-0.5 rounded-lg overflow-x-auto scrollbar-none">
                                        <button onClick={() => setFilterType('all')} className={cn("px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all whitespace-nowrap", filterType === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>All Types</button>
                                        {typeConfig.map(t => (
                                            <button key={t.id} onClick={() => setFilterType(t.id)} className={cn("px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all whitespace-nowrap", filterType === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                                                <span>{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                filteredTransactions.map(tx => {
                                    const typeInfo = typeConfig.find(t => t.id === tx.type) || typeConfig[1];
                                    const hasComments = Array.isArray(tx.comments) && tx.comments.length > 0;
                                    const isCommentOpen = activeCommentTxId === tx.id;

                                    return (
                                        <div key={tx.id} className="p-3 sm:p-4 hover:bg-muted/50 transition-all group divide-y divide-border/30">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 text-lg sm:text-xl shadow-sm", typeInfo.bg)}>
                                                        {(() => {
                                                            const cat = categories.find(c => c.id === tx.categoryId);
                                                            if (cat) return <CategoryIcon iconName={cat.icon || cat.emoji} size={18} color={cat.color} />;
                                                            return <typeInfo.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", typeInfo.color)} />;
                                                        })()}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold text-xs sm:text-sm truncate">{tx.description || getCategoryName(tx.categoryId)}</p>
                                                        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground flex-wrap mt-0.5">
                                                            <span>{format(new Date(tx.date), 'MMM dd, yyyy')}</span>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(tx.categoryId) }} />
                                                                {getCategoryName(tx.categoryId)}
                                                            </span>
                                                            {tx.paymentMode && (
                                                                <span className={cn(
                                                                    "px-1.5 py-0.2 rounded-full text-[8.5px] font-bold uppercase tracking-wider",
                                                                    tx.paymentMode === 'upi'        && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                                                                    tx.paymentMode === 'cash'       && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                                                    tx.paymentMode === 'card'       && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                                                    tx.paymentMode === 'netbanking' && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                                                                )}>
                                                                    {tx.paymentMode === 'netbanking' ? 'Net Banking' : tx.paymentMode.toUpperCase()}
                                                                </span>
                                                            )}
                                                            {/* Updated By Badge */}
                                                            {(() => {
                                                                const actor = tx.updatedBy || tx.createdBy || (tx.source === 'mcp' ? 'Claude' : null);
                                                                if (!actor) return null;
                                                                const isSuresh = actor.toLowerCase().includes('sur');
                                                                const isRosy = actor.toLowerCase().includes('ros');
                                                                const isClaude = actor.toLowerCase().includes('claude') || tx.source === 'mcp';
                                                                const label = isClaude ? 'Claude' : isRosy ? 'Rosy' : isSuresh ? 'Suresh' : actor;

                                                                return (
                                                                    <span
                                                                        title={`Updated by ${label}`}
                                                                        className={cn(
                                                                            "inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8.5px] font-semibold border shadow-2xs",
                                                                            isSuresh && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                                                                            isRosy   && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
                                                                            isClaude && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                                                                            !isSuresh && !isRosy && !isClaude && "bg-primary/10 text-primary border-primary/20"
                                                                        )}
                                                                    >
                                                                        <span className="text-[9px]">{isClaude ? '🤖' : isRosy ? '🌸' : '👤'}</span>
                                                                        <span>Updated by {label}</span>
                                                                    </span>
                                                                );
                                                            })()}
                                                            {/* Feature 1: Scope Badge */}
                                                            {tx.scope && (
                                                                <span className={cn(
                                                                    "inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8.5px] font-semibold border",
                                                                    tx.scope === 'ours'
                                                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                                        : tx.scope === 'partner'
                                                                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                                                        : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                                                                )}>
                                                                    <span>{tx.scope === 'ours' ? '🏠' : tx.scope === 'partner' ? '🌸' : '👤'}</span>
                                                                    <span>{tx.scope === 'ours' ? 'Ours' : tx.scope === 'partner' ? 'Partner' : 'Mine'}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                                                    <span className={cn("font-bold text-xs sm:text-sm", typeInfo.color)}>
                                                        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{formatMoney(tx.amount)}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {/* Feature 3: Comment Button */}
                                                        <button
                                                            onClick={() => setActiveCommentTxId(isCommentOpen ? null : tx.id)}
                                                            className={cn(
                                                                "p-1.5 rounded-lg transition-colors relative",
                                                                hasComments
                                                                    ? "text-primary hover:bg-primary/10 bg-primary/10"
                                                                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
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
                                                        <button onClick={() => handleEditClick(tx)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit Transaction">
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => deleteTransaction(tx.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete Transaction">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
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
                                                            className="p-1 rounded-full text-muted-foreground hover:bg-muted text-xs"
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
                                                                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1 shadow-sm hover:opacity-90 transition-all shrink-0"
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
                                                                    className="hover:scale-125 transition-transform p-0.5 text-sm"
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
                            {viewMode === 'transactions' && filteredTransactions.length === 0 && (
                                <div className="p-12 text-center text-muted-foreground">
                                    <Filter className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p>No transactions found.</p>
                                </div>
                            )}
                        </div>
                    </div>
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

            <SMSScanModal 
                isOpen={showSMSScan} 
                onClose={() => setShowSMSScan(false)} 
                onImport={(txs) => addTransactions(txs)} 
                categories={categories} 
            />

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
