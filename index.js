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

// Filtro combinado (categoría + precio + talla)
app.get('/api/ropas/filtros', async (req, res) => {
  const { categoria_id, precio_max, talla_id } = req.query;
  // Lógica de filtrado combinado
});

// Obtener colores disponibles para una prenda específica
app.get('/api/ropas/:id/colores', async (req, res) => {
  // Retornar colores disponibles para esa prenda
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

// ... (tus imports y middleware existentes)

// Crear un nuevo pedido
app.post('/api/pedidos', async (req, res) => {
  const { usuario_id, metodo_pago_id, direccion, coordenadas, numero_contacto, total, cartItems } = req.body;

  try {
    // Iniciar una transacción
    await pool.query('BEGIN');

    // 1. Insertar en la tabla pedidos
    const pedidoResult = await pool.query(
      `INSERT INTO pedidos (usuario_id, estado_id, metodo_pago_id, direccion, coordenadas, numero_contacto, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [usuario_id, 1, metodo_pago_id, direccion, coordenadas, numero_contacto, total] // estado_id = 1 (por ejemplo, 'Pendiente' o 'Nuevo')
    );
    const pedido_id = pedidoResult.rows[0].id;

    // 2. Insertar en la tabla detalles_pedido para cada artículo en cartItems
    for (const item of cartItems) {
      await pool.query(
        `INSERT INTO detalles_pedido (pedido_id, ropa_id, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [pedido_id, item.id, item.quantity, parseFloat(item.precio), parseFloat(item.precio) * item.quantity]
      );
      // Opcionalmente, puedes actualizar el stock del producto aquí si gestionas el stock en tu DB
      // await pool.query('UPDATE ropas SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
    }

    // Confirmar la transacción
    await pool.query('COMMIT');

    res.status(201).json({ mensaje: 'Pedido registrado correctamente', pedido_id });
  } catch (error) {
    // Revertir la transacción en caso de error
    await pool.query('ROLLBACK');
    console.error('Error al registrar el pedido:', error);
    res.status(500).json({ error: error.message });
  }
});

// Nuevo endpoint para registrar un nuevo usuario
app.post('/api/usuarios/registrar', async (req, res) => {
  const { nombre, correo, contrasena, dni } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO usuarios (nombre, correo, contraseña, dni) VALUES ($1, $2, $3, $4) RETURNING id, nombre, correo, dni',
      [nombre, correo, contrasena, dni] // Asegúrate de hashear la contraseña en una aplicación real
    );
    res.status(201).json({ mensaje: 'Usuario registrado exitosamente', usuario: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // Código de error para unique_violation
      return res.status(409).json({ error: 'El correo o DNI ya está registrado.' });
    }
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor al registrar usuario.' });
  }
});

// Nuevo endpoint para verificar si un DNI existe
app.post('/api/usuarios/verificar-dni', async (req, res) => {
  const { dni } = req.body;
  try {
    const result = await pool.query('SELECT id, nombre, correo, dni FROM usuarios WHERE dni = $1', [dni]);
    if (result.rows.length > 0) {
      res.json({ existe: true, usuario: result.rows[0] });
    } else {
      res.json({ existe: false });
    }
  } catch (error) {
    console.error('Error al verificar DNI:', error);
    res.status(500).json({ error: 'Error interno del servidor al verificar DNI.' });
  }
});
app.get('/api/estados', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM estado ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener los estados de pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener estados de pedido.' });
  }
});

