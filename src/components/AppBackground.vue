<template>
  <div class="app-bg" aria-hidden="true">
    <div class="glow glow-amber" />
    <div class="glow glow-violet" />
    <svg class="wallpaper" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="shelf-wallpaper" width="300" height="300" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
          <!-- controller -->
          <g transform="translate(24,35) scale(1.35)" fill="currentColor">
            <path d="M8 10 h34 a10 10 0 0 1 10 11 l-2 14 a8 8 0 0 1-14 5 l-6-6 h-16 l-6 6 a8 8 0 0 1-14-5 l-2-14 a10 10 0 0 1 10-11 z" fill-opacity="0.9" />
          </g>
          <!-- cartridge -->
          <g transform="translate(177,163) rotate(14) scale(1.35)" fill="currentColor">
            <rect x="0" y="0" width="30" height="40" rx="4" />
          </g>
          <!-- d-pad / dice pip cluster -->
          <g transform="translate(204,27) scale(1.35)" fill="currentColor">
            <circle cx="0" cy="0" r="3.4" />
            <circle cx="16" cy="0" r="3.4" />
            <circle cx="0" cy="16" r="3.4" />
            <circle cx="16" cy="16" r="3.4" />
            <circle cx="8" cy="8" r="3.4" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#shelf-wallpaper)" />
    </svg>
  </div>
</template>

<style scoped>
.app-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.wallpaper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: var(--text-0);
  opacity: 0.26;
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
}
.glow-amber {
  width: 42vw;
  height: 42vw;
  top: -16vw;
  left: -8vw;
  background: var(--glow-amber);
}
.glow-violet {
  width: 30vw;
  height: 30vw;
  bottom: -12vw;
  right: -6vw;
  background: var(--glow-violet);
}
</style>
