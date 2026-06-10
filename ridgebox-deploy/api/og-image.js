// OG Image endpoint - returns SVG for social media previews
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="30%" style="stop-color:#1e1b4b"/>
      <stop offset="60%" style="stop-color:#312e81"/>
      <stop offset="85%" style="stop-color:#1e1b4b"/>
      <stop offset="100%" style="stop-color:#0f172a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="50%" style="stop-color:#8b5cf6"/>
      <stop offset="100%" style="stop-color:#ec4899"/>
    </linearGradient>
    <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <!-- Decorative circles -->
  <circle cx="150" cy="500" r="200" fill="rgba(59,130,246,0.08)" />
  <circle cx="1050" cy="150" r="250" fill="rgba(139,92,246,0.08)" />
  <circle cx="600" cy="600" r="150" fill="rgba(236,72,153,0.05)" />
  
  <!-- Grid pattern -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="0.5" fill="rgba(255,255,255,0.06)"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)"/>
  
  <!-- Logo -->
  <rect x="80" y="160" width="80" height="80" rx="18" fill="url(#logoBg)"/>
  <path d="M120 185 L120 215 M110 200 L120 185 L130 200" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  
  <!-- Brand Name -->
  <text x="180" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="52" font-weight="800" fill="white" letter-spacing="-1">RidgeBox</text>
  <text x="180" y="230" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="400" fill="rgba(255,255,255,0.5)">Cloud Storage Gratis &amp; Terenkripsi</text>
  
  <!-- Main headline -->
  <text x="80" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="700" fill="white">
    <tspan>Simpan File </tspan>
    <tspan fill="url(#accent)">Unlimited</tspan>
    <tspan fill="white"> · Gratis</tspan>
  </text>
  <text x="80" y="370" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="700" fill="white">
    <tspan>Enkripsi </tspan>
    <tspan fill="url(#accent)">End-to-End</tspan>
  </text>
  
  <!-- Feature badges -->
  <rect x="80" y="420" width="140" height="36" rx="18" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
  <text x="150" y="443" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#60a5fa" text-anchor="middle">AES-256-GCM</text>
  
  <rect x="235" y="420" width="120" height="36" rx="18" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.3)" stroke-width="1"/>
  <text x="295" y="443" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#34d399" text-anchor="middle">105+ Fitur</text>
  
  <rect x="370" y="420" width="160" height="36" rx="18" fill="rgba(139,92,246,0.15)" stroke="rgba(139,92,246,0.3)" stroke-width="1"/>
  <text x="450" y="443" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#a78bfa" text-anchor="middle">Self-Destruct Link</text>
  
  <rect x="545" y="420" width="100" height="36" rx="18" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.3)" stroke-width="1"/>
  <text x="595" y="443" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#fbbf24" text-anchor="middle">PWA Ready</text>
  
  <!-- URL -->
  <text x="80" y="530" font-family="monospace" font-size="16" font-weight="500" fill="rgba(255,255,255,0.3)">ridgebox.vercel.app</text>
  
  <!-- Decorative bottom line -->
  <rect x="0" y="620" width="1200" height="10" fill="url(#accent)"/>
</svg>`;

  res.status(200).send(svg);
};
