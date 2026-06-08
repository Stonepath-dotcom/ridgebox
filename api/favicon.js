export const config = { runtime: 'edge' };

export default async function () {
  // RidgeBox Logo — Bold "R" with mountain ridge at base
  // Corporate SaaS quality — confident, clean, recognizable
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#g)"/>
  <path d="M9 24V6h5.5c3.2 0 5 1.7 5 4.2 0 2.2-1.3 3.5-3.3 4l4 9.8h-3.2l-3.7-8H12v8H9z" fill="white"/>
  <path d="M12 13.5h2.5c1.8 0 2.8-.8 2.8-2.2 0-1.3-.8-2-2.5-2H12v4.2z" fill="rgba(255,255,255,.4)"/>
  <path d="M5 28l5-7.5 3 4.5 3-5 5 8H5z" fill="white" fill-opacity=".55"/>
</svg>`;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
