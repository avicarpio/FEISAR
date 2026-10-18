/* ==========================================================
   FEISAR — UI & motion (Lenis + vanilla)
   Unofficial Wipeout fan site
   ========================================================== */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const fmt = (n, d = 0) => {
    const [i, f] = Math.abs(n).toFixed(d).split('.');
    return (n < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
  };
  const initials = name => { const w = name.split(' ').filter(x => /^[A-Z]/.test(x)); return (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };
  // list prices in 2207 euros: shown in millions
  const euro = n => '<small class="cur">€</small>' + fmt(n / 1e6, 1) + '<small class="cur"> M</small>';
  const { SHIPS, HQS, PILOTS } = window.FEISAR;

  /* ---------------------------------------------------------
     STAR RINGS
     --------------------------------------------------------- */
  const starPts = (cx, cy, R, r = R * .42) => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      p.push((cx + Math.cos(a) * rr).toFixed(2) + ',' + (cy + Math.sin(a) * rr).toFixed(2));
    }
    return p.join(' ');
  };
  const ring = (cx, cy, rad, size, n = 12) => Array.from({ length: n }, (_, i) => {
    const a = i / n * Math.PI * 2 - Math.PI / 2;
    return `<polygon points="${starPts(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, size)}"/>`;
  }).join('');
  $('#bootRing').innerHTML = ring(100, 100, 72, 11);
  $('#okRing').innerHTML = ring(100, 100, 72, 12);
  $('#unityRing').innerHTML = ring(110, 110, 66, 8);
  $('#unityCodes').innerHTML = HQS.map((h, i) =>
    `<text x="110" y="14" text-anchor="middle" transform="rotate(${i * 30} 110 110)">${h.city.toUpperCase()}</text>`).join('');

  /* ---------------------------------------------------------
     SPLIT TEXT
     --------------------------------------------------------- */
  let chIndex = 0;
  $$('[data-split]').forEach(el => {
    const words = el.textContent.split(' ');
    el.textContent = '';
    words.forEach((w, wi) => {
      const word = document.createElement('span');
      word.className = 'word';
      for (const c of w) {
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = c;
        s.style.setProperty('--i', chIndex++);
        word.appendChild(s);
      }
      el.appendChild(word);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* ---------------------------------------------------------
     LENIS SMOOTH SCROLL
     --------------------------------------------------------- */
  let lenis = null;
  if (window.Lenis && !REDUCED) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.stop();
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const nav = $('#nav');
  const scrollToEl = el => {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    nav.classList.remove('open');
    scrollToEl(el);
  });

  /* ---------------------------------------------------------
     BOOT
     --------------------------------------------------------- */
  (() => {
    const boot = $('#boot'), log = $('#bootLog'), bar = $('#bootBar'), pct = $('#bootPct');
    const lines = [
      '> FEISAR AG-SYS // FEDERAL BUILD 2207',
      '> OPERATIONAL HQ ............ VÄSTERÅS',
      '> TRU-FLY™ STABILITY CORE ... ONLINE',
      '> SYRUS THRUST CHAMBERS ..... 98.2%',
      '> MEMBER STATE NODES ........ 12/12',
      '> AG-FIELD STABILITY ........ 99.997%',
      '> STRENGTH IN UNITY.',
    ];
    const dur = REDUCED ? 300 : 2100;
    const t0 = performance.now();
    let shown = 0, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setTimeout(() => window.dispatchEvent(new Event('feisar:ignite')), 350);
      boot.classList.add('done');
      document.body.classList.remove('is-loading');
      setTimeout(() => document.body.classList.add('ready'), 450);
      lenis && lenis.start();
      setTimeout(() => boot.classList.add('gone'), 1500);
    };
    const step = now => {
      const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 2.2);
      bar.style.transform = `scaleX(${e})`;
      pct.textContent = String(Math.round(e * 100)).padStart(3, '0') + '%';
      const want = Math.min(lines.length, Math.floor(e * lines.length + .3));
      while (shown < want) { const d = document.createElement('div'); d.textContent = lines[shown++]; log.appendChild(d); }
      if (p < 1) requestAnimationFrame(step); else arm();
    };
    // the site opens by itself as soon as the bar is full and the craft is loaded
    let modelReady = false, barDone = false;
    const arm = () => { barDone = true; if (modelReady || REDUCED) finish(); };
    addEventListener('feisar:model-ready', () => { modelReady = true; if (barDone) finish(); });
    setTimeout(() => { modelReady = true; if (barDone) finish(); }, 9000);
    requestAnimationFrame(step);
    addEventListener('keydown', e => { if (e.key === 'Escape') finish(); });
  })();

  /* ---------------------------------------------------------
     TEXT SCRAMBLE
     --------------------------------------------------------- */
  const GLYPHS = 'ABCDEFGHJKLMNOPQRSTUVXYZ0123456789/<>[]—_+*#';
  function scrambleTo(el, text, dur = 800) {
    if (REDUCED) { el.textContent = text; return; }
    const from = el.textContent, len = Math.max(from.length, text.length), t0 = performance.now();
    cancelAnimationFrame(el._scr);
    const step = now => {
      const p = clamp((now - t0) / dur, 0, 1);
      let out = '';
      for (let i = 0; i < len; i++) {
        const start = (i / len) * .55;
        if (p >= start + .45) out += text[i] || '';
        else if (p > start) out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        else out += from[i] || '';
      }
      el.textContent = out;
      if (p < 1) el._scr = requestAnimationFrame(step);
    };
    el._scr = requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------
     FLEET CARDS
     --------------------------------------------------------- */
  const statsHTML = (st, zero) => st.map(([k, v, max]) =>
    `<div class="stat${v > max ? ' over' : ''}"><span>${k}</span><div class="stat__bar"><i style="--v:${zero ? 0 : Math.min(v / max, 1)}"></i></div><b>${zero ? '—' : `${v}/${max}`}</b></div>`).join('');

  (() => {
    const track = $('#fleetTrack');
    track.innerHTML = SHIPS.map((s, i) => `
      <article class="ship-card" data-ship="${i}">
        <div class="ship-card__inner">
          <div class="ship-card__glare"></div>
          <div class="ship-card__top">
            <span class="ship-card__league mono">${s.league}</span>
            <span class="ship-card__year">${s.year}</span>
          </div>
          <div class="ship-card__art">
            ${s.champion ? '<span class="badge mono">★ 2164 champion</span>' : ''}
            ${s.price === null ? '<span class="badge mono">Prototype</span>' : ''}
            <img src="${s.img}" alt="${s.name}" loading="lazy" referrerpolicy="no-referrer" class="${s.small ? 'small' : ''}">
          </div>
          <div class="ship-card__code">${s.code} · ${s.cls}</div>
          <h3 class="ship-card__name">${s.name}</h3>
          <div class="ship-card__game">${s.game}</div>
          <div class="stats">${statsHTML(s.stats, true)}</div>
          <div class="ship-card__foot">
            <span class="ship-card__price">${s.price ? euro(s.price) : 'On request'}</span>
            <button class="ship-card__cfg" data-cfg="${i}">Spec sheet</button>
          </div>
        </div>
      </article>`).join('') + `
      <article class="ship-card ship-card--end">
        <div class="ship-card__inner">
          <span class="mono">FEISAR federal fleet</span>
          <h3>Every craft.<br>Every league.<br>One continent behind you.</h3>
          <a href="#acquire" class="btn btn--yellow magnetic"><span>Join with us</span><i class="chev">›</i></a>
        </div>
      </article>`;
    $('#fleetTotal').textContent = String(SHIPS.length).padStart(2, '0');

    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const s = SHIPS[e.target.dataset.ship];
      $$('.stat', e.target).forEach((row, j) => {
        const [, v, max] = s.stats[j];
        setTimeout(() => { row.querySelector('i').style.setProperty('--v', Math.min(v / max, 1)); row.querySelector('b').textContent = `${v}/${max}`; }, 200 + j * 110);
      });
      io.unobserve(e.target);
    }), { threshold: .4 });
    $$('.ship-card[data-ship]').forEach(c => io.observe(c));
  })();

  /* ---------------------------------------------------------
     SPEC SHEET
     --------------------------------------------------------- */
  const spec = (() => {
    const tabs = $('#specTabs'), imgBox = $('#specImg');
    let cur = -1, shownPrice = 0;
    tabs.innerHTML = SHIPS.map((s, i) => `<button class="spec__tab" data-s="${i}">${s.code}</button>`).join('');
    $('#formCraft').innerHTML = SHIPS.map((s, i) => `<option value="${i}">${s.name} — ${s.league} (${s.year})</option>`).join('');
    const tweenPrice = to => {
      const from = shownPrice, t0 = performance.now();
      const step = now => {
        const p = clamp((now - t0) / 800, 0, 1), e = 1 - Math.pow(1 - p, 3);
        shownPrice = lerp(from, to, e);
        $('#specPrice').innerHTML = euro(Math.round(shownPrice / 1e5) * 1e5);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const set = i => {
      if (i === cur) return;
      cur = i;
      const s = SHIPS[i];
      $$('.spec__tab', tabs).forEach(b => b.classList.toggle('on', +b.dataset.s === i));
      $$('img', imgBox).forEach(old => { old.classList.remove('enter'); old.classList.add('leave'); setTimeout(() => old.remove(), 600); });
      const img = new Image();
      img.referrerPolicy = 'no-referrer'; img.src = s.img; img.alt = s.name;
      img.className = 'enter' + (s.small ? ' small' : '');
      imgBox.appendChild(img);
      scrambleTo($('#specName'), s.name.toUpperCase(), 700);
      scrambleTo($('#specCode'), s.code, 600);
      $('#specLeague').textContent = s.cls;
      $('#specGame').textContent = s.game;
      $('#specDims').textContent = s.dims ? `L × W × H  ${s.dims}` : `${s.league} · ${s.year}`;
      $('#specDesc').textContent = s.desc;
      $('#specStats').innerHTML = statsHTML(s.stats, true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        $$('#specStats .stat').forEach((row, j) => {
          const [, v, max] = s.stats[j];
          row.querySelector('i').style.setProperty('--v', Math.min(v / max, 1));
          row.querySelector('b').textContent = `${v}/${max}`;
        });
      }));
      $('#specTech').innerHTML = s.tech.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
      $('#specPilots').innerHTML = s.pilots.map(p => `<span class="chip"><i>${initials(p)}</i>${p}</span>`).join('');
      if (s.price) tweenPrice(s.price); else { $('#specPrice').textContent = 'On request'; shownPrice = 0; }
      $('#formCraft').value = i;
    };
    tabs.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) set(+b.dataset.s); });
    set(SHIPS.findIndex(s => s.id === 'fx350'));

    const viewer = $('#specViewer');
    if (FINE) {
      viewer.addEventListener('pointermove', e => {
        const r = viewer.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        imgBox.style.transform = `translate(${x * 18}px, ${y * 12}px)`;
      });
      viewer.addEventListener('pointerleave', () => { imgBox.style.transform = ''; });
    }
    return { set };
  })();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cfg]');
    if (!b) return;
    spec.set(+b.dataset.cfg);
    scrollToEl($('#spec'));
  });

  /* ---------------------------------------------------------
     PILOTS
     --------------------------------------------------------- */
  $('#pilotsGrid').innerHTML = PILOTS.map((p, i) => `
    <article class="pilot reveal${p.gold ? ' gold' : ''}" style="--d:${i % 3}">
      <div class="pilot__top">
        <div class="pilot__avatar">${initials(p.name)}</div>
        <div class="pilot__league mono">${p.league}<span>${p.years}</span></div>
      </div>
      <h4>${p.name}</h4>
      <p>${p.note}</p>
      <div class="pilot__code"><div class="pilot__bar"></div><span class="mono">FSR-PIL-${String(i + 1).padStart(3, '0')}</span></div>
    </article>`).join('');

  /* ---------------------------------------------------------
     CHART
     --------------------------------------------------------- */
  (() => {
    const data = [9.4, 10.1, 10.8, 11.6, 12.9, 13.8, 15.1, 16.4, 17.2, 18.7, 21.3];
    $('#chartBars').innerHTML = data.map((v, i) =>
      `<div class="chart__bar" style="--i:${i};--h:${v / 24 * 100}%"><i></i><em>€${v}bn</em><span>${String((2197 + i) % 100).padStart(2, '0')}</span></div>`).join('');
  })();

  /* ---------------------------------------------------------
     EUROPE DOT MAP — twelve headquarters
     --------------------------------------------------------- */
  (() => {
    const LON0 = -12, LON1 = 32, LAT0 = 64, LAT1 = 34, VW = 600, VH = 560;
    const px = (lon, lat) => [(lon - LON0) / (LON1 - LON0) * VW, (LAT0 - lat) / (LAT0 - LAT1) * VH];
    const polys = [
      [[-9, 37], [-9.5, 39], [-9, 42.5], [-8, 43.7], [-2, 43.5], [-1.3, 46], [-4.6, 47.8], [-1.5, 48.7], [1.5, 50], [3, 51.3], [4.5, 52.6], [5, 53.4], [8.5, 53.8], [8.5, 55.5], [8, 57], [10.5, 57.7], [10.7, 56], [12.5, 55.5], [10.5, 54.4], [14, 54], [18, 54.8], [21, 55], [21, 57], [24, 57.5], [24, 59.4], [28, 59.5], [30, 60.2], [42, 61], [42, 44], [38, 44.5], [36, 45.2], [33, 44.5], [30, 45.6], [28.5, 43.5], [28, 41.7], [26, 40.6], [24, 40.7], [23.5, 38], [22, 36.5], [21, 38], [19.5, 40.5], [19.5, 42], [16, 43.5], [13.6, 45.6], [12.3, 45.3], [12.5, 44], [14, 42.2], [16, 41.4], [18.5, 40.2], [17, 39], [16, 38], [15.6, 40.1], [14.2, 40.8], [12, 41.8], [10.5, 43], [8.5, 44.3], [7, 43.6], [4, 43.5], [3, 42.5], [3.2, 41.8], [0.5, 40.6], [-0.3, 39.5], [0, 38.6], [-2, 36.7], [-5.5, 36], [-7.5, 37]],
      [[5.5, 58], [5, 61], [5, 62.5], [8, 63.5], [12, 66], [15, 68.5], [18, 70], [23, 71], [28, 71], [30, 70], [29, 69], [28.5, 68], [30, 67], [29.5, 64], [31, 62.5], [28, 60.6], [25, 60.3], [22.5, 60.1], [21.5, 61.5], [21.5, 63.5], [25, 65], [24, 65.8], [21.5, 65.5], [19, 63.5], [17.5, 62.5], [17, 61], [18.6, 60], [16.5, 57.5], [16, 56.2], [14, 55.4], [12.8, 55.7], [11, 58.9], [10.5, 59.3], [8, 58]],
      [[-5.7, 50], [1.5, 51], [1.7, 52.8], [0, 53.5], [-1.5, 55], [-2, 56], [-1.8, 57.5], [-3, 58.6], [-5, 58.6], [-6, 57.5], [-5.5, 56], [-4.8, 55], [-3, 54.8], [-3.2, 53.4], [-4.5, 53.3], [-4.3, 52.5], [-5.2, 51.8], [-3, 51.4]],
      [[-6, 52], [-6, 54], [-7.5, 55.3], [-10, 54.2], [-10, 52], [-9, 51.5]],
      [[8.2, 39], [9.8, 39.2], [9.6, 41.1], [8.2, 40.9]],
      [[8.6, 41.4], [9.5, 41.4], [9.5, 43], [8.6, 42.6]],
      [[12.4, 38], [15.6, 38.2], [15.1, 36.7], [12.5, 37.6]],
      [[23.5, 35.3], [26.3, 35.1], [26, 35.4], [23.6, 35.6]],
    ];
    const inside = (x, y, poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    let dots = '';
    const step = 10;
    for (let y = step / 2; y < VH; y += step)
      for (let x = step / 2; x < VW; x += step) {
        const lon = LON0 + x / VW * (LON1 - LON0), lat = LAT0 - y / VH * (LAT0 - LAT1);
        if (polys.some(p => inside(lon, lat, p))) dots += `<circle class="map-dot" cx="${x}" cy="${y}" r="1.7"/>`;
      }
    $('#mapDots').innerHTML = dots;
    const op = px(HQS[0].lon, HQS[0].lat);
    $('#mapLinks').innerHTML = HQS.slice(1).map((s, i) => {
      const [x, y] = px(s.lon, s.lat);
      const mx = (op[0] + x) / 2 + (y - op[1]) * .2, my = (op[1] + y) / 2 - (x - op[0]) * .2 - 16;
      return `<path class="map-link" data-site="${i + 1}" d="M${op[0]} ${op[1]} Q${mx} ${my} ${x} ${y}"/>`;
    }).join('');
    const leftLabels = ['LS', 'BC', 'TL', 'PA', 'AM'];
    $('#mapNodes').innerHTML = HQS.map((s, i) => {
      const [x, y] = px(s.lon, s.lat);
      const left = leftLabels.includes(s.code);
      return `<g class="map-node${s.op ? ' map-op' : ''}" data-site="${i}" transform="translate(${x} ${y})">
        <circle class="pulse" r="6" style="animation-delay:${i * .22}s"/>
        ${s.op ? '<rect x="-12" y="-12" width="24" height="24"/>' : ''}
        <circle class="core" r="${s.op ? 6 : 4.5}"/>
        <text x="${left ? -12 : 12}" y="4" text-anchor="${left ? 'end' : 'start'}">${s.city.toUpperCase()}</text>
      </g>`;
    }).join('');
    $('#sitesList').innerHTML = HQS.map((s, i) => `<li data-site="${i}" class="${s.op ? 'op' : ''}"><span class="mono">${String(i + 1).padStart(2, '0')}</span><b>${s.city}</b></li>`).join('');
    const info = $('#mapInfo');
    let auto = 0, user = false;
    const select = i => {
      $$('.map-node, .sites li').forEach(el => el.classList.toggle('on', +el.dataset.site === i));
      $$('.map-link').forEach(el => el.classList.toggle('on', +el.dataset.site === i));
      scrambleTo(info, `${String(i + 1).padStart(2, '0')} · ${HQS[i].city.toUpperCase()} — ${HQS[i].role.toUpperCase()}`, 650);
    };
    const pick = e => { const el = e.target.closest('[data-site]'); if (el) { user = true; select(+el.dataset.site); } };
    ['mouseover', 'click'].forEach(ev => { $('#sitesList').addEventListener(ev, pick); $('#mapNodes').addEventListener(ev, pick); });
    const sec = $('#network');
    setInterval(() => {
      if (user || document.hidden) return;
      const r = sec.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) select(auto++ % HQS.length);
    }, 2400);
  })();

  /* ---------------------------------------------------------
     STOCK CHART
     --------------------------------------------------------- */
  (() => {
    const cv = $('#stockCanvas'), ctx = cv.getContext('2d');
    const priceEl = $('#stockPrice'), deltaEl = $('#stockDelta');
    let W = 0, H = 0, data = [], open = 0, visible = false, vol = 4, drawP = 0;
    const gen = (n, v, start) => { const a = [start]; for (let i = 1; i < n; i++) a.push(a[i - 1] + (Math.random() - .46) * v); return a; };
    const setRange = k => {
      const cfg = { '1D': [120, 4, 2376], '1M': [120, 18, 2100], '1Y': [120, 50, 1500], 'MAX': [160, 60, 120] }[k];
      vol = cfg[1]; data = gen(cfg[0], cfg[1], cfg[2]);
      if (k === 'MAX') data = data.map((v, i) => Math.max(40, 120 + i * 14.4 + (v - 120 - i * 2) * .5));
      data[data.length - 1] = 2418.6; open = data[0]; drawP = 0;
    };
    setRange('1D');
    $('.stock__tabs').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('.stock__tabs button').forEach(x => x.classList.toggle('on', x === b));
      setRange(b.textContent);
    });
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); addEventListener('resize', resize);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
    setInterval(() => { if (visible) { data.push(data[data.length - 1] + (Math.random() - .47) * vol); data.shift(); } }, 900);
    let mouse = null;
    cv.addEventListener('pointermove', e => { mouse = e.clientX - cv.getBoundingClientRect().left; });
    cv.addEventListener('pointerleave', () => { mouse = null; });
    const frame = () => {
      requestAnimationFrame(frame);
      if (!visible || !W) return;
      drawP = Math.min(1, drawP + .02);
      const mn = Math.min(...data), mx = Math.max(...data), pad = 20;
      const X = i => i / (data.length - 1) * W, Y = v => pad + (1 - (v - mn) / (mx - mn || 1)) * (H - pad * 2);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(10,21,48,.07)'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const y = pad + i * (H - pad * 2) / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const n = Math.max(2, Math.floor(data.length * (1 - Math.pow(1 - drawP, 3))));
      const col = '#0047bb';
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(0,71,187,.18)'); grad.addColorStop(1, 'rgba(0,71,187,0)');
      ctx.beginPath(); ctx.moveTo(X(0), H);
      for (let i = 0; i < n; i++) ctx.lineTo(X(i), Y(data[i]));
      ctx.lineTo(X(n - 1), H); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < n; i++) i ? ctx.lineTo(X(i), Y(data[i])) : ctx.moveTo(X(i), Y(data[i]));
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      const lx = X(n - 1), ly = Y(data[n - 1]);
      ctx.fillStyle = '#ffcc00'; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = .3 + .3 * Math.sin(performance.now() / 220);
      ctx.beginPath(); ctx.arc(lx, ly, 12, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      let shown = data[data.length - 1];
      if (mouse != null) {
        const i = clamp(Math.round(mouse / W * (data.length - 1)), 0, data.length - 1);
        shown = data[i];
        ctx.strokeStyle = 'rgba(10,21,48,.35)'; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(X(i), 0); ctx.lineTo(X(i), H); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(i), Y(data[i]), 5, 0, 7); ctx.fill();
      }
      priceEl.textContent = fmt(shown, 2);
      const d = (shown - open) / open * 100;
      deltaEl.textContent = (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(2) + '%';
      deltaEl.className = d >= 0 ? 'up' : 'down';
    };
    requestAnimationFrame(frame);
  })();

  /* ---------------------------------------------------------
     REVEALS / COUNTERS / SCRAMBLE
     --------------------------------------------------------- */
  const countUp = el => {
    const to = parseFloat(el.dataset.count), d = +(el.dataset.decimals || 0), pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    const t0 = performance.now(), dur = REDUCED ? 1 : 2000;
    const step = now => {
      const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 4);
      el.innerHTML = (pre === '€' ? '<small class="cur">€</small>' : pre) + fmt(to * e, d) + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  $$('.scramble').forEach(el => { el.dataset.text = el.textContent; el.textContent = el.textContent.replace(/\S/g, ' '); });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    if (el.classList.contains('scramble')) setTimeout(() => scrambleTo(el, el.dataset.text, 1000), 80);
    $$('[data-count]', el).forEach(countUp);
    io.unobserve(el);
  }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal, .scramble, .chart, .tl__item').forEach(el => io.observe(el));

  /* ---------------------------------------------------------
     CURSOR / MAGNETIC / TILT
     --------------------------------------------------------- */
  if (FINE) {
    const cur = $('#cursor'), dot = $('#cursorDot');
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px,${my}px)`;
      if (!document.body.classList.contains('has-cursor')) { cx = mx; cy = my; document.body.classList.add('has-cursor'); }
    });
    (function loop() {
      cx = lerp(cx, mx, .2); cy = lerp(cy, my, .2);
      cur.style.transform = `translate(${cx}px,${cy}px)`;
      requestAnimationFrame(loop);
    })();
    const hoverSel = 'a, button, [data-tilt], .ship-card, .sites li, .map-node, .dir, .pilot, input, select, .spec__viewer';
    document.addEventListener('mouseover', e => cur.classList.toggle('hover', !!e.target.closest(hoverSel)));

    document.addEventListener('pointermove', e => {
      const m = e.target.closest('.magnetic');
      $$('.magnetic.mag-on').forEach(x => { if (x !== m) { x.classList.remove('mag-on'); x.style.transform = ''; } });
      if (!m) return;
      const r = m.getBoundingClientRect();
      m.classList.add('mag-on');
      m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
    });
    const tilt = (host, inner, max) => {
      host.addEventListener('pointermove', e => {
        const r = host.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        inner.style.transform = `rotateY(${(px - .5) * max}deg) rotateX(${(.5 - py) * max}deg)`;
        inner.style.setProperty('--gx', px * 100 + '%'); inner.style.setProperty('--gy', py * 100 + '%');
      });
      host.addEventListener('pointerleave', () => { inner.style.transform = ''; });
    };
    $$('[data-tilt]').forEach(h => tilt(h, h.firstElementChild, 12));
    $$('.ship-card').forEach(h => tilt(h, h.firstElementChild, 9));
  }

  $('#burger').addEventListener('click', () => nav.classList.toggle('open'));

  /* ---------------------------------------------------------
     MARQUEES
     --------------------------------------------------------- */
  const marquees = $$('[data-marquee]').map(el => { el.innerHTML += el.innerHTML + el.innerHTML; return { el, dir: parseFloat(el.dataset.marquee), x: 0, w: 0 }; });
  const measure = () => marquees.forEach(m => { m.w = m.el.scrollWidth / 3; });
  addEventListener('load', measure); addEventListener('resize', measure);
  document.fonts && document.fonts.ready.then(measure);
  measure();

  /* ---------------------------------------------------------
     MAIN LOOP
     --------------------------------------------------------- */
  const fleet = $('#fleet'), fleetTrack = $('#fleetTrack'), fleetProg = $('#fleetProg'), fleetIdx = $('#fleetIdx'), fleetBg = $('.fleet__bgtype');
  const tlFill = $('#tlFill'), tl = $('#tl');
  const parallax = $$('[data-speed]');
  const sectors = $$('[data-sector]');
  const links = $$('#navLinks a');
  const hudSpeed = $('#hudSpeed'), hudBar = $('#hudBar'), hudSector = $('#hudSector'), progress = $('#progress');
  const cardInners = $$('.ship-card__inner', fleetTrack);
  let navY = 0, last = scrollY, sv = 0, prevT = performance.now(), hudIdle = -1e4;
  const hud = $('#hud');

  const sizeFleet = () => {
    if (innerWidth <= 900) { fleet.style.height = ''; return; }
    fleet.style.height = (innerHeight + Math.max(0, fleetTrack.scrollWidth - innerWidth) * 1.1) + 'px';
  };
  addEventListener('resize', sizeFleet); addEventListener('load', sizeFleet);
  sizeFleet();

  const tick = now => {
    requestAnimationFrame(tick);
    const dt = Math.min((now - prevT) / 1000, .05) || .016; prevT = now;
    const y = scrollY;
    const v = (y - last) / dt; last = y;
    sv = lerp(sv, v, .1);
    document.documentElement.style.setProperty('--skew', `${clamp(sv * -.006, -9, 9).toFixed(2)}deg`);

    marquees.forEach(m => {
      if (!m.w) return;
      m.x -= ((REDUCED ? 0 : 45) + Math.abs(sv) * .08) * m.dir * dt;
      m.x = ((m.x % m.w) - m.w) % m.w;
      m.el.style.transform = `translate3d(${m.x}px,0,0)`;
    });

    nav.classList.toggle('scrolled', y > 40);
    if (Math.abs(y - navY) > 10) {
      nav.classList.toggle('hidden', y > navY && y > 600 && !nav.classList.contains('open'));
      navY = y;
    }

    const docH = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${clamp(y / (docH || 1), 0, 1)})`;
    hudSpeed.textContent = String(Math.min(9999, Math.round(Math.abs(sv) * .9))).padStart(4, '0');
    if (Math.abs(v) > 30) hudIdle = now;
    hud.classList.toggle('on', document.body.classList.contains('ready') && now - hudIdle < 1400);
    hudBar.style.width = Math.min(100, Math.abs(sv) / 40) + '%';

    const mid = innerHeight * .45;
    let active = null;
    for (const s of sectors) { const r = s.getBoundingClientRect(); if (r.top < mid && r.bottom > mid) active = s; }
    if (active) {
      hudSector.textContent = String(active.dataset.sector).padStart(2, '0');
      links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + active.id));
    }

    if (!REDUCED) parallax.forEach(el => {
      const r = el.parentElement.getBoundingClientRect();
      el.style.transform = `translate3d(${r.top * parseFloat(el.dataset.speed)}px,0,0)`;
    });

    if (innerWidth > 900) {
      const r = fleet.getBoundingClientRect();
      const total = fleet.offsetHeight - innerHeight;
      const p = clamp(-r.top / (total || 1), 0, 1);
      const extra = fleetTrack.scrollWidth - innerWidth;
      fleetTrack.style.transform = `translate3d(${-p * extra}px,0,0)`;
      fleetBg.style.transform = `translate3d(${-p * extra * .3}px,0,0)`;
      fleetProg.style.width = p * 100 + '%';
      fleetIdx.textContent = String(Math.min(SHIPS.length, 1 + Math.round(p * (SHIPS.length - 1)))).padStart(2, '0');
      if (r.top < innerHeight && r.bottom > 0) {
        const sk = clamp(sv * -.004, -4, 4);
        cardInners.forEach(c => { if (!c.matches(':hover')) c.style.transform = Math.abs(sk) > .05 ? `skewX(${sk}deg)` : ''; });
      }
    }

    const tr = tl.getBoundingClientRect();
    const tp = clamp((innerHeight * .75 - tr.top) / tr.height, 0, 1);
    if (innerWidth > 1000) { tlFill.style.width = tp * 100 + '%'; tlFill.style.height = ''; }
    else { tlFill.style.height = tp * 100 + '%'; tlFill.style.width = ''; }
  };
  requestAnimationFrame(tick);

  /* ---------------------------------------------------------
     CURSOR LIGHT TRAIL
     --------------------------------------------------------- */
  if (FINE && !REDUCED) {
    const tc = $('#trail'), tx = tc.getContext('2d');
    const pts = [];
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); tc.width = innerWidth * d; tc.height = innerHeight * d; tx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
    addEventListener('pointermove', e => pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }));
    (function draw() {
      requestAnimationFrame(draw);
      const now = performance.now();
      while (pts.length && now - pts[0].t > 420) pts.shift();
      tx.clearRect(0, 0, innerWidth, innerHeight);
      if (pts.length < 2) return;
      tx.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], k = 1 - (now - b.t) / 420;
        tx.strokeStyle = `rgba(${Math.round(lerp(255, 0, k))}, ${Math.round(lerp(204, 90, k))}, ${Math.round(lerp(0, 220, k))}, ${k * .85})`;
        tx.lineWidth = 1 + k * 7;
        tx.beginPath(); tx.moveTo(a.x, a.y); tx.lineTo(b.x, b.y); tx.stroke();
      }
    })();
  }

  /* ---------------------------------------------------------
     FORM (simulation — nothing is transmitted)
     --------------------------------------------------------- */
  $('#acqForm').addEventListener('submit', e => {
    e.preventDefault();
    const ref = 'FSR-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + (Math.random() * 9000 + 1000 | 0);
    $('#formOk').classList.add('on');
    setTimeout(() => scrambleTo($('#formRef'), ref, 1100), 300);
  });
})();
