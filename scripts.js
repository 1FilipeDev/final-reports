// ── MAPA ─────────────────────────────────────────────────────
const map = L.map('map').setView([-16.67, -49.25], 13);

let lightMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
let darkMap  = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
lightMap.addTo(map);

if (localStorage.getItem('theme') === 'dark') {
  map.removeLayer(lightMap);
  darkMap.addTo(map);
}

document.addEventListener('themeChanged', (e) => {
  if (e.detail.dark) { map.removeLayer(lightMap); darkMap.addTo(map); }
  else               { map.removeLayer(darkMap);  lightMap.addTo(map); }
});

// ── VARIÁVEIS ─────────────────────────────────────────────────
let userCoordinates = null;
let selectedMarker  = null;
let allMarkers      = [];
let activeFilter    = 'all';

// ── CORES ─────────────────────────────────────────────────────
function getColor(level) {
  if (level === '3') return 'red';
  if (level === '2') return 'orange';
  return 'yellow';
}

// ── ADICIONAR MARCADOR ────────────────────────────────────────
function addMarkerToMap(report) {
  const lat        = report.lat;
  const lng        = report.lng;
  const level      = report.level;
  const category   = report.category;
  const info       = report.info;
  const userName   = report.user_name || 'Anônimo';
  const date       = report.created_at ? new Date(report.created_at).toLocaleDateString('pt-BR') : '';
  const photo      = report.photo_url  || null;
  const color      = getColor(level);
  const intensity  = level === '3' ? 0.9 : level === '2' ? 0.6 : 0.3;
  const levelLabel = { '1': 'Baixo', '2': 'Médio', '3': 'Alto' }[level] || level;

  let popupContent = `
    <b>Nível:</b> ${levelLabel}<br>
    <b>Local:</b> ${category}<br>
    <b>Info:</b> ${info || 'Nenhuma'}<br>
    <b>Por:</b> ${userName}${date ? ' · ' + date : ''}<br>
  `;
  if (photo) popupContent += `<img src="${photo}" style="max-width:120px;margin-top:4px;border-radius:4px;">`;

  L.circle([lat, lng], {
    radius: 300, color, fillColor: color,
    fillOpacity: intensity * 0.3, weight: 0
  }).addTo(map);

  L.circleMarker([lat, lng], {
    radius: 8, color, fillColor: color, fillOpacity: intensity
  }).addTo(map).bindPopup(popupContent);

  allMarkers.push({ level });
}

// ── CARREGAR DENÚNCIAS ────────────────────────────────────────
async function loadReports() {
  const reports = await DB.getReports();
  reports.forEach(r => addMarkerToMap(r));
  updateHUD();
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
  const alto  = document.getElementById('countAlto');
  const medio = document.getElementById('countMedio');
  const baixo = document.getElementById('countBaixo');
  const total = document.getElementById('countTotal');
  if (!total) return;
  alto.textContent  = allMarkers.filter(r => r.level === '3').length;
  medio.textContent = allMarkers.filter(r => r.level === '2').length;
  baixo.textContent = allMarkers.filter(r => r.level === '1').length;
  total.textContent = allMarkers.length;
}

// ── FILTROS ───────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    // (filtro visual pode ser expandido futuramente)
  });
});

// ── FORMULÁRIO ────────────────────────────────────────────────
document.getElementById('reportForm').addEventListener('submit', async function(event) {
  event.preventDefault();

  const locationEl = document.getElementById('location');
  const location   = locationEl ? locationEl.value : '';

  // ← CORRIGIDO: lê radio button, não select
  const levelRadio = document.querySelector('input[name="level"]:checked');
  const level      = levelRadio ? levelRadio.value : '1';

  const category   = document.getElementById('category').value;
  const info       = document.getElementById('additionalInfo').value;
  const photoInput = document.getElementById('photo');
  const photoFile  = photoInput && photoInput.files[0] ? photoInput.files[0] : null;

  if (!userCoordinates && !location.trim()) {
    showToast('Informe ou selecione uma localização.', 'warning');
    return;
  }

  const session = DB.getSession();
  if (!session) {
    showToast('Faça login para registrar uma denúncia.', 'warning');
    setTimeout(() => window.location.href = 'login.html', 1500);
    return;
  }

  const btn = this.querySelector('button[type="submit"]');
  btn.textContent = '⏳ Enviando…';
  btn.disabled    = true;

  const processPhoto = (callback) => {
    if (photoFile) {
      const reader = new FileReader();
      reader.onload = ev => callback(ev.target.result);
      reader.readAsDataURL(photoFile);
    } else {
      callback(null);
    }
  };

  const saveReport = async (coords, photoBase64) => {
    const result = await DB.addReport({
      lat: coords.lat, lng: coords.lng,
      level, category, info, photoBase64,
      userId: session.id, userName: session.name
    });

    if (result.ok) {
      addMarkerToMap(result.report);
      map.setView([coords.lat, coords.lng], 14);
      updateHUD();
      if (selectedMarker) { map.removeLayer(selectedMarker); selectedMarker = null; }
      userCoordinates = null;
      this.reset();
      const photoName = document.getElementById('photoName');
      if (photoName) photoName.textContent = '';
      showToast('✅ Denúncia registrada com sucesso!', 'success');
    } else {
      showToast('❌ Erro ao salvar: ' + result.msg, 'error');
    }

    btn.textContent = '🔥 Enviar Denúncia';
    btn.disabled    = false;
  };

  if (userCoordinates) {
    processPhoto(photo => saveReport(userCoordinates, photo));
  } else {
    geocodeLocation(location, coords => {
      processPhoto(photo => saveReport(coords, photo));
    });
  }
});

