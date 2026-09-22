# 🚀 Anthropic Claude Connectors Directory — Official Submission Guide

This document contains everything needed to submit **Budget Tracker Pro** to the **Claude Connectors Directory** so it appears in the public "Discover" / "Top connectors" grid alongside Google Drive, Figma, Canva, and Slack!

---

## 📋 Connector Profile & Metadata

| Field | Value |
|---|---|
| **Connector Name** | `Budget Tracker Pro` |
| **Category** | `Finance` / `Productivity` / `Utilities` |
| **Tagline** | *Smart personal finance & budget manager powered by Claude AI* |
| **Detailed Description** | Connect Claude AI to Budget Tracker Pro to inspect live account balances, record expenses with natural language, track category budgets, and analyze monthly cashflow across multiple bank accounts and UPI payments. |
| **Connector URL (MCP Endpoint)** | `https://personal-finance-app-mauve.vercel.app/api/mcp` |
| **Public Manifest** | `https://personal-finance-app-mauve.vercel.app/mcp.json` |
| **Official App Icon (512x512)** | `https://personal-finance-app-mauve.vercel.app/app-icon-512.png` |
| **Homepage** | `https://personal-finance-app-mauve.vercel.app` |
| **Privacy Policy** | `https://personal-finance-app-mauve.vercel.app/privacy` |
| **Terms of Service** | `https://personal-finance-app-mauve.vercel.app/terms` |

---

## 🔐 Authentication & Compliance Details

| Parameter | Specification |
|---|---|
| **Protocol** | Model Context Protocol (MCP) Streamable HTTP JSON-RPC 2.0 |
| **Auth Type** | OAuth 2.0 with PKCE S256 (RFC 6749, RFC 7636, RFC 8414) |
| **Discovery URL** | `https://personal-finance-app-mauve.vercel.app/.well-known/oauth-authorization-server` |
| **Authorization Endpoint** | `https://personal-finance-app-mauve.vercel.app/oauth/authorize` |
| **Token Endpoint** | `https://personal-finance-app-mauve.vercel.app/oauth/token` |
| **Supported Scopes** | `finance:read`, `finance:write` |
| **Token Lifecycle** | 30-day signed HS256 JWT access tokens + 1-year refresh tokens |

---

## 🛠️ Provided Tools & Annotations

1. **`get_balances`** (`readOnlyHint: true`)
   - *Description:* Retrieve total balance, bank account breakdowns, cash wallet, monthly budget, and subscription status.
2. **`get_transactions`** (`readOnlyHint: true`)
   - *Description:* Filter and search transactions by date, category, bank, or keyword.
3. **`get_monthly_summary`** (`readOnlyHint: true`)
   - *Description:* Summarize monthly income, expenses, savings, and top spending categories.
4. **`add_transaction`** (`readOnlyHint: false`)
   - *Description:* Add an income or expense transaction with amount, category, date, and payment mode.
5. **`list_categories`** (`readOnlyHint: true`)
   - *Description:* List all user budget categories with their monthly budget limits and current spending.
6. **`add_category`** (`readOnlyHint: false`)
   - *Description:* Create a new budget category with optional monthly allocation.
7. **`edit_category`** (`readOnlyHint: false`)
   - *Description:* Update category budget limit, name, color, or icon.
8. **`delete_category`** (`destructiveHint: true`)
   - *Description:* Delete a category with safeguards for existing transactions.
9. **`get_loans_and_recurring`** (`readOnlyHint: true`)
   - *Description:* Fetch active loans, EMI payments, and recurring bills/subscriptions.

---

## 📮 Submission Channels

### Channel 1: Claude.ai In-Product Directory Submission (Fast-Track)
1. Log into your Claude.ai account (preferably on a Team/Enterprise or Developer workspace).
2. Go to **Settings** &rarr; **Connectors** (or Organization Settings &rarr; Integrations).
3. If your account has Directory Submission access, click **"Submit a Connector"**.
4. Paste the metadata from the table above.
5. Provide a test account (or state that any Google/Email account signs in automatically with pre-populated demo categories).

### Channel 2: Anthropic Official Open-Source MCP Registry (GitHub PR)
1. Fork the official repository: [https://github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers).
2. Add `budget-tracker-pro` entry referencing `https://personal-finance-app-mauve.vercel.app/mcp.json`.
3. Submit a Pull Request with title: `Add Budget Tracker Pro remote MCP server`.
4. Once merged, it is automatically indexed into the Claude Connectors Directory!

### Channel 3: Community Registries (Instant Visibility)
You can also submit this manifest to the top community registries:
- **PulseMCP:** [https://pulsemcp.com](https://pulsemcp.com)
- **Glama MCP Directory:** [https://glama.ai/mcp/servers](https://glama.ai/mcp/servers)
- **MCP.so:** [https://mcp.so](https://mcp.so)
