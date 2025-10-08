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
        
        // --- INÍCIO DO ESPIÃO ---
        console.log('--- DADOS DO USUÁRIO NO TOKEN (VISTOS PELO BACKEND) ---');
        console.log(usuario);
        console.log('----------------------------------------------------');
        // --- FIM DO ESPIÃO ---

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
        const permissoesDoUsuario = req.usuario.permissoes;

        // 1. Primeiro, verifica se o usuário é admin.
        if (permissoesDoUsuario.includes('admin')) {
            return next(); // Se for admin, permite o acesso imediatamente.
        }

        // 2. Se não for admin, faz a verificação da permissão específica.
        if (!permissoesDoUsuario.includes(permissaoNecessaria)) {
            return res.status(403).json({ message: `Acesso negado. Requer permissão: ${permissaoNecessaria}` });
        }
        
        // 3. Se passou na verificação específica, permite o acesso.
        next();
    };
};

module.exports = { autenticarToken, autorizarAdmin, temPermissao };