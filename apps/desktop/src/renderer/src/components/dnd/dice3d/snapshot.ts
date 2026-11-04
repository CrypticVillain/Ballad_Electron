import { DirectionalLight, HemisphereLight, NeutralToneMapping, PerspectiveCamera, PMREMGenerator, Quaternion, Scene, Vector3, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { faceCenter, faceNormal, normalize, numbering, solidFor, TENS, type Vec } from '@/lib/dice3d';
import type { DiceLook } from '@/lib/diceLooks';
import { lookFont } from './looks';
import { DIE_RADIUS, dieMesh, disposeMesh } from './mesh';

const SIZE = 160;
let stage: { renderer: WebGLRenderer; scene: Scene; camera: PerspectiveCamera } | null | undefined;

/** One small offscreen renderer for every picture (WebGL allows only so many at once). */
function studio() {
  if (stage !== undefined) return stage;
  try {
    const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = NeutralToneMapping;
    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    pmrem.dispose();
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 5, 6);
    scene.add(new HemisphereLight(0xffffff, 0x444444, 0.6), key);
    stage = { renderer, scene, camera: new PerspectiveCamera(24, 1, 0.1, 100) };
  } catch {
    stage = null;
  }
  return stage;
}

const images = new Map<string, string>();

/** A picture already made, or undefined. */
export const cachedDieImage = (sides: number, look: DiceLook, value: string) => images.get(`${sides}|${look}|${value}`);

/**
 * A die in a look as a picture (a PNG data URL), turned three-quarters to
 * you with `value` on the face toward you, upright: for the dice tray's
 * buttons and the dice styles in Settings. Null without WebGL (the flat dice
 * stand in).
 */
export async function dieImage(sides: number, look: DiceLook, value: string): Promise<string | null> {
  const key = `${sides}|${look}|${value}`;
  const hit = images.get(key);
  if (hit) return hit;
  const s = studio();
  if (!s) return null;
  await document.fonts.load(lookFont(look)).catch(() => undefined);

  const solid = solidFor(sides);
  const face = solid.faces[0]!;
  const n = faceNormal(solid, face);
  const c = faceCenter(solid, face);
  const first = solid.vertices[face[0]!]!;
  const u = normalize([first[0] - c[0], first[1] - c[1], first[2] - c[2]]);
  const w: Vec = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  // Face 0 toward the camera, its number upright, then a three-quarter turn.
  const toward = new Quaternion().setFromUnitVectors(new Vector3(...n), new Vector3(0, 0, 1));
  const up = new Vector3(...w).applyQuaternion(toward);
  const upright = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.atan2(up.x, up.y));
  const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.38).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.42));
  const rotation = tilt.multiply(upright).multiply(toward);

  let top = 0;
  if (solid.readAt === 'vertex') {
    // A d4: the corner of the face toward you that points up carries the number.
    const heights = face.map((i) => new Vector3(...solid.vertices[i]!).applyQuaternion(rotation).y);
    top = face[heights.indexOf(Math.max(...heights))]!;
  }
  const labels = numbering(solid, sides === 100 ? 10 : sides, top, value, sides === 100 ? TENS : undefined);
  const mesh = dieMesh(solid, look, labels);
  mesh.quaternion.copy(rotation);
  s.scene.add(mesh);
  const radius = DIE_RADIUS[solid.shape] ?? 1;
  s.camera.position.set(0, 0, (radius * 1.12) / Math.tan((s.camera.fov * Math.PI) / 360));
  s.camera.lookAt(0, 0, 0);
  s.renderer.render(s.scene, s.camera);
  const url = s.renderer.domElement.toDataURL('image/png');
  s.scene.remove(mesh);
  disposeMesh(mesh);
  images.set(key, url);
  return url;
}
