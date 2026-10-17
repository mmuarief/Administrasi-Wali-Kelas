/* =====================================================================
   ADMINISTRASI KELAS DIGITAL
   Aplikasi penyimpanan data lokal (localStorage). Tanpa server/cloud.
   Seluruh data disimpan di perangkat pengguna.
   ===================================================================== */

/* ---------------------- UTIL ---------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function esc(v){
  return String(v ?? '').replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}
function stripTags(html){
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || '';
}
function pad(n){ return String(n).padStart(2, '0'); }
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

function fmtTanggal(s){
  if(!s) return '-';
  const p = String(s).split('-');
  if(p.length < 3) return s;
  return `${Number(p[2])} ${BULAN[Number(p[1])-1]} ${p[0]}`;
}
function fmtBulan(key){
  if(!key) return '-';
  const p = key.split('-');
  return `${BULAN[Number(p[1])-1]} ${p[0]}`;
}
function rupiah(n){
  return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
}
function num(v){
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function toast(msg){
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 320);
  }, 2100);
}

/* ---------------------- STORAGE ---------------------- */
const STORE_KEY = 'administrasiKelasDigital_v1';

function defaultDB(){
  return {
    identitas: {},
    siswa: [],
    absensi: {},
    nilai: [],
    jurnal: [],
    catatan: [],
    prestasi: [],
    ortu: [],
    jadwal: [],
    inventaris: [],
    kas: [],
    penghubung: []
  };
}

let DB;
try {
  const raw = localStorage.getItem(STORE_KEY);
  DB = raw ? Object.assign(defaultDB(), JSON.parse(raw)) : defaultDB();
} catch (e) {
  console.warn('Gagal membaca penyimpanan lokal:', e);
  DB = defaultDB();
}

let storageOK = true;
function save(){
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(DB));
    storageOK = true;
  } catch (e) {
    storageOK = false;
    toast('⚠️ Gagal menyimpan: penyimpanan browser penuh/tidak tersedia.');
  }
}

/* ---------------------- KONSTANTA ---------------------- */
const STATUS_ABSEN = {
  H: { label: 'Hadir', cls: 'g', color: '#16a34a' },
  S: { label: 'Sakit', cls: 'y', color: '#d97706' },
  I: { label: 'Izin',  cls: 'b', color: '#2563eb' },
  A: { label: 'Alpa',  cls: 'r', color: '#dc2626' }
};

const MENU = [
  { key: 'dashboard',   label: 'Dashboard',                icon: '📊' },
  { key: 'identitas',   label: 'Identitas Kelas',          icon: '🏫' },
  { key: 'siswa',       label: 'Data Siswa',               icon: '👥' },
  { key: 'absensi',     label: 'Absensi Harian',           icon: '✅' },
  { key: 'rekapAbsen',  label: 'Rekap Absensi',            icon: '📅' },
  { key: 'nilai',       label: 'Data Nilai & Asesmen',     icon: '📝' },
  { key: 'jurnal',      label: 'Jurnal Kegiatan Kelas',    icon: '📔' },
  { key: 'catatan',     label: 'Catatan Perkembangan',     icon: '🧭' },
  { key: 'prestasi',    label: 'Prestasi & Pelanggaran',   icon: '🏆' },
  { key: 'ortu',        label: 'Orang Tua / Wali',         icon: '👨‍👩‍👧' },
  { key: 'jadwal',      label: 'Jadwal Pelajaran',         icon: '🕒' },
  { key: 'inventaris',  label: 'Inventaris Kelas',         icon: '📦' },
  { key: 'kas',         label: 'Kas Kelas',                icon: '💰' },
  { key: 'penghubung',  label: 'Buku Penghubung',          icon: '📬' },
  { key: 'laporan',     label: 'Laporan Administrasi',     icon: '📄' }
];

const state = {
  search: {},
  bulanRekap: todayStr().slice(0, 7),
  tglAbsen: todayStr(),
  current: 'dashboard'
};

