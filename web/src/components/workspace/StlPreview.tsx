"use client";

import { Maximize2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { base64ToArrayBuffer } from "@/lib/workspace-binary";

type Props = {
  base64: string;
  fileName: string;
};

type ViewerApi = {
  fit: () => void;
  reset: () => void;
};

function fitCameraToSphere(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  sphere: THREE.Sphere,
): void {
  const radius = Math.max(sphere.radius, 1);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = radius / Math.sin(fov / 2);
  camera.near = Math.max(radius / 100, 0.01);
  camera.far = Math.max(radius * 100, distance * 4);
  camera.position.set(distance * 0.72, distance * 0.52, distance * 0.82);
  camera.updateProjectionMatrix();
  controls.target.copy(sphere.center);
  controls.update();
}

export function StlPreview({ base64, fileName }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewerApiRef = useRef<ViewerApi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    setError(null);
    viewerApiRef.current = null;

    let frameId = 0;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    try {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.className = "h-full w-full";
      viewport.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.screenSpacePanning = true;

      const geometry = new STLLoader().parse(base64ToArrayBuffer(base64));
      geometry.center();
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();

      const sphere = geometry.boundingSphere?.clone() ?? new THREE.Sphere();
      if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) {
        sphere.radius = 40;
      }

      const material = new THREE.MeshStandardMaterial({
        color: 0x7f919c,
        metalness: 0.22,
        roughness: 0.42,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const floorSize = Math.max(sphere.radius * 4, 80);
      const grid = new THREE.GridHelper(
        floorSize,
        16,
        new THREE.Color(0x9aa8b3),
        new THREE.Color(0xd9e0e5),
      );
      grid.position.y = -sphere.radius;
      scene.add(grid);

      const ambient = new THREE.HemisphereLight(0xffffff, 0xb8c3ca, 1.2);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
      keyLight.position.set(sphere.radius * 2, sphere.radius * 3, sphere.radius * 2);
      keyLight.castShadow = true;
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xdde8ff, 0.9);
      fillLight.position.set(-sphere.radius * 2, sphere.radius, -sphere.radius);
      scene.add(fillLight);

      const resize = () => {
        if (!viewport || disposed) return;
        const width = Math.max(viewport.clientWidth, 1);
        const height = Math.max(viewport.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };

      const fit = () => {
        fitCameraToSphere(camera, controls, sphere);
        resize();
      };

      const reset = () => {
        fit();
      };

      viewerApiRef.current = { fit, reset };
      fit();

      const observer = new ResizeObserver(resize);
      observer.observe(viewport);
      cleanups.push(() => observer.disconnect());

      const animate = () => {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        frameId = window.requestAnimationFrame(animate);
      };
      animate();

      cleanups.push(() => window.cancelAnimationFrame(frameId));
      cleanups.push(() => controls.dispose());
      cleanups.push(() => geometry.dispose());
      cleanups.push(() => material.dispose());
      cleanups.push(() => renderer.dispose());
      cleanups.push(() => {
        renderer.domElement.remove();
      });
    } catch (err) {
      // Preview initialization is imperative Three.js setup; surface failures in UI.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(err instanceof Error ? err.message : "STL 预览失败");
    }

    return () => {
      disposed = true;
      viewerApiRef.current = null;
      for (const cleanup of cleanups.reverse()) cleanup();
    };
  }, [base64]);

  const resetView = useCallback(() => {
    viewerApiRef.current?.reset();
  }, []);

  const fitView = useCallback(() => {
    viewerApiRef.current?.fit();
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-4 py-3 text-sm text-[var(--danger-muted)]">
        <p className="font-medium">无法预览 STL</p>
        <p className="mt-1 text-xs opacity-90">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-[var(--fg-tertiary)]">{fileName}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn-icon"
            aria-label="重置视角"
            title="重置视角"
            onClick={resetView}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label="适应窗口"
            title="适应窗口"
            onClick={fitView}
          >
            <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="relative min-h-[360px] flex-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface),var(--bg))]"
      />
    </div>
  );
}
