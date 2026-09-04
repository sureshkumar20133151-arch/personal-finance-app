import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useFinanceData } from "../../hooks/useFinanceData";
import { useNavigate } from "react-router-dom";
import { SUGGESTED_CATEGORIES } from "../../context/FinanceContext";
import CategoryIcon from "../../components/CategoryIcon";
import { cn } from "../../lib/utils";
import {
    Loader2, AlertCircle, Wallet, ArrowRight, Plus, Check, X,
    Briefcase, TrendingUp, Utensils, Car, Home, Zap, Clapperboard,
    ShoppingBag, Coffee, ShieldCheck, CreditCard, HeartPulse, Sparkles,
    Gift, GraduationCap, Plane, BookOpen, Package, Tag, Laptop, Coins,
    Building, Megaphone, ShoppingBasket, Percent, UserCheck, Clock
} from "lucide-react";

const ICON_OPTIONS = [
    { name: "Wallet", icon: Wallet },
    { name: "Briefcase", icon: Briefcase },
    { name: "TrendingUp", icon: TrendingUp },
    { name: "Utensils", icon: Utensils },
    { name: "Car", icon: Car },
    { name: "Home", icon: Home },
    { name: "Zap", icon: Zap },
    { name: "Clapperboard", icon: Clapperboard },
    { name: "ShoppingBag", icon: ShoppingBag },
    { name: "Coffee", icon: Coffee },
    { name: "ShieldCheck", icon: ShieldCheck },
    { name: "CreditCard", icon: CreditCard },
    { name: "HeartPulse", icon: HeartPulse },
    { name: "Sparkles", icon: Sparkles },
    { name: "Gift", icon: Gift },
    { name: "GraduationCap", icon: GraduationCap },
    { name: "Plane", icon: Plane },
    { name: "BookOpen", icon: BookOpen },
    { name: "Package", icon: Package },
    { name: "Tag", icon: Tag },
    { name: "Laptop", icon: Laptop },
    { name: "Coins", icon: Coins },
];

const COLOR_OPTIONS = [
    "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#6366f1",
    "#06b6d4", "#f97316", "#ec4899", "#8b5cf6", "#f472b6"
];

