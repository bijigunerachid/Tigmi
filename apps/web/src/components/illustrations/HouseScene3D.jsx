import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Shape,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

/**
 * Real-time 3D house for the sign-in hero (desktop, WebGL, motion allowed).
 *
 * Performance contract — learned the hard way with the animated background:
 *  - render ON DEMAND only: a short intro settle, then frames only while the house eases toward
 *    the pointer; when it has settled, nothing runs (0 % GPU at rest);
 *  - pixel ratio capped at 1.75, low-power GPU preference, 1024 px shadow map;
 *  - everything is disposed on unmount.
 * Loaded lazily (own chunk), so pages that never show it never download Three.js.
 */
const PALETTE = {
  wall: '#22325e',
  wallDark: '#18244a',
  roof: '#3157b5',
  ground: '#0f1a36',
  window: '#22d3ee',
  door: '#93c5fd',
  tree: '#0f766e',
  trunk: '#3f2d20',
};

function buildHouse() {
  const house = new Group();
  const standard = (color, extra = {}) =>
    new MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, ...extra });

  const ground = new Mesh(new CylinderGeometry(5.4, 5.6, 0.4, 64), standard(PALETTE.ground));
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  house.add(ground);

  const path = new Mesh(new BoxGeometry(1.2, 0.04, 2.4), standard('#1f2b4d'));
  path.position.set(0, 0.02, 2.9);
  path.receiveShadow = true;
  house.add(path);

  // Body: 4 wide (x), 3 deep (z), 2.4 high.
  const body = new Mesh(new BoxGeometry(4, 2.4, 3), [
    standard(PALETTE.wall),
    standard(PALETTE.wallDark),
    standard(PALETTE.wall),
    standard(PALETTE.wall),
    standard(PALETTE.wall),
    standard(PALETTE.wallDark),
  ]);
  body.position.y = 1.2;
  body.castShadow = true;
  body.receiveShadow = true;
  house.add(body);

  // Gable roof: a triangle extruded along the house length, with overhang.
  const roofShape = new Shape();
  roofShape.moveTo(-1.85, 0);
  roofShape.lineTo(1.85, 0);
  roofShape.lineTo(0, 1.35);
  roofShape.closePath();
  const roofGeometry = new ExtrudeGeometry(roofShape, {
    depth: 4.6,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  roofGeometry.translate(0, 0, -2.3);
  const roof = new Mesh(roofGeometry, standard(PALETTE.roof, { roughness: 0.4, metalness: 0.15 }));
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 2.4;
  roof.castShadow = true;
  house.add(roof);

  // Glowing windows and door: emissive panels just in front of the walls.
  const glow = (color, intensity) =>
    new MeshStandardMaterial({
      color: '#0b1224',
      emissive: new Color(color),
      emissiveIntensity: intensity,
    });
  const panel = (w, h, material, x, y, z, rotationY = 0) => {
    const mesh = new Mesh(new PlaneGeometry(w, h), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    house.add(mesh);
  };
  const windowMaterial = glow(PALETTE.window, 1.8);
  panel(0.8, 0.8, windowMaterial, -1.1, 1.4, 1.51);
  panel(0.8, 0.8, windowMaterial, 1.1, 1.4, 1.51);
  panel(0.85, 1.45, glow(PALETTE.door, 1.1), 0, 0.73, 1.51);
  panel(0.7, 0.7, windowMaterial, 2.01, 1.4, 0, Math.PI / 2);
  panel(0.5, 0.45, windowMaterial, 2.31, 3.05, 0, Math.PI / 2);

  // Trees
  for (const [x, z, scale] of [
    [-3.4, 1.6, 1],
    [-3.1, -1.8, 0.75],
    [3.6, -2.2, 0.85],
  ]) {
    const trunk = new Mesh(new CylinderGeometry(0.09, 0.12, 0.5, 8), standard(PALETTE.trunk));
    trunk.position.set(x, 0.25 * scale, z);
    const crown = new Mesh(new ConeGeometry(0.62 * scale, 1.7 * scale, 7), standard(PALETTE.tree));
    crown.position.set(x, 0.5 * scale + 0.85 * scale, z);
    crown.castShadow = true;
    house.add(trunk, crown);
  }

  return house;
}

export default function HouseScene3D({ reducedMotion = false, onReady }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;

    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(12, 8.6, 14.5);
    camera.lookAt(0, 0.9, 0);

    scene.add(new HemisphereLight('#93c5fd', '#0b1224', 0.85));
    // Cool rim light from behind: separates the house from the dark background.
    const rim = new DirectionalLight('#22d3ee', 0.9);
    rim.position.set(-6, 5, -7);
    scene.add(rim);
    const sun = new DirectionalLight('#dbeafe', 2.4);
    sun.position.set(6, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    sun.shadow.radius = 4;
    scene.add(sun);
    const porch = new PointLight('#22d3ee', 9, 7, 2);
    porch.position.set(0.4, 1.4, 2.6);
    scene.add(porch);

    const house = buildHouse();
    const BASE_ROTATION = -0.35;
    house.rotation.y = reducedMotion ? BASE_ROTATION : BASE_ROTATION - 0.55;
    house.scale.setScalar(reducedMotion ? 1 : 0.94);
    scene.add(house);

    const target = { rotY: BASE_ROTATION, rotX: 0, scale: 1 };
    let frame = 0;
    let disposed = false;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    // One frame, then keep going only while the house is still easing toward its target.
    const tick = () => {
      frame = 0;
      if (disposed) return;
      const ease = 0.075;
      house.rotation.y += (target.rotY - house.rotation.y) * ease;
      house.rotation.x += (target.rotX - house.rotation.x) * ease;
      const nextScale = house.scale.x + (target.scale - house.scale.x) * ease;
      house.scale.setScalar(nextScale);
      renderer.render(scene, camera);
      const moving =
        Math.abs(target.rotY - house.rotation.y) > 0.0005 ||
        Math.abs(target.rotX - house.rotation.x) > 0.0005 ||
        Math.abs(target.scale - nextScale) > 0.0005;
      if (moving) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (event) => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      target.rotY = BASE_ROTATION + nx * 0.28;
      target.rotX = ny * 0.06;
      wake();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    if (!reducedMotion) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      wake(); // intro: settle from a slight turn and scale
    }
    onReady?.();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      scene.traverse((object) => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material?.dispose());
      });
      renderer.dispose();
    };
  }, [reducedMotion, onReady]);

  return <canvas ref={canvasRef} aria-hidden="true" className="block size-full" />;
}
