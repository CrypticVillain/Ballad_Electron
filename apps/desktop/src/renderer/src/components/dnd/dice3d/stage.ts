import { Body, ConvexPolyhedron, Plane, Quaternion as CQuat, Vec3, World } from 'cannon-es';
import {
  DirectionalLight,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { numbering, percentile, solidFor, TENS, UNITS, upward, type Quat, type Solid } from '@/lib/dice3d';
import { keptFlags, sidesOf, type Roll } from '@/lib/dnd';
import type { DiceLook } from '@/lib/diceLooks';
import { lookFont } from './looks';
import { DIE_RADIUS, dieMesh, disposeMesh, fade } from './mesh';

/** Screen pixels per table unit: a d6 is about 50 px across. */
const PX = 44;
const STEP = 1 / 60;
const MAX_STEPS = 60 * 7;
export const MAX_DICE = 12;

type Thrown = { solid: Solid; sides: number; value: string; base?: string[]; dropped: boolean };

/** A roll's dice, as thrown: a d100 is two d10s (tens and units). At most a dozen. */
export function diceOf(roll: Roll): Thrown[] {
  const dice: Thrown[] = [];
  for (const group of roll.groups) {
    const sides = sidesOf(group.notation);
    const kept = keptFlags(group.rolls, group.kept);
    group.rolls.forEach((value, i) => {
      if (sides === 100) {
        const { tens, units } = percentile(value);
        dice.push({ solid: solidFor(10), sides: 10, value: tens, base: TENS, dropped: !kept[i] });
        dice.push({ solid: solidFor(10), sides: 10, value: units, base: UNITS, dropped: !kept[i] });
      } else {
        dice.push({ solid: solidFor(sides), sides, value: String(value), dropped: !kept[i] });
      }
    });
  }
  return dice.slice(0, MAX_DICE);
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * DiceStage — a see-through 3D table over the whole window. A throw is worked
 * out first, all at once: the dice (each its real shape, its weight) are
 * tossed in from the left, tumble, knock into each other and the window's
 * edges, and settle wherever physics leaves them, numbers upside down and all.
 * Then the faces are numbered so the one each die landed on shows what was
 * rolled, and the recorded throw plays back. Nothing turns a die to face you.
 */
export class DiceStage {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(28, 1, 1, 400);
  private light = new DirectionalLight(0xffffff, 2.4);
  private floor: Mesh;
  private meshes: Mesh[] = [];
  private token = 0;
  private frame = 0;

  /** Throws if WebGL isn't available: the caller falls back to a toast. */
  constructor(host: HTMLElement) {
    this.renderer = new WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.toneMapping = NeutralToneMapping;
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    host.appendChild(this.renderer.domElement);

    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    pmrem.dispose();
    this.scene.add(new HemisphereLight(0xffffff, 0x444444, 0.6));
    // From the top left of the screen (−x, −z), high up: shadows fall to the bottom right.
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.bias = -0.0004;
    this.light.shadow.radius = 6;
    this.scene.add(this.light, this.light.target);
    this.floor = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: 0.26 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
  }

  /** The table: the window, in units; the camera straight above it. */
  private fit() {
    const width = window.innerWidth / PX;
    const depth = window.innerHeight / PX;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.position.set(0, depth / 2 / Math.tan((this.camera.fov * Math.PI) / 360), 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.floor.scale.set(width * 1.2, depth * 1.2, 1);
    this.light.position.set(-width * 0.25, 40, -depth * 0.35);
    const shadow = this.light.shadow.camera;
    Object.assign(shadow, { left: -width * 0.7, right: width * 0.7, top: depth * 0.7, bottom: -depth * 0.7, near: 1, far: 120 });
    shadow.updateProjectionMatrix();
    return { width, depth };
  }

  /**
   * Throws a roll's dice in a look; resolves true once they've settled, false
   * if another throw came first. `still`: no tumble (reduced motion), the dice
   * just appear where they'd have landed.
   */
  async throw(roll: Roll, look: DiceLook, still: boolean): Promise<boolean> {
    const token = ++this.token;
    this.clear();
    await document.fonts.load(lookFont(look)).catch(() => undefined);
    if (token !== this.token) return false;

    const dice = diceOf(roll);
    const { width, depth } = this.fit();
    const { frames, rest } = simulate(dice, width, depth);

    this.meshes = dice.map((die, i) => {
      const top = upward(die.solid, rest[i]!);
      const mesh = dieMesh(die.solid, look, numbering(die.solid, die.sides, top, die.value, die.base));
      this.scene.add(mesh);
      return mesh;
    });
    this.place(frames[still ? frames.length - 1 : 0]!);
    this.renderer.render(this.scene, this.camera);

    return new Promise<boolean>((resolve) => {
      const start = performance.now();
      const tick = () => {
        if (token !== this.token) return resolve(false);
        const at = still ? frames.length - 1 : Math.min(frames.length - 1, Math.floor(((performance.now() - start) / 1000) * 60));
        this.place(frames[at]!);
        const done = at >= frames.length - 1;
        if (done) dice.forEach((die, i) => die.dropped && fade(this.meshes[i]!, 0.35));
        this.renderer.render(this.scene, this.camera);
        if (done) resolve(true);
        else this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    });
  }

  private place(frame: Float32Array) {
    this.meshes.forEach((mesh, i) => {
      const o = i * 7;
      mesh.position.set(frame[o]!, frame[o + 1]!, frame[o + 2]!);
      mesh.quaternion.set(frame[o + 3]!, frame[o + 4]!, frame[o + 5]!, frame[o + 6]!);
    });
  }

  /** Takes the dice off the table. */
  clear() {
    cancelAnimationFrame(this.frame);
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      disposeMesh(mesh);
    }
    this.meshes = [];
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.token++;
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/**
 * The throw, worked out ahead: each step's position and rotation of every die
 * (7 numbers each) until they've all come to rest, or seven seconds. A table
 * the size of the window, walls at its edges and a lid, so nothing leaves it.
 */
function simulate(dice: Thrown[], width: number, depth: number): { frames: Float32Array[]; rest: Quat[] } {
  const world = new World({ gravity: new Vec3(0, -42, 0), allowSleep: true });
  world.defaultContactMaterial.friction = 0.32;
  world.defaultContactMaterial.restitution = 0.34;
  const wall = (x: number, y: number, z: number, ax: number, ay: number) => {
    const body = new Body({ mass: 0, shape: new Plane(), position: new Vec3(x, y, z) });
    body.quaternion.setFromEuler(ax, ay, 0);
    world.addBody(body);
  };
  const margin = 1;
  wall(0, 0, 0, -Math.PI / 2, 0); // the table
  wall(0, 16, 0, Math.PI / 2, 0); // a lid
  wall(-width / 2 + margin, 0, 0, 0, Math.PI / 2); // left
  wall(width / 2 - margin, 0, 0, 0, -Math.PI / 2); // right
  wall(0, 0, -depth / 2 + margin, 0, 0); // top of the screen
  wall(0, 0, depth / 2 - margin, 0, Math.PI); // bottom

  // In from the left, a loose handful, each spinning its own way.
  const strength = Math.min(1.25, Math.max(0.7, width / 32));
  const bodies = dice.map((die, i) => {
    const r = DIE_RADIUS[die.solid.shape] ?? 1;
    const shape = new ConvexPolyhedron({
      vertices: die.solid.vertices.map(([x, y, z]) => new Vec3(x * r, y * r, z * r)),
      faces: die.solid.faces,
    });
    const row = Math.floor(i / 4);
    const col = i % 4;
    const body = new Body({
      mass: 1,
      shape,
      position: new Vec3(-width / 2 + 2.4 + row * 3, 2.4 + random(0, 1.6), (col - 1.5) * 3 + random(-0.25, 0.25)),
      linearDamping: 0.1,
      angularDamping: 0.16,
      allowSleep: true,
      sleepSpeedLimit: 0.18,
      sleepTimeLimit: 0.35,
    });
    body.quaternion = new CQuat(random(-1, 1), random(-1, 1), random(-1, 1), random(-1, 1)).normalize();
    body.velocity.set(random(17, 24) * strength, random(-1, 3), random(-5, 5));
    body.angularVelocity.set(random(-22, 22), random(-22, 22), random(-22, 22));
    world.addBody(body);
    return body;
  });

  const frames: Float32Array[] = [];
  const record = () => {
    const frame = new Float32Array(bodies.length * 7);
    bodies.forEach((b, i) => frame.set([b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w], i * 7));
    frames.push(frame);
  };
  record();
  for (let step = 0; step < MAX_STEPS; step++) {
    world.step(STEP);
    record();
    if (bodies.every((b) => b.sleepState === Body.SLEEPING)) break;
  }
  return { frames, rest: bodies.map((b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]) };
}
