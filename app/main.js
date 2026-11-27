// HearthLedger shell router, Overview view, SVG charts, and quick cashflow entry.
import {
  CATEGORIES, HISTORY_MONTHS, computeSummary, escHtml,
  fmtCurrency, fmtPercent, isValidCategory, nextId, readState, resetState, saveState, toMoney,
} from './data/budget.js';

const appEl = document.getElementById('app');
const navEl = document.getElementById('main-nav');
const toggleEl = document.getElementById('nav-toggle');
const resetBtn = document.getElementById('reset-sample-btn');

let state = readState();

function currentRoute() {
  const hash = globalThis.location.hash.replace(/^#/, '');
  return hash || '/';
}

function updateNav(route) {
  for (const link of navEl.querySelectorAll('a[data-route]')) {
    link.classList.toggle('active', link.getAttribute('data-route') === route);
  }
  navEl.classList.remove('open');
  toggleEl.setAttribute('aria-expanded', 'false');
}

function renderAllocationSvg(summary) {
  const hasIncome = summary.totalIncome > 0;
  const inc = hasIncome ? summary.totalIncome : 1;
  const rows = [
    { label: 'Needs', actual: hasIncome ? summary.needsSpent / inc : 0, target: 0.50, color: '#1B6B50', amt: summary.needsSpent },
    { label: 'Wants', actual: hasIncome ? summary.wantsSpent / inc : 0, target: 0.30, color: '#C85A32', amt: summary.wantsSpent },
    { label: 'Savings & Surplus', actual: hasIncome ? summary.totalSavings / inc : 0, target: 0.20, color: '#2B5B84', amt: summary.totalSavings },
  ];
  const bars = rows.map((r, i) => {
    const y = 14 + i * 52;
    const wAct = Math.min(390, Math.max(4, Math.round(r.actual * 390)));
    const wTgt = Math.round(r.target * 390);
    return `<text x="0" y="${y + 11}" font-size="12" font-weight="600" fill="#1D2939">${r.label}</text>
      <text x="390" y="${y + 11}" font-size="12" text-anchor="end" fill="#5B6675">${fmtCurrency(r.amt)} (${fmtPercent(r.actual)} vs ${Math.round(r.target * 100)}%)</text>
      <rect x="0" y="${y + 18}" width="390" height="14" rx="7" fill="#EFECE3"/>
      <rect x="0" y="${y + 18}" width="${wAct}" height="14" rx="7" fill="${r.color}"/>
      <line x1="${wTgt}" y1="${y + 14}" x2="${wTgt}" y2="${y + 36}" stroke="#1D2939" stroke-width="2" stroke-dasharray="3,2"/>`;
  }).join('');
  return `<svg class="svg-box" viewBox="0 0 390 172" role="img" aria-label="50/30/20 allocation vs actual">${bars}</svg>`;
}

function renderCashflowSvg(summary) {
  const months = [...HISTORY_MONTHS, { month: 'Nov*', income: summary.totalIncome, spent: summary.totalSpent }];
  const maxVal = Math.max(...months.flatMap((m) => [m.income, m.spent]), 1000);
  const scale = (v) => Math.round((v / maxVal) * 116);
  const cols = months.map((m, i) => {
    const x = 18 + i * 64;
    const hInc = scale(m.income);
    const hSp = scale(m.spent);
    return `<rect x="${x}" y="${132 - hInc}" width="19" height="${hInc}" rx="3" fill="#1B6B50"/>
      <rect x="${x + 22}" y="${132 - hSp}" width="19" height="${hSp}" rx="3" fill="#C85A32"/>
      <text x="${x + 20}" y="150" font-size="11.5" text-anchor="middle" fill="#5B6675">${escHtml(m.month)}</text>`;
  }).join('');
  return `<svg class="svg-box" viewBox="0 0 400 160" role="img" aria-label="6-month income vs spending trend">
    <line x1="8" y1="132" x2="392" y2="132" stroke="#DFD9CD"/>
    ${cols}
  </svg>`;
}

function renderOverview() {
  const sum = computeSummary(state);
  const paidBills = state.bills.filter((b) => b.paid).length;
  const dueSoon = state.bills.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);
  const catOptions = CATEGORIES.map((c) => `<option value="${escHtml(c.id)}">${escHtml(c.id)}</option>`).join('');
  const topEnvelopes = CATEGORIES.slice(0, 5).map((cat) => {
    const spent = sum.spentByCategory[cat.id] ?? 0;
    const cap = state.caps[cat.id] ?? 0;
    const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : (spent > 0 ? 100 : 0);
    const cls = spent > cap ? 'bar-bad' : cap > 0 && spent >= cap * 0.85 ? 'bar-warn' : '';
    return `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12.5px">
        <span><strong>${escHtml(cat.id)}</strong></span>
        <span class="num">${fmtCurrency(spent)} / ${fmtCurrency(cap)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  const recentRows = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((t) => `<tr>
    <td>${escHtml(t.date.slice(5))}</td>
    <td>${escHtml(t.desc)}</td>
    <td><span class="badge ${t.type === 'income' ? 'badge-ok' : 'badge-terra'}">${escHtml(t.category)}</span></td>
    <td class="right">${t.type === 'income' ? '+' : '-'}${fmtCurrency(t.amount)}</td>
  </tr>`).join('');

  appEl.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Household Cashflow Overview</h1>
        <p>${escHtml(state.monthLabel)} live snapshot · ${paidBills}/${state.bills.length} recurring bills paid (${fmtCurrency(dueSoon)} remaining due)</p>
      </div>
      <div class="btn-group">
        <a class="btn btn-sm" href="#/envelopes">Tune Envelopes</a>
        <a class="btn btn-sm btn-primary" href="#/ledger">Open Full Ledger</a>
      </div>
    </div>

    <section class="kpi-grid" aria-label="Monthly KPIs">
      <div class="kpi kpi-good">
        <div class="kpi-label">Monthly Net Income</div>
        <div class="kpi-val">${fmtCurrency(sum.totalIncome)}</div>
        <div class="kpi-sub">${state.incomes.filter((i) => i.active).length} active streams + ${fmtCurrency(sum.ledgerIncome)} ledger</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Spent This Month</div>
        <div class="kpi-val">${fmtCurrency(sum.totalSpent)}</div>
        <div class="kpi-sub">${fmtCurrency(sum.sinkingSpent)} sinking transfer · ${sum.overCapCount} over cap</div>
      </div>
      <div class="kpi ${sum.surplus >= 0 ? 'kpi-good' : 'kpi-warn'}">
        <div class="kpi-label">Projected Surplus</div>
        <div class="kpi-val">${fmtCurrency(sum.surplus)}</div>
        <div class="kpi-sub">Unallocated cash after ${fmtCurrency(sum.totalSpent)} outflows</div>
      </div>
      <div class="kpi kpi-good">
        <div class="kpi-label">Savings Rate %</div>
        <div class="kpi-val">${fmtPercent(sum.savingsRate)}</div>
        <div class="kpi-sub">${fmtCurrency(sum.totalSavings)} total savings capacity</div>
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-head">
          <h2>50 / 30 / 20 Rule vs. Actual</h2>
          <span class="badge ${sum.overCapCount ? 'badge-warn' : 'badge-ok'}">Dashed line = target</span>
        </div>
        ${renderAllocationSvg(sum)}
      </div>
      <div class="card">
        <div class="card-head">
          <h2>6-Month Cashflow Trend</h2>
          <span class="muted">Nov* updates live</span>
        </div>
        ${renderCashflowSvg(sum)}
        <div class="legend">
          <span><i class="dot" style="background:#1B6B50"></i>Net Income</span>
          <span><i class="dot" style="background:#C85A32"></i>Monthly Outflows</span>
        </div>
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-head">
          <h2>Quick Expense / Income Logger</h2>
          <span class="muted">Recalculates all pages</span>
        </div>
        <form id="quick-entry-form">
          <div class="form-row">
            <div class="field"><label for="qe-type">Type</label><select id="qe-type"><option value="expense">Expense</option><option value="income">Income</option></select></div>
            <div class="field"><label for="qe-cat">Category</label><select id="qe-cat">${catOptions}</select></div>
            <div class="field"><label for="qe-amt">Amount ($)</label><input id="qe-amt" type="number" step="0.01" min="0.01" placeholder="45.00" required></div>
          </div>
          <div class="form-row" style="margin-top:8px">
            <div class="field" style="grid-column:span 2"><label for="qe-desc">Description</label><input id="qe-desc" type="text" maxlength="80" placeholder="e.g., Weekly farm stand produce" required></div>
            <div><button type="submit" class="btn btn-primary" style="width:100%">Log Entry</button></div>
          </div>
          <div class="err" id="qe-err" role="alert"></div>
        </form>
        <div class="table-wrap" style="margin-top:6px">
          <table><thead><tr><th>Date</th><th>Item</th><th>Category</th><th class="right">Amount</th></tr></thead><tbody>${recentRows}</tbody></table>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Envelope Pulse</h2>
          <a href="#/envelopes" class="muted">All ${CATEGORIES.length} envelopes →</a>
        </div>
        ${topEnvelopes}
        <div class="pill-row" style="margin-top:6px;border-top:1px solid var(--border);padding-top:8px">
          <span class="muted">Dining &amp; Leisure (${fmtCurrency(sum.spentByCategory['Dining & Leisure'])} / ${fmtCurrency(state.caps['Dining & Leisure'])})</span>
          <span class="badge ${sum.spentByCategory['Dining & Leisure'] > state.caps['Dining & Leisure'] ? 'badge-bad' : 'badge-ok'}">
            ${sum.spentByCategory['Dining & Leisure'] > state.caps['Dining & Leisure'] ? 'Over Cap' : 'On Track'}
          </span>
        </div>
      </div>
    </section>
  `;

  document.getElementById('quick-entry-form')?.addEventListener('submit', handleQuickEntry);
}

function handleQuickEntry(event) {
  event.preventDefault();
  const type = document.getElementById('qe-type').value === 'income' ? 'income' : 'expense';
  const category = document.getElementById('qe-cat').value;
  const amount = toMoney(document.getElementById('qe-amt').value, false);
  const desc = document.getElementById('qe-desc').value.trim();
  const errEl = document.getElementById('qe-err');
  if (!amount || !desc || !isValidCategory(category)) {
    errEl.textContent = 'Enter a valid category, description, and positive dollar amount.';
    return;
  }
  state.transactions.unshift({
    id: nextId('t'),
    date: '2026-11-26',
    desc,
    category,
    type,
    amount,
  });
  saveState(state);
  renderOverview();
}

const routeLoaders = {
  '/': async () => () => renderOverview(),
  '/envelopes': async () => {
    const { renderEnvelopes } = await import('./pages/envelopes.js');
    return () => renderEnvelopes(appEl, ctx);
  },
  '/ledger': async () => {
    const { renderLedger } = await import('./pages/ledger.js');
    return () => renderLedger(appEl, ctx);
  },
  '/goals': async () => {
    const { renderGoals } = await import('./pages/goals.js');
    return () => renderGoals(appEl, ctx);
  },
  '/guide': async () => {
    const { renderGuide } = await import('./pages/guide.js');
    return () => renderGuide(appEl, ctx);
  },
};

const ctx = {
  getState: () => state,
  setState: (next) => {
    state = next;
    saveState(state);
  },
  rerender: () => routePage(),
};

let routeSeq = 0;

async function routePage() {
  const seq = ++routeSeq;
  state = readState();
  const route = Object.hasOwn(routeLoaders, currentRoute()) ? currentRoute() : '/';
  updateNav(route);
  const render = await routeLoaders[route]();
  if (seq === routeSeq) render();
}

toggleEl?.addEventListener('click', () => {
  const open = navEl.classList.toggle('open');
  toggleEl.setAttribute('aria-expanded', String(open));
});

resetBtn?.addEventListener('click', () => {
  state = resetState();
  routePage();
});

globalThis.addEventListener('hashchange', () => routePage());
routePage();
