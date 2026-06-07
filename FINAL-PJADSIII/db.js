// ============================================================
//  db.js  — Banco de dados Supabase + lógica de admin
// ============================================================

const SUPABASE_URL  = 'https://dkuglseelblsxwrpdmru.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrdWdsc2VlbGJsc3h3cnBkbXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDc2ODMsImV4cCI6MjA5NTkyMzY4M30.qqfrkREZc1K4mbb33dR0xlhEKcf2RRgunGiQWJOszjg';

// ⚠️ SENHA SECRETA DO ADMIN — altere para uma senha forte
const ADMIN_PASSWORD = 'admin';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`
};

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...HEADERS, ...options.headers }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const DB = {

  // ── SESSÃO ────────────────────────────────────────────────
  getSession() {
    return JSON.parse(localStorage.getItem('qmd_session') || 'null');
  },
  isAdmin() {
    const s = this.getSession();
    return s && s.role === 'admin';
  },
  saveSession(user, role = 'user') {
    localStorage.setItem('qmd_session', JSON.stringify({
      id: user.id, name: user.name, email: user.email, role
    }));
  },
  logout() {
    localStorage.removeItem('qmd_session');
  },

  // ── USUÁRIOS ──────────────────────────────────────────────
  async createUser({ name, email, cpf, password }) {
    try {
      const byEmail = await sbFetch(`users?email=eq.${encodeURIComponent(email)}&select=id`);
      if (byEmail && byEmail.length > 0) return { ok: false, msg: 'E-mail já cadastrado.' };

      const byCpf = await sbFetch(`users?cpf=eq.${encodeURIComponent(cpf)}&select=id`);
      if (byCpf && byCpf.length > 0) return { ok: false, msg: 'CPF já cadastrado.' };

      const data = await sbFetch('users?select=*', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ name, email, cpf, password: btoa(password) })
      });
      const user = data[0];
      this.saveSession(user, 'user');
      return { ok: true, user };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  },

  async loginUser(email, password) {
    try {
      // 1. Busca o usuário só pelo e-mail
      const data = await sbFetch(`users?email=eq.${encodeURIComponent(email)}&select=*`);
      if (!data || data.length === 0) return { ok: false, msg: 'E-mail ou senha incorretos.' };

      const user = data[0];

      // 2. Verifica se é senha de admin OU senha normal do usuário
      const isAdmin     = (password === ADMIN_PASSWORD);
      const isValidPass = (user.password === btoa(password));

      if (!isAdmin && !isValidPass) return { ok: false, msg: 'E-mail ou senha incorretos.' };

      // 3. Salva sessão com role correto
      const role = isAdmin ? 'admin' : 'user';
      this.saveSession(user, role);
      return { ok: true, user, role };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  },

  async getUserById(id) {
    try {
      const data = await sbFetch(`users?id=eq.${id}&select=*`);
      return data?.[0] || null;
    } catch { return null; }
  },

  async getAllUsers() {
    try {
      return await sbFetch('users?select=id,name,email,created_at&order=created_at.desc') || [];
    } catch { return []; }
  },

  // ── DENÚNCIAS ─────────────────────────────────────────────
  async addReport({ lat, lng, level, category, info, photoBase64, userId, userName }) {
    try {
      const data = await sbFetch('reports?select=*', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: userId, user_name: userName,
          lat, lng, level, category,
          info: info || '',
          photo_url: photoBase64 || null
        })
      });
      return { ok: true, report: data[0] };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  },

  async getReports() {
    try {
      return await sbFetch('reports?select=*&order=created_at.desc') || [];
    } catch { return []; }
  },

  async getReportsByUser(userId) {
    try {
      return await sbFetch(`reports?user_id=eq.${userId}&select=*&order=created_at.desc`) || [];
    } catch { return []; }
  },

  async deleteReport(id) {
    try {
      await sbFetch(`reports?id=eq.${id}`, { method: 'DELETE' });
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }
};
