import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse-fixed';
import mammoth from 'mammoth';
import db from '../config/db.js';
import OpenAI from 'openai';

const openaiKey = process.env.OPENAI_API_KEY || '';
let openai = null;
if (openaiKey) {
  openai = new OpenAI({ apiKey: openaiKey });
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
  } else if (ext === '.docx') {
    const res = await mammoth.extractRawText({ path: filePath });
    return res.value || '';
  } else {
    return fs.readFileSync(filePath, 'utf-8');
  }
}

function chunkText(text, chunkSize = 800, overlap = 100) {
  const clean = text.replace(/\n{2,}/g, '\n').trim();
  const chunks = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + chunkSize, clean.length);
    let segment = clean.slice(i, end);
    const lastDot = segment.lastIndexOf('. ');
    if (lastDot > chunkSize * 0.6) {
      segment = segment.slice(0, lastDot + 1);
      end = i + lastDot + 1;
    }
    chunks.push(segment.trim());
    i = Math.max(end - overlap, i + chunkSize);
  }
  return chunks.filter(s => s.length > 0);
}

export async function processDocument(filePath, originalName = '') {
  const text = await extractText(filePath);
  if (!text || text.trim().length === 0) {
    throw new Error('No text found in document (maybe scanned image).');
  }

  const chunks = chunkText(text, 800, 100);

  const [docRes] = await db.query('INSERT INTO documents (title, filename) VALUES (?, ?)', [originalName || path.basename(filePath), path.basename(filePath)]);
  const docId = docRes.insertId;

  for (const chunk of chunks) {
    let embedding = null;
    if (openai) {
      try {
        const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: chunk });
        embedding = emb.data[0].embedding;
      } catch (e) {
        console.error('Embedding failed, continuing without embedding:', e.message || e);
      }
    }
    await db.query('INSERT INTO chunks (document_id, chunk_text, embedding) VALUES (?, ?, ?)', [docId, chunk, embedding ? JSON.stringify(embedding) : null]);
  }
}
