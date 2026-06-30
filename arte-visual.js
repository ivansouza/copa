/**
 * Arte Visual — Visualização Circular Interativa da Copa 2026
 * 
 * Desenha um círculo com as 32 bandeiras dos classificados em volta
 * e o chaveamento do mata-mata em anéis concêntricos no centro.
 * 
 * Integra-se com os dados existentes do index.html (classified[], flagUrl(), etc.)
 */

(function() {
  'use strict';

  // ─── Configuração ───────────────────────────────────────────────
  const CFG = {
    size: 700,
    center: 350,
    outerRadius: 300,
    ringStep: 48,
    flagSize: 30,
    nameOffset: 24,
  };

  const COLORS = {
    bg: '#0f172a',
    ring: '#1e293b',
    ringStroke: '#2d3a4e',
    text: '#94a3b8',
    textBright: '#e2e8f0',
    accent: '#f59e0b',
    confirmed: '#22c55e',
    probable: '#f59e0b',
    line: '#2d3a4e',
    lineActive: '#f59e0b',
    hover: '#f59e0b22',
  };

  let state = { classified: [], selectedTeam: null, animating: false };

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function render(container, classified) {
    if (!container) return;
    state.classified = classified || [];
    state.selectedTeam = null;

    const S = CFG.size, C = CFG.center;
    const numTeams = Math.min(state.classified.length, 32);
    if (numTeams === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:#64748b;">⏳ Nenhum classificado disponível ainda</div>';
      return;
    }

    const rings = [
      { count: 16, label: 'Oitavas', r: CFG.outerRadius - CFG.ringStep },
      { count: 8,  label: 'Quartas', r: CFG.outerRadius - CFG.ringStep * 2 },
      { count: 4,  label: 'Semi',    r: CFG.outerRadius - CFG.ringStep * 3 },
      { count: 2,  label: 'Final',   r: CFG.outerRadius - CFG.ringStep * 4 },
    ];

    let svg = `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${S}px;height:auto;display:block;margin:0 auto;">`;
    svg += `<defs>
      <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1e293b" stop-opacity="0.8"/>
        <stop offset="70%" stop-color="#0f172a" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
      </radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;

    // Fundo
    svg += `<rect width="${S}" height="${S}" fill="${COLORS.bg}" rx="16"/>`;
    svg += `<circle cx="${C}" cy="${C}" r="${CFG.outerRadius + 30}" fill="url(#bgGlow)"/>`;

    // ─── Anéis internos ───────────────────────────────────────────
    rings.forEach((ring, ri) => {
      const r = ring.r;
      svg += `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="${COLORS.ringStroke}" stroke-width="1" stroke-dasharray="4,4" opacity="${0.4 - ri * 0.05}"/>`;
      // Label sutil
      const lp = polarToCartesian(C, C, r + 14, 270);
      svg += `<text x="${lp.x}" y="${lp.y}" fill="${COLORS.text}" font-size="8" text-anchor="middle" font-family="Inter,sans-serif" opacity="0.4">${ring.label}</text>`;
    });

    // ─── Linhas do chaveamento ────────────────────────────────────
    for (let i = 0; i < numTeams; i += 2) {
      if (i + 1 >= numTeams) break;
      const a1 = (i / numTeams) * 360;
      const a2 = ((i + 1) / numTeams) * 360;
      const p1 = polarToCartesian(C, C, CFG.outerRadius, a1);
      const p2 = polarToCartesian(C, C, CFG.outerRadius, a2);
      const midA = (a1 + a2) / 2;
      const midP = polarToCartesian(C, C, rings[0].r, midA);
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${midP.x}" y2="${midP.y}" stroke="${COLORS.line}" stroke-width="1.5" opacity="0.25" class="bl" data-t1="${i}" data-t2="${i+1}"/>`;
      svg += `<line x1="${p2.x}" y1="${p2.y}" x2="${midP.x}" y2="${midP.y}" stroke="${COLORS.line}" stroke-width="1.5" opacity="0.25" class="bl" data-t1="${i}" data-t2="${i+1}"/>`;
    }

    // ─── Bandeiras (anel externo) ─────────────────────────────────
    for (let i = 0; i < numTeams; i++) {
      const team = state.classified[i];
      if (!team) continue;
      const angle = (i / numTeams) * 360;
      const pos = polarToCartesian(C, C, CFG.outerRadius, angle);
      const flagSrc = window.flagUrl ? window.flagUrl(team.abbr) : '';
      const isConfirmed = team.status === 'confirmed';
      const statusColor = isConfirmed ? COLORS.confirmed : COLORS.probable;
      const fs = CFG.flagSize;
      const x = pos.x - fs / 2;
      const y = pos.y - fs / 2;

      svg += `<g class="tn" data-idx="${i}" data-abbr="${team.abbr}" data-name="${team.name}" style="cursor:pointer;">`;
      // BG hover
      svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${fs/2 + 7}" fill="transparent" class="tbg"/>`;
      // Bandeira
      if (flagSrc) {
        svg += `<image href="${flagSrc}" x="${x}" y="${y}" width="${fs}" height="${fs}" class="tf" style="clip-path:circle(50%);border-radius:50%;" filter="url(#glow)"/>`;
      } else {
        svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${fs/2}" fill="${COLORS.ring}" stroke="${statusColor}" stroke-width="1.5"/>`;
        svg += `<text x="${pos.x}" y="${pos.y + 3}" fill="${COLORS.textBright}" font-size="7" text-anchor="middle" font-family="Inter,sans-serif" font-weight="600">${team.abbr || '?'}</text>`;
      }
      // Status dot
      const sp = polarToCartesian(C, C, CFG.outerRadius + 14, angle + 12);
      svg += `<circle cx="${sp.x}" cy="${sp.y}" r="3" fill="${statusColor}" opacity="0.9" filter="url(#glow)"/>`;
      // Nome
      const np = polarToCartesian(C, C, CFG.outerRadius + CFG.nameOffset, angle);
      const rot = angle > 90 && angle < 270 ? angle + 180 : angle;
      const anc = angle > 90 && angle < 270 ? 'end' : 'start';
      const xOff = angle > 90 && angle < 270 ? -4 : 4;
      svg += `<text x="${np.x + xOff}" y="${np.y + 3}" fill="${COLORS.text}" font-size="8" text-anchor="${anc}" font-family="Inter,sans-serif" transform="rotate(${rot}, ${np.x}, ${np.y})" class="tnm">${team.name}</text>`;
      svg += `</g>`;
    }

    // ─── Centro: Troféu ───────────────────────────────────────────
    const tr = rings[3]?.r - 25 || 60;
    svg += `<circle cx="${C}" cy="${C}" r="${tr}" fill="${COLORS.ring}" stroke="${COLORS.accent}" stroke-width="2" opacity="0.9"/>`;
    svg += `<circle cx="${C}" cy="${C}" r="${tr - 4}" fill="none" stroke="${COLORS.accent}" stroke-width="0.5" opacity="0.3"/>`;
    // Troféu simplificado
    svg += `<g transform="translate(${C - 14}, ${C - 22})" opacity="0.95">`;
    svg += `<path d="M14 4 L14 18 Q14 22 9 25 L9 28 L19 28 L19 25 Q14 22 14 18" fill="${COLORS.accent}" opacity="0.85"/>`;
    svg += `<rect x="7" y="28" width="14" height="3" rx="1.5" fill="${COLORS.accent}" opacity="0.6"/>`;
    svg += `<path d="M4 9 Q0 14 4 20" fill="none" stroke="${COLORS.accent}" stroke-width="1.5" opacity="0.5"/>`;
    svg += `<path d="M24 9 Q28 14 24 20" fill="none" stroke="${COLORS.accent}" stroke-width="1.5" opacity="0.5"/>`;
    svg += `<circle cx="14" cy="2" r="3" fill="${COLORS.accent}" opacity="0.95"/>`;
    svg += `</g>`;
    svg += `<text x="${C}" y="${C + 18}" fill="${COLORS.accent}" font-size="10" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" opacity="0.6">2026</text>`;

    svg += `</svg>`;
    container.innerHTML = svg;
    attachEvents(container);
  }

  function attachEvents(container) {
    const svg = container.querySelector('svg');
    if (!svg) return;
    svg.querySelectorAll('.tn').forEach(n => {
      n.addEventListener('click', function() {
        const abbr = this.dataset.abbr;
        selectTeam(container, abbr);
      });
      n.addEventListener('mouseenter', function() {
        const bg = this.querySelector('.tbg');
        if (bg) bg.setAttribute('fill', COLORS.hover);
      });
      n.addEventListener('mouseleave', function() {
        const bg = this.querySelector('.tbg');
        if (bg && !this.classList.contains('sel')) bg.setAttribute('fill', 'transparent');
      });
    });
  }

  function selectTeam(container, abbr) {
    if (state.animating) return;
    state.animating = true;
    const svg = container.querySelector('svg');
    if (!svg) { state.animating = false; return; }

    svg.querySelectorAll('.tn.sel').forEach(n => {
      n.classList.remove('sel');
      const bg = n.querySelector('.tbg');
      if (bg) bg.setAttribute('fill', 'transparent');
    });

    if (state.selectedTeam === abbr) {
      state.selectedTeam = null;
      resetLines(svg);
      state.animating = false;
      return;
    }

    state.selectedTeam = abbr;
    const node = svg.querySelector(`.tn[data-abbr="${abbr}"]`);
    if (node) {
      node.classList.add('sel');
      const bg = node.querySelector('.tbg');
      if (bg) bg.setAttribute('fill', COLORS.accent + '44');
    }

    const idx = parseInt(node?.dataset?.idx);
    if (!isNaN(idx)) {
      svg.querySelectorAll('.bl').forEach(line => {
        const t1 = parseInt(line.dataset.t1);
        const t2 = parseInt(line.dataset.t2);
        if (t1 === idx || t2 === idx) {
          line.setAttribute('stroke', COLORS.lineActive);
          line.setAttribute('opacity', '0.8');
          line.setAttribute('stroke-width', '2.5');
        }
      });
    }
    state.animating = false;
  }

  function resetLines(svg) {
    svg.querySelectorAll('.bl').forEach(line => {
      line.setAttribute('stroke', COLORS.line);
      line.setAttribute('opacity', '0.25');
      line.setAttribute('stroke-width', '1.5');
    });
  }

  window.ArteVisual = {
    render,
    selectTeam: (abbr) => {
      const c = document.getElementById('arte-visual-container');
      if (c) selectTeam(c, abbr);
    },
    refresh: () => {
      const c = document.getElementById('arte-visual-container');
      if (c && state.classified.length > 0) render(c, state.classified);
    },
  };
})();
