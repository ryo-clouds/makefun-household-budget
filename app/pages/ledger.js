// Ledger & Recurring Bills page: searchable/filterable/sortable ledger, bill checklist, CSV/JSON export.
import {
  CATEGORIES, computeSummary, escHtml, fmtCurrency, toMoney,
} from '../data/budget.js';

const ui = { search: '', category: 'all', type: 'all', sort: 'date-desc' };

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function triggerDownload(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filterAndSort(transactions) {
  const q = ui.search.trim().toLowerCase();
  const list = transactions.filter((t) => {
    if (ui.category !== 'all' && t.category !== ui.category) return false;
    if (ui.type !== 'all' && t.type !== ui.type) return false;
    if (q && !t.desc.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
    return true;
  });
  return list.sort((a, b) => {
    if (ui.sort === 'amt-desc') return b.amount - a.amount;
    if (ui.sort === 'amt-asc') return a.amount - b.amount;
    if (ui.sort === 'date-asc') return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });
}

export function renderLedger(root, ctx) {
  const state = ctx.getState();
  const sum = computeSummary(state);
  const rows = filterAndSort(state.transactions);
  const paidBills = state.bills.filter((b) => b.paid);
  const remainingDue = state.bills.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);

  const catOptions = CATEGORIES.map((c) => (
    `<option value="${escHtml(c.id)}" ${ui.category === c.id ? 'selected' : ''}>${escHtml(c.id)}</option>`
  )).join('');

  const addCatOptions = CATEGORIES.map((c) => `<option value="${escHtml(c.id)}">${escHtml(c.id)}</option>`).join('');

  const tableRows = rows.length ? rows.map((t) => `
    <tr>
      <td class="num">${escHtml(t.date)}</td>
      <td>${escHtml(t.desc)}</td>
      <td><span class="badge ${t.type === 'income' ? 'badge-ok' : 'badge-terra'}">${escHtml(t.category)}</span></td>
      <td>${t.type === 'income' ? 'Income' : 'Expense'}</td>
      <td class="right" style="color:${t.type === 'income' ? 'var(--emerald)' : 'var(--ink)'}">
        ${t.type === 'income' ? '+' : '-'}${fmtCurrency(t.amount, 2)}
      </td>
      <td class="right"><button type="button" class="btn-ghost btn-sm" data-del-tx="${escHtml(t.id)}" aria-label="Delete ${escHtml(t.desc)}">Remove</button></td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="muted">No matching transactions. Clear filters or log a new entry.</td></tr>';

  const billRows = state.bills.map((b) => `
    <div class="pill-row">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
        <input type="checkbox" data-bill-id="${escHtml(b.id)}" ${b.paid ? 'checked' : ''} style="width:auto">
        <span><strong>${escHtml(b.name)}</strong><br><small class="muted">Due day ${b.dueDay} · ${escHtml(b.category)}</small></span>
      </label>
      <div style="text-align:right">
        <div class="num"><strong>${fmtCurrency(b.amount)}</strong></div>
        <span class="badge ${b.paid ? 'badge-ok' : 'badge-warn'}">${b.paid ? 'Paid' : 'Pending'}</span>
      </div>
    </div>
  `).join('');

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Cashflow Ledger &amp; Recurring Bills</h1>
        <p>Showing ${rows.length} of ${state.transactions.length} entries · Net Income ${fmtCurrency(sum.totalIncome)} · Spent ${fmtCurrency(sum.totalSpent)}</p>
      </div>
      <div class="btn-group">
        <button type="button" class="btn btn-sm" id="export-csv-btn">Download CSV</button>
        <button type="button" class="btn btn-sm btn-primary" id="export-json-btn">Download JSON</button>
      </div>
    </div>

    <section class="grid-2">
      <div class="card">
        <div class="card-head">
          <h2>Add Transaction</h2>
          <span class="muted">Updates Overview &amp; Envelopes</span>
        </div>
        <form id="ledger-add-form">
          <div class="form-row">
            <div class="field"><label for="ld-date">Date</label><input id="ld-date" type="date" value="2026-11-26" required></div>
            <div class="field"><label for="ld-type">Type</label><select id="ld-type"><option value="expense">Expense</option><option value="income">Income</option></select></div>
            <div class="field"><label for="ld-cat">Category</label><select id="ld-cat">${addCatOptions}</select></div>
          </div>
          <div class="form-row" style="margin-top:8px">
            <div class="field" style="grid-column:span 2"><label for="ld-desc">Description</label><input id="ld-desc" type="text" maxlength="80" placeholder="Merchant or source" required></div>
            <div class="field"><label for="ld-amt">Amount ($)</label><input id="ld-amt" type="number" step="0.01" min="0.01" placeholder="84.50" required></div>
            <div><button type="submit" class="btn btn-primary" style="width:100%">Add Entry</button></div>
          </div>
          <div class="err" id="ld-err" role="alert"></div>
        </form>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Recurring Bills Checklist</h2>
          <span class="badge ${remainingDue === 0 ? 'badge-ok' : 'badge-warn'}">${paidBills.length}/${state.bills.length} paid · ${fmtCurrency(remainingDue)} due</span>
        </div>
        ${billRows}
      </div>
    </section>

    <section class="card">
      <div class="card-head" style="flex-wrap:wrap">
        <h2>Transaction History</h2>
        <div class="form-row" style="flex:1;max-width:680px">
          <input id="ld-search" type="search" placeholder="Search merchant or category…" value="${escHtml(ui.search)}">
          <select id="ld-filter-cat"><option value="all">All categories</option>${catOptions}</select>
          <select id="ld-filter-type">
            <option value="all" ${ui.type === 'all' ? 'selected' : ''}>All types</option>
            <option value="expense" ${ui.type === 'expense' ? 'selected' : ''}>Expense</option>
            <option value="income" ${ui.type === 'income' ? 'selected' : ''}>Income</option>
          </select>
          <select id="ld-sort">
            <option value="date-desc" ${ui.sort === 'date-desc' ? 'selected' : ''}>Newest first</option>
            <option value="date-asc" ${ui.sort === 'date-asc' ? 'selected' : ''}>Oldest first</option>
            <option value="amt-desc" ${ui.sort === 'amt-desc' ? 'selected' : ''}>Amount high–low</option>
            <option value="amt-asc" ${ui.sort === 'amt-asc' ? 'selected' : ''}>Amount low–high</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th class="right">Amount</th><th class="right">Action</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </section>
  `;

  document.getElementById('ledger-add-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('ld-date').value || '2026-11-26';
    const type = document.getElementById('ld-type').value === 'income' ? 'income' : 'expense';
    const category = document.getElementById('ld-cat').value;
    const desc = document.getElementById('ld-desc').value.trim();
    const amount = toMoney(document.getElementById('ld-amt').value, false);
    const errEl = document.getElementById('ld-err');
    if (!desc || !amount) {
      errEl.textContent = 'Provide a description and a positive dollar amount.';
      return;
    }
    const next = ctx.getState();
    next.transactions.unshift({ id: `t-${Date.now()}`, date, desc, category, type, amount });
    ctx.setState(next);
    renderLedger(root, ctx);
  });

  document.getElementById('ld-search')?.addEventListener('input', (e) => {
    ui.search = e.target.value;
    renderLedger(root, ctx);
    const inp = document.getElementById('ld-search');
    inp?.focus();
    inp?.setSelectionRange(ui.search.length, ui.search.length);
  });
  document.getElementById('ld-filter-cat')?.addEventListener('change', (e) => { ui.category = e.target.value; renderLedger(root, ctx); });
  document.getElementById('ld-filter-type')?.addEventListener('change', (e) => { ui.type = e.target.value; renderLedger(root, ctx); });
  document.getElementById('ld-sort')?.addEventListener('change', (e) => { ui.sort = e.target.value; renderLedger(root, ctx); });

  for (const btn of root.querySelectorAll('[data-del-tx]')) {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del-tx');
      const next = ctx.getState();
      next.transactions = next.transactions.filter((t) => t.id !== id);
      ctx.setState(next);
      renderLedger(root, ctx);
    });
  }

  for (const chk of root.querySelectorAll('[data-bill-id]')) {
    chk.addEventListener('change', () => {
      const id = chk.getAttribute('data-bill-id');
      const next = ctx.getState();
      const bill = next.bills.find((b) => b.id === id);
      if (bill) bill.paid = chk.checked;
      ctx.setState(next);
      renderLedger(root, ctx);
    });
  }

  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    const header = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const lines = [header.join(','), ...ctx.getState().transactions.map((t) => (
      [t.date, t.desc, t.category, t.type, t.amount.toFixed(2)].map(csvCell).join(',')
    ))];
    triggerDownload('hearthledger-nov-2026.csv', 'text/csv;charset=utf-8', lines.join('\r\n'));
  });

  document.getElementById('export-json-btn')?.addEventListener('click', () => {
    triggerDownload('hearthledger-backup.json', 'application/json;charset=utf-8', JSON.stringify(ctx.getState(), null, 2));
  });
}
