const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Añadimos los datos del usuario (del token) al objeto 'req'
      req.user = decoded; 
      next();
    } catch (error) {
      console.error('Error de autenticación de token', error);
      res.status(401).json({ message: 'No autorizado, token fallido.' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'No autorizado, no hay token.' });
  }
};

const isAdmin = (req, res, next) => {
  // Los tokens compatibles con Supabase usan `role=authenticated`; el rol
  // de negocio vive en `app_role`. Se mantiene `role=admin` por compatibilidad
  // con tokens antiguos durante la transición.
  const applicationRole = req.user && (req.user.app_role || req.user.role);
  if (applicationRole === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
  }
};

module.exports = { protect, isAdmin };