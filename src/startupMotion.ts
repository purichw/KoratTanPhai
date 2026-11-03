// One document clock for the pre-JS screen, auth fallback and page loader.
// Align on mount only; CSS keeps animating without per-frame JavaScript work.
const starts = new Map<string, number>();

export function syncStartupMotion(root: Element | null) {
  if (!root?.getAnimations || typeof document.timeline?.currentTime !== 'number') return;
  for (const animation of root.getAnimations({ subtree: true })) {
    if (!('animationName' in animation) || typeof animation.animationName !== 'string'
      || animation.animationName !== 'app-startup-orbit') continue;
    const start = starts.get(animation.animationName);
    if (start !== undefined) animation.startTime = start;
    else starts.set(animation.animationName,
      typeof animation.startTime === 'number' ? animation.startTime : document.timeline.currentTime);
  }
}

let previousProgress = 0;
export function animateStartupProgress(bar: HTMLElement | null, progress: number) {
  let from = previousProgress <= progress ? previousProgress : progress;
  previousProgress = progress;
  if (!bar?.animate) return;
  const running = bar.getAnimations();
  if (running.length) {
    // A fast response can arrive before the previous interpolation ends.
    // Continue from the visible fill and discard that old animation so it
    // cannot reappear beneath the shorter completion transition.
    const scale = Number(getComputedStyle(bar).transform.match(/^matrix\(([^,]+)/)?.[1]);
    if (Number.isFinite(scale)) from = scale;
    running.forEach(animation => animation.cancel());
  }
  if (from === progress || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  bar.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${progress})` }],
    { duration: progress === 1 ? 80 : 220, easing: 'ease-out' });
}
