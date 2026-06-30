/**
 * Arte Visual 3D — Visualização Three.js da Copa 2026
 * 
 * Esfera interativa com bandeiras dos 32 classificados,
 * linhas de chaveamento animadas e dados reais do mata-mata.
 * 
 * Integra-se com os dados existentes do index.html.
 */

(function() {
  'use strict';

  // ─── Configuração ───────────────────────────────────────────────
  const CFG = {
    radius: 5,
    flagSize: 0.8,
    flagSegments: 32,
    ringCount: 5,
    autoRotateSpeed: 0.002,
  };

  let scene, camera, renderer, controls;
  let teamMeshes = [];
  let lineMeshes = [];
  let animationId = null;
  let containerEl = null;
  let state = { classified: [], bracketData: null, selectedTeam: null };

  // ─── Carrega Three.js via CDN ───────────────────────────────────
  function loadThreeJS(callback) {
    if (window.THREE) { callback(); return; }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.onload = () => {
      // Carrega OrbitControls
      const orbit = document.createElement('script');
      orbit.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
      orbit.onload = callback;
      document.head.appendChild(orbit);
    };
    document.head.appendChild(script);
  }

  // ─── Cria textura da bandeira ───────────────────────────────────
  function createFlagTexture(flagUrl, abbr) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Fundo
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 64, 64);

    // Tenta carregar a bandeira
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = flagUrl;

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 4, 4, 56, 56);
        const texture = new THREE.CanvasTexture(canvas);
        resolve(texture);
      };
      img.onerror = () => {
        // Fallback: abreviatura
        ctx.fillStyle = '#2d3a4e';
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(abbr || '?', 32, 32);
        const texture = new THREE.CanvasTexture(canvas);
        resolve(texture);
      };
    });
  }

  // ─── Inicializa a cena ──────────────────────────────────────────
  function initScene(container) {
    containerEl = container;
    container.innerHTML = '';

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 700;

    // Cena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    // Câmera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2, 14);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Controles
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = CFG.autoRotateSpeed;
    controls.minDistance = 6;
    controls.maxDistance = 25;
    controls.target.set(0, 0, 0);

    // Luzes
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight(0xf59e0b, 0.3);
    dirLight2.position.set(-5, -3, -5);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xf59e0b, 0.5, 20);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Partículas de fundo (estrelas)
    createStars();

    // Anéis decorativos
    createRings();

    // Evento de resize
    window.addEventListener('resize', onResize);
  }

  // ─── Estrelas de fundo ──────────────────────────────────────────
  function createStars() {
    const geometry = new THREE.BufferGeometry();
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 100;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x64748b,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
    });
    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
  }

  // ─── Anéis decorativos ──────────────────────────────────────────
  function createRings() {
    const ringColors = [0x2d3a4e, 0x1e293b, 0x2d3a4e];
    const ringRadii = [5.8, 4.5, 3.2];

    ringRadii.forEach((r, i) => {
      const geometry = new THREE.RingGeometry(r - 0.02, r, 64);
      const material = new THREE.MeshBasicMaterial({
        color: ringColors[i],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.1;
      scene.add(ring);
    });
  }

  // ─── Cria as bandeiras dos times ─────────────────────────────────
  async function createTeams(classified) {
    // Remove times anteriores
    teamMeshes.forEach(m => scene.remove(m));
    teamMeshes = [];

    const numTeams = Math.min(classified.length, 32);
    if (numTeams === 0) return;

    const flagPromises = [];

    for (let i = 0; i < numTeams; i++) {
      const team = classified[i];
      const angle = (i / numTeams) * Math.PI * 2;
      const x = CFG.radius * Math.sin(angle);
      const z = CFG.radius * Math.cos(angle);
      const flagSrc = window.flagUrl ? window.flagUrl(team.abbr) : '';

      flagPromises.push(
        createFlagTexture(flagSrc, team.abbr).then(texture => {
          // Plano da bandeira (sempre virada pro centro)
          const geometry = new THREE.PlaneGeometry(CFG.flagSize, CFG.flagSize);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: true,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, 0, z);
          // Aponta pro centro
          mesh.lookAt(0, 0, 0);
          mesh.userData = { team, angle, index: i };

          // Glow ao redor
          const glowGeo = new THREE.RingGeometry(
            CFG.flagSize * 0.5,
            CFG.flagSize * 0.55,
            32
          );
          const glowMat = new THREE.MeshBasicMaterial({
            color: team.status === 'confirmed' ? 0x22c55e : 0xf59e0b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
          });
          const glow = new THREE.Mesh(glowGeo, glowMat);
          glow.position.copy(mesh.position);
          glow.lookAt(0, 0, 0);

          // Label do nome (Sprite)
          const labelCanvas = document.createElement('canvas');
          labelCanvas.width = 256;
          labelCanvas.height = 64;
          const ctx = labelCanvas.getContext('2d');
          ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.roundRect(0, 0, 256, 64, 8);
          ctx.fill();
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 18px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(team.name, 128, 32);

          const labelTexture = new THREE.CanvasTexture(labelCanvas);
          const labelMat = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true,
            depthTest: false,
          });
          const label = new THREE.Sprite(labelMat);
          const labelOffset = 0.7;
          const lx = x + (x / CFG.radius) * labelOffset;
          const lz = z + (z / CFG.radius) * labelOffset;
          label.position.set(lx, -0.6, lz);
          label.scale.set(1.2, 0.3, 1);

          // Linha do time até o centro (primeiro anel)
          const lineGeo = new THREE.BufferGeometry();
          const linePoints = new Float32Array([
            x * 0.85, 0, z * 0.85,
            x * 0.3, 0, z * 0.3,
          ]);
          lineGeo.setAttribute('position', new THREE.BufferAttribute(linePoints, 3));
          const lineMat = new THREE.LineBasicMaterial({
            color: 0x2d3a4e,
            transparent: true,
            opacity: 0.2,
          });
          const line = new THREE.Line(lineGeo, lineMat);

          const group = new THREE.Group();
          group.add(mesh);
          group.add(glow);
          group.add(label);
          group.add(line);
          group.userData = { team, angle, index: i, abbr: team.abbr };

          teamMeshes.push(group);
          return group;
        })
      );
    }

    const groups = await Promise.all(flagPromises);
    groups.forEach(g => scene.add(g));
  }

  // ─── Cria as linhas do chaveamento ──────────────────────────────
  function createBracketLines(classified) {
    lineMeshes.forEach(m => scene.remove(m));
    lineMeshes = [];

    const numTeams = Math.min(classified.length, 32);
    if (numTeams < 2) return;

    // Conecta pares (1º vs 2º de cada grupo)
    for (let i = 0; i < numTeams; i += 2) {
      if (i + 1 >= numTeams) break;

      const a1 = (i / numTeams) * Math.PI * 2;
      const a2 = ((i + 1) / numTeams) * Math.PI * 2;
      const midA = (a1 + a2) / 2;

      const x1 = CFG.radius * Math.sin(a1);
      const z1 = CFG.radius * Math.cos(a1);
      const x2 = CFG.radius * Math.sin(a2);
      const z2 = CFG.radius * Math.cos(a2);
      const mx = CFG.radius * 0.6 * Math.sin(midA);
      const mz = CFG.radius * 0.6 * Math.cos(midA);

      // Curva bezier aproximada
      const points = [
        new THREE.Vector3(x1 * 0.85, 0, z1 * 0.85),
        new THREE.Vector3(x1 * 0.5 + mx * 0.3, 0.3, z1 * 0.5 + mz * 0.3),
        new THREE.Vector3(mx, 0, mz),
        new THREE.Vector3(x2 * 0.5 + mx * 0.3, 0.3, z2 * 0.5 + mz * 0.3),
        new THREE.Vector3(x2 * 0.85, 0, z2 * 0.85),
      ];

      const curve = new THREE.CatmullRomCurve3(points);
      const curvePoints = curve.getPoints(20);
      const geo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const mat = new THREE.LineBasicMaterial({
        color: 0x2d3a4e,
        transparent: true,
        opacity: 0.15,
      });
      const line = new THREE.Line(geo, mat);
      lineMeshes.push(line);
      scene.add(line);
    }

    // Anéis internos (oitavas → quartas → semi → final)
    const ringRadii = [CFG.radius * 0.6, CFG.radius * 0.4, CFG.radius * 0.25, CFG.radius * 0.12];
    ringRadii.forEach((r, ri) => {
      const points = [];
      const segments = Math.max(4, 16 - ri * 3);
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(r * Math.sin(a), 0, r * Math.cos(a)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0x2d3a4e,
        transparent: true,
        opacity: 0.2 + ri * 0.05,
        depthWrite: false,
      });
      const ring = new THREE.Line(geo, mat);
      lineMeshes.push(ring);
      scene.add(ring);
    });

    // Centro: esfera dourada (troféu)
    const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(0, 0, 0);
    lineMeshes.push(sphere);
    scene.add(sphere);

    // Anel pulsante no centro
    const pulseGeo = new THREE.RingGeometry(0.35, 0.4, 32);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = 0;
    pulse.userData.isPulse = true;
    lineMeshes.push(pulse);
    scene.add(pulse);
  }

  // ─── Animação ────────────────────────────────────────────────────
  function animate() {
    animationId = requestAnimationFrame(animate);

    // Pulsa o anel central
    lineMeshes.forEach(m => {
      if (m.userData?.isPulse) {
        const scale = 1 + 0.1 * Math.sin(Date.now() * 0.002);
        m.scale.set(scale, scale, 1);
        m.material.opacity = 0.2 + 0.15 * Math.sin(Date.now() * 0.002);
      }
    });

    controls.update();
    renderer.render(scene, camera);
  }

  // ─── Resize ──────────────────────────────────────────────────────
  function onResize() {
    if (!containerEl || !camera || !renderer) return;
    const width = containerEl.clientWidth || 700;
    const height = containerEl.clientHeight || 700;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // ─── Renderiza tudo ──────────────────────────────────────────────
  async function render(container, classified, bracketData) {
    state.classified = classified || [];
    state.bracketData = bracketData;

    if (!container) return;

    loadThreeJS(async () => {
      initScene(container);
      await createTeams(state.classified);
      createBracketLines(state.classified);
      animate();
    });
  }

  // ─── API pública ────────────────────────────────────────────────
  window.ArteVisual = {
    render,
    refresh: () => {
      const c = document.getElementById('arte-visual-container');
      if (c && state.classified.length > 0) render(c, state.classified, state.bracketData);
    },
    stop: () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
    },
  };
})();
