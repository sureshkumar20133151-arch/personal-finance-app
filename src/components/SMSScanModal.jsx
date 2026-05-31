import React, { useState, useEffect } from 'react';
import { X, Check, ShieldAlert, Sparkles, MessageSquare, AlertCircle, Calendar, CreditCard, ChevronRight } from 'lucide-react';
import { parseTransactionSMS } from '../lib/SMSParser';
import { cn } from '../lib/utils';
import CategoryIcon from './CategoryIcon';

// SMS Inbox reader import from Capacitor
import { MessageReader } from '@solimanware/capacitor-sms-reader';

const SMSScanModal = ({ isOpen, onClose, onImport, categories }) => {
    const [scanning, setScanning] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [selectedIndices, setSelectedIndices] = useState([]);
    const [permissionError, setPermissionError] = useState(false);

    useEffect(() => {
        if (isOpen) {
            scanSMSInbox();
        } else {
            // Reset state on close
            setTransactions([]);
            setSelectedIndices([]);
            setPermissionError(false);
        }
    }, [isOpen]);

    const scanSMSInbox = async () => {
        setScanning(true);
        setPermissionError(false);

        // Detect if mobile Capacitor environment
        const isMobile = window.Capacitor && window.Capacitor.isNativePlatform();

        try {
            if (isMobile) {
                // Check SMS permissions
                const status = await MessageReader.checkPermissions();
                if (status.sms !== 'granted') {
                    const req = await MessageReader.requestPermissions();
                    if (req.sms !== 'granted') {
                        setPermissionError(true);
                        setScanning(false);
                        return;
                    }
                }

                // Query inbox (last 5 days to keep it fast)
                const minDate = Date.now() - 5 * 24 * 60 * 60 * 1000;
                const result = await MessageReader.getSMSList({
                    minDate: minDate,
                    max: 80 // fetch last 80 messages
                });

                const smsList = result.messages || [];
                const parsed = smsList
                    .map(m => parseTransactionSMS(m.body, parseInt(m.date)))
                    .filter(t => t !== null);

                // Sort newest first
                parsed.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Auto-categorize
                const mapped = parsed.map(t => ({
                    ...t,
                    categoryId: guessCategory(t.description, t.type)
                }));

                setTransactions(mapped);
                // Pre-select all found transactions
                setSelectedIndices(mapped.map((_, i) => i));
            } else {
                // Browser sandbox: Simulate parsing HDFC/SBI/UPI SMS alerts for testing
                await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate loading delay
                
                const mockSMS = [
                    { body: "Dear Customer, your A/c ending 5678 has been debited by Rs 250.00 at Zomato on 31-May-26 via UPI. Ref 12345", date: Date.now() - 3600000 },
                    { body: "INR 25,000.00 credited to your SBI A/c ending 1234 on 30-May-26 towards Salary. Ref SBI7890", date: Date.now() - 24 * 3600000 },
                    { body: "You sent Rs. 99.00 to Chai Tapri using GPay UPI. Txn Ref 78901 on 31-May-26", date: Date.now() - 2 * 3600000 },
                    { body: "Paid Rs. 450.00 to Bharat Petroleum Petrol Pump on PhonePe.", date: Date.now() - 4 * 3600000 },
                    { body: "Dear Customer, your Credit Card ending 9876 debited by Rs 1,899.00 at Netflix India. Limit available Rs 85,000.00", date: Date.now() - 5 * 3600000 }
                ];

                const parsed = mockSMS
                    .map(m => parseTransactionSMS(m.body, m.date))
                    .filter(t => t !== null);

                // Auto-categorize
                const mapped = parsed.map(t => ({
                    ...t,
                    categoryId: guessCategory(t.description, t.type)
                }));

                setTransactions(mapped);
                setSelectedIndices(mapped.map((_, i) => i));
            }
        } catch (error) {
            console.error("SMS Scanning failed:", error);
            alert("Error scanning messages. Please check permissions.");
        }
        setScanning(false);
    };

    // Keyword matching helper to auto-select matching categories
    const guessCategory = (description, type) => {
        const descLower = description.toLowerCase();
        
        // Find categories
        const incomeCats = categories.filter(c => c.type === 'income');
        const expenseCats = categories.filter(c => c.type === 'expense');
        const defaultExpense = expenseCats[0]?.id || '';
        const defaultIncome = incomeCats[0]?.id || '';

        if (type === 'income') {
            if (descLower.includes('salary') || descLower.includes('salary credited')) {
                const match = incomeCats.find(c => c.name.toLowerCase().includes('salary'));
                return match ? match.id : defaultIncome;
            }
            const freelanceMatch = incomeCats.find(c => c.name.toLowerCase().includes('freelance') || c.name.toLowerCase().includes('business'));
            return freelanceMatch ? freelanceMatch.id : defaultIncome;
        } else {
            if (descLower.includes('zomato') || descLower.includes('swiggy') || descLower.includes('food') || descLower.includes('restaurant') || descLower.includes('chai') || descLower.includes('cafe')) {
                const match = expenseCats.find(c => c.name.toLowerCase().includes('food') || c.name.toLowerCase().includes('dining') || c.name.toLowerCase().includes('coffee'));
                return match ? match.id : defaultExpense;
            }
            if (descLower.includes('petrol') || descLower.includes('fuel') || descLower.includes('uber') || descLower.includes('ola') || descLower.includes('travel') || descLower.includes('auto') || descLower.includes('cab')) {
                const match = expenseCats.find(c => c.name.toLowerCase().includes('transport') || c.name.toLowerCase().includes('travel') || c.name.toLowerCase().includes('fuel'));
                return match ? match.id : defaultExpense;
            }
            if (descLower.includes('netflix') || descLower.includes('spotify') || descLower.includes('prime') || descLower.includes('movie') || descLower.includes('cinema')) {
                const match = expenseCats.find(c => c.name.toLowerCase().includes('entertainment') || c.name.toLowerCase().includes('sub'));
                return match ? match.id : defaultExpense;
            }
            if (descLower.includes('electricity') || descLower.includes('recharge') || descLower.includes('water') || descLower.includes('utilities') || descLower.includes('broadband') || descLower.includes('wifi')) {
                const match = expenseCats.find(c => c.name.toLowerCase().includes('utilities') || c.name.toLowerCase().includes('bill'));
                return match ? match.id : defaultExpense;
            }
            return defaultExpense; // fallback
        }
    };

    const handleToggleSelect = (index) => {
        setSelectedIndices(prev => 
            prev.includes(index) 
                ? prev.filter(i => i !== index) 
                : [...prev, index]
        );
    };

    const handleCategoryChange = (index, catId) => {
        setTransactions(prev => 
            prev.map((item, i) => i === index ? { ...item, categoryId: catId } : item)
        );
    };

    const handleImport = () => {
        const selectedTxs = transactions.filter((_, i) => selectedIndices.includes(i));
        // Remove rawSms before saving to db
        const cleanedTxs = selectedTxs.map(({ rawSms, ...rest }) => rest);
        onImport(cleanedTxs);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-card border rounded-2xl shadow-xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        <h2 className="font-bold text-lg">Scan SMS Transactions</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {scanning ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                            <Sparkles className="w-10 h-10 text-primary animate-bounce" />
                            <div className="space-y-1.5">
                                <p className="font-semibold text-sm">Scanning Inbox alerts...</p>
                                <p className="text-xs text-muted-foreground">Reading latest payment alerts from UPI and bank notifications.</p>
                            </div>
                        </div>
                    ) : permissionError ? (
                        <div className="p-6 text-center space-y-4 border border-destructive/20 bg-destructive/5 rounded-xl">
                            <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
                            <div className="space-y-1.5">
                                <h3 className="font-bold text-sm text-destructive">SMS Permission Blocked</h3>
                                <p className="text-xs text-muted-foreground">
                                    The app needs SMS permission to automatically scan UPI transaction alerts. Please allow permission in your phone Settings.
                                </p>
                            </div>
                            <button onClick={scanSMSInbox} className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 transition-colors shadow">
                                Try Again
                            </button>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground space-y-3">
                            <AlertCircle className="w-12 h-12 mx-auto opacity-20" />
                            <p className="text-sm font-medium">No new transactions found in SMS alerts.</p>
                            <p className="text-xs max-w-xs mx-auto">Make sure you have recent SMS notifications from your bank or UPI apps like GPay/PhonePe.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs text-muted-foreground pb-2 border-b">
                                <span>Checked ({selectedIndices.length} of {transactions.length})</span>
                                <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" /> Auto-categorized</span>
                            </div>

                            <div className="space-y-2">
                                {transactions.map((tx, idx) => {
                                    const isSelected = selectedIndices.includes(idx);
                                    const selectedCat = categories.find(c => c.id === tx.categoryId);
                                    
                                    return (
                                        <div 
                                            key={idx} 
                                            className={cn(
                                                "p-3 rounded-xl border flex items-center justify-between gap-3 transition-all",
                                                isSelected ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10" : "border-border bg-card"
                                            )}
                                        >
                                            {/* Select Checkbox & Icon */}
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => handleToggleSelect(idx)}
                                                    className={cn(
                                                        "w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0",
                                                        isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background"
                                                    )}
                                                >
                                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                </button>
                                                
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-xs leading-none">{tx.description}</span>
                                                        <span className={cn(
                                                            "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase leading-none",
                                                            tx.type === 'expense' ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                                        )}>
                                                            {tx.type === 'expense' ? 'Debit' : 'Credit'}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Category Selector inside scanned row */}
                                                    <div className="flex items-center gap-1.5">
                                                        <select
                                                            value={tx.categoryId}
                                                            onChange={(e) => handleCategoryChange(idx, e.target.value)}
                                                            className="text-[10px] font-medium bg-transparent border-none p-0 focus:ring-0 text-muted-foreground hover:text-foreground cursor-pointer outline-none"
                                                        >
                                                            {categories.filter(c => c.type === tx.type).map(c => (
                                                                <option key={c.id} value={c.id} className="bg-card text-foreground">{c.name}</option>
                                                            ))}
                                                        </select>
                                                        <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
                                                        <span className="text-[10px] text-muted-foreground capitalize flex items-center gap-0.5">
                                                            via {tx.paymentMode}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Date and Amount */}
                                            <div className="text-right shrink-0">
                                                <div className={cn("text-sm font-bold", tx.type === 'expense' ? "text-red-500" : "text-green-500")}>
                                                    {tx.type === 'expense' ? '-' : '+'}{tx.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                                                </div>
                                                <div className="text-[9px] text-muted-foreground flex items-center justify-end gap-1">
                                                    <Calendar className="w-2.5 h-2.5" />
                                                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex justify-between gap-3 bg-muted/30">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {!(window.Capacitor && window.Capacitor.isNativePlatform()) && (
                            <span className="bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 px-2 py-0.5 rounded font-medium text-[10px]">
                                Demo Mode (Web Browser)
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 border rounded-xl hover:bg-muted text-xs font-semibold transition-colors">
                            Cancel
                        </button>
                        <button 
                            onClick={handleImport}
                            disabled={selectedIndices.length === 0 || scanning}
                            className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition-all disabled:opacity-50 disabled:pointer-events-none shadow"
                        >
                            Import Selected ({selectedIndices.length})
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SMSScanModal;
