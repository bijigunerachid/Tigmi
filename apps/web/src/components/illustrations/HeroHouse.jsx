import { Suspense, lazy, useCallback, useState } from 'react';
import { IsoHouse } from './IsoHouse.jsx';

// Three.js lives in its own chunk: downloaded only when the 3D hero is actually shown.
const HouseScene3D = lazy(() => import('./HouseScene3D.jsx'));

const media = (query) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;

// Renderers that draw WebGL on the CPU (no GPU, blocked driver, virtual desktop, headless).
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * True only for hardware-accelerated WebGL. On software renderers a live 3D scene costs a lot of
 * CPU, so those visitors get the lightweight SVG instead. Two checks, because browsers differ:
 * `failIfMajorPerformanceCaveat` (some browsers refuse a software context) and the renderer name
 * (Chromium accepts SwiftShader with that flag — measured — but reports it by name).
 */
function hasHardwareWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const options = { failIfMajorPerformanceCaveat: true };
    const gl = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '',
    );
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // free the probe context right away
    return !SOFTWARE_RENDERER.test(renderer);
  } catch {
    return false;
  }
}

/** Development-only override so automated browsers (software GPU) can still test the 3D path. */
function forced3D() {
  if (!import.meta.env.DEV) return false;
  try {
    return window.localStorage.getItem('tigmi.hero') === '3d';
  } catch {
    return false;
  }
}

/**
 * Sign-in hero: real-time 3D on large screens with a real GPU, otherwise the code-drawn isometric
 * SVG. The SVG is also the instant placeholder, cross-faded out once the scene has rendered its
 * first frame — so nothing pops and nothing waits.
 */
export function HeroHouse({ className = '' }) {
  const [use3D] = useState(
    () => media('(min-width: 1024px)') && (forced3D() || hasHardwareWebGL()),
  );
  const [reducedMotion] = useState(() => media('(prefers-reduced-motion: reduce)'));
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  return (
    <div
      // Soft fade at the bottom edge: the scene never ends on a hard line.
      className={`relative [mask-image:linear-gradient(to_bottom,black_75%,transparent)] ${className}`}
      data-hero={use3D ? '3d' : 'svg'}
      aria-hidden="true"
    >
      <IsoHouse
        className={`absolute inset-0 m-auto size-full transition-opacity duration-700 ${ready ? 'opacity-0' : 'opacity-100'}`}
      />
      {use3D && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
        >
          <Suspense fallback={null}>
            <HouseScene3D reducedMotion={reducedMotion} onReady={onReady} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
