// Shared household budget state, safe storage, HTML escaping, currency validation, and live KPI calculations.
const STORAGE_KEY = 'hearthledger_v1';

export const CATEGORIES = [
  { id: 'Housing', bucket: 'needs', note: 'Mortgage, rent, escrow' },
  { id: 'Groceries', bucket: 'needs', note: 'Market, pantry, produce' },
  { id: 'Utilities & Internet', bucket: 'needs', note: 'Power, water, fiber' },
  { id: 'Transit & Fuel', bucket: 'needs', note: 'Fuel, tolls, passes' },
  { id: 'Health & Childcare', bucket: 'needs', note: 'Care, dental, pharmacy' },
  { id: 'Dining & Leisure', bucket: 'wants', note: 'Dining out, family outings' },
  { id: 'Sinking Funds', bucket: 'savings', note: 'Reserves & irregulars' },
];

export const HISTORY_MONTHS = [
  { month: 'Jun', income: 7450, spent: 5490 },
  { month: 'Jul', income: 7520, spent: 5840 },
  { month: 'Aug', income: 7600, spent: 5610 },
  { month: 'Sep', income: 7580, spent: 5420 },
  { month: 'Oct', income: 7720, spent: 5790 },
];

export function createDefaultState() {
  return {
    monthLabel: 'Nov 2026',
    activePreset: 'baseline',
    incomes: [
      { id: 'inc-1', name: 'Primary Paycheck', amount: 4400, active: true },
      { id: 'inc-2', name: 'Partner Salary', amount: 2850, active: true },
      { id: 'inc-3', name: 'Side Consulting', amount: 330, active: true },
    ],
    caps: {
      Housing: 2200,
      Groceries: 900,
      'Utilities & Internet': 340,
      'Transit & Fuel': 380,
      'Health & Childcare': 580,
      'Dining & Leisure': 650,
      'Sinking Funds': 1100,
    },
    transactions: [
      { id: 't1', date: '2026-11-01', desc: 'Mortgage & Property Escrow', category: 'Housing', type: 'expense', amount: 2200 },
      { id: 't2', date: '2026-11-02', desc: 'Aldi & Farmers Market', category: 'Groceries', type: 'expense', amount: 264 },
      { id: 't3', date: '2026-11-03', desc: 'City Electric & Natural Gas', category: 'Utilities & Internet', type: 'expense', amount: 172 },
      { id: 't4', date: '2026-11-04', desc: 'Metro Fiber Internet', category: 'Utilities & Internet', type: 'expense', amount: 85 },
      { id: 't5', date: '2026-11-05', desc: 'After-School Care Tuition', category: 'Health & Childcare', type: 'expense', amount: 390 },
      { id: 't6', date: '2026-11-06', desc: 'Neighborhood Bistro & Cinema', category: 'Dining & Leisure', type: 'expense', amount: 188 },
      { id: 't7', date: '2026-11-08', desc: 'Health FSA Reimbursement', category: 'Health & Childcare', type: 'income', amount: 220 },
      { id: 't8', date: '2026-11-09', desc: 'Whole Foods Weekly Haul', category: 'Groceries', type: 'expense', amount: 248 },
      { id: 't9', date: '2026-11-11', desc: 'Fuel & Commuter Pass', category: 'Transit & Fuel', type: 'expense', amount: 165 },
      { id: 't10', date: '2026-11-13', desc: 'Municipal Water & Trash', category: 'Utilities & Internet', type: 'expense', amount: 61 },
      { id: 't11', date: '2026-11-14', desc: 'Family Pizza & Zoo Outing', category: 'Dining & Leisure', type: 'expense', amount: 245 },
      { id: 't12', date: '2026-11-16', desc: 'Pediatric Dental Co-pay', category: 'Health & Childcare', type: 'expense', amount: 115 },
      { id: 't13', date: '2026-11-18', desc: 'Auto Transfer: Emergency & Home', category: 'Sinking Funds', type: 'expense', amount: 950 },
      { id: 't14', date: '2026-11-20', desc: "Trader Joe's Pantry Restock", category: 'Groceries', type: 'expense', amount: 236 },
      { id: 't15', date: '2026-11-22', desc: 'Weekend Coffee & Kids Books', category: 'Dining & Leisure', type: 'expense', amount: 262 },
      { id: 't16', date: '2026-11-24', desc: 'Highway Toll & Shell Fuel', category: 'Transit & Fuel', type: 'expense', amount: 100 },
    ],
    bills: [
      { id: 'b1', name: 'Mortgage & Escrow', dueDay: 1, amount: 2200, category: 'Housing', paid: true },
      { id: 'b2', name: 'City Electric & Gas', dueDay: 3, amount: 172, category: 'Utilities & Internet', paid: true },
      { id: 'b3', name: 'Metro Fiber Internet', dueDay: 4, amount: 85, category: 'Utilities & Internet', paid: true },
      { id: 'b4', name: 'After-School Care', dueDay: 5, amount: 390, category: 'Health & Childcare', paid: true },
      { id: 'b5', name: 'Municipal Water & Trash', dueDay: 13, amount: 61, category: 'Utilities & Internet', paid: true },
      { id: 'b6', name: 'Family Auto Insurance', dueDay: 28, amount: 168, category: 'Transit & Fuel', paid: false },
    ],
    goals: [
      { id: 'g1', name: 'Emergency Fund (6-Mo Runway)', target: 24000, saved: 15600, monthly: 650 },
      { id: 'g2', name: 'Home Repair Sinking Fund', target: 6000, saved: 3450, monthly: 250 },
      { id: 'g3', name: 'Summer Family Travel', target: 3600, saved: 1620, monthly: 200 },
    ],
    debts: [
      { id: 'd1', name: 'Auto Loan', balance: 9400, apr: 5.4, minPayment: 285 },
      { id: 'd2', name: 'Home HVAC Financing', balance: 3200, apr: 8.9, minPayment: 125 },
      { id: 'd3', name: 'Family Credit Card', balance: 1850, apr: 19.9, minPayment: 75 },
      { id: 'd4', name: 'Student Loan', balance: 6100, apr: 4.5, minPayment: 145 },
    ],
    extraDebtPayment: 300,
    debtStrategy: 'avalanche',
  };
}

