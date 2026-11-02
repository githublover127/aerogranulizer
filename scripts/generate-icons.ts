import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();
function crc32(buf: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePng(width: number, height: number): Buffer {
  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel + 1; // +1 for filter byte 0
  const rawData = Buffer.alloc(scanlineLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.42;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background deep sky blue
      let r = 2;
      let g = 132;
      let b = 199;
      let a = 255;

      if (dist < radius) {
        // Frutiger Aero Aqua Orb
        const normDist = dist / radius;
        // Specular highlight at top-left
        const sDist = Math.sqrt((x - (cx - radius * 0.35)) ** 2 + (y - (cy - radius * 0.35)) ** 2) / (radius * 0.6);
        const spec = Math.max(0, 1 - sDist);

        // Aqua bubble gradient
        r = Math.min(255, Math.floor(56 + spec * 180 + (1 - normDist) * 80));
        g = Math.min(255, Math.floor(189 + spec * 60 + (1 - normDist) * 50));
        b = Math.min(255, Math.floor(248 + spec * 7));

        // Sine waveform accent in center
        const waveY = cy + Math.sin((x / width) * Math.PI * 4) * (radius * 0.25);
        if (Math.abs(y - waveY) < width * 0.035) {
          r = 255;
          g = 255;
          b = 255;
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = Buffer.concat([
    Buffer.from('IHDR'),
    ihdrData,
  ]);
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(crc32(ihdrChunk), 0);
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);

  // IDAT
  const idatChunk = Buffer.concat([Buffer.from('IDAT'), deflated]);
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(idatChunk), 0);
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(deflated.length, 0);

  // IEND
  const iendChunk = Buffer.from('IEND');
  const iendCrc = Buffer.alloc(4);
  iendCrc.writeUInt32BE(crc32(iendChunk), 0);
  const iendLen = Buffer.alloc(4);
  iendLen.writeUInt32BE(0, 0);

  return Buffer.concat([
    signature,
    ihdrLen,
    ihdrChunk,
    ihdrCrc,
    idatLen,
    idatChunk,
    idatCrc,
    iendLen,
    iendChunk,
    iendCrc,
  ]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), makePng(192, 192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), makePng(512, 512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), makePng(180, 180));
console.log('Successfully generated PWA and iOS touch icons!');
