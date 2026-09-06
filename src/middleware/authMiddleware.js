const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // El JWT compatible con Supabase usa `sub`/`user_id`; los controladores
      // internos de Padel@Home históricamente consumen `req.user.id`.
      const userId = decoded.id ?? decoded.user_id ?? decoded.sub;
      if (!/^\d+$/.test(String(userId)) || Number(userId) < 1) {
        return res.status(401).json({ message: 'No autorizado, identidad inválida.' });
      }

      // Normalizamos una única vez para que todas las rutas usen el mismo ID.
      req.user = { ...decoded, id: Number(userId) };
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