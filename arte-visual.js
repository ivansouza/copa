/**
 * Arte Visual 3D — Visualização Three.js da Copa 2026
 * 
 * Esfera interativa com bandeiras dos 32 classificados,
 * linhas de chaveamento animadas e dados reais do mata-mata.
 * 
 * Integra-se com os dados existentes do index.html.
 * Usa importmap para carregar Three.js via ES modules.
 */

(function() {
  'use strict';

  const CFG = {
    radius: 5,
    flagSize: 0.8,
    autoRotateSpeed: 0.5,
  };

  let scene, camera, renderer, controls;
  let teamMeshes = [];
  let lineMeshes = [];
  let animationId = null;
  let containerEl = null;
  let state = { classified: [], selectedTeam: null };
  let threeLoaded = false;

  // ─── Carrega Three.js via importmap ─────────────────────────────
  function loadThreeJS(callback) {
    if (threeLoaded) { callback(); return; }

    // Adiciona importmap
    if (!document.querySelector('script[type="importmap"]')) {
      const im = document.createElement('script');
      im.type = 'importmap';
      im.textContent = JSON.stringify({
        imports: {
          'three': 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
          'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/',
        }
      });
      document.head.appendChild(im);
    }

    // Cria um módulo inline que carrega Three e chama callback
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import * as THREE from 'three';
      import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
      window.__THREE = { THREE, OrbitControls };
      document.dispatchEvent(new CustomEvent('three-loaded'));
    `;
    document.head.appendChild(script);

    document.addEventListener('three-loaded', () => {
      threeLoaded = true;
      callback();
    }, { once: true });

    // Timeout de segurança
    setTimeout(() => {
      if (!threeLoaded) {
        const c = document.getElementById('arte-visual-container');
        if (c) c.innerHTML = '<div style="text-align:center;padding:3rem;color:#ef4444;"><p>❌ Erro ao carregar Three.js. Verifique sua conexão.</p></div>';
      }
    }, 10000);
  }

  // ─── Cria textura da bandeira ───────────────────────────────────
  function createFlagTexture(flagUrl, abbr) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 128, 128);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = flagUrl;

      img.onload = () => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(64, 64, 56, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 8, 8, 112, 112);
        ctx.restore();
        // Borda
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(64, 64, 56, 0, Math.PI * 2);
        ctx.stroke();
        const tex = new window.__THREE.THREE.CanvasTexture(canvas);
        resolve(tex);
      };

      img.onerror = () => {
        ctx.fillStyle = '#2d3a4e';
        ctx.beginPath();
        ctx.arc(64, 64, 56, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(abbr || '?', 64, 64);
        const tex = new window.__THREE.THREE.CanvasTexture(canvas);
        resolve(tex);
      };
    });
  }

  // ─── Inicializa a cena ──────────────────────────────────────────
  function initScene(container) {
    const THREE = window.__THREE.THREE;
    containerEl = container;
    container.innerHTML = '';

    const width = container.clientWidth || Math.min(window.innerWidth - 32, 700);
    const height = container.clientHeight || 500;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 3, 12);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new window.__THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = CFG.autoRotateSpeed;
    controls.minDistance = 5;
    controls.maxDistance = 20;
    controls.target.set(0, 0, 0);

    // Luzes
    const ambient = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xf59e0b, 0.4);
    dir2.position.set(-5, -3, -5);
    scene.add(dir2);

    // Estrelas
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600 * 3; i++) starPos[i] = (Math.random() - 0.5) * 80;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x64748b, size: 0.06, transparent: true, opacity: 0.5 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Anéis
    [5.5, 4.2, 2.8].forEach((r, i) => {
      const geo = new THREE.RingGeometry(r - 0.03, r, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: [0x2d3a4e, 0x1e293b, 0x2d3a4e][i],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.1;
      scene.add(ring);
    });

    window.addEventListener('resize', onResize);
  }

  // ─── Cria os times ──────────────────────────────────────────────
  async function createTeams(classified) {
    const THREE = window.__THREE.THREE;
    teamMeshes.forEach(m => scene.remove(m));
    teamMeshes = [];

    const num = Math.min(classified.length, 32);
    if (num === 0) return;

    const tasks = [];
    for (let i = 0; i < num; i++) {
      const team = classified[i];
      const angle = (i / num) * Math.PI * 2;
      const x = CFG.radius * Math.sin(angle);
      const z = CFG.radius * Math.cos(angle);
      const flagSrc = window.flagUrl ? window.flagUrl(team.abbr) : '';

      tasks.push(
        createFlagTexture(flagSrc, team.abbr).then(tex => {
          const geo = new THREE.PlaneGeometry(CFG.flagSize, CFG.flagSize);
          const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x, 0, z);
          mesh.lookAt(0, 0, 0);

          // Label
          const c2 = document.createElement('canvas');
          c2.width = 256; c2.height = 48;
          const ctx = c2.getContext('2d');
          ctx.fillStyle = 'rgba(15,23,42,0.6)';
          ctx.roundRect ? ctx.roundRect(0, 0, 256, 48, 8) : ctx.fillRect(0, 0, 256, 48);
          ctx.fill();
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(team.name, 128, 24);
          const lTex = new THREE.CanvasTexture(c2);
          const lMat = new THREE.SpriteMaterial({ map: lTex, transparent: true, depthTest: false });
          const label = new THREE.Sprite(lMat);
          const off = 0.8;
          label.position.set(x + (x / CFG.radius) * off, -0.5, z + (z / CFG.radius) * off);
          label.scale.set(1.4, 0.26, 1);

          // Linha
          const pts = new Float32Array([x * 0.8, 0, z * 0.8, x * 0.25, 0, z * 0.25]);
          const lg = new THREE.BufferGeometry();
          lg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
          const lm = new THREE.LineBasicMaterial({ color: 0x2d3a4e, transparent: true, opacity: 0.15 });
          const line = new THREE.Line(lg, lm);

          const grp = new THREE.Group();
          grp.add(mesh); grp.add(label); grp.add(line);
          grp.userData = { team, angle, index: i, abbr: team.abbr };
          teamMeshes.push(grp);
          return grp;
        })
      );
    }

    const groups = await Promise.all(tasks);
    groups.forEach(g => scene.add(g));
  }

  // ─── Linhas do chaveamento ──────────────────────────────────────
  function createBracketLines(classified) {
    const THREE = window.__THREE.THREE;
    lineMeshes.forEach(m => scene.remove(m));
    lineMeshes = [];

    const num = Math.min(classified.length, 32);
    if (num < 2) return;

    for (let i = 0; i < num; i += 2) {
      if (i + 1 >= num) break;
      const a1 = (i / num) * Math.PI * 2;
      const a2 = ((i + 1) / num) * Math.PI * 2;
      const midA = (a1 + a2) / 2;
      const r1 = CFG.radius, r2 = CFG.radius * 0.6;

      const pts = [
        new THREE.Vector3(r1 * Math.sin(a1) * 0.8, 0, r1 * Math.cos(a1) * 0.8),
        new THREE.Vector3(r1 * 0.4 * Math.sin(a1) + r2 * 0.3 * Math.sin(midA), 0.2, r1 * 0.4 * Math.cos(a1) + r2 * 0.3 * Math.cos(midA)),
        new THREE.Vector3(r2 * Math.sin(midA), 0, r2 * Math.cos(midA)),
        new THREE.Vector3(r1 * 0.4 * Math.sin(a2) + r2 * 0.3 * Math.sin(midA), 0.2, r1 * 0.4 * Math.cos(a2) + r2 * 0.3 * Math.cos(midA)),
        new THREE.Vector3(r1 * Math.sin(a2) * 0.8, 0, r1 * Math.cos(a2) * 0.8),
      ];

      const curve = new THREE.CatmullRomCurve3(pts);
      const cpts = curve.getPoints(16);
      const geo = new THREE.BufferGeometry().setFromPoints(cpts);
      const mat = new THREE.LineBasicMaterial({ color: 0x2d3a4e, transparent: true, opacity: 0.12 });
      const line = new THREE.Line(geo, mat);
      lineMeshes.push(line);
      scene.add(line);
    }

    // Anéis internos
    [CFG.radius * 0.6, CFG.radius * 0.4, CFG.radius * 0.25, CFG.radius * 0.12].forEach((r, ri) => {
      const pts = [];
      const segs = Math.max(4, 16 - ri * 3);
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.sin(a), 0, r * Math.cos(a)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x2d3a4e, transparent: true, opacity: 0.15 + ri * 0.04 });
      lineMeshes.push(new THREE.Line(geo, mat));
      scene.add(lineMeshes[lineMeshes.length - 1]);
    });

    // Esfera central
    const sg = new THREE.SphereGeometry(0.25, 16, 16);
    const sm = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.2 });
    const sphere = new THREE.Mesh(sg, sm);
    lineMeshes.push(sphere);
    scene.add(sphere);
  }

  // ─── Animação ────────────────────────────────────────────────────
  function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function onResize() {
    if (!containerEl || !camera || !renderer) return;
    const w = containerEl.clientWidth || 700;
    const h = containerEl.clientHeight || 500;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // ─── Render ──────────────────────────────────────────────────────
  async function render(container, classified) {
    state.classified = classified || [];
    if (!container) return;

    loadThreeJS(async () => {
      initScene(container);
      await createTeams(state.classified);
      createBracketLines(state.classified);
      animate();
    });
  }

  // ─── API ─────────────────────────────────────────────────────────
  window.ArteVisual = {
    render,
    refresh: () => {
      const c = document.getElementById('arte-visual-container');
      if (c && state.classified.length > 0) render(c, state.classified);
    },
    stop: () => {
      if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
      if (renderer) { renderer.dispose(); renderer = null; }
    },
  };
})();
