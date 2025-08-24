// ---- Config ----
const TELEGRAM_URL = 'https://t.me/YourTelegramGroup'; // replace with your actual group URL
const DAILY_RATE = 0.10;
const PACKAGES = [10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
const UGX = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 });
const fmt = n => UGX.format(Math.round(n));
const LS_KEY = 'bigmoney_users';
const LS_THEME = 'bigmoney_theme';

// ---- State ----
let currentUser = null;

// ---- Storage helpers ----
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function saveUsers(users) {
  localStorage.setItem(LS_KEY, JSON.stringify(users));
}
function makeReferralCode(email) {
  const base = btoa(email).replace(/[^A-Za-z0-9]/g,'').slice(0,8).toUpperCase();
  return 'BM-' + base;
}
function makeUID(email) {
  // stable numeric-ish UID from email
  let hash = 0; for (let i=0;i<email.length;i++) hash = (hash*31 + email.charCodeAt(i))|0;
  const id = Math.abs(hash).toString().padStart(6,'0').slice(0,6);
  return `UID-${id}`;
}
function createUser(email, password, referredBy=null) {
  const code = makeReferralCode(email);
  return {
    email,
    password, // demo only — do NOT store plaintext in production
    uid: makeUID(email),
    balance: 0,
    investments: [],
    referrals: { code, referredCount: 0, referredBy },
    tx: []
  };
}
function seedDemoUser() {
  const users = loadUsers();
  const email = 'brunomujuni6@gmail.com';
  if (!users[email]) {
    users[email] = createUser(email, '12345');
    saveUsers(users);
  }
}
function saveCurrentUser() {
  if (!currentUser) return;
  const users = loadUsers();
  users[currentUser.email] = currentUser;
  saveUsers(users);
}
function findByReferral(code) {
  const users = loadUsers();
  return Object.values(users).find(u => u.referrals.code === code) || null;
}

// ---- Time / returns ----
function daysBetween(from, to) {
  const ms = Math.max(0, to - from);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
function currentInvestmentValue(inv, now=Date.now()) {
  const d = daysBetween(inv.startAt, now);
  return inv.amount * Math.pow(1 + DAILY_RATE, d);
}

// ---- DOM refs ----
const appHeader = document.getElementById('app-header');
const uidChip = document.getElementById('uid-chip');
const menuBtn = document.getElementById('menu-btn');
const tabbar = document.getElementById('tabbar');

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupReferral = document.getElementById('signup-referral');

const kpiBalance = document.getElementById('kpi-balance');
const kpiActive = document.getElementById('kpi-active');
const kpiTotal = document.getElementById('kpi-total');

const depositAmt = document.getElementById('deposit-amount');
const depositBtn = document.getElementById('deposit-btn');
const withdrawAmt = document.getElementById('withdraw-amount');
const withdrawBtn = document.getElementById('withdraw-btn');

const packagesEl = document.getElementById('packages');
const invListEl = document.getElementById('investments-list');
const txListEl = document.getElementById('tx-list');

const refCodeEl = document.getElementById('ref-code');
const refCountEl = document.getElementById('ref-count');
const refLinkInput = document.getElementById('ref-link');
const copyRefBtn = document.getElementById('copy-ref-link');
const shareNativeBtn = document.getElementById('share-native');
const shareWABtn = document.getElementById('share-whatsapp');
const shareTGBtn = document.getElementById('share-telegram');

const telegramLink = document.getElementById('telegram-link');
const menuTelegram = document.getElementById('menu-telegram');

const profileEmail = document.getElementById('profile-email');
const profileUID = document.getElementById('profile-uid');
const profileReferredBy = document.getElementById('profile-referred-by');
const notifToggle = document.getElementById('notif-toggle');
const themeToggle = document.getElementById('theme-toggle');

// Sheet
const sheet = document.getElementById('sheet');
const sheetBackdrop = document.getElementById('sheet-backdrop');
const logoutBtn = document.getElementById('logout-btn');

// ---- Tabs (auth) ----
loginTab.addEventListener('click', () => {
  loginTab.classList.add('active'); signupTab.classList.remove('active');
  loginForm.classList.add('active'); signupForm.classList.remove('active');
});
signupTab.addEventListener('click', () => {
  signupTab.classList.add('active'); loginTab.classList.remove('active');
  signupForm.classList.add('active'); loginForm.classList.remove('active');
});

// ---- Auth handlers ----
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim().toLowerCase();
  const pwd = loginPassword.value;
  const users = loadUsers();
  if (!users[email] || users[email].password !== pwd) {
    alert('Invalid email or password'); return;
  }
  currentUser = users[email];
  enterApp();
});

signupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = signupEmail.value.trim().toLowerCase();
  const pwd = signupPassword.value;
  const code = (signupReferral.value || '').trim().toUpperCase();
  if (!email || !pwd) { alert('Enter email and password'); return; }
  const users = loadUsers();
  if (users[email]) { alert('Account already exists'); return; }

  let referredBy = null;
  if (code) {
    const refUser = findByReferral(code);
    if (!refUser) { alert('Referral code not found'); return; }
    referredBy = refUser.email;
    refUser.referrals.referredCount = (refUser.referrals.referredCount || 0) + 1;
    users[refUser.email] = refUser;
  }
  users[email] = createUser(email, pwd, referredBy);
  saveUsers(users);
  loginEmail.value = email;
  loginPassword.value = pwd;
  loginTab.click();
  alert('Account created. You can now log in.');
});

// ---- Enter / Exit app ----
function enterApp() {
  // UI switches
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  appHeader.classList.remove('hidden');
  tabbar.classList.remove('hidden');

  // Links setup
  telegramLink.href = TELEGRAM_URL;
  menuTelegram.href = TELEGRAM_URL;

  // Header UID
  uidChip.textContent = currentUser.uid;

  // Theme
  const theme = localStorage.getItem(LS_THEME) || 'dark';
  setTheme(theme);

  // Render
  renderAll();
  // Default to dashboard
  showPage('dashboard');
}
function logout() {
  currentUser = null;
  appHeader.classList.add('hidden');
  tabbar.classList.add('hidden');
  appScreen.classList.add('hidden');
  authScreen.classList.remove('hidden');
  closeSheet();
}

// ---- Theme ----
function setTheme(mode) {
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.add('light'); document.body.classList.add('light');
    themeToggle.checked = false;
  } else {
    root.classList.remove('light'); document.body.classList.remove('light');
    themeToggle.checked = true; // toggle means "dark theme"
  }
  localStorage.setItem(LS_THEME, mode);
}
if (themeToggle) {
  themeToggle.addEventListener('change', () => {
    setTheme(themeToggle.checked ? 'dark' : 'light');
  });
}

// ---- Wallet actions ----
depositBtn.addEventListener('click', () => {
  const amt = Number(depositAmt.value);
  if (!amt || amt <= 0) return;
  currentUser.balance += amt;
  currentUser.tx.unshift({ type: 'deposit', amount: amt, time: Date.now(), note: 'Wallet deposit' });
  saveCurrentUser();
  depositAmt.value = '';
  renderWallet(); renderTx();
});

withdrawBtn.addEventListener('click', () => {
  const amt = Number(withdrawAmt.value);
  if (!amt || amt <= 0) return;
  if (amt > currentUser.balance) { alert('Insufficient balance'); return; }
  currentUser.balance -= amt;
  currentUser.tx.unshift({ type: 'withdraw', amount: amt, time: Date.now(), note: 'Wallet withdrawal (simulated)' });
  saveCurrentUser();
  withdrawAmt.value = '';
  renderWallet(); renderTx();
});

