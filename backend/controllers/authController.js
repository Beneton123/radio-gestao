// backend/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey';

exports.login = async (req, res) => {
    const { email, senha } = req.body;
    try {
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
        if (!senhaCorreta) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        // Gera token JWT
        const token = jwt.sign(
            {
                email: usuario.email,
                nome: usuario.nome,
                permissoes: usuario.permissoes
            },
            jwtSecret,
            { expiresIn: '8h' } // Token expira em 8 horas
        );

        res.json({ token, nomeUsuario: usuario.nome, permissoes: usuario.permissoes });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};