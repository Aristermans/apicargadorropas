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

// Obtener todas las ropas
app.get('/api/ropas/todas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ropas');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar ropa
app.delete('/api/ropas/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM ropas WHERE id = $1', [id]);
    res.json({ mensaje: 'Ropa eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Editar ropa
app.put('/api/ropas/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio, stock, categoria_id, imagen_url } = req.body;
    await pool.query(
      'UPDATE ropas SET nombre = $1, descripcion = $2, precio = $3, stock = $4, categoria_id = $5, imagen_url = $6 WHERE id = $7',
      [nombre, descripcion, precio, stock, categoria_id, imagen_url, id]
    );
    res.json({ mensaje: 'Ropa actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Filtrar ropa por talla
app.get('/api/ropas/por-talla/:talla', async (req, res) => {
  try {
    const { talla } = req.params;
    const result = await pool.query(
      'SELECT r.* FROM ropas r JOIN tallas_ropa tr ON r.id = tr.ropa_id WHERE tr.talla = $1',
      [talla]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Filtrar ropa por precio
app.get('/api/ropas/por-precio/:monto', async (req, res) => {
  try {
    const { monto } = req.params;
    const result = await pool.query('SELECT * FROM ropas WHERE precio <= $1', [monto]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Filtrar ropa por categoría
app.get('/api/ropas/por-categoria/:categoria_id', async (req, res) => {
  try {
    const { categoria_id } = req.params;
    const result = await pool.query('SELECT * FROM ropas WHERE categoria_id = $1', [categoria_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener tallas disponibles
app.get('/api/tallas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tallas');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar tallas por ropa
app.post('/api/tallas/registrar', async (req, res) => {
  try {
    const { ropa_id, talla_id } = req.body; // tallas = [{ talla: 'S', cantidad: 5 }, ...]
    for (const { talla_id, stock } of tallas) {
      await pool.query(
        'INSERT INTO ropa_talla (ropa_id, talla_id, stock) VALUES ($1, $2, $3)',
        [ropa_id, talla_id, stock]
      );
    }
    res.json({ mensaje: 'ya sirves para algo gil registraste correctamente' });
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
