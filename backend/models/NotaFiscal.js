// backend/models/NotaFiscal.js
const mongoose = require('mongoose');

const notaFiscalSchema = new mongoose.Schema({
    nfNumero: { type: String, required: true },
    
    tipoNumero: {
        type: String,
        enum: ['manual', 'automatica'],
        default: 'manual'
    },

    tipo: { type: String, required: true, enum: ['Saída', 'Entrada'] },
    cliente: { type: String },
    dataSaida: { type: Date },
    previsaoRetorno: { type: Date },
    dataEntrada: { type: Date },
    radios: [{ type: String, required: true }],
    radiosRetornados: [{ type: String }],
    
    // --- NOVO CAMPO ADICIONADO ---
    radiosRemovidos: [{
        numeroSerie: String,
        dataRemocao: Date,
        motivo: String
    }],
    // --- FIM DA ADIÇÃO ---

    observacoes: [{ type: String }],
    usuarioRegistro: { type: String, required: true },
    tipoLocacao: { type: String, enum: ['Mensal', 'Anual'] },
    nfNumeroReferencia: {
        type: String,
        required: function() { return this.tipo === 'Entrada'; }
    }
}, {
    timestamps: true
});

notaFiscalSchema.index({ nfNumero: 1, tipo: 1 }, { unique: true });

module.exports = mongoose.model('NotaFiscal', notaFiscalSchema);