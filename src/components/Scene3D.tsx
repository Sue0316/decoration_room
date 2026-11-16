import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildFurniture, elevation } from "../furniture3d";
import { WALL_TYPES } from "../catalog";
import { finishCanvas, finishId, finishInfo } from "../finishes";
import { bounds, centroid, nearestWall, signedArea } from "../geometry";
import type { Design } from "../types";

interface Props {
  design: Design;
  selectedId: string | null;
  frameToken: number;
  onSelect(id: string | null): void;
  onDragStart(): void;
  onMove(id: string, x: number, y: number): void;
}

interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  root: THREE.Group;
  walls: { group: THREE.Group; mid: THREE.Vector3; normal: THREE.Vector3 }[];
  fitSun(): void;
  anisotropy: number;
  /** Kept between rebuilds so dragging furniture doesn't re-upload the surfaces. */
  surfaces: Partial<Record<Surface, { key: string; texture: THREE.Texture | null }>>;
}

type Surface = "wall" | "floor";

const WALL_T = 0.1;

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mats = ([] as (THREE.Material | undefined)[]).concat(m.material);
    mats.forEach((mat) => mat?.dispose?.());
  });
}

/** The repeating texture for a surface, or null when it is plain. UVs are in metres. */
function surfaceTexture(stage: Stage, surface: Surface, finish: string | undefined, color: string) {
  const id = finishId(finish);
  const key = `${id}|${color}`;
  const held = stage.surfaces[surface];
  if (held?.key === key) return held.texture;
  held?.texture?.dispose();
  let texture: THREE.Texture | null = null;
  if (id !== "plain") {
    const f = finishInfo(id);
    texture = new THREE.CanvasTexture(finishCanvas(id, color, 768));
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / f.w, 1 / f.h);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = stage.anisotropy;
  }
  stage.surfaces[surface] = { key, texture };
  return texture;
}

function frame(stage: Stage, design: Design) {
  const b = bounds(design.points);
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minY + b.maxY) / 2;
  const reach = Math.max(b.w, b.h, design.height);
  stage.controls.target.set(cx, design.height * 0.3, cz);
  stage.camera.position.set(cx + reach * 0.75, reach * 1.05 + design.height, cz + reach * 1.15);
  stage.controls.update();
}

function rebuild(stage: Stage, design: Design, selectedId: string | null) {
  disposeTree(stage.root);
  stage.root.clear();
  stage.walls = [];
  const pts = design.points;

  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
  const floorMap = surfaceTexture(stage, "floor", design.floorFinish, design.floorColor);
  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: floorMap ? "#ffffff" : design.floorColor, map: floorMap, roughness: 0.85, side: THREE.DoubleSide }),
  );
  floor.rotation.x = Math.PI / 2;
  floor.receiveShadow = true;
  stage.root.add(floor);

  // Positive signed area on the y-down plan means the outward normal is (dy, -dx).
  const sign = signedArea(pts) > 0 ? 1 : -1;
  const wallMap = surfaceTexture(stage, "wall", design.wallFinish, design.wallColor);
  const edgeMat = new THREE.MeshStandardMaterial({ color: design.wallColor, roughness: 0.92 });
  const faceMat = new THREE.MeshStandardMaterial({ color: wallMap ? "#ffffff" : design.wallColor, map: wallMap, roughness: 0.92 });
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const len = Math.hypot(dx, dz);
    const normal = new THREE.Vector3((dz / len) * sign, 0, (-dx / len) * sign);
    const mid = new THREE.Vector3((a.x + b.x) / 2, 0, (a.y + b.y) / 2);
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(len + WALL_T, design.height, WALL_T);
    const uv = geometry.attributes.uv;
    for (let n = 0; n < uv.count; n++) uv.setXY(n, uv.getX(n) * (len + WALL_T), uv.getY(n) * design.height);
    // Box faces run +x, -x, +y, -y, +z, -z; only the two large faces carry the finish.
    const wall = new THREE.Mesh(geometry, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, faceMat]);
    wall.position.copy(mid).addScaledVector(normal, WALL_T / 2).setY(design.height / 2);
    wall.rotation.y = -Math.atan2(dz, dx);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    stage.root.add(group);
    stage.walls.push({ group, mid, normal });
  });

  for (const item of design.items) {
    const g = buildFurniture(item);
    g.position.set(item.x, elevation(item, design.height, design.items), item.y);
    g.rotation.y = -(item.rot * Math.PI) / 180;
    g.userData.itemId = item.id;
    const isWall = WALL_TYPES.includes(item.type);
    const parent = isWall ? stage.walls[nearestWall(item, pts).index].group : stage.root;
    parent.add(g);
    if (item.id === selectedId) {
      const box = new THREE.Box3().setFromObject(g).expandByScalar(0.02);
      const helper = new THREE.Box3Helper(box, new THREE.Color("#b8573a"));
      parent.add(helper);
    }
  }
}

