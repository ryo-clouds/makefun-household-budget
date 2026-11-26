// Envelopes & Scenarios page: editable category caps, 1-click presets, and income stream tuning.
import {
  CATEGORIES, computeSummary, escHtml, fmtCurrency, fmtPercent, toMoney,
} from '../data/budget.js';

const PRESETS = {
  baseline: {
    label: 'Baseline Month',
    note: 'Balanced household target caps',
    caps: {
      Housing: 2200,
      Groceries: 900,
      'Utilities & Internet': 340,
      'Transit & Fuel': 380,
      'Health & Childcare': 580,
      'Dining & Leisure': 650,
      'Sinking Funds': 1100,
    },
  },
  tighten: {
    label: 'Tighten Discretionary -15%',
    note: 'Trims Dining (-15%) & flexible needs (-8%)',
    caps: {
      Housing: 2200,
      Groceries: 830,
      'Utilities & Internet': 320,
      'Transit & Fuel': 340,
      'Health & Childcare': 540,
      'Dining & Leisure': 550,
      'Sinking Funds': 1100,
    },
  },
  boost: {
    label: 'Boost Emergency Fund',
    note: 'Redirects leisure savings into Sinking Funds',
    caps: {
      Housing: 2200,
      Groceries: 820,
      'Utilities & Internet': 330,
      'Transit & Fuel': 350,
      'Health & Childcare': 560,
      'Dining & Leisure': 480,
      'Sinking Funds': 1450,
    },
  },
};

function statusOf(spent, cap) {
  if (cap <= 0 || spent > cap) return { cls: 'badge-bad', bar: 'bar-bad', text: `Over by ${fmtCurrency(spent - cap)}` };
  const ratio = spent / cap;
  if (ratio >= 0.85) return { cls: 'badge-warn', bar: 'bar-warn', text: `${Math.round(ratio * 100)}% used · Watch` };
  return { cls: 'badge-ok', bar: '', text: `${Math.round(ratio * 100)}% used · Healthy` };
}

