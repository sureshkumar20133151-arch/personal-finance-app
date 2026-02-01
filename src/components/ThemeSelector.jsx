
import React from 'react';
import { useFinanceData } from '../hooks/useFinanceData';
import { Palette, Moon, Sun, Monitor, Check } from 'lucide-react';
import { cn } from '../lib/utils';

const ThemeSelector = () => {
    const { theme, updateTheme } = useFinanceData();

    const themes = [
        { id: 'light', icon: Sun, label: 'Light' },
        { id: 'dark', icon: Moon, label: 'Dark' },
        { id: 'system', icon: Monitor, label: 'System' },
    ];

    const colors = [
        { id: 'blue', label: 'Blue', color: '#3b82f6' },
        { id: 'green', label: 'Green', color: '#16a34a' },
        { id: 'purple', label: 'Purple', color: '#9333ea' },
        { id: 'orange', label: 'Orange', color: '#ea580c' },
    ];

    return (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    Appearance
                </h2>
            </div>

            <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Mode</label>
                <div className="grid grid-cols-3 gap-2 bg-muted p-1 rounded-xl">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => updateTheme({ mode: t.id })}
                            className={cn(
                                "flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                                theme.mode === t.id
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-sm font-medium text-muted-foreground">Accent Color</label>
                <div className="flex flex-wrap gap-3">
                    {colors.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => updateTheme({ accent: c.id })}
                            className={cn(
                                "group relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                                theme.accent === c.id ? "border-foreground" : "border-transparent hover:scale-110"
                            )}
                            style={{ backgroundColor: c.color }}
                            title={c.label}
                        >
                            {theme.accent === c.id && <Check className="w-5 h-5 text-white drop-shadow-md" />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ThemeSelector;
