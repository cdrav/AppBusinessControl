require('dotenv').config();  // Asegúrate de que las variables de entorno se carguen correctamente
const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// Crear la aplicación Express
const app = express();
app.use(express.json()); // Usar express.json() en lugar de body-parser
app.use(cors());

// Configurar la conexión a MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,  // El puerto de la base de datos (3306 por defecto)
});

// Conectar a la base de datos
db.connect((err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err.code, err.sqlMessage);
    return;
  }
  console.log('Conexión exitosa a la base de datos');
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Bienvenido a Business Control API');
});

// Ruta para /dashboard
app.get('/dashboard', authenticateToken, (req, res) => {
  res.json({ message: 'Bienvenido al Dashboard' });
});

// Ruta para registrar un nuevo usuario
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  // Validación básica
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  // Verificar si el usuario ya existe
  const checkUserQuery = 'SELECT * FROM users WHERE email = ? OR username = ?';
  db.query(checkUserQuery, [email, username], (err, results) => {
    if (err) {
      console.error('Error al verificar usuario:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }

    if (results.length > 0) {
      return res.status(409).json({ message: 'El usuario o correo ya existe' });
    }

    // Cifrar la contraseña
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Error al cifrar la contraseña:', err);
        return res.status(500).json({ message: 'Error del servidor' });
      }

      // Insertar el nuevo usuario en la base de datos
      const insertUserQuery = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
      db.query(insertUserQuery, [username, email, hashedPassword], (err, result) => {
        if (err) {
          console.error('Error al registrar usuario:', err);
          return res.status(500).json({ message: 'Error del servidor' });
        }

        res.status(201).json({ message: 'Usuario registrado con éxito' });
      });
    });
  });
});

// Ruta para iniciar sesión
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('Error al verificar usuario:', err);
      return res.status(500).json({ message: 'Error del servidor' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error('Error al verificar contraseña:', err);
        return res.status(500).json({ message: 'Error del servidor' });
      }

      if (!isMatch) {
        return res.status(401).json({ message: 'Credenciales incorrectas' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.status(200).json({ message: 'Inicio de sesión exitoso', token });
    });
  });
});

// Middleware para verificar JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // El token está en formato 'Bearer <token>'

  if (!token) {
    return res.status(401).json({ message: 'Acceso no autorizado' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido o expirado' });
    }

    req.user = user; // Almacena los datos del usuario en la solicitud
    next(); // Llama al siguiente middleware o controlador de ruta
  });
}

// Puerto del servidor Express
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
