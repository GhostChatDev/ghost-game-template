import * as THREE from "three";
import { setTimeOfDay } from "./daylight.js";

// Fixed camera: set once here, never changed after.
const CAMERA_POSITION = Object.freeze({ x: 12, y: 12, z: 12 });
const CAMERA_LOOK_AT = Object.freeze({ x: 0, y: 0, z: 0 });
const STEP = 1 / 60;          // fixed timestep (s)
const MAX_FRAME = 0.25;       // a slow frame never runs more than this much simulation
const SPEED = 4;              // player speed (units/s)
const DEADZONE = 0.05;        // stop this close to the target
const PLAYER_SIZE = 1;
const DAY_LENGTH = 40;        // seconds for morning -> evening -> morning
const SAVE_KEY = "ghost-game-save-v1";

// ---- save / load (wired, storing nothing yet) ----
let state = {};
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    state = parsed && typeof parsed === "object" ? parsed : {};
  } catch { state = {}; }
  return state;
}
load();

// ---- HUD ----
const hud = document.getElementById("hud");
let score = 0;
function setScore(value) { score = value; hud.textContent = `Score: ${score}`; }
setScore(0);

// ---- renderer (WebGL2 only) ----
const canvas = document.createElement("canvas");
const gl = canvas.getContext("webgl2", { antialias: true });
if (!gl) {
  document.getElementById("nogl").hidden = false;
  throw new Error("WebGL2 is not available");
}
const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(canvas);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd8dc);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);

// ---- lights ----
const hemi = new THREE.HemisphereLight(0xeef4ff, 0x6b7a5a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
scene.add(sun);
setTimeOfDay(0, sun);

// ---- ground + grid ----
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshLambertMaterial({ color: 0x8fa876 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const grid = new THREE.GridHelper(200, 200, 0x5f7350, 0x5f7350);
grid.material.transparent = true;
grid.material.opacity = 0.25;
grid.position.y = 0.002;
scene.add(grid);

// ---- player ----
const player = new THREE.Mesh(
  new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE),
  new THREE.MeshLambertMaterial({ color: 0x2f6fde }),
);
player.position.set(0, PLAYER_SIZE / 2, 0); // bottom of the box sits on the ground
scene.add(player);
let target = null;

// ---- tap / click -> ground target ----
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(ground, false)[0];
  if (hit) target = new THREE.Vector2(hit.point.x, hit.point.z);
});

function stepPlayer(dt) {
  if (!target) return;
  const dx = target.x - player.position.x;
  const dz = target.y - player.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= DEADZONE) return;
  const move = Math.min(SPEED * dt, dist);
  player.position.x += (dx / dist) * move;
  player.position.z += (dz / dist) * move;
}

// ---- resize ----
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---- read-only debug object for the checks ----
let frames = 0;
let ready = false;
const xyz = (v) => Object.freeze({ x: v.x, y: v.y, z: v.z });
Object.defineProperty(window, "__game", {
  configurable: false,
  enumerable: true,
  value: Object.freeze({
    get player() { return Object.freeze({ ...xyz(player.position), y: player.position.y - PLAYER_SIZE / 2 }); },
    get camera() { return Object.freeze({ ...xyz(camera.position), aspect: camera.aspect }); },
    get target() { return target ? Object.freeze({ x: target.x, z: target.y }) : null; },
    get frames() { return frames; },
    get ready() { return ready; },
    get score() { return score; },
    get state() { return JSON.parse(JSON.stringify(state)); },
    save,
  }),
});

// ---- loop: fixed timestep simulation, render every frame ----
const clock = new THREE.Clock();
let acc = 0;
let elapsed = 0;
renderer.setAnimationLoop(() => {
  acc += Math.min(clock.getDelta(), MAX_FRAME);
  while (acc >= STEP) {
    stepPlayer(STEP);
    elapsed += STEP;
    acc -= STEP;
  }
  const phase = (elapsed % DAY_LENGTH) / DAY_LENGTH;
  setTimeOfDay(phase < 0.5 ? phase * 2 : 2 - phase * 2, sun);
  renderer.render(scene, camera);
  frames++;
  ready = true;
});
