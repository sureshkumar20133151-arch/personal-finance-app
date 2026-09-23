import React, { useState } from 'react';
import { Bot, X, Copy, Check, ExternalLink, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

const ClaudeConnectGuideModal = ({ isOpen, onClose, mcpConnectorUrl, mcpConnectorName = 'Budget Tracker Pro' }) => {
    const [copiedName, setCopiedName] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedClientId, setCopiedClientId] = useState(false);

    if (!isOpen) return null;

    const copyText = async (text, setCopied) => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (e) {
            console.warn("Copy error:", e);
        }
    };

    const openClaudeUrl = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(mcpConnectorName)}&name=${encodeURIComponent(mcpConnectorName)}&connectorUrl=${encodeURIComponent(mcpConnectorUrl)}&url=${encodeURIComponent(mcpConnectorUrl)}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
            <div 
                className="relative w-full max-w-lg bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative p-5 sm:p-6 pb-4 border-b border-border bg-gradient-to-r from-orange-500/10 via-purple-500/10 to-indigo-500/10">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#D97757] text-white flex items-center justify-center shadow-lg shadow-[#D97757]/30 font-bold shrink-0">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                                    Connect to Claude
                                </h3>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <ShieldCheck className="w-3 h-3" /> One-Time Setup
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Add once to your Claude account — stays connected forever!
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body - Pure Simple Visual Guide */}
                <div className="p-5 sm:p-6 space-y-4">
                    {/* Visual Mockup matching Claude's Dialog */}
                    <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 sm:p-5 space-y-3.5 shadow-inner">
                        <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                            <span className="text-xs font-bold text-foreground flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#D97757]" />
                                Claude: "Add custom connector"
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">claude.ai</span>
                        </div>

                        {/* Step 1: Name */}
                        <div>
                            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">1</span>
                                    Name Field:
                                </span>
                                <span className="text-[11px] text-muted-foreground">Click to copy</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border shadow-sm">
                                <span className="text-xs font-bold text-foreground flex-1 px-1">
                                    {mcpConnectorName}
                                </span>
                                <button
                                    onClick={() => copyText(mcpConnectorName, setCopiedName)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-semibold transition-all shrink-0 shadow-sm"
                                >
                                    {copiedName ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-emerald-500 font-bold">Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Copy Name</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Step 2: Server URL */}
                        <div>
                            <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">2</span>
                                    Server URL Field:
                                </span>
                                <span className="text-[11px] text-muted-foreground">Click to copy</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border shadow-sm">
                                <code className="text-xs font-mono text-foreground flex-1 px-1 truncate">
                                    {mcpConnectorUrl}
                                </code>
                                <button
                                    onClick={() => copyText(mcpConnectorUrl, setCopiedUrl)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shrink-0 shadow-sm"
                                >
                                    {copiedUrl ? (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span className="font-bold">Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Copy URL</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Step 3: Connect */}
                        <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60">
                            <span className="flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">3</span>
                                Click <strong>Connect</strong> & sign in with Google/Email
                            </span>
                            <span className="text-emerald-500 font-semibold text-[11px]">✓ Ready</span>
                        </div>
                    </div>

                    {/* Claude's Settings Guidance */}
                    <div className="p-3 rounded-xl bg-muted/60 border border-border/70 text-xs space-y-2.5">
                        <p className="font-bold text-foreground text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>In Claude's Settings (Just 2 quick checks):</span>
                        </p>

                        {/* 1. Authentication */}
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-foreground">Authentication</span>
                                <span className="text-[10px] text-muted-foreground">Keep default (Already selected)</span>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                ✓ Sign in now
                            </span>
                        </div>

                        {/* 2. OAuth Client ID */}
                        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-foreground">OAuth Client ID</span>
                                <span className="text-[10px] text-muted-foreground">If asked, type or copy:</span>
                            </div>
                            <button
                                onClick={() => copyText('claude', setCopiedClientId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[11px] font-bold transition-all shadow-sm"
                            >
                                {copiedClientId ? (
                                    <>
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <span className="text-emerald-500">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy "claude"</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Big Action CTA Button */}
                    <a
                        href={openClaudeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#D97757] via-[#c66849] to-[#b3573c] hover:from-[#c66849] hover:to-[#9f4830] text-white font-bold text-sm shadow-lg shadow-[#D97757]/25 hover:shadow-xl hover:shadow-[#D97757]/35 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                    >
                        <span>🚀 Open Claude & Connect Now</span>
                        <ExternalLink className="w-4 h-4" />
                    </a>

                    <p className="text-[11px] text-center text-muted-foreground">
                        💡 Once connected, you can ask Claude about your expenses anytime via chat or voice!
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ClaudeConnectGuideModal;