let memoryFallback = null;

export function escHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
  ));
}

export function toMoney(raw, allowZero = false) {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (!Number.isFinite(n)) return null;
  if (allowZero ? n < 0 : n <= 0) return null;
  return Math.round(n * 100) / 100;
}

export function fmtCurrency(amount, decimals = 0) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}$${Math.abs(safe).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtPercent(ratio) {
  const safe = Number.isFinite(ratio) ? ratio : 0;
  return `${(safe * 100).toFixed(1)}%`;
}

export function readState() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.transactions) && parsed.caps) return parsed;
    }
  } catch {
    // Graceful fallback when localStorage is unavailable.
  }
  if (!memoryFallback) memoryFallback = createDefaultState();
  return structuredClone(memoryFallback);
}

export function saveState(state) {
  memoryFallback = structuredClone(state);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep memoryFallback when storage writes are blocked.
  }
}

export function resetState() {
  const fresh = createDefaultState();
  saveState(fresh);
  return fresh;
}

export function computeSummary(state) {
  const baseIncome = state.incomes.reduce((sum, inc) => sum + (inc.active && Number.isFinite(inc.amount) ? inc.amount : 0), 0);
  const ledgerIncome = state.transactions.reduce((sum, t) => sum + (t.type === 'income' && Number.isFinite(t.amount) ? t.amount : 0), 0);
  const totalIncome = baseIncome + ledgerIncome;

  const spentByCategory = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  let totalSpent = 0;
  for (const t of state.transactions) {
    if (t.type === 'expense' && Number.isFinite(t.amount) && t.amount > 0) {
      totalSpent += t.amount;
      if (Object.hasOwn(spentByCategory, t.category)) spentByCategory[t.category] += t.amount;
    }
  }

  let needsSpent = 0;
  let wantsSpent = 0;
  let sinkingSpent = 0;
  let totalCaps = 0;
  for (const cat of CATEGORIES) {
    const spent = spentByCategory[cat.id] ?? 0;
    const cap = Number.isFinite(state.caps[cat.id]) ? state.caps[cat.id] : 0;
    totalCaps += cap;
    if (cat.bucket === 'needs') needsSpent += spent;
    else if (cat.bucket === 'wants') wantsSpent += spent;
    else sinkingSpent += spent;
  }

  const surplus = totalIncome - totalSpent;
  const totalSavings = sinkingSpent + Math.max(0, surplus);
  const savingsRate = totalIncome > 0 ? totalSavings / totalIncome : 0;
  const overCapCount = CATEGORIES.filter((c) => (spentByCategory[c.id] ?? 0) > (state.caps[c.id] ?? 0)).length;

  return {
    baseIncome,
    ledgerIncome,
    totalIncome,
    totalSpent,
    totalCaps,
    surplus,
    sinkingSpent,
    totalSavings,
    savingsRate,
    needsSpent,
    wantsSpent,
    spentByCategory,
    overCapCount,
  };
}
