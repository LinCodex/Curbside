export const INSTALL_HINT_KEY = "curbside.install-guide.v1";
export function isIOSDevice(
  agent: string,
  platform: string,
  touchPoints: number,
) {
  return (
    /iPad|iPhone|iPod/.test(agent) ||
    (platform === "MacIntel" && touchPoints > 1)
  );
}
export function shouldShowInstallGuide(
  ios: boolean,
  standalone: boolean,
  seen: boolean,
) {
  return ios && !standalone && !seen;
}
export function pullDistance(deltaX: number, deltaY: number) {
  return deltaY > 0 && Math.abs(deltaX) < deltaY * 0.7
    ? Math.min(deltaY * 0.5, 108)
    : 0;
}
export const PULL_THRESHOLD = 76;
