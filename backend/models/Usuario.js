const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); 

const usuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true }, 
    permissoes: [{ type: String }],
}, { timestamps: true });

usuarioSchema.pre('save', async function(next) {
    if (this.isModified('senha') && this.senha && !this.senha.startsWith('$2b$')) { 
        this.senha = await bcrypt.hash(this.senha, 10);
    }
    next();
});


module.exports = mongoose.model('Usuario', usuarioSchema);