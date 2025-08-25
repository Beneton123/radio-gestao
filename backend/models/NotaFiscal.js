// backend/models/NotaFiscal.js
const mongoose = require('mongoose');

const notaFiscalSchema = new mongoose.Schema({
    nfNumero: { type: String, required: true },
    tipo: { type: String, required: true, enum: ['Saída', 'Entrada'] }, // 'Saída' ou 'Entrada'
    cliente: { type: String }, // Obrigatório para Saída, opcional para Entrada (pode vir da NF de Saída)
    dataSaida: { type: Date }, // Para NFs de Saída
    previsaoRetorno: { type: Date }, // Para NFs de Saída
    dataEntrada: { type: Date }, // Para NFs de Entrada (data real do retorno)
    radios: [{ type: String, required: true }], // Array de numeroSerie dos rádios
    radiosRetornados: [{ type: String }], // Para NFs de Saída: quais rádios já retornaram
    observacoes: { type: String },
    usuarioRegistro: { type: String, required: true }, // Quem registrou a NF
    tipoLocacao: { type: String, enum: ['Mensal', 'Anual'] }, // Para NFs de Saída
    nfNumeroReferencia: { // NOVO CAMPO: Para vincular NFs de Entrada a uma NF de Saída original
        type: String,
        required: function() { return this.tipo === 'Entrada'; } // Obrigatório se for uma NF de Entrada
    }
}, {
    timestamps: true
});

// Adiciona um índice composto para garantir unicidade para NFs de Saída
notaFiscalSchema.index({ nfNumero: 1, tipo: 1 }, { unique: true });

module.exports = mongoose.model('NotaFiscal', notaFiscalSchema);