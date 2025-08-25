// backend/models/RadioExcluido.js
const mongoose = require('mongoose');

// O schema deve conter os campos do rádio que você quer salvar,
// mais os campos de controle da exclusão.
const radioExcluidoSchema = new mongoose.Schema({
    modelo: { type: String, required: true },
    numeroSerie: { type: String, required: true, unique: true }, // unique para garantir que não haja duplicatas no histórico
    patrimonio: { type: String },
    frequencia: { type: String, required: true },
    status: { type: String }, // O status no momento da exclusão
    nfAtual: { type: String },
    tipoLocacaoAtual: { type: String },
    ultimaNfSaida: { type: String },
    deletadoPor: { type: String, required: true }, // Email do admin que deletou
    deletadoEm: { type: Date, default: Date.now }, // Data da exclusão
    motivoExclusao: { type: String, default: 'Não especificado' } // <-- CAMPO NOVO IMPLEMENTADO
}, {
    timestamps: true // Adiciona createdAt e updatedAt originais do rádio
});

// A linha mais importante é esta, que exporta o model diretamente
module.exports = mongoose.model('RadioExcluido', radioExcluidoSchema);