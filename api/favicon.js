export const config = { runtime: 'edge' };

export default async function () {
  // RidgeBox Logo — Mountain ridge inside a box (Ridge + Box)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="url(#g)"/>
  <path d="M5 12L9 6h14l4 6v14l-4 6H9L5 26V12z" stroke="rgba(255,255,255,.3)" stroke-width=".5" fill="none"/>
  <path d="M7 24L12 14l3 5 2.5-4.5L25 24H7z" fill="white" fill-opacity=".95"/>
  <circle cx="24" cy="9" r="2" fill="white" fill-opacity=".85"/>
</svg>`;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