// ---- Packages & invest ----
function renderPackages() {
  packagesEl.innerHTML = '';
  PACKAGES.forEach(amount => {
    const card = document.createElement('div');
    card.className = 'pkg';
    const est1Day = amount * DAILY_RATE;
    card.innerHTML = `
      <h4>${fmt(amount)}</h4>
      <div class="yield">+${fmt(est1Day)} daily (10%)</div>
      <button class="btn btn-primary">Invest ${fmt(amount)}</button>
    `;
    card.querySelector('button').addEventListener('click', () => invest(amount));
    packagesEl.appendChild(card);
  });
}
function invest(amount) {
  if (amount > currentUser.balance) {
    if (confirm('Insufficient balance. Deposit now?')) {
      depositAmt.focus();
    }
    return;
  }
  currentUser.balance -= amount;
  currentUser.investments.unshift({
    id: 'INV-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    amount,
    startAt: Date.now()
  });
  currentUser.tx.unshift({ type: 'invest', amount, time: Date.now(), note: 'New investment' });
  saveCurrentUser();
  renderAll();
}

// ---- Investments list ----
function renderInvestments() {
  const invs = currentUser.investments;
  if (!invs.length) {
    invListEl.className = 'list-empty muted';
    invListEl.textContent = 'No investments yet.';
    return;
  }
  invListEl.className = '';
  invListEl.innerHTML = '';
  invs.forEach(inv => {
    const now = Date.now();
    const value = currentInvestmentValue(inv, now);
    const days = daysBetween(inv.startAt, now);
    const row = document.createElement('div');
    row.className = 'inv';
    row.innerHTML = `
      <div>
        <div class="mono">${inv.id}</div>
        <div class="sub">Started ${new Date(inv.startAt).toLocaleDateString()}</div>
      </div>
      <div>
        <div class="sub">Principal</div>
        <div>${fmt(inv.amount)}</div>
      </div>
      <div>
        <div class="sub">Days</div>
        <div>${days}</div>
      </div>
      <div>
        <div class="sub">Current value</div>
        <div>${fmt(value)}</div>
        <button class="btn btn-outline" style="margin-top:8px">Cash out</button>
      </div>
    `;
    row.querySelector('button').addEventListener('click', () => cashOut(inv.id));
    invListEl.appendChild(row);
  });
}
function cashOut(invId) {
  const idx = currentUser.investments.findIndex(i => i.id === invId);
  if (idx === -1) return;
  const inv = currentUser.investments[idx];
  const value = currentInvestmentValue(inv);
  currentUser.balance += value;
  currentUser.investments.splice(idx, 1);
  currentUser.tx.unshift({ type: 'cashout', amount: value, time: Date.now(), note: `Cash out ${inv.id}` });
  saveCurrentUser();
  renderAll();
}

// ---- Wallet / KPIs ----
function renderWallet() {
  kpiBalance.textContent = fmt(currentUser.balance);
  kpiActive.textContent = String(currentUser.investments.length);
  const totalInvested = currentUser.investments.reduce((s, i) => s + i.amount, 0);
  kpiTotal.textContent = fmt(totalInvested);
}

// ---- Transactions ----
function renderTx() {
  const tx = currentUser.tx || [];
  if (!tx.length) {
    txListEl.innerHTML = `<div class="muted">No activity yet.</div>`;
    return;
  }
  txListEl.innerHTML = '';
  tx.slice(0, 20).forEach(t => {
    const row = document.createElement('div');
    row.className = 'tx';
    const typeClass =
      t.type === 'deposit' ? 'type-deposit' :
      t.type === 'withdraw' ? 'type-withdraw' :
      t.type === 'cashout' ? 'type-cashout' : 'type-invest';
    row.innerHTML = `
      <div>
        <div class="mono">${new Date(t.time).toLocaleString()}</div>
        <div class="muted">${t.note || t.type}</div>
      </div>
      <div class="amt ${typeClass}">${t.type === 'withdraw' ? '-' : '+'} ${fmt(t.amount)}</div>
    `;
    txListEl.appendChild(row);
  });
}

