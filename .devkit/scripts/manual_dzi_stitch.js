#!/usr/bin/env node
const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const Jimp = (function(){ try { const m = require('jimp'); return m.Jimp || m.default || m; } catch(e){ console.error('Missing jimp dependency'); process.exit(1);} })();

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('timeout')); });
  });
}

async function parseDzi(dziUrl) {
  const xml = await fetchBuffer(dziUrl);
  const parsed = await new xml2js.Parser().parseStringPromise(xml.toString('utf8'));
  const img = parsed.Image || parsed.image;
  if (!img || !img.$) throw new Error('Invalid DZI XML');
  const size = img.Size?.[0] || img.size?.[0];
  const width = parseInt(size.$.Width || size.$.width, 10);
  const height = parseInt(size.$.Height || size.$.height, 10);
  const tileSize = parseInt(img.$.TileSize || img.$.tilesize || '256', 10);
  const overlap = parseInt(img.$.Overlap || img.$.overlap || '1', 10);
  const format = String(img.$.Format || img.$.format || 'jpg');
  const base = dziUrl.replace(/\.(dzi|xml)$/i, '');
  const maxDim = Math.max(width, height);
  const maxLevel = Math.ceil(Math.log2(maxDim));
  return { base, width, height, tileSize, overlap, format, maxLevel };
}

async function downloadTile(url) {
  try { return await fetchBuffer(url); } catch { return null; }
}

async function stitch(dzi, outPath, opts = {}) {
  let { base, width, height, tileSize, overlap, format, maxLevel } = dzi;
  if (typeof opts.level === 'number' && opts.level >= 0 && opts.level <= maxLevel) {
    maxLevel = opts.level;
  } else if (typeof opts.levelOffset === 'number' && opts.levelOffset > 0) {
    maxLevel = Math.max(0, maxLevel - opts.levelOffset);
  }
  // Compute image size at this level
  const levelWidth = Math.ceil(width / Math.pow(2, (dzi.maxLevel - maxLevel)));
  const levelHeight = Math.ceil(height / Math.pow(2, (dzi.maxLevel - maxLevel)));
  const numCols = Math.ceil(levelWidth / tileSize);
  const numRows = Math.ceil(levelHeight / tileSize);
  console.log(`DZI: full=${width}x${height}, level=${maxLevel} -> ${levelWidth}x${levelHeight}, tileSize=${tileSize}, overlap=${overlap}, format=${format}, grid=${numCols}x${numRows}`);

  const MAX_DIM = 16384;
  const safeW = Math.min(levelWidth, MAX_DIM);
  const safeH = Math.min(levelHeight, MAX_DIM);
  const white = Buffer.alloc(safeW * safeH * 4, 255);
  const baseImage = new Jimp({ width: safeW, height: safeH, data: white });

  let downloaded = 0, attempted = 0;
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const tileUrl = `${base}_files/${maxLevel}/${col}_${row}.${format}`;
      attempted++;
      const data = await downloadTile(tileUrl);
      if (!data) continue;
      try {
        const img = await Jimp.read(data);
        const destX = col * tileSize - (col > 0 ? overlap : 0);
        const destY = row * tileSize - (row > 0 ? overlap : 0);
        const srcX = col > 0 ? overlap : 0;
        const srcY = row > 0 ? overlap : 0;
        const cropW = Math.min(img.bitmap.width - srcX, safeW - destX);
        const cropH = Math.min(img.bitmap.height - srcY, safeH - destY);
        const w = Math.max(1, cropW), h = Math.max(1, cropH);
        if (srcX || srcY || w !== img.bitmap.width || h !== img.bitmap.height) {
          img.crop({ x: srcX, y: srcY, w, h });
        }
        if (destX < safeW && destY < safeH && destX + w > 0 && destY + h > 0) {
          baseImage.composite(img, destX, destY);
          downloaded++;
        }
      } catch (e) {
        // ignore broken tiles
      }
    }
  }
  console.log(`Tiles: downloaded ${downloaded}/${attempted}`);
  const outBuf = await new Promise((resolve, reject) => {
    baseImage.getBuffer(Jimp.MIME_JPEG, (err, buf) => {
      if (err) reject(err); else resolve(buf);
    });
  });
  fs.writeFileSync(outPath, outBuf);
}

async function main() {
  const args = process.argv.slice(2);
  const dziUrl = args[0];
  const outPath = args[1] || path.join('.devkit', 'tmp', 'dzi_output.jpg');
  let level = null;
  let levelOffset = null;
  for (const a of args.slice(2)) {
    if (a && a.startsWith('--level=')) {
      const v = parseInt(a.split('=')[1], 10);
      if (!isNaN(v)) level = v;
    }
    if (a && a.startsWith('--down=')) {
      const v = parseInt(a.split('=')[1], 10);
      if (!isNaN(v)) levelOffset = v;
    }
  }
  if (!dziUrl) {
    console.error('Usage: manual_dzi_stitch.js <dzi-xml-or-dzi-url> [out.jpg]');
    process.exit(1);
  }
  try {
    const dzi = await parseDzi(dziUrl);
    const opts = {};
    if (level !== null) opts.level = level;
    if (levelOffset !== null) opts.levelOffset = levelOffset;
    await stitch(dzi, outPath, opts);
    const st = fs.statSync(outPath);
    console.log(`Saved: ${outPath} (${(st.size/1024/1024).toFixed(2)} MB)`);
  } catch (e) {
    console.error('Failed:', e && e.message ? e.message : e);
    process.exit(2);
  }
}

main();

