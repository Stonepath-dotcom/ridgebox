export const config = { runtime: 'edge' };

export default async function () {
  // RidgeBox favicon — Bold R with mountain ridge accent
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient></defs>
    <rect width="32" height="32" rx="7" fill="url(#bg)"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M7 25V7h7c4.2 0 6.5 1.8 6.5 5.2 0 2.5-1.4 4.2-3.8 5L23 25h-4.5l-5.2-9H11v9H7zm4-14.5v5h3.3c2.3 0 3.7-1.2 3.7-2.8s-1.3-2.2-3.5-2.2H11z" fill="white"/>
    <path d="M3 29l7-8.5 3.5 5L17 19l7 10H3z" fill="white" fill-opacity=".35"/>
  </svg>`;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
