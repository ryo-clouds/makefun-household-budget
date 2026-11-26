// Savings Goals Tracker and Avalanche vs. Snowball Debt Payoff Simulator.
import { computeSummary, escHtml, fmtCurrency, toMoney } from '../data/budget.js';

function simulatePayoff(debts, extraMonthly, strategy) {
  const items = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, rem: d.balance }));
  if (items.length === 0) return { months: 0, totalInterest: 0, curve: [0] };

  let months = 0;
  let totalInterest = 0;
  const curve = [items.reduce((s, d) => s + d.rem, 0)];
  const totalBudget = items.reduce((s, d) => s + d.minPayment, 0) + Math.max(0, extraMonthly);

  while (items.some((d) => d.rem > 0.01) && months < 360) {
    months += 1;
    for (const d of items) {
      if (d.rem <= 0) continue;
      const interest = d.rem * (d.apr / 100 / 12);
      totalInterest += interest;
      d.rem += interest;
    }
    let pool = totalBudget;
    for (const d of items) {
      if (d.rem <= 0) continue;
      const pay = Math.min(d.rem, d.minPayment, pool);
      d.rem -= pay;
      pool -= pay;
    }
    const ordered = items.filter((d) => d.rem > 0.01).sort((a, b) => (
      strategy === 'avalanche' ? b.apr - a.apr : a.rem - b.rem
    ));
    for (const d of ordered) {
      if (pool <= 0.01) break;
      const pay = Math.min(d.rem, pool);
      d.rem -= pay;
      pool -= pay;
    }
    curve.push(Math.max(0, items.reduce((s, d) => s + d.rem, 0)));
  }
  return { months, totalInterest: Math.round(totalInterest), curve };
}

