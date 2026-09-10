'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointMaterial, Points } from '@react-three/drei';
import * as THREE from 'three';

function OrbitingRings() {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x -= delta * 0.08;
      ring1Ref.current.rotation.y -= delta * 0.12;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x += delta * 0.06;
      ring2Ref.current.rotation.y += delta * 0.09;
    }
  });

  return (
    <group>
      <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[3.2, 0.008, 8, 40]} />
        <meshBasicMaterial color="#7C3AED" transparent opacity={0.5} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[0, Math.PI / 4, Math.PI / 6]}>
        <torusGeometry args={[2.6, 0.008, 8, 40]} />
        <meshBasicMaterial color="#A855F7" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function WireframeSphere() {
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (sphereRef.current) {
      sphereRef.current.rotation.y += delta * 0.07;
      sphereRef.current.rotation.x += delta * 0.035;
    }
  });

  return (
    <mesh ref={sphereRef}>
      <sphereGeometry args={[1.8, 14, 14]} />
      <meshBasicMaterial color="#A855F7" wireframe transparent opacity={0.14} />
    </mesh>
  );
}

function FloatingParticles() {
  const ref = useRef<THREE.Points>(null);
  const particles = useMemo(() => {
    const positions = new Float32Array(280 * 3);
    for (let index = 0; index < 280; index += 1) {
      const radius = 4 + Math.random() * 2;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[index * 3 + 2] = radius * Math.cos(phi);
    }
    return positions;
  }, []);

  useFrame((_state, delta) => {
    if (ref.current) {
      ref.current.rotation.y -= delta * 0.035;
      ref.current.rotation.z += delta * 0.015;
    }
  });

  return (
    <Points ref={ref} positions={particles} stride={3}>
      <PointMaterial
        transparent
        color="#C084FC"
        size={0.028}
        sizeAttenuation
        depthWrite={false}
        opacity={0.35}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function SceneCleanup() {
  const { scene, gl } = useThree();

  useEffect(() => () => {
    scene.traverse((object) => {
      const renderable = object as THREE.Mesh | THREE.Points;
      if ('geometry' in renderable && renderable.geometry) renderable.geometry.dispose();
      if ('material' in renderable && renderable.material) {
        const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
        materials.forEach((material) => material.dispose());
      }
    });
    gl.dispose();
  }, [gl, scene]);

  return null;
}

function StaticPoster() {
  return <div className="hero-poster absolute inset-0" aria-hidden />;
}

export function HeroBackground() {
  const [canvasAllowed, setCanvasAllowed] = useState(false);
  const [active, setActive] = useState(true);
  const inViewRef = useRef(true);
  const tabVisibleRef = useRef(true);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce), (update: slow)');
    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    // Only genuinely weak devices skip WebGL (≤2 cores / ≤2GB) — a 4-core
    // laptop is the median desktop visitor and runs this scene trivially,
    // not an edge case to downgrade to the static poster.
    const lowPower = (navigator.hardwareConcurrency || 8) <= 2 || (navigatorWithMemory.deviceMemory ?? 8) <= 2;
    const update = () => setCanvasAllowed(!media.matches && !lowPower);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const syncActive = () => setActive(inViewRef.current && tabVisibleRef.current);
    const onVisibility = () => {
      tabVisibleRef.current = !document.hidden;
      syncActive();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      inViewRef.current = entry.isIntersecting;
      setActive(entry.isIntersecting && tabVisibleRef.current);
    }, { threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [canvasAllowed]);

  if (!canvasAllowed) return <StaticPoster />;

  return (
    <div ref={wrapperRef} className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <Canvas
        fallback={<StaticPoster />}
        frameloop={active ? 'always' : 'never'}
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.25]}
        gl={{ powerPreference: 'high-performance', antialias: false, alpha: true }}
      >
        <WireframeSphere />
        <OrbitingRings />
        <FloatingParticles />
        <SceneCleanup />
      </Canvas>
    </div>
  );
}
