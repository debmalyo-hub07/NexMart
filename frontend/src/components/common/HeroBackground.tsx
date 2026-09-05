'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, Preload } from '@react-three/drei';
import * as THREE from 'three';

function OrbitingRings() {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x -= delta * 0.12; // slowed — feels orbital
      ring1Ref.current.rotation.y -= delta * 0.18;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x += delta * 0.08; // counter-rotate slowly
      ring2Ref.current.rotation.y += delta * 0.13;
    }
  });

  return (
    <group>
      {/* Outer Ring */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[3.2, 0.008, 8, 48]} />
        <meshBasicMaterial color="#6b21a8" transparent opacity={0.6} />
      </mesh>
      {/* Inner Ring */}
      <mesh ref={ring2Ref} rotation={[0, Math.PI / 4, Math.PI / 6]}>
        <torusGeometry args={[2.6, 0.008, 8, 48]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function WireframeSphere() {
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (sphereRef.current) {
      sphereRef.current.rotation.y += delta * 0.1;
      sphereRef.current.rotation.x += delta * 0.05;
    }
  });

  return (
    <mesh ref={sphereRef}>
      <sphereGeometry args={[1.8, 16, 16]} />
      <meshBasicMaterial 
        color="#a855f7" 
        wireframe 
        transparent 
        opacity={0.15} 
      />
    </mesh>
  );
}

function FloatingParticles() {
  const ref = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const positions = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const r = 4 + Math.random() * 2;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return positions;
  }, []);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y -= delta * 0.05;
      ref.current.rotation.z += delta * 0.02;
    }
  });

  return (
    <Points ref={ref} positions={particles} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#c084fc"
        size={0.03}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

import { useThree } from '@react-three/fiber';

function SceneCleanup() {
  const { scene, gl } = useThree();
  useEffect(() => {
    return () => {
      scene.traverse((object: any) => {
        if (!object.isMesh && !object.isPoints) return;
        
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material: any) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      gl.dispose();
    };
  }, [scene, gl]);
  
  return null;
}

export function HeroBackground() {
  const [ready, setReady] = useState(false);
  // Pause the render loop entirely when the tab is backgrounded — no GPU/CPU
  // burned animating a canvas nobody is looking at.
  const [active, setActive] = useState(true);

  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    const onVisibility = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!ready) return <div className="absolute inset-0 z-0" />;

  return (
    <div
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      style={{ animation: 'heroFadeIn 0.5s ease forwards' }}
    >
      <style>{`@keyframes heroFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <Canvas frameloop={active ? 'always' : 'never'} camera={{ position: [0, 0, 5], fov: 60 }} dpr={[1, 1.5]} gl={{ powerPreference: 'high-performance', antialias: false }}>
        <ambientLight intensity={0.5} />
        <WireframeSphere />
        <OrbitingRings />
        <FloatingParticles />
        <SceneCleanup />
        <Preload all />
      </Canvas>
    </div>
  );
}