const TYPE_LABELS = {
    income: { label: "Income Categories", badge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    expense: { label: "Expense Categories", badge: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    savings: { label: "Savings Goals", badge: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
    debt: { label: "Debt & EMI", badge: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
};

const PROFESSION_OPTIONS = ["Business", "Working Professional", "Student", "Home Maker/Housewife"];

const SelectCategories = () => {
    const { profile, saveCategorySelection, saveProfile } = useFinanceData();
    const navigate = useNavigate();

    useEffect(() => {
        if (profile?.categoriesSelected) {
            navigate("/dashboard", { replace: true });
        }
    }, [profile?.categoriesSelected, navigate]);

    const [currentProfession, setCurrentProfession] = useState(profile?.profession || "Working Professional");

    // Initialize checked state with suggested items for current profession
    const [categories, setCategories] = useState(() => {
        const initialList = SUGGESTED_CATEGORIES[currentProfession] || SUGGESTED_CATEGORIES["Working Professional"];
        return initialList.map((cat, idx) => ({
            ...cat,
            id: `suggested_${idx}`,
            selected: true,
        }));
    });

    const handleProfessionChange = (newProf) => {
        setCurrentProfession(newProf);
        saveProfile({ profession: newProf });
        const newSuggested = SUGGESTED_CATEGORIES[newProf] || SUGGESTED_CATEGORIES["Working Professional"];
        setCategories(newSuggested.map((cat, idx) => ({
            ...cat,
            id: `suggested_${idx}`,
            selected: true,
        })));
    };

    const [addingType, setAddingType] = useState(null); // 'income' | 'expense' | 'savings' | 'debt' | null
    const [customName, setCustomName] = useState("");
    const [customIcon, setCustomIcon] = useState("Tag");
    const [customColor, setCustomColor] = useState("#3b82f6");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const toggleCategory = (id) => {
        setCategories((prev) =>
            prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
        );
    };

    const handleAddCustom = (type) => {
        if (!customName.trim()) return;
        const newCat = {
            id: `custom_${Date.now()}`,
            name: customName.trim(),
            type,
            color: customColor,
            icon: customIcon,
            budget: 0,
            selected: true,
        };
        setCategories((prev) => [...prev, newCat]);
        setCustomName("");
        setAddingType(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedCategories = categories.filter((c) => c.selected);
        if (selectedCategories.length === 0) {
            setError("Please select at least one category to continue.");
            return;
        }

        setError("");
        setLoading(true);
        try {
            await saveCategorySelection(selectedCategories);
            navigate("/dashboard");
        } catch (err) {
            console.error(err);
            setError("Failed to save categories. Please try again.");
        }
        setLoading(false);
    };

    const types = ["income", "expense", "savings", "debt"];

    return (
        <div className="min-h-screen bg-background p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background ambient light */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/15 rounded-full blur-3xl animate-float" />
                <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.2s' }} />
            </div>

            <div className="relative w-full max-w-2xl animate-up my-8 space-y-6">
                {/* Header with Profession Switcher */}
                <div className="glass-strong rounded-3xl p-6 sm:p-8 space-y-4 text-center">
                    <div className="flex justify-center">
                        <div className="p-3 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-xl shadow-primary/30">
                            <Wallet className="w-7 h-7 text-white" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Select your categories</h1>
                        <p className="text-sm text-muted-foreground">
                            Switch your role anytime below to get instant category recommendations:
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            {PROFESSION_OPTIONS.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => handleProfessionChange(p)}
                                    className={cn(
                                        "px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm",
                                        currentProfession === p
                                            ? "border-primary bg-primary/20 text-primary ring-2 ring-primary/30"
                                            : "border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                    )}
                                >
                                    {currentProfession === p && "✓ "}{p}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-2xl flex items-center gap-3 border border-destructive/20 animate-enter">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Category Groups */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {types.map((type) => {
                        const groupCats = categories.filter((c) => c.type === type);
                        if (groupCats.length === 0 && type === "debt" && currentProfession === "Student") {
                            // Student default doesn't have debt, but user can still add if they wish
                        }

                        return (
                            <div key={type} className="glass-strong rounded-3xl p-5 sm:p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${TYPE_LABELS[type].badge}`}>
                                            {TYPE_LABELS[type].label}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAddingType(type);
                                            setCustomColor(COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)]);
                                        }}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Custom
                                    </button>
                                </div>

                                {/* List of Checkbox Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {groupCats.map((cat) => (
                                        <div
                                            key={cat.id}
                                            onClick={() => toggleCategory(cat.id)}
                                            className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                                                cat.selected
                                                    ? "bg-primary/10 border-primary/40 shadow-sm"
                                                    : "bg-muted/30 border-border hover:bg-muted/50 opacity-60"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                                                    style={{ backgroundColor: `${cat.color}20` }}
                                                >
                                                    <CategoryIcon iconName={cat.icon} color={cat.color} size={18} />
                                                </div>
                                                <span className="text-sm font-semibold truncate text-foreground">
                                                    {cat.name}
                                                </span>
                                            </div>

                                            <div
                                                className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                                                    cat.selected
                                                        ? "bg-primary border-primary text-primary-foreground"
                                                        : "border-muted-foreground/40 bg-background"
                                                }`}
                                            >
                                                {cat.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Add Custom Category Inline Form */}
                                {addingType === type && (
                                    <div className="mt-4 p-4 rounded-2xl bg-muted/60 border border-primary/30 space-y-3 animate-enter">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-foreground">New {type} category</span>
                                            <button
                                                type="button"
                                                onClick={() => setAddingType(null)}
                                                className="text-muted-foreground hover:text-foreground p-1"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                            placeholder="Category Name"
                                            className="input-field text-sm"
                                            autoFocus
                                        />

                                        {/* Icon Picker */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                                Icon
                                            </label>
                                            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1 border border-border rounded-xl bg-background">
                                                {ICON_OPTIONS.map((item) => (
                                                    <button
                                                        key={item.name}
                                                        type="button"
                                                        onClick={() => setCustomIcon(item.name)}
                                                        className={`p-2 rounded-lg transition-colors ${
                                                            customIcon === item.name
                                                                ? "bg-primary/20 text-primary border border-primary/40"
                                                                : "text-muted-foreground hover:bg-muted"
                                                        }`}
                                                    >
                                                        <item.icon className="w-4 h-4" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Color Picker */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                                Color
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {COLOR_OPTIONS.map((c) => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => setCustomColor(c)}
                                                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                                            customColor === c ? "scale-110 border-white shadow" : "border-transparent"
                                                        }`}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAddCustom(type)}
                                            disabled={!customName.trim()}
                                            className="btn-primary w-full py-2 text-xs font-bold disabled:opacity-50"
                                        >
                                            Add Category
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Submit Button */}
                    <div className="glass-strong rounded-3xl p-6 text-center space-y-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 h-12 text-base shadow-xl shadow-primary/25"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Continue to Dashboard</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                        <p className="text-xs text-muted-foreground">
                            You can always add, edit, or customize categories later in Settings.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SelectCategories;
