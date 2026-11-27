import fs from 'fs';
import path from 'path';
import os from 'os';
import { promises as fsp } from 'fs';
import { tableFromIPC } from 'apache-arrow';
import { initSync, readParquet } from 'parquet-wasm/esm';
import { Storage } from '@google-cloud/storage';
import { createEndpoint, ValidationError, NotFoundError } from '../_utils/endpoint.js';

const FALLBACK_DIR = path.join(os.tmpdir(), 'fallback_tracks');
const FALLBACK_CACHE_NAME = 'latest.parquet';
const FALLBACK_BUCKET = process.env.FALLBACK_PARQUET_BUCKET;
const FALLBACK_OBJECT = process.env.FALLBACK_PARQUET_OBJECT;

// Initialize parquet-wasm once
let parquetInitialized = false;
const initParquet = () => {
  if (parquetInitialized) return;
  const wasmPath = path.join(process.cwd(), 'node_modules', 'parquet-wasm', 'esm', 'parquet_wasm_bg.wasm');
  const wasmBytes = fs.readFileSync(wasmPath);
  initSync({ module: wasmBytes });
  parquetInitialized = true;
};

let storageClient = null;
const getStorageClient = () => {
  if (storageClient) return storageClient;
  const saKey = process.env.GCP_SA_KEY;
  if (!saKey) return null;
  try {
    const credentials = JSON.parse(saKey);
    storageClient = new Storage({ credentials });
    return storageClient;
  } catch (err) {
    console.error('Failed to parse GCP_SA_KEY:', err);
    return null;
  }
};

const ensureFallbackDir = async () => {
  try {
    await fsp.mkdir(FALLBACK_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create fallback directory:', err);
  }
};

const getParquetPath = async () => {
  await ensureFallbackDir();

  const existingFiles = fs.readdirSync(FALLBACK_DIR)
    .filter((name) => name.endsWith('.parquet'))
    .map((name) => path.join(FALLBACK_DIR, name));

  if (existingFiles.length) {
    return existingFiles
      .map((file) => ({ file, mtime: fs.statSync(file).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0].file;
  }

  const fallbackUrl = process.env.FALLBACK_PARQUET_URL;
  if (fallbackUrl) {
    try {
      const resp = await fetch(fallbackUrl);
      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer());
        const cachedPath = path.join(FALLBACK_DIR, FALLBACK_CACHE_NAME);
        await fsp.writeFile(cachedPath, buffer);
        return cachedPath;
      }
    } catch (err) {
      console.error('Error downloading from URL:', err);
    }
  }

  const storage = getStorageClient();
  if (storage && FALLBACK_BUCKET && FALLBACK_OBJECT) {
    try {
      const cachedPath = path.join(FALLBACK_DIR, FALLBACK_CACHE_NAME);
      await storage.bucket(FALLBACK_BUCKET).file(FALLBACK_OBJECT).download({ destination: cachedPath });
      return cachedPath;
    } catch (err) {
      console.error('Error downloading from GCS:', err);
    }
  }

  return null;
};

export default createEndpoint({ methods: ['GET'], db: false }, async (req, res) => {
  const { dateFrom, dateTo, imeis } = req.query;

  if (!dateFrom || !dateTo) {
    throw new ValidationError('dateFrom and dateTo are required (YYYY-MM-DD)');
  }

  const parquetPath = await getParquetPath();
  if (!parquetPath) {
    throw new NotFoundError('No fallback parquet file available');
  }

  initParquet();
  const fileBuffer = fs.readFileSync(parquetPath);
  const parquetTable = await readParquet(fileBuffer);
  const ipcStream = parquetTable.intoIPCStream();
  const arrowTable = tableFromIPC(ipcStream);

  const fromTs = new Date(dateFrom).getTime();
  const toTs = new Date(dateTo).getTime();
  const imeiSet = imeis
    ? new Set(String(imeis).split(',').map((s) => s.trim()).filter(Boolean))
    : null;

  const tripCol = arrowTable.getChild('Trip');
  const timeCol = arrowTable.getChild('Time');
  const latCol = arrowTable.getChild('Lat');
  const lngCol = arrowTable.getChild('Lng');
  const imeiCol = arrowTable.getChild('IMEI') || arrowTable.getChild('imei');

  if (!tripCol || !timeCol || !latCol || !lngCol) {
    throw new Error('Fallback parquet missing required columns (Trip, Time, Lat, Lng)');
  }

  const points = [];
  const rowCount = arrowTable.numRows ?? 0;

  for (let i = 0; i < rowCount; i++) {
    const rawTime = timeCol.get(i);
    const ts = rawTime !== null && rawTime !== undefined ? new Date(rawTime).getTime() : NaN;
    if (Number.isNaN(ts) || ts < fromTs || ts > toTs) continue;

    const timeStr = new Date(ts).toISOString();
    const recordImei = imeiCol ? imeiCol.get(i) : undefined;
    const recordImeiStr =
      recordImei !== undefined && recordImei !== null ? String(recordImei) : undefined;
    if (imeiSet && (!recordImeiStr || !imeiSet.has(recordImeiStr))) {
      continue;
    }

    points.push({
      time: timeStr,
      timestamp: timeStr,
      boat: '',
      tripId: String(tripCol.get(i) ?? ''),
      latitude: Number(latCol.get(i) ?? 0),
      longitude: Number(lngCol.get(i) ?? 0),
      speed: 0,
      range: 0,
      heading: 0,
      boatName: '',
      community: '',
      tripCreated: '',
      tripUpdated: '',
      imei: recordImeiStr,
      deviceId: recordImeiStr,
      lastSeen: timeStr
    });
  }

  return res.json(points);
});
