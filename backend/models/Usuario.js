const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // Adicionado para uso em pré-save hook

const usuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true }, // Senha já hashada
    permissoes: [{ type: String }],
}, { timestamps: true });

// Pré-save hook para garantir que a senha seja hashed antes de salvar (se for alterada)
usuarioSchema.pre('save', async function(next) {
    if (this.isModified('senha') && this.senha && !this.senha.startsWith('$2b$')) { // Verifica se a senha foi modificada e não é um hash
        this.senha = await bcrypt.hash(this.senha, 10);
    }
    next();
});


module.exports = mongoose.model('Usuario', usuarioSchema);