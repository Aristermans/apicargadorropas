const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const pool = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Configurar multer para leer archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Obtener categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categorias');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subir imagen al storage
app.post('/api/upload-image', upload.single('imagen'), async (req, res) => {
  try {
    const { originalname, buffer, mimetype } = req.file;
    const filePath = `ropas/${Date.now()}-${originalname}`;

    const { error: uploadError } = await supabase
      .storage
      .from('ropas')
      .upload(filePath, buffer, { contentType: mimetype });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: publicData } = supabase
      .storage
      .from('ropas')
      .getPublicUrl(filePath);

    res.json({ url: publicData.publicUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Insertar ropa con URL ya subida
app.post('/api/ropa', async (req, res) => {
  const { nombre, descripcion, precio, stock, imagen_url, categoria_id } = req.body;

  try {
    await pool.query(
      `INSERT INTO ropas (nombre, descripcion, precio, stock, imagen_url, categoria_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nombre, descripcion, precio, stock, imagen_url, categoria_id]
    );

    res.json({ mensaje: 'Ropa registrada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Prueba de conexión
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, server_time: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`✅ API corriendo en http://localhost:${port}`);
});
