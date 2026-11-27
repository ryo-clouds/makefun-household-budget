// Household Budgeting Guide page tailored with live numbers from the user's current plan.
import { computeSummary, escHtml, fmtCurrency, fmtPercent } from '../data/budget.js';

export function renderGuide(root, ctx) {
  const state = ctx.getState();
  const sum = computeSummary(state);
  const emergencyTarget3 = Math.round(sum.needsSpent * 3);
  const emergencyTarget6 = Math.round(sum.needsSpent * 6);
  const emergencyGoal = state.goals.find((g) => g.id === 'g1');
  const funded = emergencyGoal ? emergencyGoal.saved : 0;

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Household Budgeting Playbook</h1>
        <p>Practical rules of thumb grounded in your live ${escHtml(state.monthLabel)} figures.</p>
      </div>
      <a class="btn btn-sm btn-primary" href="#/">Back to Overview</a>
    </div>

    <section class="grid-eq">
      <div class="card">
        <div class="card-head">
          <h2>1. The 50 / 30 / 20 Cashflow Rule</h2>
          <span class="badge badge-ok">Your rate: ${fmtPercent(sum.savingsRate)}</span>
        </div>
        <p>Divide net take-home pay (<strong class="num">${fmtCurrency(sum.totalIncome)}</strong>) into three resilient buckets:</p>
        <div class="pill-row"><span><strong>50% Needs</strong> (Housing, groceries, utilities, care)</span><span class="num">${fmtCurrency(sum.needsSpent)} / ${fmtCurrency(sum.totalIncome * 0.5)}</span></div>
        <div class="pill-row"><span><strong>30% Wants</strong> (Dining, travel, family leisure)</span><span class="num">${fmtCurrency(sum.wantsSpent)} / ${fmtCurrency(sum.totalIncome * 0.3)}</span></div>
        <div class="pill-row"><span><strong>20% Savings &amp; Extra Debt</strong> (Sinking + surplus)</span><span class="num">${fmtCurrency(sum.totalSavings)} / ${fmtCurrency(sum.totalIncome * 0.2)}</span></div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>2. Emergency Buffer Targets</h2>
          <span class="badge badge-terra">Funded: ${fmtCurrency(funded)}</span>
        </div>
        <p>Size your cash runway around essential monthly obligations (<strong class="num">${fmtCurrency(sum.needsSpent)}/mo</strong>) rather than gross income:</p>
        <div class="pill-row"><span>Starter 3-Month Essentials Runway</span><strong class="num">${fmtCurrency(emergencyTarget3)}</strong></div>
        <div class="pill-row"><span>Full 6-Month Family Resilience Target</span><strong class="num">${fmtCurrency(emergencyTarget6)}</strong></div>
        <p class="muted" style="margin:8px 0 0">Tip: Keep the emergency buffer in a liquid high-yield account separate from day-to-day checking.</p>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>3. Irregular Bill &amp; Sinking Smoothing</h2>
          <span class="badge badge-ok">Monthly transfer: ${fmtCurrency(sum.sinkingSpent)}</span>
        </div>
        <p>Annual property maintenance, auto registration, school fees, and holiday gifts break monthly budgets when treated as surprises. Total each annual item and divide by 12 into a dedicated <strong>Sinking Funds</strong> envelope.</p>
        <p class="muted" style="margin:0">Example: $2,400 home upkeep + $1,800 summer travel + $1,200 gifts = $5,400/yr → $450/mo steady transfer.</p>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>4. Local-Only Privacy &amp; Portability</h2>
          <span class="badge badge-ok">Zero Network Calls</span>
        </div>
        <p>HearthLedger runs 100% offline in your browser with no external scripts, analytics, or remote servers. Edits persist in local storage, and you can export full RFC 4180 CSV or JSON snapshots anytime on the <a href="#/ledger">Ledger &amp; Bills</a> page.</p>
      </div>
    </section>
  `;
}
