// backend/controllers/userController.js
const Usuario = require('../models/Usuario');

exports.createUser = async (req, res) => {
    try {
        const { nome, email, senha, permissoes } = req.body;
        if (!nome || !email || !senha || !Array.isArray(permissoes)) {
            return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
        }
        const usuarioExistente = await Usuario.findOne({ email });
        if (usuarioExistente) return res.status(409).json({ message: 'E-mail já cadastrado.' });

        const novoUsuario = new Usuario({ nome, email, senha, permissoes });
        await novoUsuario.save();
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', usuario: { nome: novoUsuario.nome, email: novoUsuario.email } });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const usuarios = await Usuario.find({}, { senha: 0 });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { email } = req.params;
        if (email === 'admin@admin.com') return res.status(403).json({ message: 'Usuário admin não pode ser excluído.' });
        
        const result = await Usuario.deleteOne({ email });
        if (result.deletedCount === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
        
        res.status(200).json({ message: 'Usuário excluído com sucesso.' });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
// Adicione esta linha no final do arquivo userController.js
console.log('>>> EXPORTANDO de userController.js:', module.exports);

};