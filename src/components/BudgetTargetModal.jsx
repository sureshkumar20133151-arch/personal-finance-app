import React, { useState } from 'react';
import { X, Target, Save, DollarSign } from 'lucide-react';
import { cn } from '../lib/utils';
import { useFinanceData } from '../hooks/useFinanceData';

const BudgetTargetModal = ({ isOpen, onClose }) => {
    const { monthlyBudget, updateBudget, formatMoney, currency } = useFinanceData();
    const [amount, setAmount] = useState(monthlyBudget);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        updateBudget(amount);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Set Monthly Target
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            Global Monthly Limit
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                                {currency?.symbol}
                            </span>
                            <input
                                type="number"
                                autoFocus
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                className="w-full bg-muted/30 border border-input rounded-xl pl-10 pr-4 py-3 text-2xl font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                placeholder="0"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            This is your overall spending limit for the month.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setAmount(monthlyBudget)}
                            className="py-2.5 rounded-xl border border-input hover:bg-muted font-medium text-sm transition-colors"
                        >
                            Reset
                        </button>
                        <button
                            type="submit"
                            className="py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Save Target
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BudgetTargetModal;
