import { Color, MathUtils } from "three";

const MORNING = new Color(0xffffff);
const EVENING = new Color(0xff7a1a);
const MORNING_ELEVATION = MathUtils.degToRad(70);
const EVENING_ELEVATION = MathUtils.degToRad(12);
const SUN_DISTANCE = 20;

// t runs 0 (flat morning white, high sun) to 1 (hard orange, low sun).
// Returns the sun for that time: { color, intensity, position: {x,y,z} }. Safe to call with t alone.
// Optional `sun` (a DirectionalLight): when given, the values are also applied to it.
export function setTimeOfDay(t, sun) {
  const k = MathUtils.clamp(Number(t) || 0, 0, 1);
  const elevation = MathUtils.lerp(MORNING_ELEVATION, EVENING_ELEVATION, k);
  const azimuth = MathUtils.degToRad(MathUtils.lerp(-30, 60, k));
  const result = {
    color: MORNING.clone().lerp(EVENING, k),
    intensity: MathUtils.lerp(1.6, 2.6, k),
    position: {
      x: Math.cos(elevation) * Math.sin(azimuth) * SUN_DISTANCE,
      y: Math.sin(elevation) * SUN_DISTANCE,
      z: Math.cos(elevation) * Math.cos(azimuth) * SUN_DISTANCE,
    },
  };
  if (sun) {
    sun.color.copy(result.color);
    sun.intensity = result.intensity;
    sun.position.set(result.position.x, result.position.y, result.position.z);
  }
  return result;
}
