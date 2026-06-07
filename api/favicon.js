export const config = { runtime: 'edge' };

export default async function () {
  // Simple SVG favicon as data URI - blue box icon
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#3b82f6"/><path d="M10 16h12M16 10v12" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>`;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
