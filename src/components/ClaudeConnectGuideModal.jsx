import React, { useState } from 'react';
import { Bot, X, Copy, Check, ExternalLink, Zap, Download, Monitor, Sparkles, CheckCircle2, Globe, ShieldCheck } from 'lucide-react';

const ClaudeConnectGuideModal = ({ isOpen, onClose, mcpConnectorUrl, mcpConnectorName = 'Budget Tracker Pro' }) => {
    const [copiedName, setCopiedName] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [activeTab, setActiveTab] = useState('web'); // 'web' | 'desktop' | 'bookmarklet'

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

    const bookmarkletCode = `javascript:(function(){const inputs=Array.from(document.querySelectorAll('input'));if(inputs.length>=2){inputs[0].value='${mcpConnectorName}';inputs[0].dispatchEvent(new Event('input',{bubbles:true}));inputs[1].value='${mcpConnectorUrl}';inputs[1].dispatchEvent(new Event('input',{bubbles:true}));}})();`;

    const downloadWindowsBat = () => {
        const batContent = `@echo off
title Installing Budget Tracker Pro in Claude Desktop
echo ========================================================
echo    Installing Budget Tracker Pro MCP in Claude Desktop
echo ========================================================
set "CLAUDE_DIR=%APPDATA%\\Claude"
if not exist "%CLAUDE_DIR%" mkdir "%CLAUDE_DIR%"
set "CONFIG_FILE=%CLAUDE_DIR%\\claude_desktop_config.json"

powershell -Command "$cfg = @{ mcpServers = @{ 'budget-tracker-pro' = @{ command = 'npx'; args = @('-y', 'mcp-remote', '${mcpConnectorUrl}') } } }; if (Test-Path '%CONFIG_FILE%') { try { $existing = Get-Content '%CONFIG_FILE%' | ConvertFrom-Json; if (-not $existing.mcpServers) { $existing | Add-Member -NotePropertyName 'mcpServers' -NotePropertyValue @{} }; $existing.mcpServers | Add-Member -NotePropertyName 'budget-tracker-pro' -NotePropertyValue $cfg.mcpServers.'budget-tracker-pro' -Force; $existing | ConvertTo-Json -Depth 5 | Set-Content '%CONFIG_FILE%' } catch { $cfg | ConvertTo-Json -Depth 5 | Set-Content '%CONFIG_FILE%' } } else { $cfg | ConvertTo-Json -Depth 5 | Set-Content '%CONFIG_FILE%' }"

echo.
echo [SUCCESS] Budget Tracker Pro MCP installed successfully!
echo Please restart your Claude Desktop app to use it.
echo ========================================================
pause
`;
        const blob = new Blob([batContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'install-budget-tracker-claude.bat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadJsonConfig = () => {
        const config = {
            mcpServers: {
                "budget-tracker-pro": {
                    command: "npx",
                    args: ["-y", "mcp-remote", mcpConnectorUrl]
                }
            }
        };
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'claude_desktop_config.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const openClaudeUrl = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(mcpConnectorName)}&name=${encodeURIComponent(mcpConnectorName)}&connectorUrl=${encodeURIComponent(mcpConnectorUrl)}&url=${encodeURIComponent(mcpConnectorUrl)}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
            <div 
                className="relative w-full max-w-2xl bg-card border border-border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Top Gradient & Header */}
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
                                    Connect to Claude AI
                                </h3>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <ShieldCheck className="w-3 h-3" /> One-Time Setup
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Set it up once — Claude remembers Budget Tracker forever for all future chats!
                            </p>
                        </div>
                    </div>

                    {/* Method Selector Tabs */}
                    <div className="flex items-center gap-1.5 mt-4 p-1 rounded-xl bg-muted/60 border border-border text-xs font-semibold">
                        <button
                            onClick={() => setActiveTab('web')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                                activeTab === 'web'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Claude Web (2 Steps)</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('bookmarklet')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                                activeTab === 'bookmarklet'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span>⚡ 1-Click Magic Auto-Fill</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('desktop')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                                activeTab === 'desktop'
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Monitor className="w-3.5 h-3.5" />
                            <span>Claude Desktop App</span>
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                    {/* TAB 1: CLAUDE WEB VISUAL GUIDE */}
                    {activeTab === 'web' && (
                        <div className="space-y-4">
                            {/* Realistic Mockup of Claude's Dialog */}
                            <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 sm:p-5 relative overflow-hidden shadow-inner">
                                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
                                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#D97757]" />
                                        <span>In Claude: "Add custom connector" Dialog</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-mono">claude.ai</span>
                                </div>

                                <div className="space-y-3">
                                    {/* Mock Field 1: Name */}
                                    <div>
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1">
                                            <span className="flex items-center gap-1">
                                                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">1</span>
                                                Name
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">Click button below to copy:</span>
                                        </div>
                                        <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border shadow-sm">
                                            <span className="text-xs font-bold text-foreground flex-1 px-1">
                                                {mcpConnectorName}
                                            </span>
                                            <button
                                                onClick={() => copyText(mcpConnectorName, setCopiedName)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-semibold transition-all shrink-0 shadow-sm"
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

                                    {/* Mock Field 2: Server URL */}
                                    <div>
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1">
                                            <span className="flex items-center gap-1">
                                                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">2</span>
                                                Server URL
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">Click button below to copy:</span>
                                        </div>
                                        <div className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border shadow-sm">
                                            <code className="text-xs font-mono text-foreground flex-1 px-1 truncate">
                                                {mcpConnectorUrl}
                                            </code>
                                            <button
                                                onClick={() => copyText(mcpConnectorUrl, setCopiedUrl)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shrink-0 shadow-sm"
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

                                    {/* Step 3 guidance */}
                                    <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">3</span>
                                            Click <strong>Connect</strong> & authenticate via 1-click Google/Email
                                        </span>
                                        <span className="text-emerald-500 font-semibold text-[11px]">✓ Done forever</span>
                                    </div>
                                </div>
                            </div>

                            {/* Open Claude Big CTA */}
                            <a
                                href={openClaudeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#D97757] via-[#c66849] to-[#b3573c] hover:from-[#c66849] hover:to-[#9f4830] text-white font-bold text-sm shadow-lg shadow-[#D97757]/25 hover:shadow-xl hover:shadow-[#D97757]/35 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                            >
                                <span>🚀 Open Claude Connectors Window</span>
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    )}

                    {/* TAB 2: ⚡ 1-CLICK MAGIC BOOKMARKLET */}
                    {activeTab === 'bookmarklet' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
                                <h4 className="font-bold text-sm flex items-center gap-1.5 mb-1">
                                    <Zap className="w-4 h-4 text-amber-500" />
                                    The 0-Typing Trick for Browser Users
                                </h4>
                                <p className="leading-relaxed">
                                    Drag the button below to your browser's Bookmarks bar. Whenever Claude's <em>"Add custom connector"</em> modal opens, just click this bookmark and it types both the Name and URL automatically in 0.1s!
                                </p>
                            </div>

                            {/* Draggable Bookmarklet Button */}
                            <div className="text-center p-6 rounded-2xl border-2 border-dashed border-amber-500/40 bg-card flex flex-col items-center justify-center gap-2.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                    ⬇ Drag this button onto your Bookmarks bar (Ctrl+Shift+B if hidden):
                                </span>
                                <a
                                    href={bookmarkletCode}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        alert("Drag this button to your browser Bookmarks Bar (above the webpage)!");
                                    }}
                                    className="cursor-grab active:cursor-grabbing px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm shadow-md shadow-amber-500/25 flex items-center gap-2 select-none"
                                >
                                    <Zap className="w-4 h-4 fill-white" />
                                    <span>⚡ Auto-Fill Claude</span>
                                </a>
                                <span className="text-[11px] text-muted-foreground">
                                    Works in Google Chrome, Microsoft Edge, Brave, and Firefox!
                                </span>
                            </div>

                            <a
                                href={openClaudeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 transition-all"
                            >
                                <span>Open Claude Connectors</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    )}

                    {/* TAB 3: CLAUDE DESKTOP APP (1-CLICK FILE INSTALL) */}
                    {activeTab === 'desktop' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-700 dark:text-indigo-300">
                                <h4 className="font-bold text-sm flex items-center gap-1.5 mb-1">
                                    <Monitor className="w-4 h-4 text-indigo-500" />
                                    For Claude Desktop App Users (Windows / Mac)
                                </h4>
                                <p className="leading-relaxed">
                                    If you have the Claude Desktop software installed on your computer, you don't even need to open settings! Just download the 1-click installer and run it.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Windows 1-Click Installer */}
                                <div className="p-4 rounded-2xl border border-border bg-card flex flex-col justify-between gap-3">
                                    <div>
                                        <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                                            Windows 1-Click Installer
                                        </h5>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            Double-click the downloaded <code>.bat</code> file to automatically write the config.
                                        </p>
                                    </div>
                                    <button
                                        onClick={downloadWindowsBat}
                                        className="w-full py-2.5 px-3 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download .bat Installer</span>
                                    </button>
                                </div>

                                {/* Raw JSON Config */}
                                <div className="p-4 rounded-2xl border border-border bg-card flex flex-col justify-between gap-3">
                                    <div>
                                        <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                            Direct JSON Config
                                        </h5>
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            Download <code>claude_desktop_config.json</code> to place in your Claude app directory.
                                        </p>
                                    </div>
                                    <button
                                        onClick={downloadJsonConfig}
                                        className="w-full py-2.5 px-3 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download .json Config</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 px-6 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Once added, you can ask Claude about your expenses via voice or chat!
                    </span>
                    <button
                        onClick={onClose}
                        className="font-semibold text-foreground hover:underline"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClaudeConnectGuideModal;
