import { Color, DirectionalLight, MathUtils } from "three";

const MORNING = new Color(0xffffff);
const EVENING = new Color(0xff7a1a);
const MORNING_ELEVATION = MathUtils.degToRad(70);
const EVENING_ELEVATION = MathUtils.degToRad(12);
const SUN_DISTANCE = 20;
const sun = new DirectionalLight(0xffffff, 1.6);

// t runs 0 (flat morning white, high sun) to 1 (hard orange, low sun) and is applied to the one sun.
// The scene adds that sun once with scene.add(setTimeOfDay.sun).
export function setTimeOfDay(t) {
  const k = MathUtils.clamp(Number(t) || 0, 0, 1);
  const elevation = MathUtils.lerp(MORNING_ELEVATION, EVENING_ELEVATION, k);
  const azimuth = MathUtils.degToRad(MathUtils.lerp(-30, 60, k));
  sun.color.copy(MORNING).lerp(EVENING, k);
  sun.intensity = MathUtils.lerp(1.6, 2.6, k);
  sun.position.set(
    Math.cos(elevation) * Math.sin(azimuth) * SUN_DISTANCE,
    Math.sin(elevation) * SUN_DISTANCE,
    Math.cos(elevation) * Math.cos(azimuth) * SUN_DISTANCE,
  );
  return sun;
}
setTimeOfDay.sun = sun;
