const sharp = require("sharp");
const { readFileSync, writeFileSync } = require("fs");

async function convert(size) {
  const svgPath = `/home/z/my-project/taskmanager/public/icons/icon-${size}.svg`;
  const pngPath = `/home/z/my-project/taskmanager/public/icons/icon-${size}.png`;

  const svg = readFileSync(svgPath);
  await sharp(svg).resize(size, size).png().toFile(pngPath);
  console.log(`Generated ${pngPath}`);
}

Promise.all([convert(192), convert(512)])
  .then(() => console.log("Done."))
  .catch(console.error);