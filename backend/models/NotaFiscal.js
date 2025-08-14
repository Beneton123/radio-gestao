// backend/models/NotaFiscal.js
const mongoose = require('mongoose');

const notaFiscalSchema = new mongoose.Schema({
    nfNumero: { type: String, required: true },
    tipo: { type: String, required: true, enum: ['Saída', 'Entrada'] },
    cliente: { type: String, required: true },
    dataSaida: { type: Date, required: function() { return this.tipo === 'Saída'; } },
    previsaoRetorno: { type: Date, default: null },
    radios: [{ type: String, required: true }],
    // NOVO CAMPO: Guarda os rádios que já foram retornados de uma NF de Saída
    radiosRetornados: { type: [String], default: [] },
    dataEntrada: { type: Date, default: null }, // Agora representa a data da ÚLTIMA entrada
    observacoes: [{ type: String }],
    usuarioRegistro: { type: String, required: true },
    tipoLocacao: { type: String, enum: ['Mensal', 'Anual', null], default: null }
}, { timestamps: true });

notaFiscalSchema.index({ nfNumero: 1, tipo: 1 }, { unique: true });

module.exports = mongoose.model('NotaFiscal', notaFiscalSchema);