// ---- Referrals / Share ----
function referralLink() {
  const base = `${location.origin}${location.pathname}`;
  return `${base}?ref=${currentUser.referrals.code}`;
}
function renderReferrals() {
  refCodeEl.textContent = currentUser.referrals.code;
  refCountEl.textContent = String(currentUser.referrals.referredCount || 0);
  refLinkInput.value = referralLink();
}
copyRefBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(refLinkInput.value);
    copyRefBtn.textContent = 'Copied!';
    setTimeout(() => (copyRefBtn.textContent = 'Copy link'), 1200);
  } catch {
    refLinkInput.select(); document.execCommand('copy');
  }
});
shareNativeBtn.addEventListener('click', async () => {
  const url = referralLink();
  if (navigator.share) {
    try { await navigator.share({ title: 'Join Big Money', text: 'Start saving and earning.', url }); }
    catch { /* user canceled */ }
  } else {
    alert('Native share not supported. Copy the link instead.');
  }
});
shareWABtn.addEventListener('click', () => {
  const url = encodeURIComponent(referralLink());
  const text = encodeURIComponent('Join Big Money and start earning: ');
  window.open(`https://wa.me/?text=${text}${url}`, '_blank');
});
shareTGBtn.addEventListener('click', () => {
  const url = encodeURIComponent(referralLink());
  const text = encodeURIComponent('Join Big Money and start earning');
  window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
});

// ---- Profile ----
function renderProfile() {
  profileEmail.textContent = currentUser.email;
  profileUID.textContent = currentUser.uid;
  profileReferredBy.textContent = currentUser.referrals.referredBy || '—';
}

// ---- Navigation (pages) ----
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${name}`);
  if (pageEl) pageEl.classList.add('active');

  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.dataset.target) b.classList.toggle('active', b.dataset.target === name);
  });

  // Update header UID visible on all pages
  uidChip.textContent = currentUser.uid;

  if (name === 'dashboard') { /* already rendered via renderAll */ }
  if (name === 'share') renderReferrals();
  if (name === 'support') { /* static */ }
  if (name === 'profile') renderProfile();

  closeSheet();
}

// Bottom tab clicks
document.querySelectorAll('.tab-btn[data-target]').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.target));
});

// ---- Sheet (menu) ----
function openSheet() {
  sheet.classList.remove('hidden'); sheetBackdrop.classList.remove('hidden');
  // force reflow to enable transition
  sheet.getBoundingClientRect();
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
}
function closeSheet() {
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    sheet.classList.add('hidden'); sheetBackdrop.classList.add('hidden');
  }, 220);
}
menuBtn.addEventListener('click', openSheet);
sheetBackdrop.addEventListener('click', closeSheet);
sheet.addEventListener('click', (e) => {
  const t = e.target.closest('.item');
  if (!t) return;
  const target = t.dataset.target;
  if (target) showPage(target);
});

// ---- Logout ----
logoutBtn.addEventListener('click', () => { closeSheet(); logout(); });

// ---- Rendering ----
function renderAll() {
  renderWallet();
  renderPackages();
  renderInvestments();
  renderTx();
  renderReferrals();
  renderProfile();
}

// ---- Init ----
seedDemoUser();

// Auto-apply referral code from URL (optional)
(function applyReferralFromURL() {
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (ref) {
    // Pre-fill sign-up referral field
    signupReferral.value = ref;
  }
})();

// Telegram links
telegramLink.textContent = 'Join our Telegram';
menuTelegram.textContent = '📢 Join Telegram';

// Notifications toggle (demo only)
notifToggle?.addEventListener('change', () => {
  alert(notifToggle.checked ? 'Notifications enabled (demo)' : 'Notifications disabled');
});

// Optional: auto-fill demo login fields (already set in HTML)

// Optional: set default theme
const savedTheme = localStorage.getItem(LS_THEME) || 'dark';
setTheme(savedTheme);