app.get('/api/pedidos', async (req, res) => {
  try {
    const { usuario_id, estado_id, min_total, max_total, fecha_inicio, fecha_fin } = req.query;
    let query = `
      SELECT
        p.id AS pedido_id,
        p.fecha,
        p.direccion,
        p.coordenadas,
        p.numero_contacto,
        p.total,
        u.id AS usuario_id,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo,
        e.id AS estado_id,
        e.nombre AS estado_nombre,
        mp.id AS metodo_pago_id,
        mp.nombre AS metodo_pago_nombre,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'detalle_id', dp.id,
            'ropa_id', r.id,
            'ropa_nombre', r.nombre,
            'cantidad', dp.cantidad,
            'precio_unitario', dp.precio_unitario,
            'subtotal', dp.subtotal,
            'imagen_url', r.imagen_url
          ) ORDER BY dp.id
        ) AS detalles_items
      FROM
        pedidos p
      JOIN
        usuarios u ON p.usuario_id = u.id
      JOIN
        estado e ON p.estado_id = e.id
      JOIN
        metodo_pago mp ON p.metodo_pago_id = mp.id
      LEFT JOIN
        detalles_pedido dp ON p.id = dp.pedido_id
      LEFT JOIN
        ropas r ON dp.ropa_id = r.id
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (usuario_id) {
      conditions.push(`p.usuario_id = $${paramIndex++}`);
      values.push(usuario_id);
    }
    if (estado_id) {
      conditions.push(`p.estado_id = $${paramIndex++}`);
      values.push(estado_id);
    }
    if (min_total) {
      conditions.push(`p.total >= $${paramIndex++}`);
      values.push(min_total);
    }
    if (max_total) {
      conditions.push(`p.total <= $${paramIndex++}`);
      values.push(max_total);
    }
    if (fecha_inicio) {
      conditions.push(`p.fecha >= $${paramIndex++}`);
      values.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push(`p.fecha <= $${paramIndex++}`);
      values.push(fecha_fin);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` GROUP BY p.id, u.id, e.id, mp.id ORDER BY p.fecha DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener/filtrar pedidos:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener pedidos.' });
  }
});

// Endpoint para obtener un pedido específico por ID
app.get('/api/pedidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT
        p.id AS pedido_id,
        p.fecha,
        p.direccion,
        p.coordenadas,
        p.numero_contacto,
        p.total,
        u.id AS usuario_id,
        u.nombre AS usuario_nombre,
        u.correo AS usuario_correo,
        e.id AS estado_id,
        e.nombre AS estado_nombre,
        mp.id AS metodo_pago_id,
        mp.nombre AS metodo_pago_nombre,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'detalle_id', dp.id,
            'ropa_id', r.id,
            'ropa_nombre', r.nombre,
            'cantidad', dp.cantidad,
            'precio_unitario', dp.precio_unitario,
            'subtotal', dp.subtotal,
            'imagen_url', r.imagen_url
          ) ORDER BY dp.id
        ) AS detalles_items
      FROM
        pedidos p
      JOIN
        usuarios u ON p.usuario_id = u.id
      JOIN
        estado e ON p.estado_id = e.id
      JOIN
        metodo_pago mp ON p.metodo_pago_id = mp.id
      LEFT JOIN
        detalles_pedido dp ON p.id = dp.pedido_id
      LEFT JOIN
        ropas r ON dp.ropa_id = r.id
      WHERE
        p.id = $1
      GROUP BY p.id, u.id, e.id, mp.id;
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Pedido no encontrado.' });
    }
  } catch (error) {
    console.error('Error al obtener pedido por ID:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener el pedido.' });
  }
});

// Endpoint para actualizar el estado de un pedido
// PUT /api/pedidos/:id/estado
// Body: { "estado_id": 2 }
app.put('/api/pedidos/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_id } = req.body;

    if (!estado_id) {
      return res.status(400).json({ error: 'El ID del estado es requerido.' });
    }

    // Opcional: Podrías verificar que estado_id existe en la tabla 'estado'
    const estadoCheck = await pool.query('SELECT id FROM estado WHERE id = $1', [estado_id]);
    if (estadoCheck.rows.length === 0) {
      return res.status(404).json({ error: 'El estado_id proporcionado no es válido.' });
    }

    const result = await pool.query(
      'UPDATE pedidos SET estado_id = $1 WHERE id = $2 RETURNING id',
      [estado_id, id]
    );

    if (result.rows.length > 0) {
      res.json({ mensaje: 'Estado del pedido actualizado correctamente.', pedido_id: result.rows[0].id });
    } else {
      res.status(404).json({ error: 'Pedido no encontrado para actualizar.' });
    }
  } catch (error) {
    console.error('Error al actualizar el estado del pedido:', error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar el estado.' });
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