function hideNearWalls(stage: Stage) {
  for (const w of stage.walls) {
    const toCam = stage.camera.position.clone().sub(w.mid).setY(0);
    w.group.visible = toCam.dot(w.normal) < 0;
  }
}

export function Scene3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    const canvas = renderer.domElement;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9e4db");
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 1.5;
    controls.maxDistance = 40;

    scene.add(new THREE.HemisphereLight("#fff7ea", "#b8ab99", 1.7));
    const sun = new THREE.DirectionalLight("#fff1dc", 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);

    const root = new THREE.Group();
    scene.add(root);
    const fitSun = () => {
      const { design } = latest.current;
      const b = bounds(design.points);
      const c = centroid(design.points);
      const reach = Math.max(b.w, b.h) + 2;
      sun.position.set(c.x + reach * 0.5, reach * 1.4 + design.height, c.y + reach * 0.35);
      sun.target.position.set(c.x, 0, c.y);
      const cam = sun.shadow.camera;
      cam.left = cam.bottom = -reach;
      cam.right = cam.top = reach;
      cam.far = reach * 5;
      cam.updateProjectionMatrix();
    };
    const stage: Stage = { scene, camera, controls, root, walls: [], fitSun, anisotropy: renderer.capabilities.getMaxAnisotropy(), surfaces: {} };
    stageRef.current = stage;

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const ray = new THREE.Raycaster();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    const setRay = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const floorHit = () => ray.ray.intersectPlane(floorPlane, new THREE.Vector3());
    const isShown = (o: THREE.Object3D | null): boolean => !o || (o.visible && isShown(o.parent));
    const pickItem = (): string | null => {
      for (const hit of ray.intersectObject(root, true)) {
        if (!isShown(hit.object) || !(hit.object as THREE.Mesh).isMesh) continue;
        let o: THREE.Object3D | null = hit.object;
        while (o && !o.userData.itemId) o = o.parent;
        if (o) return o.userData.itemId as string;
      }
      return null;
    };

    let drag: { id: string; dx: number; dz: number; moved: boolean; downX: number; downY: number } | null = null;
    let press: { x: number; y: number } | null = null;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      setRay(e);
      press = { x: e.clientX, y: e.clientY };
      const id = pickItem();
      if (!id) return;
      const item = latest.current.design.items.find((i) => i.id === id);
      const at = floorHit();
      if (!item || !at) return;
      controls.enabled = false;
      drag = { id, dx: item.x - at.x, dz: item.y - at.z, moved: false, downX: e.clientX, downY: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      latest.current.onSelect(id);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY) < 4) return;
        drag.moved = true;
        latest.current.onDragStart();
      }
      setRay(e);
      const at = floorHit();
      if (at) latest.current.onMove(drag.id, at.x + drag.dx, at.z + drag.dz);
    };
    const onUp = (e: PointerEvent) => {
      if (drag) {
        drag = null;
        controls.enabled = true;
      } else if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4) {
        latest.current.onSelect(null);
      }
      press = null;
    };
    canvas.addEventListener("pointerdown", onDown, { capture: true });
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      hideNearWalls(stage);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      disposeTree(scene);
      Object.values(stage.surfaces).forEach((s) => s.texture?.dispose());
      renderer.dispose();
      canvas.remove();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    rebuild(stage, props.design, props.selectedId);
    stage.fitSun();
  }, [props.design, props.selectedId]);

  useEffect(() => {
    if (stageRef.current) frame(stageRef.current, latest.current.design);
  }, [props.frameToken]);

  return <div className="scene" ref={hostRef} data-testid="scene3d" />;
}