function renderDebtCurveSvg(av, sn, minOnly, strategy) {
  const maxMonths = Math.max(av.curve.length - 1, sn.curve.length - 1, minOnly.curve.length - 1, 1);
  const maxBal = Math.max(av.curve[0] ?? 1000, 1000);
  const toPath = (curve) => curve.map((val, m) => {
    const x = 52 + (m / maxMonths) * 394;
    const y = 14 + (1 - val / maxBal) * 136;
    return `${m === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const isSnow = strategy === 'snowball';

  return `<svg class="svg-box" viewBox="0 0 460 175" role="img" aria-label="Debt payoff curve comparing Avalanche vs Snowball">
    <line x1="52" y1="150" x2="446" y2="150" stroke="#DFD9CD"/>
    <line x1="52" y1="14" x2="52" y2="150" stroke="#DFD9CD"/>
    <text x="47" y="20" font-size="10.5" text-anchor="end" fill="#5B6675">${fmtCurrency(maxBal)}</text>
    <text x="47" y="152" font-size="10.5" text-anchor="end" fill="#5B6675">$0</text>
    <text x="52" y="166" font-size="10.5" fill="#5B6675">Mo 0</text>
    <text x="446" y="166" font-size="10.5" text-anchor="end" fill="#5B6675">Mo ${maxMonths}</text>
    <path d="${toPath(minOnly.curve)}" fill="none" stroke="#8C96A3" stroke-width="1.8" stroke-dasharray="4,3"/>
    <path d="${toPath(sn.curve)}" fill="none" stroke="#C85A32" stroke-width="${isSnow ? '3.4' : '1.9'}" opacity="${isSnow ? '1' : '0.7'}"/>
    <path d="${toPath(av.curve)}" fill="none" stroke="#1B6B50" stroke-width="${isSnow ? '1.9' : '3.4'}" opacity="${isSnow ? '0.7' : '1'}"/>
  </svg>`;
}

export function renderGoals(root, ctx) {
  const state = ctx.getState();
  const sum = computeSummary(state);
  const extra = Number.isFinite(state.extraDebtPayment) ? state.extraDebtPayment : 0;

  const avalanche = simulatePayoff(state.debts, extra, 'avalanche');
  const snowball = simulatePayoff(state.debts, extra, 'snowball');
  const minimumOnly = simulatePayoff(state.debts, 0, 'avalanche');
  const totalDebt = state.debts.reduce((s, d) => s + d.balance, 0);

  const goalCards = state.goals.map((g) => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 100;
    const rem = Math.max(0, g.target - g.saved);
    const monthsLeft = g.monthly > 0 ? Math.ceil(rem / g.monthly) : 0;
    return `
      <div class="card">
        <div class="card-head">
          <h2>${escHtml(g.name)}</h2>
          <span class="badge badge-ok">${pct}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;margin:6px 0 10px">
          <span class="num"><strong>${fmtCurrency(g.saved)}</strong> of ${fmtCurrency(g.target)}</span>
          <span class="muted">${rem === 0 ? 'Funded!' : `${monthsLeft} mo @ ${fmtCurrency(g.monthly)}/mo`}</span>
        </div>
        <div class="btn-group">
          <button type="button" class="btn btn-sm" data-goal-add="${escHtml(g.id)}" data-amt="100">+ $100</button>
          <button type="button" class="btn btn-sm btn-primary" data-goal-add="${escHtml(g.id)}" data-amt="250">+ $250</button>
        </div>
      </div>
    `;
  }).join('');

  const debtRows = state.debts.map((d) => `
    <tr>
      <td><strong>${escHtml(d.name)}</strong></td>
      <td class="right">${fmtCurrency(d.balance)}</td>
      <td class="right">${d.apr.toFixed(1)}%</td>
      <td class="right">${fmtCurrency(d.minPayment)}</td>
    </tr>
  `).join('');

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Savings Goals &amp; Debt Payoff Simulator</h1>
        <p>Current monthly surplus available to allocate: <strong class="num">${fmtCurrency(sum.surplus)}</strong> · Total Debt: <strong class="num">${fmtCurrency(totalDebt)}</strong></p>
      </div>
      <div class="btn-group">
        <button type="button" class="btn btn-sm ${state.debtStrategy === 'avalanche' ? 'btn-primary' : ''}" data-strat="avalanche">Highlight Avalanche</button>
        <button type="button" class="btn btn-sm ${state.debtStrategy === 'snowball' ? 'btn-accent' : ''}" data-strat="snowball">Highlight Snowball</button>
      </div>
    </div>

    <section class="grid-3">${goalCards}</section>

    <section class="grid-2">
      <div class="card">
        <div class="card-head">
          <h2>Avalanche vs. Snowball Curve</h2>
          <span class="badge badge-ok">Extra: ${fmtCurrency(extra)}/mo</span>
        </div>
        <div class="field" style="margin-bottom:10px">
          <label for="extra-debt-range">Extra Monthly Payment Toward Debt: <strong class="num">${fmtCurrency(extra)}/mo</strong></label>
          <input id="extra-debt-range" type="range" min="0" max="1500" step="50" value="${extra}">
        </div>
        ${renderDebtCurveSvg(avalanche, snowball, minimumOnly, state.debtStrategy)}
        <div class="legend">
          <span><i class="dot" style="background:#1B6B50"></i>Avalanche (${avalanche.months} mo · ${fmtCurrency(avalanche.totalInterest)} interest)</span>
          <span><i class="dot" style="background:#C85A32"></i>Snowball (${snowball.months} mo · ${fmtCurrency(snowball.totalInterest)} interest)</span>
          <span><i class="dot" style="background:#8C96A3"></i>Minimums only (${minimumOnly.months} mo · ${fmtCurrency(minimumOnly.totalInterest)} interest)</span>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Household Balances &amp; Savings</h2>
          <span class="badge badge-terra">Saves ${fmtCurrency(minimumOnly.totalInterest - (state.debtStrategy === 'snowball' ? snowball.totalInterest : avalanche.totalInterest))} via ${state.debtStrategy === 'snowball' ? 'Snowball' : 'Avalanche'}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Account</th><th class="right">Balance</th><th class="right">APR</th><th class="right">Min / Mo</th></tr></thead>
            <tbody>${debtRows}</tbody>
          </table>
        </div>
        <div class="pill-row" style="margin-top:8px">
          <span>Avalanche vs. Snowball Interest Difference</span>
          <strong class="num" style="color:var(--emerald)">${fmtCurrency(snowball.totalInterest - avalanche.totalInterest)} saved</strong>
        </div>
        <form id="custom-goal-form" style="margin-top:10px">
          <div class="form-row">
            <div class="field"><label for="cg-select">Custom Contribution</label><select id="cg-select">${state.goals.map((g) => `<option value="${escHtml(g.id)}">${escHtml(g.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="cg-amt">Amount ($)</label><input id="cg-amt" type="number" min="1" step="1" placeholder="150" required></div>
            <div><button type="submit" class="btn btn-primary" style="width:100%">Contribute</button></div>
          </div>
        </form>
      </div>
    </section>
  `;

  for (const btn of root.querySelectorAll('[data-goal-add]')) {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-goal-add');
      const amt = toMoney(btn.getAttribute('data-amt'), false);
      if (!amt) return;
      const next = ctx.getState();
      const goal = next.goals.find((g) => g.id === id);
      if (goal) goal.saved += amt;
      ctx.setState(next);
      renderGoals(root, ctx);
    });
  }

  document.getElementById('custom-goal-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('cg-select').value;
    const amt = toMoney(document.getElementById('cg-amt').value, false);
    if (!amt) return;
    const next = ctx.getState();
    const goal = next.goals.find((g) => g.id === id);
    if (goal) goal.saved += amt;
    ctx.setState(next);
    renderGoals(root, ctx);
  });

  document.getElementById('extra-debt-range')?.addEventListener('input', (e) => {
    const val = toMoney(e.target.value, true);
    if (val === null) return;
    const next = ctx.getState();
    next.extraDebtPayment = val;
    ctx.setState(next);
    renderGoals(root, ctx);
    document.getElementById('extra-debt-range')?.focus();
  });

  for (const btn of root.querySelectorAll('[data-strat]')) {
    btn.addEventListener('click', () => {
      const next = ctx.getState();
      next.debtStrategy = btn.getAttribute('data-strat') === 'snowball' ? 'snowball' : 'avalanche';
      ctx.setState(next);
      renderGoals(root, ctx);
    });
  }
}
