import React, { useState } from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { Plus, Trash2, Calendar, CreditCard, Building2, Car } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, addMonths, differenceInMonths } from 'date-fns';

const Loans = () => {
    const { loans, addLoan, deleteLoan, formatMoney, getLoanDetails } = useFinanceData();
    const [isAdding, setIsAdding] = useState(false);

    // Form State
    const [loanType, setLoanType] = useState('emi'); // 'emi' or 'debt'
    const [newLoan, setNewLoan] = useState({
        name: '',
        monthlyAmount: '',
        tenure: '', // in months (for EMI)
        principal: '', // for Debt
        interestRate: '', // % per month (for Debt)
        startDate: format(new Date(), 'yyyy-MM-dd')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newLoan.name) return;

        addLoan({
            type: loanType,
            name: newLoan.name,
            startDate: newLoan.startDate,
            // EMI specific
            monthlyAmount: loanType === 'emi' ? parseFloat(newLoan.monthlyAmount) : 0,
            tenure: loanType === 'emi' ? parseInt(newLoan.tenure) : 0,
            // Debt specific
            principal: loanType === 'debt' ? parseFloat(newLoan.principal) : 0,
            interestRate: loanType === 'debt' ? parseFloat(newLoan.interestRate) : 0,
        });

        setIsAdding(false);
        setNewLoan({
            name: '',
            monthlyAmount: '',
            tenure: '',
            principal: '',
            interestRate: '',
            startDate: format(new Date(), 'yyyy-MM-dd')
        });
    };

    const calculateProgress = (loan) => {
        // Use generic helper if implementing debt view
        if (loan.type === 'debt') {
            const stats = getLoanDetails(loan);
            return { monthsPassed: 0, progress: stats.progress };
        }

        const start = new Date(loan.startDate);
        const today = new Date();
        const monthsPassed = differenceInMonths(today, start);
        const progress = Math.min(Math.max((monthsPassed / loan.tenure) * 100, 0), 100);
        return { monthsPassed, progress };
    };

    const getEndDate = (loan) => {
        if (loan.type === 'debt') return null; // Indefinite until paid
        return addMonths(new Date(loan.startDate), loan.tenure);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Loans & Debts</h1>
                    <p className="text-muted-foreground">Track your loans, EMIs, and debt payoffs</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="w-4 h-4" />
                    Add Account
                </button>
            </header>

            {/* Add Loan Form */}
            {isAdding && (
                <div className="bg-card border border-border p-6 rounded-2xl shadow-sm animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">Add New Account</h2>
                        <div className="flex bg-muted p-1 rounded-lg">
                            <button onClick={() => setLoanType('emi')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", loanType === 'emi' ? "bg-background shadow-sm" : "text-muted-foreground")}>Bank EMI</button>
                            <button onClick={() => setLoanType('debt')} className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", loanType === 'debt' ? "bg-background shadow-sm" : "text-muted-foreground")}>Personal Debt</button>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-end">
                        <div className="space-y-2">
                            <label htmlFor="loan-name" className="text-sm font-medium">Name</label>
                            <input
                                id="loan-name"
                                name="loanName"
                                type="text"
                                placeholder={loanType === 'emi' ? "e.g., Car Loan" : "e.g., Loan from Friend"}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={newLoan.name}
                                onChange={e => setNewLoan({ ...newLoan, name: e.target.value })}
                            />
                        </div>

                        {loanType === 'emi' ? (
                            <>
                                <div className="space-y-2">
                                    <label htmlFor="monthly-emi" className="text-sm font-medium">Monthly EMI</label>
                                    <input
                                        id="monthly-emi"
                                        name="monthlyEmi"
                                        type="number"
                                        placeholder="0.00"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={newLoan.monthlyAmount}
                                        onChange={e => setNewLoan({ ...newLoan, monthlyAmount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="tenure" className="text-sm font-medium">Tenure (Months)</label>
                                    <input
                                        id="tenure"
                                        name="tenure"
                                        type="number"
                                        placeholder="e.g. 60"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={newLoan.tenure}
                                        onChange={e => setNewLoan({ ...newLoan, tenure: e.target.value })}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label htmlFor="principal" className="text-sm font-medium">Principal Amount</label>
                                    <input
                                        id="principal"
                                        name="principal"
                                        type="number"
                                        placeholder="Total Borrowed"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={newLoan.principal}
                                        onChange={e => setNewLoan({ ...newLoan, principal: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="interest-rate" className="text-sm font-medium">Interest Rate (%/mo)</label>
                                    <input
                                        id="interest-rate"
                                        name="interestRate"
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 2 for 2%"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={newLoan.interestRate}
                                        onChange={e => setNewLoan({ ...newLoan, interestRate: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="start-date" className="text-sm font-medium">Start Date</label>
                            <input
                                id="start-date"
                                name="startDate"
                                type="date"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={newLoan.startDate}
                                onChange={e => setNewLoan({ ...newLoan, startDate: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-2 mt-2">
                            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                                Cancel
                            </button>
                            <button type="submit" className="bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
                                Save Account
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Active Loans List */}
            <div className="grid gap-6 md:grid-cols-2">
                {loans.map(loan => {
                    const isDebt = loan.type === 'debt';
                    const { progress } = calculateProgress(loan);
                    const endDate = getEndDate(loan);
                    const stats = getLoanDetails(loan); // Get stats (Remaining, Interest, etc)

                    return (
                        <div key={loan.id} className="group relative bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => deleteLoan(loan.id)}
                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", isDebt ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600")}>
                                        {isDebt ? <CreditCard className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{loan.name}</h3>
                                        <p className="text-sm text-muted-foreground">{isDebt ? 'Personal Debt' : 'Bank EMI'} • Started {format(new Date(loan.startDate), 'MMM yyyy')}</p>
                                    </div>
                                </div>
                            </div>

                            {isDebt ? (
                                // DEBT VIEW
                                <div className="mb-6 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Original Principal</span>
                                        <span className="font-medium">{formatMoney(loan.principal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Paid So Far</span>
                                        <span className="font-medium text-green-600">{formatMoney(stats.paid)}</span>
                                    </div>
                                    <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/10">
                                        <div className="flex justify-between text-base font-bold text-red-700 dark:text-red-400">
                                            <span>Remaining</span>
                                            <span>{formatMoney(stats.remaining)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-red-500/80 mt-1">
                                            <span>Est. Interest This Month ({loan.interestRate}%)</span>
                                            <span>{formatMoney(stats.monthlyInterest)}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // EMI VIEW
                                <div className="mb-6 space-y-1">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-muted-foreground">Monthly EMI</span>
                                        <span className="font-bold text-lg">{formatMoney(loan.monthlyAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Total Value</span>
                                        <span>{formatMoney(loan.monthlyAmount * loan.tenure)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-medium">
                                    <span>Progress</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full transition-all duration-1000 ease-out", isDebt ? "bg-red-500" : "bg-primary")}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    {isDebt ? (
                                        <span>{loan.interestRate}% Interest/Month</span>
                                    ) : (
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Ends {endDate ? format(endDate, 'MMM yyyy') : 'N/A'}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {loans.length === 0 && !isAdding && (
                    <div className="md:col-span-2 py-16 text-center border-2 border-dashed border-muted rounded-2xl">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                            <CreditCard className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-semibold">No active loans</h3>
                        <p className="text-muted-foreground mb-4">Add your car, home, or personal loans to track them here.</p>
                        <button onClick={() => setIsAdding(true)} className="text-primary font-medium hover:underline">
                            Add your first loan
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Loans;
