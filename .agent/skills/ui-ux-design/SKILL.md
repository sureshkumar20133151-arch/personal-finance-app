---
name: ui-ux-design
description: >-
  Expert UI/UX design patterns, guidelines, and memory for modern web apps,
  specifically financial trackers, spreadsheets, compact modal forms, and responsive layouts.
---

# UI/UX Design System & Memory Guidelines

## 1. Data-Dense Layouts & Spreadsheets
- **Full Width for Tabular Data**: Financial transaction logs, accounting registers, and data tables must always occupy full container width. Never cram a 9-column data table into a 2/3 column layout alongside an always-visible vertical sidebar form.
- **Excel / Spreadsheet Mental Model**:
  - Clear uppercase column headers with muted tracking (`text-[10px]` or `text-[11px]`, font-bold, uppercase).
  - Subtle zebra striping (`even:bg-muted/15`) for horizontal scanning across wide tables.
  - Tabular monospace numbers for amounts (`tabular-nums font-mono font-bold`) so decimal places and currency symbols align strictly.
  - Bottom status bar / aggregation bar (e.g. `COUNT: {n} | EXPENSE: ₹{x} | INCOME: ₹{y}`) matching Excel/Sheets behavior.
  - Responsive horizontal scrolling (`overflow-x-auto scrollbar-thin`) for lower resolutions with fallback card view toggle (`[📊 Sheet]` / `[📱 Cards]`).

## 2. Responsive Data Entry (Desktop Horizontal vs Mobile Vertical)
- **Web App / Desktop (Horizontal Table Row)**:
  - In web app / desktop spreadsheet mode, data entry must be **HORIZONTAL**, directly at the top of the spreadsheet table.
  - Aligned identically with existing rows: `[Date] [Type] [Category] [Description] [Payment Mode] [Paid By] [Scope] [Amount] [+ Add Button]`.
  - Pressing `Enter` in the description or amount field instantly saves the row into the sheet.
- **Mobile Phones (Vertical Pop-up Modal)**:
  - On mobile screens, 9-column horizontal rows would overflow or be too cramped.
  - Data entry on mobile opens as a focused, centered **Vertical Pop-up Modal** with a backdrop.
  - Compact `<select>` dropdowns prevent vertical scroll cut-offs.
  - Light dismiss (tap outside backdrop or press `X`) cleanly closes the modal.
