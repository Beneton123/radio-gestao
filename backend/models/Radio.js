const mongoose = require('mongoose');

const radioSchema = new mongoose.Schema({
    modelo: { type: String, required: true },
    numeroSerie: { type: String, required: true, unique: true },
    patrimonio: { type: String, default: '' },
    frequencia: { type: String, required: true },
    status: { type: String, default: 'Disponível', enum: ['Disponível', 'Ocupado', 'Manutenção'] }, // Enum para status
    ultimaNfSaida: { type: String, default: null },
    ultimaNfEntrada: { type: String, default: null },
    nfAtual: { type: String, default: null },
tipoLocacaoAtual: { type: String, enum: ['Mensal', 'Anual', null], default: null } // Reflete o tipo de locação se estiver 'Ocupado'
}, { timestamps: true }); // Adiciona createdAt e updatedAt automaticamente

module.exports = mongoose.model('Radio', radioSchema);