/* Mapeador de Evoluções (SOMENTE LEITURA) - roda dentro da página do sistema.
   Não salva nada. Gera um relatório de texto para você me enviar. */
(function () {
  if (window.__MAPA) { window.__MAPA.toggle(); return; }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const MESES = 'janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez';

  // anos das datas encontradas num texto (só anos plausíveis)
  function anosDatas(t) {
    const o = []; let m;
    const r1 = /(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/g;
    while ((m = r1.exec(t))) o.push(+(m[3].length === 2 ? '20' + m[3] : m[3]));
    const r2 = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
    while ((m = r2.exec(t))) o.push(+m[1]);
    const r3 = new RegExp('(?<!\\d)(\\d{1,2})\\s+(?:de\\s+)?(' + MESES + ')\\.?,?\\s+(?:de\\s+)?(\\d{4})(?!\\d)', 'gi');
    while ((m = r3.exec(t))) o.push(+m[3]);
    const lim = new Date().getFullYear() + 1;
    return o.filter(y => y >= 2000 && y <= lim);
  }

  const contexto = p => {
    let e = p;
    for (let i = 0; i < 3 && e.parentElement && (e.textContent || '').length < 60; i++) e = e.parentElement;
    return (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  };

  // nós de texto visíveis que contêm data (ignora nascimento e o próprio painel)
  function nosComData() {
    const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (!p || p.closest('#mapa-p,script,style')) continue;
      if (!p.getClientRects().length) continue;
      if (!anosDatas(n.nodeValue).length) continue;
      if (/nasc/i.test(contexto(p))) continue;
      out.push(n);
    }
    return out;
  }

  // copia o elemento sem dados sensíveis: só estrutura, classes, ids, data-*, estado marcado
  function limpa(el) {
    const orig = [el, ...$$('*', el)];
    const c = el.cloneNode(true);
    const cl = [c, ...$$('*', c)];
    orig.forEach((o, i) => {
      const x = cl[i];
      if (!x) return;
      if (o.tagName === 'INPUT' && (o.type === 'checkbox' || o.type === 'radio')) x.setAttribute('data-estado-checked', String(o.checked));
    });
    $$('script,style,svg,img,noscript', c).forEach(x => x.remove());
    [c, ...$$('*', c)].forEach(x => {
      Array.from(x.attributes).forEach(a => {
        const n = a.name;
        const ok = n === 'class' || n === 'id' || n.startsWith('data-') || n === 'type' || n === 'checked' || n === 'disabled' || n === 'role' || n.startsWith('aria-') || n === 'for' || n === 'name' || n === 'placeholder';
        if (!ok) x.removeAttribute(n);
        else if (a.value.length > 80) x.setAttribute(n, a.value.slice(0, 80) + '…');
      });
    });
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    const nos = []; let n;
    while ((n = w.nextNode())) nos.push(n);
    nos.forEach(t => {
      let v = t.nodeValue.replace(/\s+/g, ' ');
      v = v.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '#CPF#').replace(/\d{7,}/g, '#').replace(/\S+@\S+/g, '#email#');
      if (v.length > 60) v = v.slice(0, 40) + '…[+' + (v.length - 40) + ' letras]';
      t.nodeValue = v;
    });
    return c.outerHTML.replace(/>\s+</g, '><');
  }

  const desc = e => e.tagName + (e.id ? '#' + e.id : '') + (e.getAttribute('class') ? '.' + e.getAttribute('class').trim().replace(/\s+/g, '.') : '');

  // "cartão" de uma evolução = maior ancestral que ainda contém só UMA data
  function cartao(no, nos) {
    let e = no.parentElement;
    const dentro = x => nos.filter(n => x.contains(n)).length;
    while (e.parentElement && e.parentElement !== document.body && dentro(e.parentElement) === dentro(e)) e = e.parentElement;
    return e;
  }

  // formulário: se já houver um aberto (com opções), lê ele; senão abre "Adicionar Evolução", lê e CANCELA
  async function lerFormulario() {
    let m = $$('.overlay').find(o => $$('.checkItem', o).length);
    let abri = false;
    if (!m) {
      const add = $$('button').filter(b => b.textContent.includes('Adicionar Evolução')).pop();
      if (!add) return 'Formulário: não achei o botão "Adicionar Evolução" (abra um paciente antes).';
      add.click(); abri = true;
      for (let i = 0; i < 100 && !m; i++) { await sleep(100); m = $$('.overlay').find(o => $$('.checkItem', o).length); }
      if (!m) return 'Formulário: não abriu a tempo.';
      await sleep(500);
    }
    const linhas = [];
    linhas.push('Título do formulário: ' + $$('.modalTitle', m).map(t => t.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
    linhas.push('Formulário aberto por mim (e cancelado depois): ' + (abri ? 'sim' : 'não, já estava aberto'));
    linhas.push('--- OPÇÕES (data-id | texto | classe | marcada?) ---');
    $$('.checkItem', m).forEach(e => {
      const i = e.querySelector('input');
      linhas.push((e.dataset.id || '?') + ' | ' + e.textContent.replace(/\s+/g, ' ').trim() + ' | ' + e.className + ' | ' + (i ? i.checked : '-'));
    });
    linhas.push('--- EVA (posição:texto:classe) ---');
    $$('button.evaBtn', m).forEach((b, i) => linhas.push(i + ':' + b.textContent.trim() + ':' + b.className));
    linhas.push('--- CAMPOS ---');
    $$('input,textarea,select', m).forEach(x => linhas.push(x.tagName + '#' + x.id + ' type=' + (x.type || '') + ' valor=' + (x.type === 'checkbox' || x.type === 'radio' ? x.checked : String(x.value || '').slice(0, 12))));
    if (abri) {
      const c = $$('button', m).find(b => b.textContent.includes('Cancelar'));
      if (c) c.click();
      await sleep(400);
    }
    return linhas.join('\n');
  }

  async function mapear() {
    const rel = [];
    rel.push('RELATÓRIO DO MAPEADOR — ' + new Date().toLocaleString('pt-BR'));
    rel.push('Endereço (só o domínio): ' + location.host);
    const nos = nosComData();
    rel.push('Datas visíveis encontradas na tela: ' + nos.length);
    const cards = [];
    nos.forEach(n => { const c = cartao(n, nos); if (!cards.includes(c)) cards.push(c); });
    rel.push('Blocos de evolução prováveis: ' + cards.length);
    if (cards.length) {
      rel.push('Pai dos blocos: ' + desc(cards[0].parentElement));
      cards.slice(0, 2).forEach((c, i) => {
        rel.push('');
        rel.push('=== BLOCO ' + (i + 1) + ' (' + desc(c) + ') ===');
        rel.push('Texto simples: ' + c.innerText.replace(/\s+/g, ' ').trim().replace(/\d{7,}/g, '#').slice(0, 300));
        rel.push('HTML:');
        rel.push(limpa(c).slice(0, 6000));
      });
    } else {
      rel.push('Nenhuma data visível: abra o paciente, entre na aba de evoluções e expanda a mais recente.');
    }
    rel.push('');
    rel.push('=== FORMULÁRIO ===');
    try { rel.push(await lerFormulario()); } catch (e) { rel.push('Formulário: erro ' + String(e.message || e)); }
    return rel.join('\n');
  }

  /* ---------------- painel ---------------- */
  const css = document.createElement('style');
  css.textContent = `#mapa-p{position:fixed;z-index:2147483647;left:0;right:0;bottom:0;background:#fff7e6;color:#2a2a2a;font:14px system-ui,sans-serif;border-top:2px solid #d9a441;box-shadow:0 -4px 18px #0004;padding:10px;display:flex;flex-direction:column;gap:8px;max-height:70dvh}
  #mapa-p *{box-sizing:border-box}
  #mapa-p .r{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  #mapa-p button{border:1px solid #8a8f98;border-radius:7px;padding:9px 12px;font-size:14px;font-weight:600;min-height:40px;background:#fff}
  #mapa-p button.ok{background:#2fa244;color:#fff;border-color:#1d6b2c}
  #mapa-p textarea{width:100%;font:11px Consolas,monospace;min-height:120px;border:1px solid #d9a441;border-radius:6px;padding:6px}
  @media(min-width:700px){#mapa-p{left:auto;right:16px;bottom:16px;width:480px;border:1px solid #d9a441;border-radius:10px}}`;
  document.head.appendChild(css);

  const P = document.createElement('div');
  P.id = 'mapa-p';
  P.innerHTML = `<div class="r"><b style="flex:1">Mapeador (só leitura)</b><button data-a="x">✕</button></div>
  <small>1) Abra um paciente e a aba de evoluções. 2) Expanda a evolução mais recente (ou abra ela). 3) Toque em Mapear.</small>
  <div class="r"><button class="ok" data-a="go">Mapear</button><button data-a="cp">Copiar</button></div>
  <small id="mapa-s"></small>
  <textarea id="mapa-t" readonly placeholder="O relatório aparece aqui"></textarea>`;
  document.body.appendChild(P);

  const st = m => { $('#mapa-s').textContent = m; };
  let ocupado = false;
  P.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'x') P.style.display = 'none';
    if (a.dataset.a === 'go' && !ocupado) {
      ocupado = true; st('Mapeando...');
      try {
        const t = await mapear();
        $('#mapa-t').value = t; st('Pronto. Revise o texto, troque qualquer nome de paciente por X e toque em Copiar.');
      } catch (er) { st('ERRO: ' + String(er.message || er)); }
      ocupado = false;
    }
    if (a.dataset.a === 'cp') {
      const ta = $('#mapa-t'); let ok = false;
      try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (_) { }
      if (!ok) { try { ta.select(); ta.setSelectionRange(0, ta.value.length); ok = document.execCommand('copy'); } catch (_) { } }
      st(ok ? 'Copiado!' : 'Não consegui copiar: segure o texto da caixa e copie manualmente.');
    }
  });
  window.__MAPA = { toggle: () => { P.style.display = P.style.display === 'none' ? 'flex' : 'none'; } };
})();
