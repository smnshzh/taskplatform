import { writeFileSync, mkdirSync } from "fs";

function generateIcon(size: number) {
  const padding = Math.round(size * 0.12);
  const innerSize = size - padding * 2;
  const radius = Math.round(innerSize * 0.18);
  const fontSize = Math.round(innerSize * 0.5);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e40af"/>
      <stop offset="100%" style="stop-color:#7c3aed"/>
    </linearGradient>
  </defs>
  <rect x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" rx="${radius}" fill="url(#bg)"/>
  <text x="50%" y="52%" dominant-baseline="central" text-anchor="middle"
        font-family="Vazirmatn, Tahoma, Arial, sans-serif"
        font-size="${fontSize}" font-weight="bold" fill="white">پ</text>
</svg>`;

  return svg;
}

// Generate SVG icons
mkdirSync("/home/z/my-project/taskmanager/public/icons", { recursive: true });

for (const size of [192, 512]) {
  writeFileSync(
    `/home/z/my-project/taskmanager/public/icons/icon-${size}.svg`,
    generateIcon(size)
  );
}

console.log("SVG icons generated.");