const mongoose = require('mongoose');

const radioSchema = new mongoose.Schema({
    modelo: { type: String, required: true },
    numeroSerie: { type: String, required: true, unique: true },
    patrimonio: { type: String, default: '' },
    frequencia: { type: String, required: true },
    status: { type: String, default: 'Disponível', enum: ['Disponível', 'Ocupado', 'Manutenção'] },
    ultimaNfSaida: { type: String, default: null },
    ultimaNfEntrada: { type: String, default: null },
    nfAtual: { type: String, default: null },
    tipoLocacaoAtual: { type: String, enum: ['Mensal', 'Anual', null], default: null },
    cadastradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }
}, { timestamps: true }); // Adiciona createdAt e updatedAt automaticamente

module.exports = mongoose.model('Radio', radioSchema);
