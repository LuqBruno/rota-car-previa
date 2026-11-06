// Rota Car — prévia conceitual (Bruno Luque). Ideia central: "A rota do seu carro".
// Motion 11.11.17 (vanilla, global `Motion`) para coreografia e cenas ligadas à rolagem; Lenis só na roda do mouse.
// Sem este arquivo a página continua completa: os estados escondidos só existem depois de `motion-ready`.
//
// Camadas de motion
//  Assinatura: contorno amarelo do carro que vira estrada (hero) + luz de inspeção no ponteiro;
//              cena presa "A rota" (desktop) com 5 paradas, estrada desenhada pela rolagem e troca de foto por varredura.
//  Narrativa:  linha da rota correndo na lateral (celular) · faixas da lista de serviços desenhando ao entrar ·
//              rota do mini mapa chegando ao pin.
//  Interface:  pressão em botões e linhas, seta em continuidade, CTA magnético (ponteiro fino), placas da rota clicáveis.

const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const pinMQ = matchMedia('(min-width: 1024px) and (min-height: 600px)');
const reduce = reduceMQ.matches;
if (reduce) root.classList.add('reduce');

/* tokens de motion (espelham as variáveis do CSS) */
const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN_OUT = [0.77, 0, 0.175, 1];
const DUR = { press: 0.14, ctrl: 0.2, panel: 0.32, reveal: 0.95, draw: 1.5 };
const SPRING_CTA = { stiffness: 220, damping: 18 };
const SPRING_LIGHT = { stiffness: 90, damping: 16 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ------------------------------------------------------------------ */
/* Topo e CTA do polegar                                               */
/* ------------------------------------------------------------------ */
const top = $('[data-top]');
let topTicking = false;
const onScrollTop = () => {
  if (topTicking) return; topTicking = true;
  requestAnimationFrame(() => { top.classList.toggle('is-solid', scrollY > 24); topTicking = false; });
};
addEventListener('scroll', onScrollTop, { passive: true }); onScrollTop();

const dock = $('[data-dock]');
if (dock && 'IntersectionObserver' in window) {
  root.classList.add('dock-ready');
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => seen.set(e.target, e.isIntersecting));
    const anyCta = [...seen.values()].some(Boolean);
    dock.classList.toggle('is-shown', !anyCta && scrollY > 200);
  }, { threshold: 0 });
  [$('.hero__actions'), $('.fim'), $('.foot')].forEach((t) => t && io.observe(t));
}

