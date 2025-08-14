// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey';

const autenticarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token de autenticação não fornecido.' });

    jwt.verify(token, jwtSecret, (err, usuario) => {
        if (err) {
            if (err.name === 'TokenExpiredError') return res.status(403).json({ message: 'Token expirado. Faça login novamente.' });
            return res.status(403).json({ message: 'Token inválido.' });
        }
        req.usuario = usuario;
        next();
    });
};

const autorizarAdmin = (req, res, next) => {
    if (!req.usuario || !req.usuario.permissoes.includes('admin')) {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
    }
    next();
};

const temPermissao = (permissaoNecessaria) => {
    return (req, res, next) => {
        if (!req.usuario.permissoes.includes(permissaoNecessaria) && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: `Acesso negado. Requer permissão: ${permissaoNecessaria}` });
        }
        next();
    };
};

module.exports = { autenticarToken, autorizarAdmin, temPermissao };