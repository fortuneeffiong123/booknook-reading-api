const express = require('express');
const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');
const sql = require('mssql');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

let pool;

async function getPool() {
  if (pool) return pool;
  const cred = new DefaultAzureCredential();
  const kv = new SecretClient(process.env.KEY_VAULT_URL, cred);
  const secret = await kv.getSecret('SqlConnectionString');
  pool = await sql.connect(secret.value);
  return pool;
}

function blobClient() {
  const cred = new DefaultAzureCredential();
  return new BlobServiceClient(
    `https://${process.env.STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    cred
  );
}

// GET /api/health
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', ts: new Date() }));

// GET /api/books
app.get('/api/books', async (req, res) => {
  try {
    const db = await getPool();
    const r = await db.request().query('SELECT * FROM Books ORDER BY AddedAt DESC');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/books
app.post('/api/books', async (req, res) => {
  try {
    const { Title, Author, Genre, Status, Rating, Notes } = req.body;
    const db = await getPool();
    const r = await db.request()
      .input('Title', sql.NVarChar, Title)
      .input('Author', sql.NVarChar, Author)
      .input('Genre', sql.NVarChar, Genre || null)
      .input('Status', sql.NVarChar, Status || 'to-read')
      .input('Rating', sql.Int, Rating || null)
      .input('Notes', sql.NVarChar(sql.MAX), Notes || null)
      .query(`INSERT INTO Books (Title,Author,Genre,Status,Rating,Notes)
              OUTPUT INSERTED.*
              VALUES (@Title,@Author,@Genre,@Status,@Rating,@Notes)`);
    res.status(201).json(r.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/books/:id
app.get('/api/books/:id', async (req, res) => {
  try {
    const db = await getPool();
    const r = await db.request()
      .input('Id', sql.Int, req.params.id)
      .query('SELECT * FROM Books WHERE Id=@Id');
    if (!r.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/books/:id
app.put('/api/books/:id', async (req, res) => {
  try {
    const { Title, Author, Genre, Status, Rating, Notes } = req.body;
    const db = await getPool();
    const r = await db.request()
      .input('Id', sql.Int, req.params.id)
      .input('Title', sql.NVarChar, Title)
      .input('Author', sql.NVarChar, Author)
      .input('Genre', sql.NVarChar, Genre || null)
      .input('Status', sql.NVarChar, Status || 'to-read')
      .input('Rating', sql.Int, Rating || null)
      .input('Notes', sql.NVarChar(sql.MAX), Notes || null)
      .query(`UPDATE Books SET Title=@Title,Author=@Author,Genre=@Genre,
              Status=@Status,Rating=@Rating,Notes=@Notes
              OUTPUT INSERTED.* WHERE Id=@Id`);
    if (!r.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.recordset[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/books/:id
app.delete('/api/books/:id', async (req, res) => {
  try {
    const db = await getPool();
    await db.request()
      .input('Id', sql.Int, req.params.id)
      .query('DELETE FROM Books WHERE Id=@Id');
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/books/:id/cover
app.post('/api/books/:id/cover', upload.single('cover'), async (req, res) => {
  try {
    const ext = path.extname(req.file.originalname);
    const blobName = `cover-${req.params.id}-${Date.now()}${ext}`;
    const container = blobClient().getContainerClient('covers');
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });
    const url = blob.url;
    const db = await getPool();
    await db.request()
      .input('Id', sql.Int, req.params.id)
      .input('Url', sql.NVarChar, url)
      .query('UPDATE Books SET CoverUrl=@Url WHERE Id=@Id');
    res.json({ coverUrl: url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BookNook running on ${PORT}`));