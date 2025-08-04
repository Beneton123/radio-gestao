const mongoose = require('mongoose');

const notaFiscalSchema = new mongoose.Schema({
    nfNumero: { type: String, required: true },
    tipo: { type: String, required: true, enum: ['Saída', 'Entrada'] }, // 'Saída' ou 'Entrada'
    cliente: { type: String, required: true },
    dataSaida: { type: Date, required: function() { return this.tipo === 'Saída'; } }, // Obrigatório se for saída
    previsaoRetorno: { type: Date, default: null },
    radios: [{ type: String, required: true }], // Array de numeroSerie dos rádios
    dataEntrada: { type: Date, default: null },
    observacoes: [{ type: String }],
    usuarioRegistro: { type: String, required: true }, // Email do usuário que registrou
}, { timestamps: true });

// Índice composto para garantir NF única por número e tipo
notaFiscalSchema.index({ nfNumero: 1, tipo: 1 }, { unique: true });

module.exports = mongoose.model('NotaFiscal', notaFiscalSchema);