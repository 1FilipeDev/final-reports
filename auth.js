

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── MENU LATERAL ──────────────────────────────────────────────
function initMenu() {
  const menuBtn  = document.getElementById('menuToggle');
  const sideMenu = document.getElementById('sideMenu');
  if (!menuBtn || !sideMenu) return; // página sem menu — sai

  const overlay     = document.getElementById('menuOverlay');
  const logoutBtn   = document.getElementById('logoutBtn');
  const navLogin    = document.getElementById('navLogin');
  const navRegister = document.getElementById('navRegister');
  const userInfoEl  = document.getElementById('menuUserInfo');

  // ── Abrir / fechar ──────────────────────────────────────────
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sideMenu.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  });

  if (overlay) {
    overlay.addEventListener('click', () => {
      sideMenu.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // Fecha ao clicar fora (fallback sem overlay)
  document.addEventListener('click', (e) => {
    if (!sideMenu.contains(e.target) && !menuBtn.contains(e.target)) {
      sideMenu.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    }
  });

  // ── Sessão ──────────────────────────────────────────────────
  const session = DB.getSession();

  if (userInfoEl) {
    if (session) {
      userInfoEl.innerHTML = `
        <div class="avatar">${session.name.charAt(0).toUpperCase()}</div>
        <div class="side-menu-user-info">
          <div class="name">${session.name}</div>
          <div class="email">${session.email}</div>
        </div>`;
    } else {
      userInfoEl.innerHTML = `
        <div class="avatar">👤</div>
        <div class="side-menu-user-info">
          <div class="name">Visitante</div>
          <div class="email">Faça login para denunciar</div>
        </div>`;
    }
  }

  if (session) {
    if (navLogin)    navLogin.style.display    = 'none';
    if (navRegister) navRegister.style.display = 'none';
    if (logoutBtn)   logoutBtn.style.display   = 'block';
  } else {
    if (logoutBtn) logoutBtn.style.display = 'none';
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      DB.logout();
      window.location.href = 'login.html';
    });
  }
}

// ── TEMA ──────────────────────────────────────────────────────
function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    btn.textContent = '☀️';
  }

  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    btn.textContent = isDark ? '☀️' : '🌙';
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { dark: isDark } }));
  });
}

// ── INICIALIZA AO CARREGAR ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMenu();
  initTheme();
});
