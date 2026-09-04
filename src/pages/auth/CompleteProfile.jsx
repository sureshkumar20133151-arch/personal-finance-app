import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useFinanceData } from "../../hooks/useFinanceData";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, Wallet, ArrowRight, Mail, User } from "lucide-react";

const professionOptions = ["Business", "Working Professional", "Student", "Home Maker/Housewife"];

const CompleteProfile = () => {
    const { currentUser } = useAuth();
    const { profile, saveProfile } = useFinanceData();
    const navigate = useNavigate();

    useEffect(() => {
        if (profile?.profileComplete) {
            if (profile?.categoriesSelected) {
                navigate("/dashboard", { replace: true });
            } else {
                navigate("/select-categories", { replace: true });
            }
        }
    }, [profile?.profileComplete, profile?.categoriesSelected, navigate]);

    const nameParts = (currentUser?.displayName || "").trim().split(" ");
    const [firstName, setFirstName] = useState(profile?.firstName || nameParts[0] || "");
    const [lastName, setLastName] = useState(profile?.lastName || nameParts.slice(1).join(" ") || "");
    const [age, setAge] = useState(profile?.age ? String(profile.age) : "");
    const [place, setPlace] = useState(profile?.place || "");
    const [mobile, setMobile] = useState(profile?.mobile || "");
    const [profession, setProfession] = useState(profile?.profession || "Working Professional");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!profession) {
            setError("Please select your profession.");
            return;
        }
        if (!place || !mobile || !age) {
            setError("Please fill in all fields.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            await saveProfile({
                firstName,
                lastName,
                age: Number(age),
                place,
                mobile,
                profession,
            });
            navigate("/select-categories");
        } catch (err) {
            console.error(err);
            setError(
                "Could not save your profile (" + (err?.code || err?.message || "unknown error") +
                "). Please check your connection and try again."
            );
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/15 rounded-full blur-3xl animate-float" />
                <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.2s' }} />
            </div>

            <div className="relative w-full max-w-lg animate-up">
                <div className="glass-strong rounded-3xl p-7 sm:p-8 space-y-5">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-3">
                            <div className="p-3 bg-gradient-to-br from-primary to-purple-600 rounded-2xl shadow-xl shadow-primary/30">
                                <Wallet className="w-7 h-7 text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Complete your profile</h1>
                        <p className="text-sm text-muted-foreground">
                            Just a few more details to personalize your experience
                        </p>
                    </div>

                    {/* Auto-filled from Google (locked) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2.5 bg-muted/40 border border-border rounded-xl px-3.5 py-2.5">
                            <User className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{currentUser?.displayName || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2.5 bg-muted/40 border border-border rounded-xl px-3.5 py-2.5">
                            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{currentUser?.email || "—"}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3.5 rounded-xl flex items-center gap-2.5 border border-destructive/20">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="firstName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">First Name</label>
                                <input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                                    className="input-field" required />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="lastName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Last Name</label>
                                <input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                                    className="input-field" required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="age" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Age</label>
                                <input id="age" type="number" min="13" max="120" value={age} onChange={e => setAge(e.target.value)}
                                    placeholder="e.g. 25" className="input-field" required />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="place" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Place</label>
                                <input id="place" type="text" value={place} onChange={e => setPlace(e.target.value)}
                                    placeholder="Madurai" className="input-field" required />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="mobile" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Mobile Number</label>
                            <input id="mobile" type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
                                placeholder="9876543210" className="input-field" required />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Profession</label>
                            <div className="grid grid-cols-2 gap-2">
                                {professionOptions.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setProfession(p)}
                                        className={
                                            "h-10 rounded-xl text-xs font-semibold border transition-colors " +
                                            (profession === p
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border text-muted-foreground hover:bg-muted/60")
                                        }
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 h-11">
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfile;
