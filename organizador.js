/* Organizador de Evoluções - Leo (versão celular / favorito)
   Roda DENTRO da página do sistema. Nenhum dado de paciente sai do aparelho. */
(function () {
  if (window.__OEL) { window.__OEL.toggle(); return; }

  const LS = 'oel_perfis_v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const br = s => s.split('-').reverse().join('/');
  const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  async function until(fn, ms, msg) {
    const t = Date.now();
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() - t > ms) throw new Error(msg);
      await sleep(100);
    }
  }

  // preenche campos mesmo em sistemas que "escutam" eventos (React etc.)
  function setVal(el, v) {
    const P = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(P.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const S = { perfis: {}, pac: [], atrib: {}, brush: '', rodando: false, parar: false, res: null };
  // perfis do Organizador do computador; usados enquanto você não colar outros em "Perfis"
  const PERFIS_PADRAO = {"1":{"nome":"Tens - Laser - Cinesio","marcar":["er_Alongamentos_Pertinentes","er_Exercícios_Fortalecimento_Muscular","laser_1_J_cm_","laser_3_J_cm_","tensa_20_min","res_Evolução_Satisfatória"],"eva":null,"intensidade":"","obs":""},"2":{"nome":"Tens + Liberação + Cinesio","marcar":["er_Alongamentos_Pertinentes","er_Exercícios_Fortalecimento_Muscular","er_Liberação_Miofascial","er_Relaxamento","er_Trabalho_de_Mobilidade","tensa_20_min","res_Evolução_Satisfatória"],"eva":null,"intensidade":"","obs":""},"3":{"nome":"Tens + IV + Relaxamento/Alongamentos","marcar":["er_Alongamentos_Pertinentes","er_Relaxamento","iv_10_min","tensa_20_min","res_Evolução_Satisfatória"],"eva":null,"intensidade":"","obs":""},"9":{"nome":"Cinesio + Laser + Alongamento (S/ Tens)","marcar":["er_Alongamentos_Pertinentes","er_Exercícios_Fortalecimento_Muscular","er_Trabalho_de_Mobilidade","laser_1_J_cm_","res_Evolução_Satisfatória"],"eva":null,"intensidade":"","obs":""},"4":{"nome":"Pós OP - Full Cinesio S/Tens e S/Laser","marcar":["er_Alongamentos_Pertinentes","er_Exercícios_Fortalecimento_Muscular","er_Manipulação_Articular","er_Propriocepção","er_Trabalho_de_Mobilidade","tensa_20_min","res_Evolução_Satisfatória","res_Ganho_ADM","res_Ganho_FM"],"eva":null,"intensidade":"","obs":""},"6":{"nome":"Pós OP - Start - Manipulação Art; Mobilidade; Tens; Laser","marcar":["er_Manipulação_Articular","er_Trabalho_de_Mobilidade","laser_1_J_cm_","tensa_20_min"],"eva":null,"intensidade":"","obs":""},"5":{"nome":"Pós OP - FES / Full Cinesio","marcar":["er_Alongamentos_Pertinentes","er_Exercícios_Fortalecimento_Muscular","er_Manipulação_Articular","er_Trabalho_de_Mobilidade","fess_15_min"],"eva":null,"intensidade":"","obs":""}};
  try { S.perfis = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { }
  if (!Object.keys(S.perfis).length) S.perfis = JSON.parse(JSON.stringify(PERFIS_PADRAO));

  // histórico de evoluções SALVAS (fica só neste aparelho); usado para exportar para Excel
  const LH = 'oel_hist_v1';
  S.hist = [];
  try { S.hist = JSON.parse(localStorage.getItem(LH) || '[]'); } catch (e) { }

  /* ---------------- robô (mesma lógica do bot do computador) ---------------- */
  const modal = () => $$('.overlay').find(o => $$('.modalTitle', o).some(t => t.textContent.includes('Nova Evolução')));
  const btn = (root, t) => $$('button', root).filter(b => b.textContent.includes(t));
  const busca = () => $('input[placeholder="Buscar paciente..."]');

  async function fechar() {
    for (let i = 0; i < 5 && $('.overlay'); i++) {
      const b = $$('.overlay .btnClose').pop();
      if (b) b.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(300);
    }
  }

  async function lista() {
    if ($('tbody tr')) return;
    const el = $$('body *').find(e => !e.children.length && e.textContent.trim() === 'Prontuários');
    if (!el) throw new Error('Abra a lista de Prontuários no sistema.');
    el.click();
    await until(() => $('tbody tr'), 20000, 'Não consegui chegar na lista de Prontuários.');
  }

  async function carregar() {
    await fechar(); await lista();
    const b = busca();
    if (b && b.value) { setVal(b, ''); await sleep(500); }
    const rows = $$('tbody tr').map(tr => Array.from(tr.children).map(td => td.innerText.trim()));
    if (!rows.length) throw new Error('Nenhum paciente encontrado na tela.');
    S.pac = rows; render();
    log(rows.length + ' pacientes carregados.');
  }

  async function preencher(perf, data) {
    const d = $('#evo_date', modal());
    if (!d) throw new Error('campo de data não encontrado no formulário');
    setVal(d, data); await sleep(80);
    if (d.value !== data) throw new Error('não consegui definir a data ' + br(data) + ' no formulário');

    const est = e => e.className + '|' + (e.querySelector('input') ? e.querySelector('input').checked : '');
    const item = cid => $$('.checkItem', modal()).filter(e => e.dataset.id === cid);
    for (const cid of perf.marcar || []) {
      const l = item(cid);
      if (l.length !== 1) throw new Error('opção não encontrada no formulário: ' + cid);
      const antes = est(l[0]);
      l[0].click(); await sleep(80);
      const dep = item(cid)[0];
      if (!dep || est(dep) === antes) throw new Error('o clique não marcou: ' + cid);
    }
    if (perf.eva !== null && perf.eva !== undefined && perf.eva !== '') {
      const b = () => $$('button.evaBtn', modal())[Number(perf.eva)];
      if (!b()) throw new Error('botão EVA ' + perf.eva + ' não encontrado');
      const antes = b().className;
      b().click(); await sleep(80);
      if (b().className === antes) throw new Error('o clique não marcou EVA ' + perf.eva);
    }
    if (perf.intensidade) setVal($('#us_wcm2', modal()), String(perf.intensidade));
    if (perf.obs) setVal($('#evo_obs', modal()), perf.obs);
  }

  async function limparBusca() { const b = busca(); if (b) setVal(b, ''); }

  async function processar(nome, perf, modo, data) {
    await fechar(); await lista();
    const b = busca();
    if (!b) throw new Error('campo de busca não encontrado');
    setVal(b, nome); await sleep(600);
    const re = n => n.textContent.trim() === nome;
    const linhas = () => $$('tbody tr').filter(tr => $$('strong', tr).some(re));
    await until(() => linhas().length, 5000, 'paciente não encontrado na lista');
    const l = linhas();
    if (l.length > 1) log('   aviso: há nomes repetidos, usando o primeiro');
    $$('strong', l[0]).find(re).click();

    const add = await until(() => btn(document, 'Adicionar Evolução').pop(), 20000, 'botão Adicionar Evolução não apareceu');
    add.click();
    await until(modal, 20000, 'formulário Nova Evolução não abriu');
    await preencher(perf, data);

    const cancelar = async () => { const m = modal(); if (m) btn(m, 'Cancelar')[0].click(); await fechar(); await limparBusca(); };

    if (modo === 'simulacao') {
      await sleep(2000); await cancelar();
      return 'SIMULADO (preenchido com data ' + br(data) + ', não salvo)';
    }
    if (modo === 'confirmar') {
      const r = await ask('Paciente: ' + nome + ' — perfil: ' + perf.nome + ' — data: ' + br(data) + '. Confira o formulário.');
      if (r === 'parar') { await cancelar(); return 'PARADO'; }
      if (r === 'nao') { await cancelar(); return 'PULADO pelo usuário'; }
    }
    btn(modal(), 'Salvar Evolução')[0].click();
    await until(() => !modal(), 20000, 'clicou em Salvar mas o formulário não fechou — VERIFIQUE no sistema se salvou');
    await fechar(); await limparBusca();
    return 'SALVO (data ' + br(data) + ')';
  }

  async function play() {
    if (S.rodando) return;
    const data = $('#oel-d').value;
    if (!data) { alert('Escolha a data das evoluções.'); return; }
    const jobs = S.pac.filter(r => S.perfis[S.atrib[r[0]]]).map(r => [r[0], S.perfis[S.atrib[r[0]]], S.atrib[r[0]]]);
    if (!jobs.length) { alert('Marque pacientes com um perfil antes.'); return; }
    const modo = $('#oel-m').value;
    if (modo === 'auto' && !confirm('Vai SALVAR evolução em ' + jobs.length + ' paciente(s), todas com a data ' + br(data) + '.\nRecomendo testar antes em Simulação. Continuar?')) return;

    S.rodando = true; S.parar = false;
    P.style.display = 'none'; pill.style.display = 'none'; bar.style.display = 'flex'; barBtns();
    const oAlert = window.alert, oConfirm = window.confirm;
    window.alert = m => log('  [aviso do sistema] ' + m);
    window.confirm = () => true;
    let ok = 0;
    try {
      log('Data das evoluções: ' + br(data));
      for (let i = 0; i < jobs.length; i++) {
        if (S.parar) { log('Parado pelo usuário.'); break; }
        const [nome, perf, ch] = jobs[i];
        $('#oel-bt').textContent = '[' + (i + 1) + '/' + jobs.length + '] ' + nome;
        log('[' + (i + 1) + '/' + jobs.length + '] ' + nome + ' — perfil ' + ch + ' (' + perf.nome + ')');
        let res;
        try { res = await processar(nome, perf, modo, data); }
        catch (e) { res = 'FALHA: ' + String(e.message || e).split('\n')[0]; try { await fechar(); } catch (_) { } }
        if (res.startsWith('SALVO')) { ok++; registrar(nome, perf, ch, data); }
        log('   -> ' + res);
        if (res === 'PARADO') break;
      }
      log(modo === 'simulacao' ? 'Fim da simulação (nada foi salvo).' : 'Fim. ' + ok + ' evolução(ões) salva(s) de ' + jobs.length + '.');
    } catch (e) { log('ERRO: ' + String(e.message || e).split('\n')[0]); }
    window.alert = oAlert; window.confirm = oConfirm;
    S.rodando = false; bar.style.display = 'none'; P.style.display = 'flex';
  }

  /* ---------------- interface ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  #oel-p,#oel-bar{position:fixed;z-index:2147483647;left:0;right:0;bottom:0;background:#eef3fa;color:#1b2a3a;font:14px 'Segoe UI',system-ui,sans-serif;box-shadow:0 -4px 18px #0004;border-top:1px solid #8fb0d6}
  #oel-p{display:flex;flex-direction:column;max-height:88vh}
  @media(min-width:700px){#oel-p{left:auto;right:16px;bottom:16px;width:480px;border:1px solid #8fb0d6;border-radius:10px;overflow:hidden}}
  #oel-p *{box-sizing:border-box;font-family:inherit}
  #oel-p .h{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:linear-gradient(#e0edfb,#b6cfec);border-bottom:1px solid #8fb0d6;color:#1d3a5f;font-size:15px}
  #oel-p .b{padding:10px;overflow:auto;display:flex;flex-direction:column;gap:8px}
  #oel-p .r{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  #oel-p button,#oel-bar button{background:linear-gradient(#fbfbfb 50%,#e1e1e1 50%);border:1px solid #8a8f98;border-radius:7px;padding:9px 12px;font-size:14px;font-weight:600;color:#1b2a3a;min-height:40px}
  #oel-p button.ok,#oel-bar button.ok{background:linear-gradient(#8be39a 50%,#2fa244 50%);border-color:#1d6b2c;color:#fff}
  #oel-bar button.no{background:linear-gradient(#f3978c 50%,#c8412f 50%);border-color:#8c2218;color:#fff}
  #oel-p button.on{background:linear-gradient(#c8e7f8 50%,#9ccfee 50%);border-color:#2b6490}
  #oel-p input,#oel-p select,#oel-p textarea{border:1px solid #a9bfd8;border-radius:6px;padding:9px;font-size:15px;background:#fff;color:#1b2a3a;min-height:40px}
  #oel-p textarea{width:100%;font:12px Consolas,monospace}
  #oel-p small{color:#4b6a8f}
  #oel-l{max-height:34vh;overflow:auto;background:#fff;border:1px solid #a9bfd8;border-radius:6px}
  #oel-l .pr{display:flex;justify-content:space-between;gap:8px;padding:11px 10px;border-bottom:1px solid #e4eef9}
  #oel-l .pr.m{background:#d9f2dc}
  #oel-l .pr b{color:#1f4f8a;white-space:nowrap}
  #oel-log{margin:0;max-height:16vh;overflow:auto;background:#fff;border:1px solid #a9bfd8;border-radius:6px;padding:6px;font:11px Consolas,monospace;white-space:pre-wrap}
  #oel-bar{display:none;align-items:center;gap:8px;padding:10px;flex-wrap:wrap}
  #oel-bt{flex:1;min-width:140px;font-weight:600}
  #oel-pill{position:fixed;z-index:2147483647;right:12px;bottom:12px;background:linear-gradient(#e0edfb,#b6cfec);border:1px solid #8fb0d6;border-radius:20px;padding:10px 14px;font:600 14px system-ui,sans-serif;color:#1d3a5f;box-shadow:0 2px 10px #0004;display:none}`;
  document.head.appendChild(css);

  const P = document.createElement('div');
  P.id = 'oel-p';
  P.innerHTML = `
  <div class="h"><b>Organizador de Evoluções - Leo</b><button data-a="min">▾</button></div>
  <div class="b">
    <div class="r"><button data-a="car">Carregar pacientes</button><button data-a="imp">Perfis</button></div>
    <div id="oel-i" style="display:none"><textarea id="oel-t" rows="6" placeholder="Cole aqui o conteúdo do arquivo perfis.json"></textarea>
      <div class="r"><button class="ok" data-a="salvarp">Salvar perfis</button><small>O arquivo perfis.json fica na pasta do Organizador no computador.</small></div></div>
    <div class="r"><button data-a="d-">◀</button><input type="date" id="oel-d"><button data-a="d+">▶</button><button data-a="hj">Hoje</button><small id="oel-dia"></small></div>
    <select id="oel-m"><option value="simulacao">Simulação (preenche, NÃO salva)</option><option value="confirmar">Confirmar cada paciente</option><option value="auto">Automático (salva direto)</option></select>
    <div id="oel-br" class="r"></div><small id="oel-lg"></small>
    <div class="r"><input id="oel-q" placeholder="Buscar na lista..." style="flex:1;min-width:0"><button data-a="lq">✕ Limpar</button></div>
    <div id="oel-l"></div>
    <div class="r"><small id="oel-c" style="flex:1"></small><button data-a="lim">Limpar</button><button class="ok" data-a="play">▶ PLAY</button></div>
    <div class="r"><button class="ok" data-a="exp">📥 Exportar Excel</button><button data-a="limh">Zerar histórico</button><small id="oel-h" style="flex:1"></small></div>
    <pre id="oel-log"></pre>
  </div>`;
  const bar = document.createElement('div');
  bar.id = 'oel-bar';
  bar.innerHTML = '<span id="oel-bt"></span><span id="oel-bb" style="display:flex;gap:6px"></span>';
  const pill = document.createElement('div');
  pill.id = 'oel-pill'; pill.textContent = '📋 Organizador';
  document.body.append(P, bar, pill);

  const log = m => {
    const l = $('#oel-log'), d = new Date(), s = document.createElement('span');
    s.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '  ' + m + '\n';
    if (/FALHA|ERRO/.test(m)) { s.style.color = '#c0261b'; s.style.fontWeight = '700'; }
    l.appendChild(s); l.scrollTop = l.scrollHeight;
  };
  const salvarPerfis = () => { try { localStorage.setItem(LS, JSON.stringify(S.perfis)); } catch (e) { log('Não consegui guardar os perfis neste navegador.'); } };
  const barBtns = () => { $('#oel-bb').innerHTML = '<button class="no" data-a="parar">■ Parar</button>'; };
  function ask(txt) {
    return new Promise(res => {
      $('#oel-bt').textContent = txt;
      $('#oel-bb').innerHTML = '<button class="ok" data-r="sim">Salvar</button><button data-r="nao">Pular</button><button class="no" data-r="parar">Parar</button>';
      S.res = r => { S.res = null; barBtns(); res(r); };
    });
  }

  /* ---------------- histórico + exportar para Excel ---------------- */
  const contH = () => { const e = $('#oel-h'); if (e) e.textContent = S.hist.length + ' evolução(ões) no histórico'; };
  const salvarHist = () => { try { localStorage.setItem(LH, JSON.stringify(S.hist)); } catch (e) { log('Não consegui guardar o histórico neste navegador.'); } };
  const limpaProc = id => id.replace(/^(er|res)_/, '').replace(/_/g, ' ').trim();

  function registrar(nome, perf, ch, data) {
    // mesma data + mesmo paciente = substitui (evita duplicar se rodar de novo)
    S.hist = S.hist.filter(h => !(h.d === data && h.n === nome));
    S.hist.push({ d: data, n: nome, p: ch, pn: perf.nome || '', pr: (perf.marcar || []).map(limpaProc).join(', ') });
    salvarHist(); contH();
  }

  function exportar() {
    if (!S.hist.length) { log('Nada para exportar: ainda não há evoluções salvas no histórico.'); return; }
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const cab = ['Data', 'Dia da semana', 'Paciente', 'Perfil', 'Procedimentos'];
    const linhas = [cab.map(q).join(';')];
    S.hist.slice().sort((a, b) => a.d.localeCompare(b.d) || a.n.localeCompare(b.n)).forEach(h =>
      linhas.push([br(h.d), DIAS[new Date(h.d + 'T12:00:00').getDay()], h.n, h.p + ' - ' + h.pn, h.pr].map(q).join(';')));
    // BOM + ponto e vírgula: o Excel em português abre com acentos e colunas certinhos
    const blob = new Blob(['\uFEFF' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'evolucoes_' + iso(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    log('Exportado: ' + S.hist.length + ' linha(s) em ' + a.download);
  }

  function renderBrush() {
    const ks = Object.keys(S.perfis).sort();
    if (!ks.includes(S.brush) && S.brush !== '0') S.brush = ks[0] || '';
    $('#oel-br').innerHTML = ks.map(k => `<button data-b="${k}" class="${k === S.brush ? 'on' : ''}">${k}</button>`).join('') +
      (ks.length ? `<button data-b="0" class="${S.brush === '0' ? 'on' : ''}">✕</button>` : '');
    $('#oel-lg').textContent = ks.length ? 'Toque no número do perfil e depois nos pacientes. ' + ks.map(k => k + ': ' + S.perfis[k].nome).join(' · ') : 'Nenhum perfil ainda. Toque em "Perfis" e cole o perfis.json do computador.';
  }
  function render() {
    const f = $('#oel-q').value.trim().toLowerCase();
    $('#oel-l').innerHTML = S.pac.map((r, i) => [r, i]).filter(([r]) => !f || r[0].toLowerCase().includes(f))
      .map(([r, i]) => `<div class="pr${S.atrib[r[0]] ? ' m' : ''}" data-i="${i}"><span>${esc(r[0])}</span><b>${S.atrib[r[0]] || ''}</b></div>`).join('');
    cont();
  }
  const cont = () => { $('#oel-c').textContent = S.pac.length + ' pacientes · ' + Object.keys(S.atrib).length + ' com perfil'; };
  function dia() {
    const v = $('#oel-d').value;
    $('#oel-dia').textContent = v ? DIAS[new Date(v + 'T12:00:00').getDay()] : 'escolha a data';
  }
  function moverData(n) {
    const v = $('#oel-d').value || iso(new Date());
    const [y, m, d] = v.split('-').map(Number);
    $('#oel-d').value = iso(new Date(y, m - 1, d + n)); dia();
  }
  const mostrar = v => { P.style.display = v ? 'flex' : 'none'; pill.style.display = v || S.rodando ? 'none' : 'block'; };

  const falha = e => log('ERRO: ' + String(e.message || e).split('\n')[0]);
  const acoes = {
    min: () => mostrar(false),
    car: () => carregar().catch(falha),
    imp: () => { const i = $('#oel-i'); i.style.display = i.style.display === 'none' ? 'block' : 'none'; $('#oel-t').value = Object.keys(S.perfis).length ? JSON.stringify(S.perfis, null, 1) : ''; },
    salvarp: () => {
      const bruto = $('#oel-t').value;
      try {
        // aceita texto com aspas curvas, espaços estranhos e palavras antes/depois das chaves
        const limpa = bruto.replace(/[\u201C\u201D\u201E\u201F\u2033\u02BA]/g, '"').replace(/[\u00A0\u200B\uFEFF]/g, ' ');
        const a = limpa.indexOf('{'), z = limpa.lastIndexOf('}');
        if (a < 0 || z < a) throw new Error('não achei o texto entre { e }');
        const o = JSON.parse(limpa.slice(a, z + 1));
        if (!o || typeof o !== 'object' || !Object.values(o).every(p => p && Array.isArray(p.marcar))) throw new Error('formato inesperado');
        S.perfis = o; salvarPerfis(); renderBrush(); $('#oel-i').style.display = 'none'; log(Object.keys(o).length + ' perfis salvos.');
      } catch (e) {
        log('ERRO: texto dos perfis inválido (' + e.message + '). Começo do texto na caixa: ' + JSON.stringify(bruto.slice(0, 30)) + ' — tamanho: ' + bruto.length);
      }
    },
    'd-': () => moverData(-1), 'd+': () => moverData(1),
    hj: () => { $('#oel-d').value = iso(new Date()); dia(); },
    lim: () => { S.atrib = {}; render(); },
    lq: () => { const q = $('#oel-q'); q.value = ''; render(); q.focus(); },
    exp: () => exportar(),
    limh: () => {
      if (!S.hist.length) return;
      if (confirm('Apagar o histórico de ' + S.hist.length + ' evolução(ões) deste aparelho? Exporte antes se quiser guardar.')) { S.hist = []; salvarHist(); contH(); log('Histórico zerado.'); }
    },
    play: () => play(),
    parar: () => { S.parar = true; if (S.res) S.res('parar'); }
  };

  P.addEventListener('click', e => {
    const a = e.target.closest('[data-a]'), b = e.target.closest('[data-b]'), r = e.target.closest('.pr');
    if (a) acoes[a.dataset.a]();
    else if (b) { S.brush = b.dataset.b; renderBrush(); }
    else if (r) {
      const nome = S.pac[+r.dataset.i][0];
      if (S.brush === '0' || S.atrib[nome] === S.brush) delete S.atrib[nome]; else if (S.brush) S.atrib[nome] = S.brush;
      r.className = 'pr' + (S.atrib[nome] ? ' m' : ''); r.lastChild.textContent = S.atrib[nome] || ''; cont();
    }
  });
  bar.addEventListener('click', e => {
    const a = e.target.closest('[data-a]'), r = e.target.closest('[data-r]');
    if (a) acoes[a.dataset.a](); else if (r && S.res) S.res(r.dataset.r);
  });
  pill.addEventListener('click', () => mostrar(true));
  $('#oel-q').addEventListener('input', render);
  $('#oel-d').addEventListener('change', dia);

  $('#oel-d').value = iso(new Date());
  dia(); renderBrush(); render(); contH();
  window.__OEL = { toggle: () => mostrar(P.style.display === 'none') };
})();