/* ------------------------------------------------------------------ */
/* Rolagem contínua (Lenis): só ponteiro fino; toque fica nativo        */
/* ------------------------------------------------------------------ */
let lenis = null;
function startLenis() {
  if (reduce || !fineMQ.matches || !window.Lenis || lenis) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  const raf = (t) => { if (!lenis) return; lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
if (window.Lenis) startLenis(); else addEventListener('load', startLenis, { once: true });
reduceMQ.addEventListener('change', () => { if (reduceMQ.matches && lenis) { lenis.destroy(); lenis = null; } });

function scrollToY(y) {
  if (lenis) lenis.scrollTo(y, { duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id === '#conteudo') return;
  const target = id === '#inicio' ? document.body : $(id);
  if (!target) return;
  e.preventDefault();
  const y = id === '#inicio' ? 0 : target.getBoundingClientRect().top + scrollY - (id === '#rota' ? 0 : top.offsetHeight + 8);
  scrollToY(y);
  if (id !== '#inicio') { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
});

/* ------------------------------------------------------------------ */
/* Mola simples com velocidade preservada (interrompível)              */
/* ------------------------------------------------------------------ */
function springVec(apply, { stiffness = 170, damping = 20 } = {}, start = [0, 0]) {
  const s = { x: start[0], y: start[1], vx: 0, vy: 0, tx: start[0], ty: start[1], raf: 0, last: 0 };
  const tick = (t) => {
    const dt = Math.min(0.032, (t - (s.last || t)) / 1000 || 0.016); s.last = t;
    for (const k of ['x', 'y']) {
      const v = 'v' + k, tk = 't' + k;
      const f = -stiffness * (s[k] - s[tk]) - damping * s[v];
      s[v] += f * dt; s[k] += s[v] * dt;
    }
    apply(s.x, s.y);
    if (Math.abs(s.x - s.tx) + Math.abs(s.y - s.ty) + Math.abs(s.vx) + Math.abs(s.vy) > 0.02) s.raf = requestAnimationFrame(tick);
    else { s.raf = 0; s.last = 0; }
  };
  const set = (x, y) => { s.tx = x; s.ty = y; if (!s.raf) s.raf = requestAnimationFrame(tick); };
  set.stop = () => { cancelAnimationFrame(s.raf); s.raf = 0; };
  return set;
}

/* CTA magnético: só ponteiro fino e sem movimento reduzido */
if (!reduce && fineMQ.matches) {
  $$('[data-magnetic]').forEach((b) => {
    const set = springVec((x, y) => { b.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`; }, SPRING_CTA);
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      set((e.clientX - r.left - r.width / 2) * 0.16, (e.clientY - r.top - r.height / 2) * 0.28);
    });
    b.addEventListener('pointerleave', () => set(0, 0));
  });
}

/* ------------------------------------------------------------------ */
/* Varredura de luz (troca de foto por faixas)                          */
/* ------------------------------------------------------------------ */
const BANDS = 8;
function bandsClip(s, dir = 1) {
  const pts = ['0% 0%'];
  for (let i = 0; i < BANDS; i++) {
    const order = dir > 0 ? i : BANDS - 1 - i;
    const x = (100 * easeOut((s - order * 0.07) / 0.45)).toFixed(2);
    pts.push(`${x}% ${(i * 100 / BANDS).toFixed(2)}%`, `${x}% ${((i + 1) * 100 / BANDS).toFixed(2)}%`);
  }
  pts.push('0% 100%');
  return `polygon(${pts.join(',')})`;
}

/* ------------------------------------------------------------------ */
/* Motion: coreografia                                                  */
/* ------------------------------------------------------------------ */
const M = window.Motion || null;
if (!M) console.warn('Motion indisponível; página segue estática.');

const scene = $('[data-scene]');
const stops = $$('.stop', scene);
const N = stops.length;

if (M) {
  const { animate, scroll, inView, stagger } = M;
  const prog = (p) => (typeof p === 'number' ? p : p?.y?.progress ?? 0);

  function scan(img, beam, dir, { duration = DUR.reveal, onDone } = {}) {
    const h = img.parentElement.offsetHeight;
    img.style.clipPath = bandsClip(0, dir);
    img.style.filter = 'brightness(1.35)';
    beam.style.opacity = '1';
    const ctl = animate(0, 1, {
      duration, ease: 'linear',
      onUpdate: (s) => {
        img.style.clipPath = bandsClip(s, dir);
        img.style.filter = `brightness(${(1 + 0.35 * (1 - easeOut(s))).toFixed(3)})`;
        beam.style.transform = `translateY(${((dir > 0 ? s : 1 - s) * h).toFixed(1)}px)`;
        beam.style.opacity = s < 0.86 ? '1' : String(clamp((1 - s) / 0.14));
      },
      onComplete: () => { img.style.clipPath = ''; img.style.filter = ''; beam.style.opacity = '0'; onDone && onDone(); },
    });
    ctl.finish = () => { ctl.stop(); img.style.clipPath = ''; img.style.filter = ''; beam.style.opacity = '0'; };
    return ctl;
  }

  if (reduce) {
    root.classList.add('motion-ready');
    stops.forEach((s) => s.classList.add('is-on'));
  } else {
    /* ---- estados iniciais (antes de exibir) ---- */
    const traceParts = $$('.hero__trace [data-draw]');
    traceParts.forEach((p) => { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; });
    const road = $('[data-road]');
    road.style.transform = 'scaleY(0)';
    root.classList.add('motion-ready');

    /* ---- HERO: entrada (texto e CTA não esperam a cena) ---- */
    animate('.hero__title .line > span', { transform: ['translateY(108%)', 'translateY(0%)'] }, { duration: 0.9, delay: stagger(0.08), ease: EASE_OUT });
    animate('.eyebrow, .hero__lead, .hero__actions, .hero__place', { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0)'] }, { duration: 0.6, delay: stagger(0.07, { startDelay: 0.25 }), ease: EASE_OUT });
    // propriedades individuais (scale/translate) para a entrada e o parallax não disputarem `transform`
    $('.hero__photo img').animate([{ scale: '1.12', filter: 'brightness(.55)' }, { scale: '1.04', filter: 'brightness(1)' }], { duration: 1600, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' });
    // contorno: WAAPI direto em SVG (o estado inicial está em style inline)
    const ez = 'cubic-bezier(0.65, 0, 0.35, 1)';
    const car = $('.trace__car');
    const carDraw = car.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1700, delay: 450, easing: ez, fill: 'forwards' });
    $$('.trace__wheel, .trace__glass').forEach((p, i) => p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 700, delay: 1300 + i * 120, easing: ez, fill: 'forwards' }));
    carDraw.finished.then(() => animate(road, { transform: ['scaleY(0)', 'scaleY(1)'] }, { duration: 0.6, ease: EASE_OUT })).catch(() => {});

    /* ---- HERO: foto acompanha a saída (parallax contido) ---- */
    scroll((p) => {
      const v = prog(p);
      $('.hero__photo img').style.translate = `0 ${(v * 9).toFixed(2)}%`;
    }, { target: $('[data-hero]'), offset: ['start start', 'end start'] });

    /* ---- HERO: luz de inspeção (spotlight) ---- */
    const area = $('[data-shine-area]');
    const shine = $('[data-shine]');
    if (fineMQ.matches) {
      const set = springVec((x, y) => {
        shine.style.setProperty('--sx', `${x.toFixed(2)}%`);
        shine.style.setProperty('--sy', `${y.toFixed(2)}%`);
        shine.style.setProperty('--bx', `${(x * 0.8 + 12).toFixed(2)}%`);
      }, SPRING_LIGHT, [60, 52]);
      const hero = $('[data-hero]');
      hero.addEventListener('pointermove', (e) => {
        const r = area.getBoundingClientRect();
        if (e.clientX < r.left) { shine.classList.remove('is-on'); return; }
        shine.classList.add('is-on');
        set(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
      });
      hero.addEventListener('pointerleave', () => shine.classList.remove('is-on'));
    } else {
      // toque: o reflexo passa uma vez e depois acompanha levemente a rolagem
      shine.style.setProperty('--sx', '-60%');
      shine.classList.add('is-on');
      animate(0, 1, {
        duration: 1.8, delay: 0.7, ease: EASE_IN_OUT,
        onUpdate: (v) => shine.style.setProperty('--bx', `${(-15 + v * 95).toFixed(2)}%`),
        onComplete: () => {
          scroll((p) => shine.style.setProperty('--bx', `${(80 - prog(p) * 70).toFixed(2)}%`), { target: $('[data-hero]'), offset: ['start start', 'end start'] });
        },
      });
    }

    /* ---- A ROTA ---- */
    let teardown = pinMQ.matches ? setupPin() : setupList();
    pinMQ.addEventListener('change', () => { teardown(); teardown = pinMQ.matches ? setupPin() : setupList(); });

    function setupPin() {
      root.classList.add('scene-pin');
      const map = $('[data-map]'); map.hidden = false;
      const route = $('[data-route]');
      const carDot = $('[data-car]');
      const L = route.getTotalLength();
      const marks = $$('.mark');
      marks.forEach((m, i) => {
        const pt = route.getPointAtLength((L * i) / (N - 1));
        m.style.left = `${(pt.x / 600) * 100}%`;
        m.style.top = `${(pt.y / 120) * 100}%`;
      });
      let cur = -1; let running = null; let textAnim = [];
      const q = (p) => clamp((p - 0.05) / 0.9);

      function show(i, instant) {
        const prev = cur; cur = i;
        if (running) { running.finish(); running = null; }
        textAnim.forEach((a) => a.stop()); textAnim = [];
        stops.forEach((s, k) => {
          s.classList.toggle('is-active', k === i);
          s.classList.toggle('is-prev', !instant && k === prev);
          s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
          $$('.stop__title, .stop__desc, .plate', s).forEach((el) => { el.style.clipPath = ''; el.style.opacity = ''; el.style.transform = ''; });
        });
        marks.forEach((m, k) => { m.classList.toggle('is-current', k === i); m.setAttribute('aria-current', k === i ? 'step' : 'false'); });
        if (instant || prev < 0) return;
        const s = stops[i];
        const dir = i > prev ? 1 : -1;
        running = scan($('img', s), $('.stop__beam', s), dir, { onDone: () => { stops.forEach((x) => x.classList.remove('is-prev')); running = null; } });
        // texto: placa entra pela lateral, título em máscara de linha, descrição assenta
        textAnim.push(
          animate($('.plate', s), { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] }, { duration: 0.5, ease: EASE_OUT }),
          animate($('.stop__title', s), { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 -12% 0)'], transform: [`translateY(${dir * 34}px)`, 'translateY(0px)'] }, { duration: 0.7, delay: 0.06, ease: EASE_OUT }),
          animate($('.stop__desc', s), { opacity: [0, 1], transform: [`translateY(${dir * 12}px)`, 'translateY(0px)'] }, { duration: 0.5, delay: 0.18, ease: EASE_OUT }),
        );
      }

      const stopScroll = scroll((p) => {
        const v = q(prog(p));
        route.style.strokeDashoffset = String(1 - v);
        const pt = route.getPointAtLength(L * v);
        carDot.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        const idx = Math.min(N - 1, Math.floor(v * (N - 1) + 0.12));
        marks.forEach((m, k) => m.classList.toggle('is-reached', k <= idx));
        if (idx !== cur) show(idx, cur < 0);
      }, { target: scene, offset: ['start start', 'end end'] });

      const onMark = (e) => {
        const b = e.target.closest('[data-go]'); if (!b) return;
        const i = +b.dataset.go;
        const p = 0.05 + 0.9 * (i / (N - 1));
        const y = scene.getBoundingClientRect().top + scrollY + p * (scene.offsetHeight - innerHeight) + 2;
        scrollToY(y);
      };
      map.addEventListener('click', onMark);

      return () => {
        stopScroll(); map.removeEventListener('click', onMark);
        if (running) running.finish();
        textAnim.forEach((a) => a.stop());
        root.classList.remove('scene-pin'); map.hidden = true;
        stops.forEach((s) => { s.classList.remove('is-active', 'is-prev'); s.removeAttribute('aria-hidden'); });
      };
    }

    function setupList() {
      const fill = $('[data-rail]');
      fill.style.transform = 'scaleY(0)';
      const stopScroll = scroll((p) => { fill.style.transform = `scaleY(${prog(p).toFixed(4)})`; }, { target: scene, offset: ['start 72%', 'end 72%'] });
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => e.target.classList.toggle('is-on', e.boundingClientRect.top < innerHeight * 0.72));
      }, { rootMargin: '0px 0px -28% 0px', threshold: [0, 1] });
      stops.forEach((s) => io.observe(s));
      const offs = [];
      const anims = [];
      stops.forEach((s) => {
        const fig = $('.stop__fig', s); const img = $('img', fig);
        if (fig.getBoundingClientRect().top < innerHeight) return;
        img.style.clipPath = bandsClip(0, 1);
        offs.push(inView(fig, () => { anims.push(scan(img, $('.stop__beam', fig), 1, { duration: 1.05 })); }, { amount: 0.35 }));
      });
      return () => {
        stopScroll(); io.disconnect(); offs.forEach((o) => o && o()); anims.forEach((a) => a.finish());
        fill.style.transform = ''; stops.forEach((s) => { s.classList.remove('is-on'); $('img', s).style.clipPath = ''; });
      };
    }

    /* ---- Narrativa: faixas da lista de serviços ---- */
    root.classList.add('lanes');
    $$('.svc li').forEach((li, i) => inView(li, () => { setTimeout(() => li.classList.add('is-in'), (i % 3) * 60); }, { amount: 0.6 }));

    /* ---- Títulos de seção: máscara de linha ---- */
    $$('[data-mask]').forEach((h) => {
      if (h.getBoundingClientRect().top < innerHeight) return;
      h.style.clipPath = 'inset(0 0 100% 0)';
      h.style.transform = 'translateY(30px)';
      // observa o pai: um alvo recortado por clip-path não conta como visível para o IntersectionObserver
      inView(h.parentElement, () => { animate(h, { clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% -12% 0%)'], transform: ['translateY(30px)', 'translateY(0px)'] }, { duration: 0.9, ease: EASE_OUT }); }, { amount: 0.25 });
    });

    /* ---- Fechamento: o carro do hero chega ao fim da rota ---- */
    const fimCar = $('[data-fim-car]'); const fimLine = $('[data-fim-line]');
    if (fimCar && fimLine) {
      fimLine.style.strokeDashoffset = '1';
      fimCar.style.opacity = '0';
      inView('[data-fim-road]', () => {
        fimLine.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });
        fimCar.animate([{ opacity: 0, transform: 'translate(-260px, 14px)' }, { opacity: 1, offset: 0.25 }, { opacity: 1, transform: 'translate(20px, 14px)' }], { duration: 1500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
      }, { amount: 0.5 });
    }

    /* ---- Narrativa: rota do mini mapa chega ao pin ---- */
    const mini = $('[data-mini-route]'); const pin = $('[data-pin]');
    if (mini && pin) {
      mini.style.strokeDashoffset = '1';
      pin.style.opacity = '0'; pin.style.transform = 'translateY(-26px)';
      inView('.minimap', () => {
        mini.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: DUR.draw * 1000, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' });
        // queda do pin com leve overshoot (WAAPI direto no SVG)
        pin.animate([{ opacity: 0, transform: 'translateY(-26px)' }, { opacity: 1, transform: 'translateY(0px)' }], { duration: 620, delay: (DUR.draw - 0.15) * 1000, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'both' });
      }, { amount: 0.4 });
    }
  }
}
