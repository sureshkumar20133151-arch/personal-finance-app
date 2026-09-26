# Workspace Rules: UI/UX & Architecture Guidelines

## Core UX Principles for Budget Tracker:
1. **Spreadsheet-First Data Display (Desktop)**:
   - On desktop, the transactions list renders in a clean, full-width Excel-style table view by default.
   - Retains clearly aligned columns: Date, Type, Category, Description, Payment Mode, Paid By, Updated By, Scope, Amount, and Actions.
   - `PaymentStatusBadge` (`✅ Paid`, `⏳ Due...`, `🤝 Borrowed`) is integrated into the Payment Mode cell in the desktop table.
   - Monospace amounts and an Excel status bar at the bottom showing COUNT, EXPENSE total, and INCOME total.
   - Sheet vs Cards view toggle (`[📊 Sheet]` and `[📱 Cards]`) available on desktop (`hidden md:flex`).

2. **Mobile View UI**:
   - On mobile screens (`< md`), the Excel spreadsheet is hidden (`hidden md:block`), and transactions render directly as clean **2-Row Cards**:
     - **Row 1**: Icon + Description + compact metadata pills (`Date • Category dot • UPI/Cash • Paid By • Scope • PaymentStatusBadge`).
     - **Row 2**: Monospace Amount on the left (`-₹500` / `+₹10,000`) and action buttons on the right (`💬 Comments`, `✏️ Edit`, `🗑️ Delete`).
   - Mobile data entry is a centered, clean **Vertical Pop-up Modal** with light dismiss.

3. **Dashboard Design (CRED / Luxury Obsidian Black Style)**:
   - **Header**: Titled `Dashboard` (never "FinTrack"), with current month date range (`01 MMM – 30 MMM yyyy`), Month Selector (`< MMM yyyy >`), and Sync / Share buttons.
   - **Hero Balance Card**:
     - Modern luxury matte black / carbon black aesthetic (`bg-gradient-to-br from-zinc-900 via-neutral-950 to-black border border-white/10`).
     - Shows **Total Balance** (Bank Accounts + Cash in Hand combined) as the prominent number in large monospace font.
     - Month-over-month trend indicator (`↑/↓ % vs last month`).
     - 3 dark glass pills: `💚 Income`, `🔴 Spent`, and `💙 Saved`.
     - Live monthly budget progress bar and "Safe to spend / day" calculation.
   - **Upcoming Payments & Bills (Directly Under Hero Card)**:
     - Placed immediately underneath the Hero Card for instant visibility.
     - Displays recurring subscriptions, EMIs, and bills with due date countdown (`Today!`, `In 3d`), frequency, and urgency indicators.
   - **Bank Accounts Carousel**:
     - Horizontal snap-scroll cards for each bank (`Indian Bank`, `Canara Bank`, `SBI`, etc.) + `Cash in Hand (Wallet)`.
   - **Pending Payments Panel (கொடுக்க வேண்டியவை)**:
     - Displays pending/deferred payment obligations (`paymentStatus === 'deferred'`).
     - Shows who to pay, amount, promised due date, promise note, and an instant **`[Pay]`** button.
     - Renders cleanly only when pending payments exist; kept uncluttered.
     - *Adding* pending payments is done strictly through the **Add Transaction** form (`Payment Status: ⏳ Pay Later / Deferred`), keeping the dashboard clean.
   - **Side-by-Side Charts**:
     - Clean 50/50 two-column layout on desktop: `Expense Breakdown` and `Income Sources` donut charts.
   - **Removed from Dashboard**:
     - "Household Report Card" / "Monthly Contribution Ratio" has been completely removed.
     - "Salary Pockets" setup card has been moved out of Dashboard to the dedicated Budget tab.

4. **Budget Page Architecture (2 Dedicated Tabs)**:
   - Located at `/budget` (`Budget.jsx`).
   - Features a clean top header and 2-tab switcher:
     1. **`🎯 Category Budget`**:
        - Traditional category budget limits, monthly global limit (`Set Limit`), interactive category list, and detailed spending breakdown.
     2. **`👛 Salary Pockets`**:
        - Virtual Envelope Budgeting (`SalaryPocketSystem.jsx`).
        - User enters monthly salary (e.g. ₹50,000) and allocates into virtual pockets (e.g. `🌸 Rosy Home Expenses: ₹20,000`, `👤 Suresh Pocket Money: ₹5,000`, and remaining as `💛 Savings Buffer`).
        - Live envelope progress bars tracking spent vs allocated amounts per pocket.
        - Month-end transfer button to move leftover buffer into the savings pool.

5. **Bank Account Management (`Setup.jsx`)**:
   - In `Setup -> 🏦 Starting Balances`:
     - Users can manually add any bank account using the **`+ Add Bank`** button with preset buttons (`Indian Bank`, `Canara Bank`, `SBI`, `HDFC`, `ICICI`, `Axis`) or custom name, account ending (last 4 digits), starting balance, and date.
     - Existing bank balances can be updated inline or removed via the trash button.
     - Cash in Hand balance and date are managed here.
   - Bank Statement PDF Upload in Transactions also automatically detects bank name, account number, transactions, and running balances.

6. **Payment Status & Debt Model**:
   - Every transaction supports `paymentStatus`:
     - `paid`: Money has left the hand/account (default).
     - `deferred`: Promised to pay on a future date (requires `deferredTo` date and optional `deferredNote`).
     - `borrowed`: Paid using borrowed money (records `borrowedFrom`).
   - Prevents artificial negative balance confusion; promises to pay remain in pending status until paid.

7. **Household Collaboration & Actors**:
   - **Husband (Suresh)** and **Wife (Rosy)** household collaboration.
   - `paidBy`: Who physically paid (`Suresh`, `Rosy`, `Both`).
   - `updatedBy`: Who created/edited the transaction (`Suresh`, `Rosy`, `Claude`).
   - `scope`: `ours` (Joint/Home), `mine` (Suresh Personal), `partner` (Rosy Personal).

8. **Search, Actions & Filter Toolbar (Transactions)**:
   - **Mobile View**: Title on left, Month Selector (`< MMM yyyy >` + `All` / `This Month`) on the top-right. Clean 50/50 equal-width action buttons: `[ 📄 Upload Statement ]` and `[ ➕ Add Transaction ]`.
   - **Desktop View**: Title on left; Month Selector, `Upload Statement` button, and `+ Add Transaction` button aligned in a clean horizontal group on the right.
   - **Sort Dropdown**: `Newest First` (default), `Oldest First`, `Amount: High to Low`, `Amount: Low to High`.
   - **Filter Dropdown**: `Expense For` (`All Expenses`, `🏠 Home (Joint)`, `👤 Suresh`, `🌸 Rosy`) and `Category`.
   - `Export CSV` and `Fixed / Recurring` filter tabs are permanently removed.

9. **Verification Protocol**:
   - Always verify changes locally on `http://localhost:5173` before pushing to Git or Vercel.
   - Run `cmd /c "npm run build"` to verify production compilation before reporting completion.
   - In Windows PowerShell, run dev/build commands via `cmd /c "npm run ..."` to avoid PowerShell execution policy blocks.