export function renderEnvelopes(root, ctx) {
  const state = ctx.getState();
  const sum = computeSummary(state);

  const presetBtns = Object.entries(PRESETS).map(([key, p]) => `
    <button type="button" class="btn ${state.activePreset === key ? 'btn-primary' : ''}" data-preset="${key}">
      ${escHtml(p.label)}
    </button>
  `).join('');

  const envelopeCards = CATEGORIES.map((cat) => {
    const spent = sum.spentByCategory[cat.id] ?? 0;
    const cap = state.caps[cat.id] ?? 0;
    const st = statusOf(spent, cap);
    const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 100;
    const rem = cap - spent;
    return `
      <div class="card">
        <div class="card-head">
          <div>
            <h2>${escHtml(cat.id)}</h2>
            <span class="muted">${escHtml(cat.note)} · <strong>${escHtml(cat.bucket.toUpperCase())}</strong></span>
          </div>
          <span class="badge ${st.cls}">${escHtml(st.text)}</span>
        </div>
        <div class="bar-track"><div class="bar-fill ${st.bar}" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:10px;flex-wrap:wrap">
          <div class="num" style="font-size:13px">
            Spent: <strong>${fmtCurrency(spent)}</strong> ·
            ${rem >= 0 ? `<span style="color:var(--emerald)">${fmtCurrency(rem)} left</span>` : `<span style="color:var(--crimson)">${fmtCurrency(Math.abs(rem))} over</span>`}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <label class="muted" for="cap-${escHtml(cat.id)}">Cap $</label>
            <input id="cap-${escHtml(cat.id)}" data-cap-cat="${escHtml(cat.id)}" type="number" min="0" step="10" value="${cap}" style="width:96px">
          </div>
        </div>
      </div>
    `;
  }).join('');

  const incomeRows = state.incomes.map((inc) => `
    <div class="pill-row">
      <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
        <input type="checkbox" data-inc-toggle="${escHtml(inc.id)}" ${inc.active ? 'checked' : ''} style="width:auto">
        <span><strong>${escHtml(inc.name)}</strong></span>
      </label>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="muted">$</span>
        <input type="number" min="0" step="25" data-inc-amt="${escHtml(inc.id)}" value="${inc.amount}" style="width:105px">
      </div>
    </div>
  `).join('');

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Budget Envelopes &amp; Scenarios</h1>
        <p>Total Monthly Caps: <strong class="num">${fmtCurrency(sum.totalCaps)}</strong> vs. Net Income <strong class="num">${fmtCurrency(sum.totalIncome)}</strong> · Unallocated Buffer: <strong class="num">${fmtCurrency(sum.totalIncome - sum.totalCaps)}</strong></p>
      </div>
      <div class="btn-group">${presetBtns}</div>
    </div>

    <section class="grid-2" style="margin-bottom:14px">
      <div class="card">
        <div class="card-head">
          <h2>Monthly Income Streams</h2>
          <span class="badge badge-ok">${fmtCurrency(sum.totalIncome)} total</span>
        </div>
        ${incomeRows}
        <p class="muted" style="margin:8px 0 0">Plus ${fmtCurrency(sum.ledgerIncome)} in ledger income · Savings Rate: <strong>${fmtPercent(sum.savingsRate)}</strong></p>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Scenario Summary</h2>
          <span class="badge badge-terra">${escHtml(PRESETS[state.activePreset]?.label ?? 'Custom Caps')}</span>
        </div>
        <p style="margin:0 0 8px">Adjust any category cap or income stream below. Changes persist locally and immediately recalculate KPIs across Overview, Ledger, and Goals.</p>
        <div class="pill-row"><span>Committed Envelope Caps</span><strong class="num">${fmtCurrency(sum.totalCaps)}</strong></div>
        <div class="pill-row"><span>Actual Month-to-Date Outflows</span><strong class="num">${fmtCurrency(sum.totalSpent)}</strong></div>
        <div class="pill-row"><span>Projected Monthly Surplus</span><strong class="num" style="color:var(--emerald)">${fmtCurrency(sum.surplus)}</strong></div>
      </div>
    </section>

    <section class="grid-eq">${envelopeCards}</section>
  `;

  for (const btn of root.querySelectorAll('[data-preset]')) {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-preset');
      const preset = PRESETS[key];
      if (!preset) return;
      const next = ctx.getState();
      next.activePreset = key;
      next.caps = { ...preset.caps };
      ctx.setState(next);
      renderEnvelopes(root, ctx);
    });
  }

  for (const input of root.querySelectorAll('[data-cap-cat]')) {
    input.addEventListener('change', () => {
      const cat = input.getAttribute('data-cap-cat');
      const val = toMoney(input.value, true);
      if (val === null) {
        input.value = String(ctx.getState().caps[cat] ?? 0);
        return;
      }
      const next = ctx.getState();
      next.caps[cat] = val;
      next.activePreset = 'custom';
      ctx.setState(next);
      renderEnvelopes(root, ctx);
    });
  }

  for (const chk of root.querySelectorAll('[data-inc-toggle]')) {
    chk.addEventListener('change', () => {
      const id = chk.getAttribute('data-inc-toggle');
      const next = ctx.getState();
      const target = next.incomes.find((i) => i.id === id);
      if (target) target.active = chk.checked;
      ctx.setState(next);
      renderEnvelopes(root, ctx);
    });
  }

  for (const amtInput of root.querySelectorAll('[data-inc-amt]')) {
    amtInput.addEventListener('change', () => {
      const id = amtInput.getAttribute('data-inc-amt');
      const val = toMoney(amtInput.value, true);
      const next = ctx.getState();
      const target = next.incomes.find((i) => i.id === id);
      if (val === null || !target) {
        amtInput.value = String(target?.amount ?? 0);
        return;
      }
      target.amount = val;
      ctx.setState(next);
      renderEnvelopes(root, ctx);
    });
  }
}
