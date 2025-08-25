// backend/models/RadioExcluido.js
const mongoose = require('mongoose');

const radioExcluidoSchema = new mongoose.Schema({
    modelo: { type: String, required: true },

    numeroSerie: { type: String, required: true },
    patrimonio: { type: String },
    frequencia: { type: String, required: true },
    status: { type: String },
    nfAtual: { type: String },
    tipoLocacaoAtual: { type: String },
    ultimaNfSaida: { type: String },
    deletadoPor: { type: String, required: true },
    deletadoEm: { type: Date, default: Date.now },
    motivoExclusao: { type: String, default: 'Não especificado' }
}, {
    timestamps: true
});

module.exports = mongoose.model('RadioExcluido', radioExcluidoSchema);