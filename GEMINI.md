# Workspace Rules: UI/UX & Architecture Guidelines

## Core UX Principles for Budget Tracker:
1. **Spreadsheet-First Data Display (Desktop)**:
   - On desktop, the transactions list renders in a clean, full-width Excel-style table view by default.
   - Retains clearly aligned columns: Date, Type, Category, Description, Payment Mode, Paid By, Scope, Amount, and Actions.
   - Monospace amounts and an Excel status bar at the bottom showing COUNT, EXPENSE total, and INCOME total.
   - Sheet vs Cards view toggle (`[📊 Sheet]` and `[📱 Cards]`) available on desktop (`hidden md:flex`).

2. **Mobile View UI**:
   - On mobile screens (`< md`), the Excel spreadsheet is hidden (`hidden md:block`), and transactions render directly as clean **2-Row Cards**:
     - **Row 1**: Icon + Description + compact metadata pills (`Date • Category dot • UPI/Cash • Paid By • Scope`).
     - **Row 2**: Monospace Amount on the left (`-₹500` / `+₹10,000`) and action buttons on the right (`💬 Comments`, `✏️ Edit`, `🗑️ Delete`).
   - Mobile data entry is a centered, clean **Vertical Pop-up Modal** with light dismiss.

3. **Search, Actions & Filter Toolbar**:
   - **Header**:
     - **Mobile View**: Title on left, Month Selector (`< MMM yyyy >` + `All` / `This Month`) on the top-right (directly under the profile tiger avatar in the navbar). Clean 50/50 equal-width action buttons row below: `[ 📄 Upload Statement ]` and `[ ➕ Add Transaction ]`.
     - **Desktop View**: Title on left; Month Selector, `Upload Statement` button, and `+ Add Transaction` button aligned in a clean horizontal group on the right.
   - **Search & Sort Row (Inside Card)**:
     - Left: `[ 🔍 Search transactions... ]` spanning available width (`flex-1`).
     - Right: `[ ↕️ Sort By ]` dropdown (`ArrowUpDown` icon + `ChevronDown`) with options:
       - `Newest First` (`date-desc` - default)
       - `Oldest First` (`date-asc`)
       - `Amount: High to Low` (`amount-desc`)
       - `Amount: Low to High` (`amount-asc`)
     - Desktop also shows the Sheet/Cards toggle and SMS sync tools here.
   - **Filter Row (Inside Card)**:
     - `Expense For` Dropdown: `All Expenses`, `🏠 Home (Joint)`, `👤 Suresh (Personal)`, `🌸 Rosy (Personal)`.
     - `Category` Dropdown: `Category: All`, `🔴 Expense`, `🟢 Income`, `🔵 Savings`, `🟠 Debt`.
     - `Reset` button appears automatically when any filter is active.
     - On mobile: Two 50/50 equal-width columns (`grid grid-cols-2 gap-2 w-full`) with zero cropping.
     - On desktop: Inline dropdowns with an active transaction count summary (`Showing: X transactions`).
   - **Removed Items**:
     - `Export CSV` is completely removed.
     - `Fixed / Recurring` filter tabs are completely removed from this toolbar to keep the register focused.

4. **Household Collaboration Features**:
   - **Mine / Yours / Ours**: Tag expenses as Joint (`🏠 Ours`), Suresh's personal (`👤 Mine`), or Partner's personal (`🌸 Partner`).
   - **Transaction Comments**: In-app comments thread with quick emoji reactions (`👍 ❤️ ❓ 🛒 ⚡ 🎉`).
   - **Shared Bill Calendar**: Due date tracking, assignment to `🤝 Both`, `👤 Suresh`, or `🌸 Rosy`, and mark-as-paid checklist.
   - **Monthly Household Report Card**: Side-by-side spend breakdown, contribution ratio, and 50/50 settlement calculation on the Dashboard.

5. **Verification Protocol**:
   - Always verify changes locally on `http://localhost:5173` before pushing to Git or Vercel.
   - Run `npm run build` to verify production compilation before reporting completion.
   - In Windows PowerShell, run dev/build commands via `cmd /c "npm run ..."` to avoid PowerShell execution policy blocks.
