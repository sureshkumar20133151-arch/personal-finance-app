
import React from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { Globe, Check } from 'lucide-react';


const CURRENCIES = [
    { code: 'USD', symbol: '$', locale: 'en-US', name: 'United States Dollar' },
    { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro' },
    { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'British Pound' },
    { code: 'INR', symbol: '₹', locale: 'en-IN', name: 'Indian Rupee' },
    { code: 'JPY', symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
    { code: 'CAD', symbol: '$', locale: 'en-CA', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: '$', locale: 'en-AU', name: 'Australian Dollar' },
    { code: 'CNY', symbol: '¥', locale: 'zh-CN', name: 'Chinese Yuan' },
];

const CurrencySelector = () => {
    const { currency, updateCurrency } = useFinanceData();

    const handleChange = (e) => {
        const selectedCode = e.target.value;
        const selectedCurrency = CURRENCIES.find(c => c.code === selectedCode);
        if (selectedCurrency) {
            updateCurrency(selectedCurrency);
        }
    };

    return (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    Currency
                </h2>
                <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                    {currency.code} ({currency.symbol})
                </span>
            </div>

            <div className="relative">
                <select
                    value={currency.code}
                    onChange={handleChange}
                    className="w-full appearance-none bg-background text-foreground border border-input rounded-xl px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                >
                    {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>
                            {c.name} ({c.code} - {c.symbol})
                        </option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default CurrencySelector;