// Categoria "outros"
const categoryEl = document.getElementById('category');
if (categoryEl) {
  categoryEl.addEventListener('change', function() {
    const other = document.getElementById('otherCategoryGroup');
    if (other) other.style.display = this.value === 'outros' ? 'block' : 'none';
  });
}

// Preview nome da foto
const photoInput = document.getElementById('photo');
if (photoInput) {
  photoInput.addEventListener('change', function() {
    const nameEl = document.getElementById('photoName');
    if (nameEl) nameEl.textContent = this.files[0] ? '📎 ' + this.files[0].name : '';
  });
}

// ── GEOLOCALIZAÇÃO ────────────────────────────────────────────
document.getElementById('useLocation').addEventListener('click', function() {
  if (!navigator.geolocation) { showToast('Geolocalização não suportada.', 'error'); return; }
  this.textContent = '⏳';
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      userCoordinates = { lat, lng };
      document.getElementById('location').value = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
      map.setView([lat, lng], 15);
      this.textContent = '📍';
      showToast('📍 Localização obtida!', 'success');
      checkNearby(lat, lng);
    },
    () => {
      showToast('Não foi possível obter sua localização.', 'error');
      this.textContent = '📍';
    }
  );
});

// ── CLIQUE NO MAPA ────────────────────────────────────────────
map.on('click', function(e) {
  const { lat, lng } = e.latlng;
  userCoordinates = { lat, lng };
  document.getElementById('location').value = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
  if (selectedMarker) map.removeLayer(selectedMarker);
  selectedMarker = L.marker([lat, lng]).addTo(map)
    .bindPopup('<small>📍 Local selecionado</small>').openPopup();
});

// ── GEOCODE ───────────────────────────────────────────────────
function geocodeLocation(location, callback) {
  if (/^\d{5}-?\d{3}$/.test(location)) {
    fetch(`https://viacep.com.br/ws/${location.replace('-', '')}/json/`)
      .then(r => r.json())
      .then(data => {
        if (data.erro) { showToast('CEP inválido.', 'error'); return; }
        const addr = `${data.logradouro}, ${data.localidade}, ${data.uf}`;
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`)
          .then(r => r.json())
          .then(res => {
            if (res.length > 0) callback({ lat: parseFloat(res[0].lat), lng: parseFloat(res[0].lon) });
            else showToast('CEP não encontrado.', 'error');
          });
      });
  } else {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`)
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) callback({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        else showToast('Endereço não encontrado.', 'error');
      });
  }
}

// ── HAVERSINE ─────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2
              + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function checkNearby(userLat, userLng) {
  const reports = await DB.getReports();
  const nearby  = reports.filter(r => haversine(userLat, userLng, r.lat, r.lng) <= 5);
  if (nearby.length > 0) {
    const highs = nearby.filter(r => r.level === '3').length;
    showToast(
      highs > 0
        ? `🚨 ${highs} queimada(s) de ALTO risco a menos de 5km!`
        : `⚠️ ${nearby.length} queimada(s) próximas de você.`,
      highs > 0 ? 'error' : 'warning', 6000
    );
  }
}

// ── LEGENDA ───────────────────────────────────────────────────
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function() {
  const div = L.DomUtil.create('div', 'info legend');
  div.innerHTML = `
    <div style="background:#1e1e1e;padding:10px;border-radius:8px;color:white;font-size:13px;">
      <strong>Nível de Queimada</strong><br><br>
      <span style="color:red;">●</span> Alto<br>
      <span style="color:orange;">●</span> Médio<br>
      <span style="color:yellow;">●</span> Baixo
    </div>`;
  return div;
};
legend.addTo(map);

// ── MENU LATERAL ─────────────────────────────────────────────
// O auth.js já cuida do toggle (open/close) e do tema.
// Aqui só injetamos o link de admin se for admin.
(function injectAdminLink() {
  const session = DB.getSession();
  if (!session || session.role !== 'admin') return;

  // Procura a <nav> do menu lateral
  const nav = document.querySelector('#sideMenu nav');
  if (!nav) return;

  const adminA = document.createElement('a');
  adminA.href = 'admin.html';
  adminA.innerHTML = '<span class="nav-icon">⚙️</span> Painel Admin';
  adminA.style.cssText = 'color:#ff9800;font-weight:700;';
  nav.appendChild(adminA);
})();

// ── INICIALIZAR ───────────────────────────────────────────────
loadReports();