/* ---------------------- KOMPONEN ---------------------- */
function renderTable(cols, rows, emptyMsg){
  if(!rows.length){
    return `<p class="empty">${esc(emptyMsg || 'Belum ada data. Silakan tambahkan data terlebih dahulu.')}</p>`;
  }
  let h = '<div class="table-wrap"><table><thead><tr>';
  cols.forEach(c => { h += `<th>${esc(c.label)}</th>`; });
  h += '</tr></thead><tbody>';
  rows.forEach(r => {
    h += '<tr>';
    cols.forEach(c => {
      const v = c.render ? c.render(r) : esc(r[c.key] ?? '');
      h += `<td data-label="${esc(c.label)}">${v}</td>`;
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

const ACT_COL = {
  label: 'Aksi',
  render: r => `<div class="row-actions">
      <button class="icon-btn" data-act="edit" data-id="${r.id}" title="Edit">✏️</button>
      <button class="icon-btn del" data-act="del" data-id="${r.id}" title="Hapus">🗑️</button>
    </div>`
};

function openForm(title, fields, data, onSave){
  data = data || {};
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const body = fields.map(f => {
    const val = data[f.name] ?? f.default ?? '';
    let inp;
    if(f.type === 'select'){
      const opts = (typeof f.options === 'function' ? f.options() : f.options) || [];
      inp = `<select name="${f.name}" ${f.required ? 'required' : ''}>
        ${f.placeholder !== false ? '<option value="">-- Pilih --</option>' : ''}
        ${opts.map(o => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`;
        }).join('')}
      </select>`;
    } else if(f.type === 'textarea'){
      inp = `<textarea name="${f.name}" rows="3" ${f.required ? 'required' : ''} placeholder="${esc(f.ph || '')}">${esc(val)}</textarea>`;
    } else {
      inp = `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(val)}"
        ${f.required ? 'required' : ''} placeholder="${esc(f.ph || '')}"
        ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''}
        ${f.max != null ? `max="${f.max}"` : ''}>`;
    }
    return `<div class="field">
      <label>${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>
      ${inp}
      ${f.hint ? `<small>${esc(f.hint)}</small>` : ''}
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button type="button" class="icon-btn" data-close title="Tutup">✕</button>
      </div>
      <form class="modal-body" id="modalForm" novalidate>${body}</form>
      <div class="modal-foot">
        <button type="button" class="btn" data-close>Batal</button>
        <button type="button" class="btn btn-primary" id="modalSave">Simpan</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
  };
  overlay.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  overlay.addEventListener('mousedown', e => { if(e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e){
    if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', onEsc); }
  });

  const form = overlay.querySelector('#modalForm');
  overlay.querySelector('#modalSave').onclick = () => {
    if(!form.checkValidity()){
      form.reportValidity();
      return;
    }
    const vals = {};
    fields.forEach(f => {
      let v = (form.elements[f.name].value || '').trim();
      if(f.type === 'number') v = v === '' ? '' : Number(v);
      vals[f.name] = v;
    });
    onSave(vals);
    close();
  };
  setTimeout(() => {
    const first = form.querySelector('input,select,textarea');
    if(first) first.focus();
  }, 60);
}

/* ---------------------- EKSPOR & CETAK ---------------------- */
function exportCSV(filename, rows){
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('File CSV diunduh (dapat dibuka di Excel)');
}

function identitasHeaderHTML(){
  const d = DB.identitas || {};
  const parts = [];
  if(d.sekolah) parts.push(esc(d.sekolah));
  if(d.namaKelas) parts.push('Kelas ' + esc(d.namaKelas));
  if(d.waliKelas) parts.push('Wali: ' + esc(d.waliKelas));
  if(d.tahunAjaran) parts.push('T.A. ' + esc(d.tahunAjaran) + (d.semester ? ' — ' + esc(d.semester) : ''));
  if(!parts.length) return '';
  return `<p style="margin:4px 0 14px;color:#475569;font-size:12.5px">${parts.join(' • ')}</p>`;
}

function printHTML(title, innerHTML){
  const w = window.open('', '_blank');
  if(!w){
    alert('Jendela cetak diblokir oleh browser. Izinkan popup untuk mencetak.');
    return;
  }
  w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;padding:26px;color:#0f172a;font-size:12.5px}
    h2{margin:0 0 4px;font-size:17px}
    h3{margin:22px 0 8px;font-size:14px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left;vertical-align:top}
    th{background:#f1f5f9;font-size:11.5px;text-transform:uppercase;letter-spacing:.03em}
    tbody tr:nth-child(even){background:#f8fafc}
    .foot{margin-top:26px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px}
    @media print{ body{padding:0} @page{margin:14mm} }
  </style></head><body>
  ${innerHTML}
  <div class="foot">Dicetak dari Aplikasi Administrasi Kelas Digital — ${new Date().toLocaleString('id-ID')}</div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch(e){} }, 350);
}

function printTable(title, cols, rows){
  const head = cols.map(c => `<th>${esc(c.label)}</th>`).join('');
  const body = rows.length
    ? rows.map(r => '<tr>' + cols.map(c => {
        const raw = c.render ? stripTags(c.render(r)) : String(r[c.key] ?? '');
        return `<td>${esc(raw)}</td>`;
      }).join('') + '</tr>').join('')
    : `<tr><td colspan="${cols.length}" style="text-align:center;color:#64748b">Belum ada data</td></tr>`;

  printHTML(title, `<h2>${esc(title)}</h2>${identitasHeaderHTML()}
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`);
}

/* ---------------------- DATA HELPER ---------------------- */
function siswaOptions(){
  return DB.siswa.map(s => ({
    value: s.id,
    label: s.nama + (s.nis ? ' (' + s.nis + ')' : '')
  }));
}
function namaSiswa(id){
  const s = DB.siswa.find(x => x.id === id);
  return s ? s.nama : '—';
}

/* =====================================================================
   GENERIC CRUD VIEW
   ===================================================================== */
function simpleCrud(cfg){
  const view = $('#view');
  const fieldsFn = () => (typeof cfg.fields === 'function' ? cfg.fields() : cfg.fields);

  view.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="search-box">
          <span>🔍</span>
          <input id="s_${cfg.key}" type="search" placeholder="${esc(cfg.searchPlaceholder || 'Cari data...')}" value="${esc(state.search[cfg.key] || '')}">
        </div>
        <div class="toolbar-right">
          ${cfg.extraToolbar ? cfg.extraToolbar() : ''}
          <button class="btn btn-primary" id="add_${cfg.key}">＋ ${esc(cfg.addLabel)}</button>
          <button class="btn btn-ghost" id="exp_${cfg.key}">⬇ CSV</button>
          <button class="btn btn-ghost" id="prn_${cfg.key}">🖨 Cetak</button>
        </div>
      </div>
      <div id="tbl_${cfg.key}"></div>
    </div>
    ${cfg.bottom ? `<div id="bot_${cfg.key}">${cfg.bottom()}</div>` : ''}`;

  const tbl = $('#tbl_' + cfg.key);

  function currentRows(){
    const q = (state.search[cfg.key] || '').toLowerCase().trim();
    let all = DB[cfg.collection].slice();
    if(q){
      all = all.filter(r => cfg.searchFields.some(f => String(r[f] ?? '').toLowerCase().includes(q)));
    }
    if(cfg.sortFn) all.sort(cfg.sortFn);
    return all;
  }

  function draw(){
    const rows = currentRows();
    tbl.innerHTML = renderTable(cfg.columns, rows, cfg.empty);

    tbl.querySelectorAll('[data-act="edit"]').forEach(btn => {
      btn.onclick = () => {
        const item = DB[cfg.collection].find(x => x.id === btn.dataset.id);
        if(!item) return;
        openForm('Edit — ' + cfg.addLabel, fieldsFn(), item, vals => {
          Object.assign(item, vals);
          save(); draw(); refreshBottom(); refreshHeader();
          toast('Perubahan berhasil disimpan');
        });
      };
    });

    tbl.querySelectorAll('[data-act="del"]').forEach(btn => {
      btn.onclick = () => {
        if(!confirm('Yakin ingin menghapus data ini?\nTindakan ini tidak dapat dibatalkan.')) return;
        DB[cfg.collection] = DB[cfg.collection].filter(x => x.id !== btn.dataset.id);
        save(); draw(); refreshBottom(); refreshHeader();
        toast('Data berhasil dihapus');
      };
    });

    if(cfg.afterDraw) cfg.afterDraw(rows);
  }

  function refreshBottom(){
    if(!cfg.bottom) return;
    const el = $('#bot_' + cfg.key);
    if(el) el.innerHTML = cfg.bottom();
  }

  draw();

  $('#s_' + cfg.key).oninput = e => {
    state.search[cfg.key] = e.target.value;
    draw();
  };

  $('#add_' + cfg.key).onclick = () => {
    if(cfg.beforeAdd && cfg.beforeAdd() === false) return;
    openForm(cfg.addLabel, fieldsFn(), {}, vals => {
      DB[cfg.collection].push(Object.assign({ id: uid() }, vals));
      save(); draw(); refreshBottom(); refreshHeader();
      toast('Data berhasil ditambahkan');
    });
  };

  $('#exp_' + cfg.key).onclick = () => {
    const rows = currentRows();
    const cols = cfg.columns.filter(c => c.key);
    const header = cols.map(c => c.label);
    const body = rows.map(r => cols.map(c => (cfg.exportValue ? cfg.exportValue(r, c) : (r[c.key] ?? ''))));
    exportCSV((cfg.title || cfg.key) + '.csv', [header, ...body]);
  };

  $('#prn_' + cfg.key).onclick = () => {
    const rows = currentRows();
    const cols = cfg.columns.filter(c => c.key);
    printTable(cfg.title || cfg.key, cols, rows);
  };
}

/* =====================================================================
   1. DASHBOARD
   ===================================================================== */
function viewDashboard(){
  const total = DB.siswa.length;
  const lk = DB.siswa.filter(s => s.jk === 'L').length;
  const pr = DB.siswa.filter(s => s.jk === 'P').length;

  const today = todayStr();
  const rec = DB.absensi[today] || {};
  const cH = Object.values(rec).filter(v => v === 'H').length;
  const cS = Object.values(rec).filter(v => v === 'S').length;
  const cI = Object.values(rec).filter(v => v === 'I').length;
  const cA = Object.values(rec).filter(v => v === 'A').length;
  const belum = Math.max(0, total - (cH + cS + cI + cA));

  const saldo = DB.kas.reduce((a, k) => a + (k.jenis === 'Masuk' ? num(k.jumlah) : -num(k.jumlah)), 0);
  const nilaiArr = DB.nilai.map(n => num(n.nilai)).filter(n => !isNaN(n) && n > 0);
  const rata = nilaiArr.length ? (nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length) : 0;
  const jmlPrestasi = DB.prestasi.filter(p => p.jenis === 'Prestasi').length;
  const jmlPelanggaran = DB.prestasi.filter(p => p.jenis === 'Pelanggaran').length;

  const bulan = today.slice(0, 7);
  const keysBulan = Object.keys(DB.absensi).filter(k => k.startsWith(bulan));
  const tot = { H: 0, S: 0, I: 0, A: 0 };
  keysBulan.forEach(k => {
    Object.values(DB.absensi[k] || {}).forEach(v => { if(tot[v] != null) tot[v]++; });
  });

  const hariIni = HARI[new Date().getDay()];
  const jadwalHariIni = DB.jadwal
    .filter(j => j.hari === hariIni)
    .sort((a, b) => String(a.jamKe || '').localeCompare(String(b.jamKe || ''), 'id', { numeric: true }));

  const maxAbs = Math.max(tot.H, tot.S, tot.I, tot.A, 1);

  $('#view').innerHTML = `
    <div class="stats">
      <div class="stat"><div class="si" style="background:#dbeafe;color:#1e40af">👥</div>
        <div><div class="sv">${total}</div><div class="sl">Total Siswa</div></div></div>
      <div class="stat"><div class="si" style="background:#dcfce7;color:#166534">✅</div>
        <div><div class="sv">${cH}/${total}</div><div class="sl">Hadir Hari Ini</div></div></div>
      <div class="stat"><div class="si" style="background:#fef3c7;color:#92400e">📝</div>
        <div><div class="sv">${nilaiArr.length ? rata.toFixed(1) : '—'}</div><div class="sl">Rata-rata Nilai</div></div></div>
      <div class="stat"><div class="si" style="background:#f3e8ff;color:#6b21a8">💰</div>
        <div><div class="sv" style="font-size:15px">${rupiah(saldo)}</div><div class="sl">Saldo Kas</div></div></div>
    </div>

    <div class="card">
      <h2 class="card-title">Ringkasan Kelas</h2>
      <p class="muted">${DB.identitas.namaKelas ? 'Kelas ' + esc(DB.identitas.namaKelas) : 'Identitas kelas belum diisi'} • ${hariIni}, ${fmtTanggal(today)}</p>
      <div class="stats" style="margin-top:14px;margin-bottom:0">
        <div class="stat"><div class="si" style="background:#e0e7ff;color:#3730a3">♂</div>
          <div><div class="sv">${lk}</div><div class="sl">Laki-laki</div></div></div>
        <div class="stat"><div class="si" style="background:#fce7f3;color:#9d174d">♀</div>
          <div><div class="sv">${pr}</div><div class="sl">Perempuan</div></div></div>
        <div class="stat"><div class="si" style="background:#dcfce7;color:#166534">🏆</div>
          <div><div class="sv">${jmlPrestasi}</div><div class="sl">Prestasi</div></div></div>
        <div class="stat"><div class="si" style="background:#fee2e2;color:#991b1b">⚠️</div>
          <div><div class="sv">${jmlPelanggaran}</div><div class="sl">Pelanggaran</div></div></div>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">Absensi Bulan ${esc(fmtBulan(bulan))}</h2>
      <p class="muted">${keysBulan.length} hari tercatat</p>
      <div class="chart" style="margin-top:14px">
        ${chartRow('Hadir', tot.H, maxAbs, '#16a34a')}
        ${chartRow('Sakit', tot.S, maxAbs, '#d97706')}
        ${chartRow('Izin',  tot.I, maxAbs, '#2563eb')}
        ${chartRow('Alpa',  tot.A, maxAbs, '#dc2626')}
      </div>
      ${total > 0 ? `<p class="muted" style="margin-top:12px">Kehadiran hari ini belum tercatat untuk <strong>${belum}</strong> siswa.</p>` : ''}
    </div>

    <div class="card">
      <h2 class="card-title">Jadwal Hari ${esc(hariIni)}</h2>
      ${jadwalHariIni.length ? renderTable([
        { label: 'Jam Ke', key: 'jamKe' },
        { label: 'Waktu', key: 'waktu' },
        { label: 'Mata Pelajaran', key: 'mapel' },
        { label: 'Guru', key: 'guru' },
        { label: 'Ruang', key: 'ruang' }
      ], jadwalHariIni) : '<p class="empty">Belum ada jadwal untuk hari ini.</p>'}
    </div>

    ${total === 0 ? `<div class="card">
      <h2 class="card-title">Mulai Menggunakan Aplikasi</h2>
      <p class="muted" style="margin-bottom:12px">Langkah awal yang disarankan:</p>
      <ol style="margin-left:18px;color:#334155;font-size:13px;line-height:2">
        <li>Isi <strong>Identitas Kelas</strong> (nama kelas, wali kelas, tahun ajaran).</li>
        <li>Tambahkan <strong>Data Siswa</strong> satu per satu.</li>
        <li>Mulai catat <strong>Absensi Harian</strong>, <strong>Nilai</strong>, dan modul lainnya.</li>
      </ol>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="navigate('identitas')">Isi Identitas Kelas</button>
        <button class="btn" onclick="navigate('siswa')">Tambah Data Siswa</button>
      </div>
    </div>` : ''}
  `;
}

function chartRow(label, value, max, color){
  const pct = max > 0 ? (value / max * 100) : 0;
  return `<div class="chart-row">
    <span class="chart-label">${esc(label)}</span>
    <div class="chart-track"><div class="chart-bar" style="width:${pct}%;background:${color}"></div></div>
    <span class="chart-val">${value}</span>
  </div>`;
}

/* =====================================================================
   2. IDENTITAS KELAS
   ===================================================================== */
function viewIdentitas(){
  const d = DB.identitas || {};

  const fieldHTML = (name, label, type = 'text', ph = '', full = false) => {
    let input;
    if (type === 'select') {
      const opts = ['Ganjil', 'Genap']
        .map(v => `<option value="${v}" ${d[name] === v ? 'selected' : ''}>${v}</option>`)
        .join('');
      input = `<select name="${name}"><option value="">-- Pilih --</option>${opts}</select>`;
    } else if (type === 'textarea') {
      input = `<textarea name="${name}" rows="3" placeholder="${esc(ph || '')}">${esc(d[name] || '')}</textarea>`;
    } else {
      input = `<input class="input" name="${name}" type="${type}" value="${esc(d[name] || '')}" placeholder="${esc(ph || '')}">`;
    }
    return `<div class="field ${full ? 'full' : ''}"><label>${esc(label)}</label>${input}</div>`;
  };

  $('#view').innerHTML = `
    <div class="card">
      <h2 class="card-title">Identitas Kelas</h2>
      <p class="muted" style="margin-bottom:16px">
        Isi data identitas kelas sesuai kondisi sebenarnya. Data akan digunakan pada header laporan dan cetakan.
      </p>
      <form id="formIdentitas" class="grid-form" onsubmit="return false;">
        ${fieldHTML('sekolah', 'Nama Sekolah', 'text', 'Contoh: SMP Negeri 1 ...')}
        ${fieldHTML('npsn', 'NPSN', 'text', 'Nomor Pokok Sekolah Nasional')}
        ${fieldHTML('namaKelas', 'Nama Kelas', 'text', 'Contoh: VII A')}
        ${fieldHTML('tingkat', 'Tingkat', 'text', 'Contoh: VII / 7')}
        ${fieldHTML('waliKelas', 'Nama Wali Kelas', 'text', 'Nama lengkap guru wali kelas')}
        ${fieldHTML('nipWali', 'NIP / NUPTK Wali Kelas', 'text', 'Opsional')}
        ${fieldHTML('tahunAjaran', 'Tahun Ajaran', 'text', 'Contoh: 2025/2026')}
        ${fieldHTML('semester', 'Semester', 'select')}
        ${fieldHTML('ruangKelas', 'Ruang Kelas', 'text', 'Contoh: R-07')}
        ${fieldHTML('jumlahSiswa', 'Jumlah Siswa (otomatis)', 'text', 'Dihitung dari Data Siswa')}
        ${fieldHTML('catatan', 'Catatan Kelas', 'textarea', 'Catatan umum mengenai kelas...', true)}
      </form>
      <div class="form-actions">
        <button class="btn btn-primary" id="saveIdentitas" type="button">💾 Simpan Identitas</button>
        <button class="btn btn-ghost" id="printIdentitas" type="button">🖨 Cetak Identitas</button>
        <span class="muted" id="identitasMsg"></span>
      </div>
    </div>`;

  const jmlInput = $('#formIdentitas input[name="jumlahSiswa"]');
  if (jmlInput) {
    jmlInput.value = (DB.siswa ? DB.siswa.length : 0) + ' siswa';
    jmlInput.readOnly = true;
    jmlInput.style.background = '#f8fafc';
  }

  $('#saveIdentitas').onclick = () => {
    const form = $('#formIdentitas');
    const data = {};
    ['sekolah','npsn','namaKelas','tingkat','waliKelas','nipWali','tahunAjaran','semester','ruangKelas','catatan']
      .forEach(k => {
        const el = form.elements[k];
        if (el) data[k] = (el.value || '').trim();
      });
    DB.identitas = data;
    save();
    updateHeader();
    $('#identitasMsg').textContent = '✔ Tersimpan ' + new Date().toLocaleTimeString('id-ID');
    toast('Identitas kelas berhasil disimpan');
  };

  $('#printIdentitas').onclick = () => {
    const rows = [
      ['Nama Sekolah', d.sekolah || '-'],
      ['NPSN', d.npsn || '-'],
      ['Nama Kelas', d.namaKelas || '-'],
      ['Tingkat', d.tingkat || '-'],
      ['Wali Kelas', d.waliKelas || '-'],
      ['NIP / NUPTK', d.nipWali || '-'],
      ['Tahun Ajaran', d.tahunAjaran || '-'],
      ['Semester', d.semester || '-'],
      ['Ruang Kelas', d.ruangKelas || '-'],
      ['Jumlah Siswa', (DB.siswa ? DB.siswa.length : 0) + ' siswa'],
      ['Catatan', d.catatan || '-']
    ];
    printHTML('Identitas Kelas', `<h2>Identitas Kelas</h2>
      <table><tbody>${rows.map(r => `<tr><th style="width:34%">${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`);
  };
}

/* =====================================================================
   3. DATA SISWA
   ===================================================================== */
function viewSiswa(){
  simpleCrud({
    key: 'siswa',
    collection: 'siswa',
    title: 'Data Siswa',
    addLabel: 'Tambah Siswa',
    searchPlaceholder: 'Cari nama, NIS, atau alamat...',
    searchFields: ['nama', 'nis', 'alamat', 'tempatLahir'],
    empty: 'Belum ada data siswa. Klik "Tambah Siswa" untuk memulai.',
    sortFn: (a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'),
    fields: () => [
      { name: 'nis', label: 'NIS / NISN', type: 'text', ph: 'Nomor induk siswa' },
      { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true, ph: 'Nama sesuai akta' },
      { name: 'jk', label: 'Jenis Kelamin', type: 'select', required: true,
        options: [{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }] },
      { name: 'tempatLahir', label: 'Tempat Lahir', type: 'text' },
      { name: 'tanggalLahir', label: 'Tanggal Lahir', type: 'date' },
      { name: 'agama', label: 'Agama', type: 'text' },
      { name: 'alamat', label: 'Alamat', type: 'textarea' },
      { name: 'noHp', label: 'No. HP Siswa', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', default: 'Aktif',
        options: ['Aktif', 'Tidak Aktif', 'Pindah', 'Lulus'] },
      { name: 'keterangan', label: 'Keterangan', type: 'textarea' }
    ],
    columns: [
      { label: 'No', render: r => String(DB.siswa.indexOf(r) + 1) },
      { label: 'NIS', key: 'nis', render: r => esc(r.nis || '-') },
      { label: 'Nama', key: 'nama', render: r => `<strong>${esc(r.nama)}</strong>` },
      { label: 'L/P', key: 'jk', render: r => esc(r.jk || '-') },
      { label: 'Tempat, Tgl Lahir', render: r =>
          esc([r.tempatLahir, r.tanggalLahir ? fmtTanggal(r.tanggalLahir) : ''].filter(Boolean).join(', ') || '-') },
      { label: 'Status', key: 'status', render: r =>
          `<span class="pill ${r.status === 'Aktif' ? 'g' : 'n'}">${esc(r.status || 'Aktif')}</span>` },
      ACT_COL
    ],
    extraToolbar: () => `<span class="muted" style="align-self:center">${DB.siswa.length} siswa</span>`
  });
}

/* =====================================================================
   4. ABSENSI HARIAN
   ===================================================================== */
function viewAbsensi(){
  const tgl = state.tglAbsen || todayStr();
  state.tglAbsen = tgl;

  if(DB.siswa.length === 0){
    $('#view').innerHTML = `<div class="card">
      <h2 class="card-title">Absensi Harian</h2>
      <p class="empty">Belum ada data siswa. Silakan tambahkan siswa terlebih dahulu di menu <strong>Data Siswa</strong>.</p>
      <div class="form-actions"><button class="btn btn-primary" onclick="navigate('siswa')">Tambah Data Siswa</button></div>
    </div>`;
    return;
  }

  const rec = DB.absensi[tgl] || {};

  $('#view').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="field" style="margin:0">
          <label style="font-size:12px">Tanggal Absensi</label>
          <input type="date" id="tglAbsen" value="${tgl}" style="padding:8px 10px;border:1px solid var(--border);border-radius:9px">
        </div>
        <div class="toolbar-right">
          <button class="btn" id="allHadir">✅ Semua Hadir</button>
          <button class="btn" id="resetAbsen">↺ Kosongkan</button>
          <button class="btn btn-ghost" id="prnAbsen">🖨 Cetak</button>
        </div>
      </div>

      <div id="absenSummary" class="stats" style="margin-bottom:14px"></div>

      <div class="table-wrap">
        <table>
          <thead><tr><th style="width:50px">No</th><th>NIS</th><th>Nama Siswa</th><th style="min-width:280px">Status Kehadiran</th></tr></thead>
          <tbody id="absenBody"></tbody>
        </table>
      </div>
    </div>`;

  function drawBody(){
    const r = DB.absensi[tgl] || {};
    const body = $('#absenBody');
    body.innerHTML = DB.siswa.map((s, i) => `
      <tr>
        <td data-label="No">${i + 1}</td>
        <td data-label="NIS">${esc(s.nis || '-')}</td>
        <td data-label="Nama"><strong>${esc(s.nama)}</strong></td>
        <td data-label="Status">
          <div class="absen-group">
            ${Object.entries(STATUS_ABSEN).map(([k, v]) =>
              `<button class="absen-btn ${r[s.id] === k ? 'active' : ''}" data-sid="${s.id}" data-st="${k}" style="--c:${v.color}">${v.label}</button>`
            ).join('')}
          </div>
        </td>
      </tr>`).join('');

    body.querySelectorAll('.absen-btn').forEach(btn => {
      btn.onclick = () => {
        const sid = btn.dataset.sid;
        const st = btn.dataset.st;
        if(!DB.absensi[tgl]) DB.absensi[tgl] = {};
        DB.absensi[tgl][sid] = st;
        save();
        btn.parentElement.querySelectorAll('.absen-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        drawSummary();
      };
    });

    drawSummary();
  }

  function drawSummary(){
    const r = DB.absensi[tgl] || {};
    const c = { H: 0, S: 0, I: 0, A: 0 };
    Object.values(r).forEach(v => { if(c[v] != null) c[v]++; });
    const belum = DB.siswa.length - (c.H + c.S + c.I + c.A);
    $('#absenSummary').innerHTML = `
      <div class="stat"><div class="si" style="background:#dcfce7;color:#166534">✅</div>
        <div><div class="sv">${c.H}</div><div class="sl">Hadir</div></div></div>
      <div class="stat"><div class="si" style="background:#fef3c7;color:#92400e">🤒</div>
        <div><div class="sv">${c.S}</div><div class="sl">Sakit</div></div></div>
      <div class="stat"><div class="si" style="background:#dbeafe;color:#1e40af">📄</div>
        <div><div class="sv">${c.I}</div><div class="sl">Izin</div></div></div>
      <div class="stat"><div class="si" style="background:#fee2e2;color:#991b1b">❌</div>
        <div><div class="sv">${c.A}</div><div class="sl">Alpa</div></div></div>
      <div class="stat"><div class="si" style="background:#f1f5f9;color:#475569">⏳</div>
        <div><div class="sv">${belum}</div><div class="sl">Belum Diisi</div></div></div>`;
  }

  drawBody();

  $('#tglAbsen').onchange = e => {
    state.tglAbsen = e.target.value || todayStr();
    viewAbsensi();
  };

  $('#allHadir').onclick = () => {
    if(!confirm('Tandai SEMUA siswa sebagai Hadir pada tanggal ini?')) return;
    if(!DB.absensi[tgl]) DB.absensi[tgl] = {};
    DB.siswa.forEach(s => { DB.absensi[tgl][s.id] = 'H'; });
    save();
    drawBody();
    toast('Semua siswa ditandai Hadir');
  };

  $('#resetAbsen').onclick = () => {
    if(!confirm('Kosongkan seluruh status absensi pada tanggal ini?')) return;
    delete DB.absensi[tgl];
    save();
    drawBody();
    toast('Absensi tanggal ini dikosongkan');
  };

  $('#prnAbsen').onclick = () => {
    const r = DB.absensi[tgl] || {};
    const rows = DB.siswa.map((s, i) => ({
      no: i + 1, nis: s.nis || '-', nama: s.nama,
      status: r[s.id] ? STATUS_ABSEN[r[s.id]].label : 'Belum diisi'
    }));
    printHTML('Absensi Harian', `<h2>Daftar Hadir Siswa</h2>
      <p style="margin:0 0 10px;color:#475569">Hari/Tanggal: <strong>${HARI[new Date(tgl + 'T00:00:00').getDay()]}, ${fmtTanggal(tgl)}</strong></p>
      ${identitasHeaderHTML()}
      <table><thead><tr><th style="width:44px">No</th><th>NIS</th><th>Nama Siswa</th><th style="width:130px">Status</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${r.no}</td><td>${esc(r.nis)}</td><td>${esc(r.nama)}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table>`);
  };
}

/* =====================================================================
   5. REKAP ABSENSI
   ===================================================================== */
function viewRekapAbsen(){
  const bulan = state.bulanRekap || todayStr().slice(0, 7);
  state.bulanRekap = bulan;

  if(DB.siswa.length === 0){
    $('#view').innerHTML = `<div class="card">
      <h2 class="card-title">Rekap Absensi</h2>
      <p class="empty">Belum ada data siswa. Tambahkan data siswa terlebih dahulu.</p>
      <div class="form-actions"><button class="btn btn-primary" onclick="navigate('siswa')">Tambah Data Siswa</button></div>
    </div>`;
    return;
  }

  const tanggalTercatat = Object.keys(DB.absensi).filter(k => k.startsWith(bulan)).sort();
  const counts = {};
  DB.siswa.forEach(s => counts[s.id] = { H: 0, S: 0, I: 0, A: 0 });

  tanggalTercatat.forEach(tgl => {
    const r = DB.absensi[tgl] || {};
    Object.entries(r).forEach(([sid, st]) => {
      if(!counts[sid]) counts[sid] = { H: 0, S: 0, I: 0, A: 0 };
      if(counts[sid][st] != null) counts[sid][st]++;
    });
  });

  const totalHari = tanggalTercatat.length;
  const rows = DB.siswa.map(s => {
    const c = counts[s.id];
    const diisi = c.H + c.S + c.I + c.A;
    const persen = diisi > 0 ? (c.H / diisi * 100) : 0;
    return { siswa: s, c, diisi, persen };
  });

  const kelas = { H: 0, S: 0, I: 0, A: 0 };
  rows.forEach(r => { kelas.H += r.c.H; kelas.S += r.c.S; kelas.I += r.c.I; kelas.A += r.c.A; });
  const maxKelas = Math.max(kelas.H, kelas.S, kelas.I, kelas.A, 1);

  $('#view').innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="field" style="margin:0">
          <label style="font-size:12px">Pilih Bulan</label>
          <input type="month" id="bulanRekap" value="${bulan}" style="padding:8px 10px;border:1px solid var(--border);border-radius:9px">
        </div>
        <div class="toolbar-right">
          <span class="muted" style="align-self:center">${totalHari} hari tercatat</span>
          <button class="btn btn-ghost" id="expRekap">⬇ CSV</button>
          <button class="btn btn-ghost" id="prnRekap">🖨 Cetak</button>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="si" style="background:#dcfce7;color:#166534">✅</div>
          <div><div class="sv">${kelas.H}</div><div class="sl">Total Hadir</div></div></div>
        <div class="stat"><div class="si" style="background:#fef3c7;color:#92400e">🤒</div>
          <div><div class="sv">${kelas.S}</div><div class="sl">Total Sakit</div></div></div>
        <div class="stat"><div class="si" style="background:#dbeafe;color:#1e40af">📄</div>
          <div><div class="sv">${kelas.I}</div><div class="sl">Total Izin</div></div></div>
        <div class="stat"><div class="si" style="background:#fee2e2;color:#991b1b">❌</div>
          <div><div class="sv">${kelas.A}</div><div class="sl">Total Alpa</div></div></div>
      </div>

      <h3 style="font-size:13.5px;margin:6px 0 12px;color:#334155">Grafik Akumulasi Kelas — ${esc(fmtBulan(bulan))}</h3>
      <div class="chart" style="margin-bottom:20px">
        ${chartRow('Hadir', kelas.H, maxKelas, '#16a34a')}
        ${chartRow('Sakit', kelas.S, maxKelas, '#d97706')}
        ${chartRow('Izin',  kelas.I, maxKelas, '#2563eb')}
        ${chartRow('Alpa',  kelas.A, maxKelas, '#dc2626')}
      </div>

      <h3 style="font-size:13.5px;margin:6px 0 12px;color:#334155">Rekap Per Siswa</h3>
      ${renderTable([
        { label: 'No', render: r => String(rows.indexOf(r) + 1) },
        { label: 'NIS', render: r => esc(r.siswa.nis || '-') },
        { label: 'Nama Siswa', render: r => `<strong>${esc(r.siswa.nama)}</strong>` },
        { label: 'Hadir', render: r => `<span class="pill g">${r.c.H}</span>` },
        { label: 'Sakit', render: r => `<span class="pill y">${r.c.S}</span>` },
        { label: 'Izin',  render: r => `<span class="pill b">${r.c.I}</span>` },
        { label: 'Alpa',  render: r => `<span class="pill r">${r.c.A}</span>` },
        { label: '% Hadir', render: r => `<strong>${r.persen.toFixed(1)}%</strong>` }
      ], rows, 'Belum ada data absensi pada bulan ini.')}
    </div>`;

  $('#bulanRekap').onchange = e => {
    state.bulanRekap = e.target.value;
    viewRekapAbsen();
  };

  $('#expRekap').onclick = () => {
    const header = ['No', 'NIS', 'Nama', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Persentase Hadir (%)'];
    const body = rows.map((r, i) => [i + 1, r.siswa.nis || '', r.siswa.nama, r.c.H, r.c.S, r.c.I, r.c.A, r.persen.toFixed(1)]);
    exportCSV(`Rekap_Absensi_${bulan}.csv`, [header, ...body]);
  };

  $('#prnRekap').onclick = () => {
    printHTML('Rekap Absensi', `<h2>Rekap Absensi Bulanan</h2>
      <p style="margin:0 0 10px;color:#475569">Periode: <strong>${esc(fmtBulan(bulan))}</strong> • ${totalHari} hari tercatat</p>
      ${identitasHeaderHTML()}
      <table>
        <thead><tr><th>No</th><th>NIS</th><th>Nama Siswa</th><th>H</th><th>S</th><th>I</th><th>A</th><th>% Hadir</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.siswa.nis || '-')}</td><td>${esc(r.siswa.nama)}</td>
          <td>${r.c.H}</td><td>${r.c.S}</td><td>${r.c.I}</td><td>${r.c.A}</td><td>${r.persen.toFixed(1)}%</td></tr>`).join('')}</tbody>
        <tfoot><tr style="font-weight:700;background:#f1f5f9">
          <td colspan="3">JUMLAH</td><td>${kelas.H}</td><td>${kelas.S}</td><td>${kelas.I}</td><td>${kelas.A}</td><td></td>
        </tr></tfoot>
      </table>`);
  };
}

/* =====================================================================
   6. DATA NILAI & ASESMEN
   ===================================================================== */
function viewNilai(){
  const adaSiswa = DB.siswa.length > 0;

  simpleCrud({
    key: 'nilai',
    collection: 'nilai',
    title: 'Data Nilai & Asesmen',
    addLabel: 'Tambah Nilai',
    searchPlaceholder: 'Cari nama siswa atau mata pelajaran...',
    searchFields: ['mapel', 'jenis', 'keterangan'],
    empty: 'Belum ada data nilai. Klik "Tambah Nilai" untuk mulai mencatat.',
    sortFn: (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')),
    beforeAdd: () => {
      if(!adaSiswa){ alert('Tambahkan data siswa terlebih dahulu di menu Data Siswa.'); return false; }
      return true;
    },
    fields: () => [
      { name: 'siswaId', label: 'Nama Siswa', type: 'select', required: true, options: siswaOptions() },
      { name: 'mapel', label: 'Mata Pelajaran', type: 'text', required: true, ph: 'Contoh: Matematika' },
      { name: 'jenis', label: 'Jenis Asesmen', type: 'select', required: true, default: 'Tugas',
        options: ['Tugas', 'Ulangan Harian', 'UTS / PTS', 'UAS / PAS', 'Praktik', 'Proyek', 'Sikap'] },
      { name: 'nilai', label: 'Nilai (0 - 100)', type: 'number', required: true, min: 0, max: 100, step: '0.01' },
      { name: 'tanggal', label: 'Tanggal', type: 'date', default: todayStr() },
      { name: 'semester', label: 'Semester', type: 'select', options: ['Ganjil', 'Genap'] },
      { name: 'keterangan', label: 'Keterangan', type: 'textarea' }
    ],
    columns: [
      { label: 'Tanggal', key: 'tanggal', render: r => esc(fmtTanggal(r.tanggal)) },
      { label: 'Nama Siswa', render: r => `<strong>${esc(namaSiswa(r.siswaId))}</strong>` },
      { label: 'Mata Pelajaran', key: 'mapel' },
      { label: 'Jenis', key: 'jenis', render: r => `<span class="pill n">${esc(r.jenis || '-')}</span>` },
      { label: 'Nilai', key: 'nilai', render: r => {
          const n = num(r.nilai);
          const cls = n >= 80 ? 'g' : n >= 70 ? 'b' : n >= 60 ? 'y' : 'r';
          return `<span class="pill ${cls}">${n}</span>`;
        } },
      { label: 'Keterangan', key: 'keterangan', render: r => esc(r.keterangan || '-') },
      ACT_COL
    ],
    exportValue: (r, c) => c.key === 'siswaId' ? namaSiswa(r.siswaId) : r[c.key],
    bottom: () => {
      if(DB.nilai.length === 0) return '';
      const map = {};
      DB.nilai.forEach(n => {
        if(!map[n.siswaId]) map[n.siswaId] = [];
        map[n.siswaId].push(num(n.nilai));
      });
      const rows = Object.entries(map).map(([sid, arr]) => {
        const rata = arr.reduce((a, b) => a + b, 0) / arr.length;
        return { nama: namaSiswa(sid), jumlah: arr.length, min: Math.min(...arr), max: Math.max(...arr), rata };
      }).sort((a, b) => b.rata - a.rata);

      return `<div class="card">
        <h2 class="card-title">Rekap Nilai Per Siswa</h2>
        <p class="muted" style="margin-bottom:12px">Dihitung otomatis dari seluruh nilai yang telah diinput.</p>
        ${renderTable([
          { label: 'Peringkat', render: r => String(rows.indexOf(r) + 1) },
          { label: 'Nama Siswa', render: r => `<strong>${esc(r.nama)}</strong>` },
          { label: 'Jumlah Nilai', render: r => String(r.jumlah) },
          { label: 'Terendah', render: r => String(r.min) },
          { label: 'Tertinggi', render: r => String(r.max) },
          { label: 'Rata-rata', render: r => {
              const cls = r.rata >= 80 ? 'g' : r.rata >= 70 ? 'b' : r.rata >= 60 ? 'y' : 'r';
              return `<span class="pill ${cls}">${r.rata.toFixed(2)}</span>`;
            } }
        ], rows, 'Belum ada data nilai.')}
      </div>`;
    }
  });
}

/* =====================================================================
   7. JURNAL KEGIATAN KELAS
   ===================================================================== */
function viewJurnal(){
  simpleCrud({
    key: 'jurnal',
    collection: 'jurnal',
    title: 'Jurnal Kegiatan Kelas',
    addLabel: 'Tambah Jurnal',
    searchPlaceholder: 'Cari kegiatan atau mata pelajaran...',
    searchFields: ['kegiatan', 'mapel', 'keterangan'],
    empty: 'Belum ada jurnal kegiatan.',
    sortFn: (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')),
    fields: () => [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, default: todayStr() },
      { name: 'jam', label: 'Jam / Waktu', type: 'text', ph: 'Contoh: 07.00 - 08.20' },
      { name: 'mapel', label: 'Mata Pelajaran / Agenda', type: 'text' },
      { name: 'kegiatan', label: 'Uraian Kegiatan', type: 'textarea', required: true },
      { name: 'jumlahHadir', label: 'Jumlah Siswa Hadir', type: 'number', min: 0 },
      { name: 'keterangan', label: 'Keterangan / Tindak Lanjut', type: 'textarea' }
    ],
    columns: [
      { label: 'Tanggal', key: 'tanggal', render: r => esc(fmtTanggal(r.tanggal)) },
      { label: 'Jam', key: 'jam', render: r => esc(r.jam || '-') },
      { label: 'Mapel / Agenda', key: 'mapel', render: r => esc(r.mapel || '-') },
      { label: 'Uraian Kegiatan', key: 'kegiatan', render: r => esc(r.kegiatan || '-') },
      { label: 'Hadir', key: 'jumlahHadir', render: r => (r.jumlahHadir === '' || r.jumlahHadir == null) ? '-' : esc(r.jumlahHadir) },
      ACT_COL
    ]
  });
}

/* =====================================================================
   8. CATATAN PERKEMBANGAN SISWA
   ===================================================================== */
function viewCatatan(){
  const adaSiswa = DB.siswa.length > 0;
  simpleCrud({
    key: 'catatan',
    collection: 'catatan',
    title: 'Catatan Perkembangan Siswa',
    addLabel: 'Tambah Catatan',
    searchPlaceholder: 'Cari catatan...',
    searchFields: ['catatan', 'kategori', 'tindakLanjut'],
    empty: 'Belum ada catatan perkembangan.',
    sortFn: (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')),
    beforeAdd: () => {
      if(!adaSiswa){ alert('Tambahkan data siswa terlebih dahulu di menu Data Siswa.'); return false; }
      return true;
    },
    fields: () => [
      { name: 'siswaId', label: 'Nama Siswa', type: 'select', required: true, options: siswaOptions() },
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, default: todayStr() },
      { name: 'kategori', label: 'Kategori', type: 'select', required: true, default: 'Akademik',
        options: ['Akademik', 'Sikap / Perilaku', 'Sosial', 'Emosional', 'Kehadiran', 'Lainnya'] },
      { name: 'catatan', label: 'Catatan Pengamatan', type: 'textarea', required: true },
      { name: 'tindakLanjut', label: 'Tindak Lanjut', type: 'textarea' },
      { name: 'pelapor', label: 'Dicatat Oleh', type: 'text', ph: 'Nama guru / wali kelas' }
    ],
    columns: [
      { label: 'Tanggal', key: 'tanggal', render: r => esc(fmtTanggal(r.tanggal)) },
      { label: 'Nama Siswa', render: r => `<strong>${esc(namaSiswa(r.siswaId))}</strong>` },
      { label: 'Kategori', key: 'kategori', render: r => `<span class="pill n">${esc(r.kategori || '-')}</span>` },
      { label: 'Catatan', key: 'catatan', render: r => esc(r.catatan || '-') },
      { label: 'Tindak Lanjut', key: 'tindakLanjut', render: r => esc(r.tindakLanjut || '-') },
      ACT_COL
    ],
    exportValue: (r, c) => c.key === 'siswaId' ? namaSiswa(r.siswaId) : r[c.key]
  });
}

/* =====================================================================
   9. PRESTASI & PELANGGARAN
   ===================================================================== */
function viewPrestasi(){
  const adaSiswa = DB.siswa.length > 0;
  simpleCrud({
    key: 'prestasi',
    collection: 'prestasi',
    title: 'Data Prestasi & Pelanggaran',
    addLabel: 'Tambah Data',
    searchPlaceholder: 'Cari nama kegiatan...',
    searchFields: ['nama', 'keterangan', 'tingkat'],
    empty: 'Belum ada data prestasi atau pelanggaran.',
    sortFn: (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')),
    beforeAdd: () => {
      if(!adaSiswa){ alert('Tambahkan data siswa terlebih dahulu di menu Data Siswa.'); return false; }
      return true;
    },
    fields: () => [
      { name: 'siswaId', label: 'Nama Siswa', type: 'select', required: true, options: siswaOptions() },
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, default: todayStr() },
      { name: 'jenis', label: 'Jenis', type: 'select', required: true, default: 'Prestasi',
        options: ['Prestasi', 'Pelanggaran'] },
      { name: 'nama', label: 'Nama Prestasi / Pelanggaran', type: 'text', required: true },
      { name: 'tingkat', label: 'Tingkat / Kategori', type: 'select',
        options: ['Kelas', 'Sekolah', 'Kecamatan', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional', 'Ringan', 'Sedang', 'Berat'] },
      { name: 'poin', label: 'Poin', type: 'number', min: 0, default: 0 },
      { name: 'keterangan', label: 'Keterangan', type: 'textarea' }
    ],
    columns: [
      { label: 'Tanggal', key: 'tanggal', render: r => esc(fmtTanggal(r.tanggal)) },
      { label: 'Nama Siswa', render: r => `<strong>${esc(namaSiswa(r.siswaId))}</strong>` },
      { label: 'Jenis', key: 'jenis', render: r =>
          `<span class="pill ${r.jenis === 'Prestasi' ? 'g' : 'r'}">${esc(r.jenis || '-')}</span>` },
      { label: 'Nama', key: 'nama', render: r => esc(r.nama || '-') },
      { label: 'Tingkat', key: 'tingkat', render: r => esc(r.tingkat || '-') },
      { label: 'Poin', key: 'poin', render: r => esc(r.poin ?? 0) },
      ACT_COL
    ],
    exportValue: (r, c) => c.key === 'siswaId' ? namaSiswa(r.siswaId) : r[c.key],
    bottom: () => {
      const p = DB.prestasi.filter(x => x.jenis === 'Prestasi').length;
      const v = DB.prestasi.filter(x => x.jenis === 'Pelanggaran').length;
      if(p + v === 0) return '';
      return `<div class="card">
        <h2 class="card-title">Statistik Prestasi & Pelanggaran</h2>
        <div class="chart" style="margin-top:12px">
          ${chartRow('Prestasi', p, Math.max(p, v, 1), '#16a34a')}
          ${chartRow('Pelanggaran', v, Math.max(p, v, 1), '#dc2626')}
        </div>
      </div>`;
    }
  });
}

/* =====================================================================
   10. DATA ORANG TUA / WALI
   ===================================================================== */
function viewOrtu(){
  const adaSiswa = DB.siswa.length > 0;
  simpleCrud({
    key: 'ortu',
    collection: 'ortu',
    title: 'Data Orang Tua / Wali',
    addLabel: 'Tambah Data Orang Tua',
    searchPlaceholder: 'Cari nama orang tua / wali...',
    searchFields: ['namaAyah', 'namaIbu', 'namaWali', 'telepon'],
    empty: 'Belum ada data orang tua/wali.',
    beforeAdd: () => {
      if(!adaSiswa){ alert('Tambahkan data siswa terlebih dahulu di menu Data Siswa.'); return false; }
      return true;
    },
    fields: () => [
      { name: 'siswaId', label: 'Nama Siswa', type: 'select', required: true, options: siswaOptions() },
      { name: 'namaAyah', label: 'Nama Ayah', type: 'text' },
      { name: 'pekerjaanAyah', label: 'Pekerjaan Ayah', type: 'text' },
      { name: 'namaIbu', label: 'Nama Ibu', type: 'text' },
      { name: 'pekerjaanIbu', label: 'Pekerjaan Ibu', type: 'text' },
      { name: 'namaWali', label: 'Nama Wali (jika ada)', type: 'text' },
      { name: 'telepon', label: 'No. Telepon / WA', type: 'text' },
      { name: 'alamat', label: 'Alamat', type: 'textarea' },
      { name: 'keterangan', label: 'Keterangan', type: 'textarea' }
    ],
    columns: [
      { label: 'Nama Siswa', render: r => `<strong>${esc(namaSiswa(r.siswaId))}</strong>` },
      { label: 'Ayah', render: r => esc(r.namaAyah || '-') },
      { label: 'Ibu', render: r => esc(r.namaIbu || '-') },
      { label: 'Wali', render: r => esc(r.namaWali || '-') },
      { label: 'Telepon', key: 'telepon', render: r => esc(r.telepon || '-') },
      ACT_COL
    ],
    exportValue: (r, c) => c.key === 'siswaId' ? namaSiswa(r.siswaId) : r[c.key]
  });
}

/* =====================================================================
   11. JADWAL PELAJARAN
   ===================================================================== */
function viewJadwal(){
  const urutanHari = { Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6, Minggu: 7 };
  simpleCrud({
    key: 'jadwal',
    collection: 'jadwal',
    title: 'Jadwal Pelajaran',
    addLabel: 'Tambah Jadwal',
    searchPlaceholder: 'Cari mata pelajaran atau guru...',
    searchFields: ['mapel', 'guru', 'ruang', 'hari'],
    empty: 'Belum ada jadwal pelajaran.',
    sortFn: (a, b) => {
      const d = (urutanHari[a.hari] || 99) - (urutanHari[b.hari] || 99);
      if(d !== 0) return d;
      return String(a.jamKe || '').localeCompare(String(b.jamKe || ''), 'id', { numeric: true });
    },
    fields: () => [
      { name: 'hari', label: 'Hari', type: 'select', required: true,
        options: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] },
      { name: 'jamKe', label: 'Jam Ke-', type: 'number', min: 1, required: true },
      { name: 'waktu', label: 'Waktu', type: 'text', ph: 'Contoh: 07.00 - 08.20' },
      { name: 'mapel', label: 'Mata Pelajaran', type: 'text', required: true },
      { name: 'guru', label: 'Nama Guru', type: 'text' },
      { name: 'ruang', label: 'Ruang', type: 'text' }
    ],
    columns: [
      { label: 'Hari', key: 'hari' },
      { label: 'Jam Ke', key: 'jamKe', render: r => esc(r.jamKe || '-') },
      { label: 'Waktu', key: 'waktu', render: r => esc(r.waktu || '-') },
      { label: 'Mata Pelajaran', key: 'mapel', render: r => `<strong>${esc(r.mapel || '-')}</strong>` },
      { label: 'Guru', key: 'guru', render: r => esc(r.guru || '-') },
      { label: 'Ruang', key: 'ruang', render: r => esc(r.ruang || '-') },
      ACT_COL
    ]
  });
}

/* =====================================================================
   12. INVENTARIS KELAS
   ===================================================================== */
function viewInventaris(){
  simpleCrud({
    key: 'inventaris',
    collection: 'inventaris',
    title: 'Inventaris Kelas',
    addLabel: 'Tambah Inventaris',
    searchPlaceholder: 'Cari nama barang...',
    searchFields: ['nama', 'kondisi', 'keterangan'],
    empty: 'Belum ada data inventaris kelas.',
    fields: () => [
      { name: 'nama', label: 'Nama Barang', type: 'text', required: true },
      { name: 'jumlah', label: 'Jumlah', type: 'number', min: 0, required: true, default: 1 },
      { name: 'satuan', label: 'Satuan', type: 'text', default: 'buah', ph: 'buah / unit / set' },
      { name: 'kondisi', label: 'Kondisi', type: 'select', required: true, default: 'Baik',
        options: ['Baik', 'Rusak Ringan', 'Rusak Berat'] },
      { name: 'tanggal', label: 'Tanggal Pencatatan', type: 'date', default: todayStr() },
      { name: 'keterangan', label: 'Keterangan', type: 'textarea' }
    ],
    columns: [
      { label: 'No', render: r => String(DB.inventaris.indexOf(r) + 1) },
      { label: 'Nama Barang', key: 'nama', render: r => `<strong>${esc(r.nama || '-')}</strong>` },
      { label: 'Jumlah', render: r => `${esc(r.jumlah ?? 0)} ${esc(r.satuan || '')}` },
      { label: 'Kondisi', key: 'kondisi', render: r => {
          const cls = r.kondisi === 'Baik' ? 'g' : r.kondisi === 'Rusak Ringan' ? 'y' : 'r';
          return `<span class="pill ${cls}">${esc(r.kondisi || '-')}</span>`;
        } },
      { label: 'Tanggal', key: 'tanggal', render: r => esc(fmtTanggal(r.tanggal)) },
      ACT_COL
    ],
    extraToolbar: () => `<span class="muted" style="align-self:center">${DB.inventaris.length} jenis barang</span>`
  });
}

/* =====================================================================
   13. KAS KELAS
   ===================================================================== */
function viewKas(){
  simpleCrud({
    key: 'kas',
    collection: 'kas',
    title: 'Kas Kelas',
    addLabel: 'Tambah Transaksi',
    searchPlaceholder: 'Cari keterangan transaksi...',
    searchFields: ['keterangan', 'jenis'],
    empty: 'Belum ada transaksi kas.',
    sortFn: (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')),
    fields: () => [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, default: todayStr() },
      { name: 'jenis', label: 'Jenis Transaksi', type: 'select', required: true, default: 'Masuk',
        options: [{ value: 'Masuk', label: 'Uang Masuk' }, { value: 'Keluar', label: 'Uang Keluar' }] },
      { name: 'jumlah', label: 'Jumlah (Rp)', type: 'number', required: true, min: 0 },
      { name: 'keterangan', label: 'Keterangan', type: 'text', required: true, ph: 'Contoh: Iuran bulanan' },
      { name: 'petugas', label: 'Petugas / Bendahara', type: 'text' }
    ],
    columns: [
      { label: 'Tanggal', key: 'tanggal', render: r => esc(fmtTanggal(r.tanggal)) },
      { label: 'Jenis', key: 'jenis', render: r =>
          `<span class="pill ${r.jenis === 'Masuk' ? 'g' : 'r'}">${esc(r.jenis === 'Masuk' ? 'Masuk' : 'Keluar')}</span>` },
      { label: 'Jumlah', key: 'jumlah', render: r =>
          `<strong style="color:${r.jenis === 'Masuk' ? '#16a34a' : '#dc2626'}">${rupiah(r.jumlah)}</strong>` },
      { label: 'Keterangan', key: 'keterangan', render: r => esc(r.keterangan || '-') },
      { label: 'Petugas', key: 'petugas', render: r => esc(r.petugas || '-') },
      ACT_COL
    ],
    extraToolbar: () => {
      const saldo = DB.kas.reduce((a, k) => a + (k.jenis === 'Masuk' ? num(k.jumlah) : -num(k.jumlah)), 0);
      return `<span class="pill ${saldo >= 0 ? 'g' : 'r'}" style="align-self:center">Saldo: ${rupiah(saldo)}</span>`;
    },
    bottom: () => {
      if(DB.kas.length === 0) return '';
      const masuk = DB.kas.filter(k => k.jenis === 'Masuk').reduce((a, k) => a + num(k.jumlah), 0);
      const keluar = DB.kas.filter(k => k.jenis === 'Keluar').reduce((a, k) => a + num(k.jumlah), 0);
      const saldo = masuk - keluar;
      return `<div class="card">
        <h2 class="card-title">Ringkasan Kas Kelas</h2>
        <div class="stats" style="margin-top:12px;margin-bottom:0">
          <div class="stat"><div class="si" style="background:#dcfce7;color:#166534">⬆</div>
            <div><div class="sv" style="font-size:15px">${rupiah(masuk)}</div><div class="sl">Total Masuk</div></div></div>
          <div class="stat"><div class="si" style="background:#fee2e2;color:#991b1b">⬇</div>
            <div><div class="sv" style="font-size:15px">${rupiah(keluar)}</div><div class="sl">Total Keluar</div></div></div>
          <div class="stat"><div class="si" style="background:#dbeafe;color:#1e40af">💼</div>
            <div><div class="sv" style="font-size:15px">${rupiah(saldo)}</div><div class="sl">Saldo Akhir</div></div></div>
        </div>
      </div>`;
    }
  });
}

/* =====================================================================
   14. BUKU PENGHUBUNG
   ===================================================================== */
function viewPenghubung(){
  const adaSiswa = DB.siswa.length > 0;
  simpleCrud({
    key: 'penghubung',
    collection: 'penghubung',
    title: 'Buku Penghubung',
    addLabel: 'Tambah Catatan Penghubung',
    searchPlaceholder: 'Cari isi pesan...',
    searchFields: ['isi', 'tindakLanjut', 'arah'],
    empty: 'Belum ada catatan pada buku penghubung.',
    sortFn: (a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')),
    beforeAdd: () => {
      if(!adaSiswa){ alert('Tambahkan data siswa terlebih dahulu di menu Data Siswa.'); return false; }
      return true;
    },
    fields: () => [
      { name: 'tanggal', label: 'Tanggal', type: 'date', required: true, default: todayStr() },
      { name: 'siswaId', label: 'Nama Siswa', type: 'select', required: true, options: siswaOptions() },
      { name: 'arah', label: 'Arah Komunikasi', type: 'select', required: true, default: 'Ke Orang Tua',
        options: ['Ke Orang Tua / Wali', 'Dari Orang Tua / Wali'] },
      { name: 'isi', label: 'Isi Pesan / Informasi', type: 'textarea', required: true },
      { name: 'tindakLanjut', label: 'Balasan / Tindak Lanjut', type: 'textarea' },
      { name: 'petugas', label: 'Dicatat Oleh', type: 'text' }
    ],
    columns: [
      { label: 'Tanggal', key: 'tanggal', render: r => esc(fmtTanggal(r.tanggal)) },
      { label: 'Nama Siswa', render: r => `<strong>${esc(namaSiswa(r.siswaId))}</strong>` },
      { label: 'Arah', key: 'arah', render: r => `<span class="pill n">${esc(r.arah || '-')}</span>` },
      { label: 'Isi Pesan', key: 'isi', render: r => esc(r.isi || '-') },
      { label: 'Tindak Lanjut', key: 'tindakLanjut', render: r => esc(r.tindakLanjut || '-') },
      ACT_COL
    ],
    exportValue: (r, c) => c.key === 'siswaId' ? namaSiswa(r.siswaId) : r[c.key]
  });
}

/* =====================================================================
   15. LAPORAN ADMINISTRASI
   ===================================================================== */
function viewLaporan(){
  const saldo = DB.kas.reduce((a, k) => a + (k.jenis === 'Masuk' ? num(k.jumlah) : -num(k.jumlah)), 0);
  const bulan = state.bulanRekap || todayStr().slice(0, 7);

  $('#view').innerHTML = `
    <div class="card">
      <h2 class="card-title">Laporan Administrasi Kelas</h2>
      <p class="muted" style="margin-bottom:14px">Pilih laporan yang ingin dicetak atau diekspor.</p>
      <div class="toolbar">
        <div class="field" style="margin:0">
          <label style="font-size:12px">Periode Bulan (untuk laporan absensi)</label>
          <input type="month" id="bulanLap" value="${bulan}" style="padding:8px 10px;border:1px solid var(--border);border-radius:9px">
        </div>
      </div>

      <div class="stats" style="margin-top:8px">
        <div class="stat"><div class="si" style="background:#dbeafe;color:#1e40af">👥</div>
          <div><div class="sv">${DB.siswa.length}</div><div class="sl">Siswa</div></div></div>
        <div class="stat"><div class="si" style="background:#dcfce7;color:#166534">📝</div>
          <div><div class="sv">${DB.nilai.length}</div><div class="sl">Data Nilai</div></div></div>
        <div class="stat"><div class="si" style="background:#fef3c7;color:#92400e">💰</div>
          <div><div class="sv" style="font-size:15px">${rupiah(saldo)}</div><div class="sl">Saldo Kas</div></div></div>
        <div class="stat"><div class="si" style="background:#f3e8ff;color:#6b21a8">📬</div>
          <div><div class="sv">${DB.penghubung.length}</div><div class="sl">Buku Penghubung</div></div></div>
      </div>

      <div class="table-wrap" style="margin-top:10px">
        <table>
          <thead><tr><th>Nama Laporan</th><th>Jumlah Data</th><th style="width:210px">Aksi</th></tr></thead>
          <tbody id="lapBody"></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">Manajemen Data</h2>
      <p class="muted" style="margin-bottom:14px">
        Data tersimpan di penyimpanan lokal browser (localStorage) pada perangkat ini.
        Lakukan pencadangan (backup) berkala untuk mencegah kehilangan data.
      </p>
      <div class="form-actions">
        <button class="btn btn-primary" id="btnBackup">⬇ Cadangkan Data (JSON)</button>
        <button class="btn" id="btnRestore">⬆ Pulihkan dari Cadangan</button>
        <input type="file" id="fileRestore" accept=".json,application/json" style="display:none">
        <button class="btn btn-danger" id="btnReset">🗑 Hapus Semua Data</button>
        <button class="btn btn-ghost" id="btnDemo">🧪 Muat Data Contoh (DEMO)</button>
      </div>
      <p class="muted" style="margin-top:10px">
        <strong>Catatan:</strong> tombol "Muat Data Contoh (DEMO)" akan mengisi aplikasi dengan data fiktif
        untuk keperluan uji coba. Jangan digunakan untuk data nyata.
      </p>
    </div>`;

  const laporan = [
    { nama: 'Daftar Siswa', jml: DB.siswa.length, cols: () => [
        { label: 'No', render: r => String(DB.siswa.indexOf(r) + 1) },
        { label: 'NIS', key: 'nis' }, { label: 'Nama', key: 'nama' },
        { label: 'L/P', key: 'jk' }, { label: 'Tempat Lahir', key: 'tempatLahir' },
        { label: 'Tgl Lahir', key: 'tanggalLahir' }, { label: 'Alamat', key: 'alamat' },
        { label: 'No. HP', key: 'noHp' }, { label: 'Status', key: 'status' }
      ], rows: () => DB.siswa },
    { nama: 'Rekap Absensi Bulanan', jml: Object.keys(DB.absensi).filter(k => k.startsWith(bulan)).length, khusus: 'absensi' },
    { nama: 'Daftar Nilai & Asesmen', jml: DB.nilai.length, cols: () => [
        { label: 'Tanggal', key: 'tanggal' }, { label: 'Nama Siswa', render: r => namaSiswa(r.siswaId) },
        { label: 'Mapel', key: 'mapel' }, { label: 'Jenis', key: 'jenis' },
        { label: 'Nilai', key: 'nilai' }, { label: 'Keterangan', key: 'keterangan' }
      ], rows: () => DB.nilai },
    { nama: 'Jurnal Kegiatan Kelas', jml: DB.jurnal.length, cols: () => [
        { label: 'Tanggal', key: 'tanggal' }, { label: 'Jam', key: 'jam' },
        { label: 'Mapel', key: 'mapel' }, { label: 'Kegiatan', key: 'kegiatan' },
        { label: 'Hadir', key: 'jumlahHadir' }, { label: 'Keterangan', key: 'keterangan' }
      ], rows: () => DB.jurnal },
    { nama: 'Catatan Perkembangan Siswa', jml: DB.catatan.length, cols: () => [
        { label: 'Tanggal', key: 'tanggal' }, { label: 'Nama Siswa', render: r => namaSiswa(r.siswaId) },
        { label: 'Kategori', key: 'kategori' }, { label: 'Catatan', key: 'catatan' },
        { label: 'Tindak Lanjut', key: 'tindakLanjut' }
      ], rows: () => DB.catatan },
    { nama: 'Prestasi & Pelanggaran', jml: DB.prestasi.length, cols: () => [
        { label: 'Tanggal', key: 'tanggal' }, { label: 'Nama Siswa', render: r => namaSiswa(r.siswaId) },
        { label: 'Jenis', key: 'jenis' }, { label: 'Nama', key: 'nama' },
        { label: 'Tingkat', key: 'tingkat' }, { label: 'Poin', key: 'poin' }
      ], rows: () => DB.prestasi },
    { nama: 'Data Orang Tua / Wali', jml: DB.ortu.length, cols: () => [
        { label: 'Nama Siswa', render: r => namaSiswa(r.siswaId) },
        { label: 'Ayah', key: 'namaAyah' }, { label: 'Pekerjaan', key: 'pekerjaanAyah' },
        { label: 'Ibu', key: 'namaIbu' }, { label: 'Pekerjaan', key: 'pekerjaanIbu' },
        { label: 'Telepon', key: 'telepon' }
      ], rows: () => DB.ortu },
    { nama: 'Jadwal Pelajaran', jml: DB.jadwal.length, cols: () => [
        { label: 'Hari', key: 'hari' }, { label: 'Jam Ke', key: 'jamKe' }, { label: 'Waktu', key: 'waktu' },
        { label: 'Mapel', key: 'mapel' }, { label: 'Guru', key: 'guru' }, { label: 'Ruang', key: 'ruang' }
      ], rows: () => DB.jadwal },
    { nama: 'Inventaris Kelas', jml: DB.inventaris.length, cols: () => [
        { label: 'Nama Barang', key: 'nama' }, { label: 'Jumlah', key: 'jumlah' },
        { label: 'Satuan', key: 'satuan' }, { label: 'Kondisi', key: 'kondisi' },
        { label: 'Keterangan', key: 'keterangan' }
      ], rows: () => DB.inventaris },
    { nama: 'Kas Kelas', jml: DB.kas.length, cols: () => [
        { label: 'Tanggal', key: 'tanggal' }, { label: 'Jenis', key: 'jenis' },
        { label: 'Jumlah', key: 'jumlah' }, { label: 'Keterangan', key: 'keterangan' },
        { label: 'Petugas', key: 'petugas' }
      ], rows: () => DB.kas },
    { nama: 'Buku Penghubung', jml: DB.penghubung.length, cols: () => [
        { label: 'Tanggal', key: 'tanggal' }, { label: 'Nama Siswa', render: r => namaSiswa(r.siswaId) },
        { label: 'Arah', key: 'arah' }, { label: 'Isi Pesan', key: 'isi' },
        { label: 'Tindak Lanjut', key: 'tindakLanjut' }
      ], rows: () => DB.penghubung }
  ];

  $('#lapBody').innerHTML = laporan.map((l, i) => `
    <tr>
      <td data-label="Nama Laporan"><strong>${esc(l.nama)}</strong></td>
      <td data-label="Jumlah Data">${l.jml}</td>
      <td data-label="Aksi">
        <div class="row-actions">
          <button class="btn" data-lap="${i}" data-act="print" style="padding:5px 10px;font-size:12px">🖨 Cetak</button>
          <button class="btn btn-ghost" data-lap="${i}" data-act="csv" style="padding:5px 10px;font-size:12px">⬇ CSV</button>
        </div>
      </td>
    </tr>`).join('');

  $('#lapBody').querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = () => {
      const l = laporan[Number(btn.dataset.lap)];
      if(l.khusus === 'absensi'){ cetakRekapAbsensi($('#bulanLap').value || bulan); return; }
      const cols = l.cols();
      const rows = l.rows();
      if(btn.dataset.act === 'print') printTable(l.nama, cols, rows);
      else exportCSV(l.nama.replace(/\s+/g, '_') + '.csv',
        [cols.map(c => c.label), ...rows.map(r => cols.map(c => c.key ? (r[c.key] ?? '') : (c.render ? stripTags(c.render(r)) : '')))]);
    };
  });

  $('#bulanLap').onchange = e => { state.bulanRekap = e.target.value; };

  function cetakRekapAbsensi(b){
    const keys = Object.keys(DB.absensi).filter(k => k.startsWith(b));
    const c = {};
    DB.siswa.forEach(s => c[s.id] = { H: 0, S: 0, I: 0, A: 0 });
    keys.forEach(k => Object.entries(DB.absensi[k] || {}).forEach(([sid, st]) => {
      if(!c[sid]) c[sid] = { H: 0, S: 0, I: 0, A: 0 };
      if(c[sid][st] != null) c[sid][st]++;
    }));
    const rows = DB.siswa.map((s, i) => {
      const x = c[s.id];
      const tot = x.H + x.S + x.I + x.A;
      return { no: i + 1, nis: s.nis || '-', nama: s.nama, ...x, persen: tot ? (x.H / tot * 100).toFixed(1) + '%' : '-' };
    });
    printHTML('Rekap Absensi', `<h2>Rekap Absensi Bulanan</h2>
      <p style="margin:0 0 10px;color:#475569">Periode: <strong>${esc(fmtBulan(b))}</strong> • ${keys.length} hari tercatat</p>
      ${identitasHeaderHTML()}
      <table><thead><tr><th>No</th><th>NIS</th><th>Nama</th><th>H</th><th>S</th><th>I</th><th>A</th><th>% Hadir</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${r.no}</td><td>${esc(r.nis)}</td><td>${esc(r.nama)}</td>
        <td>${r.H}</td><td>${r.S}</td><td>${r.I}</td><td>${r.A}</td><td>${r.persen}</td></tr>`).join('')}</tbody></table>`);
  }

  /* --- Manajemen data --- */
  $('#btnBackup').onclick = () => {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_administrasi_kelas_${todayStr()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('Cadangan berhasil diunduh');
  };

  $('#btnRestore').onclick = () => $('#fileRestore').click();

  $('#fileRestore').onchange = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if(typeof parsed !== 'object' || parsed === null) throw new Error('Format tidak valid');
        if(!confirm('Pulihkan data dari berkas ini?\nSeluruh data yang ada saat ini akan DIGANTI.')) return;
        DB = Object.assign(defaultDB(), parsed);
        save();
        updateHeader();
        navigate('laporan');
        toast('Data berhasil dipulihkan');
      } catch (err) {
        alert('Gagal memulihkan data: berkas tidak valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  $('#btnReset').onclick = () => {
    if(!confirm('HAPUS SEMUA DATA aplikasi?\nTindakan ini tidak dapat dibatalkan.')) return;
    if(!confirm('Konfirmasi terakhir: seluruh data siswa, absensi, nilai, dan lainnya akan hilang permanen. Lanjutkan?')) return;
    DB = defaultDB();
    save();
    updateHeader();
    navigate('dashboard');
    toast('Semua data telah dihapus');
  };

  $('#btnDemo').onclick = () => {
    if(!confirm('Muat DATA CONTOH (DEMO)?\nData yang ada akan ditambahkan/digantikan dengan data fiktif untuk uji coba.')) return;
    muatDataDemo();
  };
}

/* ---------------------- DATA DEMO ---------------------- */
function muatDataDemo(){
  DB = defaultDB();
  DB.identitas = {
    sekolah: '[DEMO] SMP Contoh Nusantara',
    npsn: '00000000',
    namaKelas: 'VII A (DEMO)',
    tingkat: 'VII',
    waliKelas: '[DEMO] Budi Santoso, S.Pd.',
    nipWali: '-',
    tahunAjaran: '2025/2026',
    semester: 'Ganjil',
    ruangKelas: 'R-DEMO',
    catatan: 'Data ini hanya contoh (DEMO) untuk uji coba aplikasi. Bukan data nyata.'
  };

  const namaDemo = ['Siswa Demo 1','Siswa Demo 2','Siswa Demo 3','Siswa Demo 4','Siswa Demo 5','Siswa Demo 6'];
  DB.siswa = namaDemo.map((n, i) => ({
    id: 'demo' + i,
    nis: 'DEMO' + String(i + 1).padStart(3, '0'),
    nama: n,
    jk: i % 2 === 0 ? 'L' : 'P',
    tempatLahir: '-',
    tanggalLahir: '',
    agama: '-',
    alamat: '-',
    noHp: '-',
    status: 'Aktif',
    keterangan: 'Data DEMO'
  }));

  for(let d = 0; d < 3; d++){
    const dt = new Date();
    dt.setDate(dt.getDate() - d);
    const key = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
    DB.absensi[key] = {};
    DB.siswa.forEach((s, i) => {
      DB.absensi[key][s.id] = ['H','H','H','S','I','A'][(i + d) % 6];
    });
  }

  DB.nilai = DB.siswa.flatMap((s, i) => ([
    { id: uid(), siswaId: s.id, mapel: 'Matematika', jenis: 'Ulangan Harian', nilai: 70 + ((i * 7) % 25), tanggal: todayStr(), semester: 'Ganjil', keterangan: 'DEMO' },
    { id: uid(), siswaId: s.id, mapel: 'Bahasa Indonesia', jenis: 'Tugas', nilai: 75 + ((i * 5) % 20), tanggal: todayStr(), semester: 'Ganjil', keterangan: 'DEMO' }
  ]));

  DB.jurnal = [{ id: uid(), tanggal: todayStr(), jam: '07.00 - 08.20', mapel: 'Matematika',
    kegiatan: '[DEMO] Pembahasan materi bilangan bulat.', jumlahHadir: DB.siswa.length, keterangan: 'DEMO' }];

  DB.catatan = [{ id: uid(), siswaId: 'demo0', tanggal: todayStr(), kategori: 'Akademik',
    catatan: '[DEMO] Menunjukkan peningkatan dalam mengerjakan latihan.', tindakLanjut: 'Diberikan pengayaan.', pelapor: '[DEMO] Wali Kelas' }];

  DB.prestasi = [
    { id: uid(), siswaId: 'demo1', tanggal: todayStr(), jenis: 'Prestasi', nama: '[DEMO] Juara 2 Lomba Cerdas Cermat', tingkat: 'Sekolah', poin: 10, keterangan: 'DEMO' },
    { id: uid(), siswaId: 'demo2', tanggal: todayStr(), jenis: 'Pelanggaran', nama: '[DEMO] Terlambat masuk kelas', tingkat: 'Ringan', poin: 2, keterangan: 'DEMO' }
  ];

  DB.ortu = [{ id: uid(), siswaId: 'demo0', namaAyah: '[DEMO] Ayah Siswa 1', pekerjaanAyah: '-',
    namaIbu: '[DEMO] Ibu Siswa 1', pekerjaanIbu: '-', namaWali: '', telepon: '08xx-xxxx-xxxx', alamat: '-', keterangan: 'DEMO' }];

  DB.jadwal = [
    { id: uid(), hari: 'Senin', jamKe: 1, waktu: '07.00 - 08.20', mapel: '[DEMO] Matematika', guru: '[DEMO] Guru A', ruang: 'R-DEMO' },
    { id: uid(), hari: 'Senin', jamKe: 2, waktu: '08.20 - 09.40', mapel: '[DEMO] Bahasa Indonesia', guru: '[DEMO] Guru B', ruang: 'R-DEMO' }
  ];

  DB.inventaris = [
    { id: uid(), nama: '[DEMO] Papan Tulis', jumlah: 1, satuan: 'buah', kondisi: 'Baik', tanggal: todayStr(), keterangan: 'DEMO' },
    { id: uid(), nama: '[DEMO] Kursi Siswa', jumlah: 20, satuan: 'buah', kondisi: 'Baik', tanggal: todayStr(), keterangan: 'DEMO' }
  ];

  DB.kas = [
    { id: uid(), tanggal: todayStr(), jenis: 'Masuk', jumlah: 300000, keterangan: '[DEMO] Iuran kelas', petugas: '[DEMO] Bendahara' },
    { id: uid(), tanggal: todayStr(), jenis: 'Keluar', jumlah: 75000, keterangan: '[DEMO] Pembelian spidol & penghapus', petugas: '[DEMO] Bendahara' }
  ];

  DB.penghubung = [{ id: uid(), tanggal: todayStr(), siswaId: 'demo0', arah: 'Ke Orang Tua / Wali',
    isi: '[DEMO] Mohon perhatian belajar di rumah.', tindakLanjut: '-', petugas: '[DEMO] Wali Kelas' }];

  save();
  updateHeader();
  navigate('dashboard');
  toast('Data DEMO berhasil dimuat');
}

/* =====================================================================
   NAVIGASI
   ===================================================================== */
const VIEWS = {
  dashboard:  viewDashboard,
  identitas:  viewIdentitas,
  siswa:      viewSiswa,
  absensi:    viewAbsensi,
  rekapAbsen: viewRekapAbsen,
  nilai:      viewNilai,
  jurnal:     viewJurnal,
  catatan:    viewCatatan,
  prestasi:   viewPrestasi,
  ortu:       viewOrtu,
  jadwal:     viewJadwal,
  inventaris: viewInventaris,
  kas:        viewKas,
  penghubung: viewPenghubung,
  laporan:    viewLaporan
};

function navigate(key){
  if(!VIEWS[key]) key = 'dashboard';
  state.current = key;
  $('#pageTitle').textContent = (MENU.find(m => m.key === key) || {}).label || 'Dashboard';
  $$('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.key === key));
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  VIEWS[key]();
}

function updateHeader(){
  const d = DB.identitas || {};
  const badge = $('#badgeKelas');
  if(d.namaKelas){
    badge.textContent = 'Kelas ' + d.namaKelas + (d.waliKelas ? ' • ' + d.waliKelas : '');
  } else {
    badge.textContent = 'Kelas belum diatur';
  }
  document.title = (d.namaKelas ? 'Kelas ' + d.namaKelas + ' — ' : '') + 'Administrasi Kelas Digital';
}

function buildNav(){
  $('#nav').innerHTML = MENU.map(m =>
    `<button class="nav-item" data-key="${m.key}">
      <span class="ic">${m.icon}</span><span>${esc(m.label)}</span>
    </button>`).join('');
  $$('#nav .nav-item').forEach(b => b.onclick = () => navigate(b.dataset.key));
}

function openSidebar(){ $('#sidebar').classList.add('open'); $('#overlay').classList.add('show'); }
function closeSidebar(){ $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); }

/* =====================================================================
   INISIALISASI
   ===================================================================== */
$('#btnMenu').onclick = () => {
  if($('#sidebar').classList.contains('open')) closeSidebar(); else openSidebar();
};
$('#overlay').onclick = closeSidebar;

$('#btnQuickBackup').onclick = () => {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_administrasi_kelas_${todayStr()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast('Cadangan berhasil diunduh');
};

window.addEventListener('resize', () => {
  if(window.innerWidth > 1024) closeSidebar();
});

buildNav();
updateHeader();
navigate('dashboard');

if(!storageOK){
  setTimeout(() => toast('⚠️ Penyimpanan lokal tidak tersedia. Data tidak akan tersimpan.'), 900);
}