<template>
  <div class="app-bg" aria-hidden="true">
    <div class="dots" />
    <div class="slab" />
    <div class="grain" />
  </div>
</template>

<style scoped>
.app-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  background: var(--bg-0);
}

/* graph-paper dot grid, fading out toward the bottom of the viewport */
.dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle at 1px 1px, rgba(243, 239, 228, 0.11) 1px, transparent 0);
  background-size: 24px 24px;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.55) 55%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.55) 55%, transparent 100%);
}

/* one oversized tilted slab of acid in the corner, mostly off-screen */
.slab {
  position: absolute;
  top: -260px;
  right: -180px;
  width: 520px;
  height: 520px;
  background: repeating-linear-gradient(-45deg, rgba(212, 255, 58, 0.07) 0 2px, transparent 2px 14px);
  border: 2px solid rgba(212, 255, 58, 0.12);
  transform: rotate(18deg);
}

/* print grain, so flat fills don't look like plastic */
.grain {
  position: absolute;
  inset: -50%;
  opacity: 0.07;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

@media (max-width: 700px) {
  .slab { width: 320px; height: 320px; top: -180px; right: -160px; }
}
</style>
