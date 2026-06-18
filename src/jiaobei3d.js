// 3D 筊杯：載入 CrescentMoon.stl，紅色霧面材質（低反光），兩枚月牙翻滾投擲
let THREE, renderer, scene, camera, raf;
let blocks = [];        // [{ group, mesh }]
let ready = false;
let initing = null;

// 兩種落定姿態：陽=平面朝上、陰=凸面朝上（繞長軸翻 180°）
const BASE = { x: -Math.PI / 2, y: 0, z: 0 };

function restEuler(flat) {
  return { x: BASE.x, y: flat ? 0 : Math.PI, z: BASE.z };
}

export async function ensure3d(canvas) {
  if (ready) return true;
  if (initing) return initing;
  initing = (async () => {
    try {
      THREE = await import('three');
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const base = import.meta.env.BASE_URL;
      const buf = await fetch(base + 'assets/crescent.stl').then((r) => r.arrayBuffer());
      let geom = new STLLoader().parse(buf);
      geom.center();
      geom.computeVertexNormals();
      // 縮放到適中大小
      geom.computeBoundingBox();
      const s = 1.7 / geom.boundingBox.max.y; // 長軸約 1.7 單位
      geom.scale(s, s, s);

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 190, false);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, (canvas.clientWidth || 320) / (canvas.clientHeight || 190), 0.1, 100);
      camera.position.set(0, 3.4, 5.2);
      camera.lookAt(0, -0.2, 0);

      // 柔和打光、霧面材質 → 反光不明顯
      scene.add(new THREE.AmbientLight(0xffffff, 1.15));
      const key = new THREE.DirectionalLight(0xfff1e0, 0.85); key.position.set(2, 5, 3); scene.add(key);
      const fill = new THREE.DirectionalLight(0x88aaff, 0.25); fill.position.set(-3, 1, -2); scene.add(fill);

      const mat = new THREE.MeshStandardMaterial({ color: 0x9c1f1f, roughness: 0.82, metalness: 0.04 });

      for (let i = 0; i < 2; i++) {
        const mesh = new THREE.Mesh(geom, mat);
        const group = new THREE.Group();
        group.add(mesh);
        group.position.x = i === 0 ? -1.25 : 1.25;
        group.rotation.set(BASE.x, i === 0 ? 0 : Math.PI, BASE.z);
        scene.add(group);
        blocks.push({ group, mesh });
      }
      ready = true;
      renderOnce();
      return true;
    } catch (e) {
      console.warn('3D 筊杯不可用：', e && e.message);
      return false;
    }
  })();
  return initing;
}

export function resize(canvas) {
  if (!ready) return;
  const w = canvas.clientWidth || 320, h = canvas.clientHeight || 190;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderOnce();
}

function renderOnce() { if (ready) renderer.render(scene, camera); }

// 落定為指定結果（不動畫）
export function settle(aFlat, bFlat) {
  if (!ready) return;
  const ra = restEuler(aFlat), rb = restEuler(bFlat);
  blocks[0].group.rotation.set(ra.x, ra.y, ra.z); blocks[0].group.position.y = 0;
  blocks[1].group.rotation.set(rb.x, rb.y, rb.z); blocks[1].group.position.y = 0;
  renderOnce();
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// 投擲：拋起 + 翻滾 → 落定到結果（onDone 回呼）
export function throwAnim(aFlat, bFlat, onDone) {
  if (!ready) { if (onDone) onDone(); return; }
  cancelAnimationFrame(raf);
  const DUR = 820;
  const start = performance.now();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    settle(aFlat, bFlat);
    if (onDone) onDone();
  };
  // 保險：rAF 被節流（分頁隱藏等）時仍確保落定
  setTimeout(finish, DUR + 260);
  const init = blocks.map((b, i) => {
    const target = restEuler(i === 0 ? aFlat : bFlat);
    // 起始多轉幾圈，落定到目標角度
    const spin = (2 + Math.floor(Math.random() * 2)) * Math.PI * 2;
    return {
      sx: target.x - spin - Math.PI * (0.5 + Math.random()),
      sy: target.y + spin + Math.PI * Math.random(),
      sz: target.z + (Math.random() - 0.5) * 2,
      tx: target.x, ty: target.y, tz: target.z,
    };
  });

  const tick = (now) => {
    const t = Math.min(1, (now - start) / DUR);
    const e = easeOut(t);
    // 拋物線高度 + 落地回彈
    let h = Math.sin(Math.min(t, 0.78) / 0.78 * Math.PI) * 1.9;
    if (t > 0.78) { const b = (t - 0.78) / 0.22; h = Math.sin(b * Math.PI) * 0.22; } // 小回彈
    for (let i = 0; i < 2; i++) {
      const s = init[i]; const g = blocks[i].group;
      g.rotation.x = s.sx + (s.tx - s.sx) * e;
      g.rotation.y = s.sy + (s.ty - s.sy) * e;
      g.rotation.z = s.sz + (s.tz - s.sz) * e;
      g.position.y = h;
    }
    renderer.render(scene, camera);
    if (t < 1) { raf = requestAnimationFrame(tick); }
    else { finish(); }
  };
  raf = requestAnimationFrame(tick);
}

export function stop() { cancelAnimationFrame(raf); }
