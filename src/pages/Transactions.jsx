
import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useFinanceData } from '../hooks/useFinanceData';
import { Plus, Search, Filter, Trash2, Edit2, X, TrendingUp, TrendingDown, PiggyBank, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { parseStatement } from '../lib/StatementParser';
import { Upload, FileText, Check, AlertCircle } from 'lucide-react';
import CategoryIcon from '../components/CategoryIcon';

const Transactions = () => {
    const {
        transactions,
        categories,
        addTransaction,
        addTransactions,
        importData,
        deleteTransaction,
        updateTransaction,
        addRecurringTransaction,
        deleteRecurringTransaction,

        recurring,
        loans,
        formatMoney
    } = useFinanceData();

    // Form State
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('expense');
    const [categoryId, setCategoryId] = useState('');

    const [loanId, setLoanId] = useState(''); // New State for linking repayment
    const [isRecurring, setIsRecurring] = useState(false);

    // Editing State
    const [editingTx, setEditingTx] = useState(null);

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
    };

    // Derived Logic
    const typeConfig = [
        { id: 'income', label: 'Income', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
        { id: 'expense', label: 'Expense', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
        { id: 'savings', label: 'Savings', icon: PiggyBank, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        { id: 'debt', label: 'Debt Repayment', icon: CreditCard, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    ];

    const availableCategories = useMemo(() => {
        return categories.filter(c => c.type === type);
    }, [categories, type]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesType = filterType === 'all' || t.type === filterType;
            const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (categories.find(c => c.id === t.categoryId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
            return matchesType && matchesSearch;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, filterType, searchQuery, categories]);

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
            loanId: type === 'debt' ? loanId : undefined,
            repaymentType: type === 'debt' ? repaymentType : undefined,
            paymentMode: paymentMode,
        };

        if (editingTx) {
            updateTransaction(editingTx.id, txData);
        } else {
            addTransaction(txData);
            if (isRecurring) {
                // Ensure the function exists before calling
                if (addRecurringTransaction) {
                    addRecurringTransaction({
                        amount: parseFloat(amount),
                        description,
                        type,
                        categoryId,
                        frequency: recurringFreq,
                        interval: recurringFreq === 'custom' ? parseInt(recurringInterval) : 1,
                        weeklyDay: recurringFreq === 'weekly' ? recurringDay : undefined,
                        tenure: recurringTenure ? parseInt(recurringTenure) : null, // New Field
                        processedCount: 0,
                        lastProcessedDate: new Date().toISOString() // Mark as processed today so it doesn't dupe immediately
                    });
                }
            }
        }

        resetForm();
    };

    const handleEditClick = (tx) => {
        setEditingTx(tx);
        setAmount(tx.amount.toString());
        setDescription(tx.description);
        setDate(tx.date.split('T')[0]);
        setType(tx.type);
        setCategoryId(tx.categoryId);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsParsing(true);
        setUploadError('');

        try {
            const results = await parseStatement(file);
            if (results.length === 0) {
                setUploadError('No transactions found in file.');
            } else {
                setParsedTransactions(results);
                setShowUploadPreview(true);
            }
        } catch (err) {
            console.error(err);
            setUploadError(err.message || 'Failed to parse file.');
        } finally {
            setIsParsing(false);
            e.target.value = null; // Reset input
        }
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
    const processFile = async (file) => {
        if (!file) return;

        setIsParsing(true);
        setUploadError('');

        try {
            const results = await parseStatement(file);
            if (results.length === 0) {
                setUploadError('No transactions found in file.');
            } else {
                setParsedTransactions(results);
                setShowUploadPreview(true);
            }
        } catch (err) {
            console.error(err);
            setUploadError(err.message || 'Failed to parse file.');
        } finally {
            setIsParsing(false);
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Transactions</h1>
                <p className="text-muted-foreground">Record and manage your financial activities.</p>
            </header>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Form Section */}
                <div className="lg:col-span-1">
                    <div className={cn("rounded-2xl border bg-card shadow-sm p-6 sticky top-8 transition-all", editingTx ? "border-primary ring-1 ring-primary" : "border-border")}>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                {editingTx ? <Edit2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                                {editingTx ? 'Edit Transaction' : 'Add Transaction'}
                            </h2>
                            <div className="flex gap-2">
                                {editingTx && (
                                    <button onClick={resetForm} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded-md transition-colors">
                                        <X className="w-3 h-3" /> Cancel
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Drag & Drop Zone - Compact Version */}
                        {!editingTx && (
                            <div
                                className={cn(
                                    "mb-3 border border-dashed rounded-lg p-3 text-center transition-all cursor-pointer",
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

                        {uploadError && (
                            <div className="mb-3 p-2 bg-destructive/10 text-destructive text-xs rounded-md flex items-start gap-2">
                                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                <p>{uploadError}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="space-y-1.5" role="radiogroup" aria-labelledby="type-label">
                                <span id="type-label" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Type</span>
                                <div className="grid grid-cols-4 gap-1 p-1 bg-muted/50 rounded-lg">
                                    {typeConfig.map(t => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => { setType(t.id); setCategoryId(''); setIsRecurring(false); }}
                                            className={cn(
                                                "flex items-center justify-center gap-1 py-1.5 px-1 rounded-md text-xs font-medium transition-all",
                                                type === t.id
                                                    ? "bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                            )}
                                            title={t.label}
                                        >
                                            <t.icon className={cn("w-3 h-3", type === t.id ? t.color : "")} />
                                            <span className="hidden xl:inline">{t.label}</span>
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
                                                        const selectedLoan = loans.find(l => l.id === selectedId);
                                                        if (selectedLoan) {
                                                            setAmount(selectedLoan.monthlyAmount.toString());
                                                            setDescription(`EMI for ${selectedLoan.name}`);
                                                        }
                                                    }}
                                                    className="w-full h-9 bg-background border border-input rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                                >
                                                    <option value="">Select Loan</option>
                                                    {loans.filter(l => l.type === 'emi').map(l => (
                                                        <option key={l.id} value={l.id}>{l.name}</option>
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
                                            <span className="hidden sm:inline leading-tight text-center">{mode.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {!editingTx && (type === 'expense' || type === 'savings') && (
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox"
                                        id="recurring"
                                        checked={isRecurring}
                                        onChange={(e) => setIsRecurring(e.target.checked)}
                                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="recurring" className="text-xs font-medium leading-none cursor-pointer">
                                        Recurring {type === 'savings' ? 'Saving' : 'Expense'}
                                    </label>
                                </div>
                            )}

                            {isRecurring && !editingTx && (
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
                                            <option value="custom">Custom</option>
                                        </select>
                                    </div>

                                    {recurringFreq === 'weekly' && (
                                        <div className="space-y-1.5 animate-in fade-in leading-none">
                                            <label className="text-[10px] font-medium text-muted-foreground">Day of Week</label>
                                            <div className="flex justify-between gap-0.5">
                                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        onClick={() => setRecurringDay(index)}
                                                        className={cn(
                                                            "w-6 h-6 rounded-full text-[10px] font-bold transition-all",
                                                            recurringDay === index
                                                                ? "bg-primary text-primary-foreground shadow-sm"
                                                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                        )}
                                                    >
                                                        {day}
                                                    </button>
                                                ))}
                                            </div>
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
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full inline-flex items-center justify-center rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 mt-4 gap-2 shadow-sm"
                            >
                                {editingTx ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                {editingTx ? 'Update' : 'Add Transaction'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border shadow-sm">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
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
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
                            <div className="flex bg-muted p-1 rounded-lg shrink-0">
                                <button
                                    onClick={() => setViewMode('transactions')}
                                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === 'transactions' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                >
                                    History
                                </button>
                                <button
                                    onClick={() => setViewMode('recurring')}
                                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1", viewMode === 'recurring' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Fixed / Recurring
                                </button>
                            </div>

                            {viewMode === 'transactions' && (
                                <div className="flex bg-muted p-1 rounded-lg shrink-0">
                                    <button onClick={() => setFilterType('all')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap", filterType === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>All</button>
                                    {typeConfig.map(t => (
                                        <button key={t.id} onClick={() => setFilterType(t.id)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap", filterType === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                                            <span className="hidden sm:inline">{t.label}</span>
                                            <span className="sm:hidden">{t.label[0]}</span>
                                        </button>
                                    ))}
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
                                        <p>No recurring transactions set up yet.</p>
                                        <p className="text-xs mt-2">Add a transaction and check "Recurring".</p>
                                    </div>
                                ) : (
                                    recurring.map(rule => {
                                        const typeInfo = typeConfig.find(t => t.id === rule.type) || typeConfig[1];
                                        return (
                                            <div key={rule.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl border-2 shadow-sm", typeInfo.bg, "border-primary/20")}>
                                                        {(() => {
                                                            const cat = categories.find(c => c.id === rule.categoryId);
                                                            if (cat) return <CategoryIcon iconName={cat.icon || cat.emoji} size={20} color={cat.color} />;
                                                            return <typeInfo.icon className={cn("w-5 h-5", typeInfo.color)} />;
                                                        })()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm">{rule.description || getCategoryName(rule.categoryId)}</p>
                                                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">Fixed</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                                                            {rule.tenure && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>Duration: {rule.tenure} {rule.frequency === 'weekly' ? 'Weeks' : 'Months'}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between sm:justify-end gap-6">
                                                    <span className={cn("font-bold", typeInfo.color)}>
                                                        {formatMoney(rule.amount)} / mo
                                                    </span>
                                                    <button onClick={() => deleteRecurringTransaction(rule.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Remove Fixed Rule">
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
                                    return (

                                        <div key={tx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/50 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-xl shadow-sm", typeInfo.bg)}>
                                                        {(() => {
                                                            const cat = categories.find(c => c.id === tx.categoryId);
                                                            if (cat) return <CategoryIcon iconName={cat.icon || cat.emoji} size={20} color={cat.color} />;
                                                            return <typeInfo.icon className={cn("w-5 h-5", typeInfo.color)} />;
                                                        })()}
                                                    </div>
                                                <div>
                                                    <p className="font-medium text-sm">{tx.description || getCategoryName(tx.categoryId)}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                                        <span>{format(new Date(tx.date), 'MMM dd, yyyy')}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(tx.categoryId) }} />
                                                            {getCategoryName(tx.categoryId)}
                                                        </span>
                                                        {tx.paymentMode && (
                                                            <span className={cn(
                                                                "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                                                tx.paymentMode === 'upi'        && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                                                                tx.paymentMode === 'cash'       && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                                                tx.paymentMode === 'card'       && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                                                tx.paymentMode === 'netbanking' && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                                                            )}>
                                                                {tx.paymentMode === 'netbanking' ? 'Net Banking' : tx.paymentMode.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-6">
                                                <span className={cn("font-bold", typeInfo.color)}>
                                                    {tx.type === 'income' || tx.type === 'debt' ? '+' : '-'}{formatMoney(tx.amount)}
                                                </span>
                                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditClick(tx)} className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => deleteTransaction(tx.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Delete">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
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
        </div >
    );
};

export default Transactions;
