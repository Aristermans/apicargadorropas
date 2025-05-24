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

// Registrar múltiples tallas con stock para una prenda
app.post('/api/tallas/registrar', async (req, res) => {
  try {
    const { ropa_id, tallas } = req.body;

    if (!ropa_id || !Array.isArray(tallas) || tallas.length === 0) {
      return res.status(400).json({ error: 'Faltan datos: ropa_id o tallas inválidas' });
    }

    for (const { talla_id, stock } of tallas) {
      await pool.query(
        'INSERT INTO ropa_talla (ropa_id, talla_id, stock) VALUES ($1, $2, $3) ON CONFLICT (ropa_id, talla_id) DO UPDATE SET stock = EXCLUDED.stock',
        [ropa_id, talla_id, stock]
      );
    }

    res.json({ mensaje: 'Tallas registradas correctamente con stock' });
  } catch (error) {
    console.error('Error al registrar tallas:', error);
    res.status(500).json({ error: error.message });
  }
});

//compara la cantidad de stock que hay si la prenda ya se registro previamente para evitar duplicados
app.get('/api/ropa/:id/stock-detalle', async (req, res) => {
  try {
    const ropa_id = req.params.id;

    // Verificar que la prenda existe
    const ropaRes = await pool.query(
      'SELECT stock FROM ropas WHERE id = $1',
      [ropa_id]
    );

    if (ropaRes.rowCount === 0) {
      return res.status(404).json({ error: 'Prenda no encontrada' });
    }

    const stockTotal = ropaRes.rows[0].stock;

    // Sumar stock ya registrado por tallas
    const asignadoRes = await pool.query(
      'SELECT COALESCE(SUM(stock), 0) AS stock_asignado FROM ropa_talla WHERE ropa_id = $1',
      [ropa_id]
    );
    const stockAsignado = parseInt(asignadoRes.rows[0].stock_asignado, 10);
    const stockDisponible = stockTotal - stockAsignado;

    // Obtener tallas ya registradas con su nombre y cantidad
    const tallasRegistradasRes = await pool.query(`
      SELECT rt.talla_id, t.nombre AS talla_nombre, t.descripcion, rt.stock
      FROM ropa_talla rt
      JOIN tallas t ON rt.talla_id = t.id
      WHERE rt.ropa_id = $1
    `, [ropa_id]);

    const tallasRegistradas = tallasRegistradasRes.rows;

    // Si ya no hay stock disponible
    if (stockDisponible <= 0) {
      return res.status(400).json({
        error: 'La prenda ya tiene todo su stock asignado por tallas.',
        ropa_id,
        stock_total: stockTotal,
        stock_asignado: stockAsignado,
        stock_disponible: 0,
        tallas_registradas: tallasRegistradas
      });
    }

    // Si aún hay stock para asignar tallas
    res.json({
      ropa_id,
      stock_total: stockTotal,
      stock_asignado: stockAsignado,
      stock_disponible: stockDisponible,
      mensaje: 'La prenda aún tiene stock disponible para asignar tallas.',
      tallas_registradas: tallasRegistradas
    });

  } catch (error) {
    console.error('Error al obtener el detalle de stock:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

//jala todos los colores
app.get('/api/colores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM colores');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener los colores:', error.message);
    res.status(500).json({ error: 'Error al obtener los colores' });
  }
});


// Subir varios colores con sus imágenes (usa color_id en lugar de color)
app.post('/api/ropa/colores', upload.array('imagenes'), async (req, res) => {
  try {
    const { ropa_id, colores } = req.body;

    if (!ropa_id || !colores || !req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const coloresArray = JSON.parse(colores);

    if (coloresArray.length !== req.files.length) {
      return res.status(400).json({ error: 'Cantidad de imágenes no coincide con los colores' });
    }

    const registros = [];

    for (let i = 0; i < coloresArray.length; i++) {
      const file = req.files[i];
      const color_id = coloresArray[i];  // Usamos el ID

      const filePath = `ropa_colores/${Date.now()}-${file.originalname}`;

      const { error: uploadError } = await supabase.storage
        .from('ropas')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
        });

      if (uploadError) {
        console.error('Error al subir imagen:', uploadError.message);
        continue;
      }

      const { data: publicData } = supabase.storage
        .from('ropas')
        .getPublicUrl(filePath);

      await pool.query(
        `INSERT INTO ropa_color (ropa_id, color_id, imagen_url)
         VALUES ($1, $2, $3)`,
        [ropa_id, color_id, publicData.publicUrl]
      );

      registros.push({ color_id, imagen_url: publicData.publicUrl });
    }

    res.json({ mensaje: 'Colores e imágenes registradas', registros });

  } catch (error) {
    console.error('Error:', error.message);
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ API corriendo en http://localhost:${PORT}`);

  

});
