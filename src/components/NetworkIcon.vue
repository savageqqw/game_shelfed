<script setup>
// Round network badges for the donate page. ETH, BNB and TRX follow the
// CC0 cryptocurrency-icons set; Solana, Base and Robinhood are simplified.
defineProps({
  id: { type: String, required: true },
  size: { type: [Number, String], default: 40 }
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true" focusable="false" class="net-icon">
    <template v-if="id === 'eth'">
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <g fill="#fff">
        <path fill-opacity=".6" d="M16.5 4v8.87l7.5 3.35z" />
        <path d="M16.5 4 9 16.22l7.5-3.35z" />
        <path fill-opacity=".6" d="M16.5 21.97V28L24 17.62z" />
        <path d="M16.5 28v-6.03L9 17.62z" />
        <path fill-opacity=".2" d="m16.5 20.57 7.5-4.35-7.5-3.35z" />
        <path fill-opacity=".6" d="m9 16.22 7.5 4.35v-7.7z" />
      </g>
    </template>

    <template v-else-if="id === 'bsc'">
      <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
      <path fill="#fff" d="M12.12 14.4 16 10.52l3.89 3.89 2.26-2.26L16 6l-6.14 6.14 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.12 1.6L16 21.48l3.89-3.89 2.26 2.26L16 26l-6.14-6.14 2.26-2.26zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.19 0L16 18.29 13.71 16l.4-.4.2-.2L16 13.71 18.29 16z" />
    </template>

    <template v-else-if="id === 'tron'">
      <circle cx="16" cy="16" r="16" fill="#EF0027" />
      <path fill="#fff" d="M21.93 9.91 7.5 7.26l7.6 19.11 10.58-12.9-3.75-3.56zm-.23 1.17 2.21 2.1-6.04 1.1 3.83-3.2zm-5.14 2.98-6.37-5.28 10.4 1.91-4.03 3.37zm-.45.93-1.04 8.58-5.6-14.02 6.64 5.44zm.96.46 6.69-1.21-7.67 9.34.98-8.13z" />
    </template>

    <template v-else-if="id === 'sol'">
      <defs>
        <linearGradient :id="`sol-g-${size}`" x1="8" y1="24" x2="24" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#9945FF" />
          <stop offset="1" stop-color="#14F195" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="#0c0c0e" />
      <g :fill="`url(#sol-g-${size})`">
        <path d="M10.6 19.7h13.2l-2.4 2.6H8.2z" />
        <path d="M8.2 14.7h13.2l2.4 2.6H10.6z" />
        <path d="M10.6 9.7h13.2l-2.4 2.6H8.2z" />
      </g>
    </template>

    <template v-else-if="id === 'base'">
      <circle cx="16" cy="16" r="16" fill="#0052FF" />
      <path fill="#fff" d="M15.98 25.5a9.5 9.5 0 1 0-9.47-10.28h12.56v1.56H6.51a9.5 9.5 0 0 0 9.47 8.72z" />
    </template>

    <template v-else-if="id === 'robinhood'">
      <circle cx="16" cy="16" r="16" fill="#0c0c0e" />
      <path fill="#CCFF00" d="M23.6 6.6c-5.9.3-10.4 4.2-12.2 10.1l-2.9 7.5c-.2.5.5.9.8.4l3-5.4c5.6.5 10-3.9 11.3-12.6z" />
    </template>

    <template v-else>
      <circle cx="16" cy="16" r="16" fill="#29292f" />
    </template>
  </svg>
</template>

<style scoped>
.net-icon { display: block; flex-shrink: 0; }
</style>
