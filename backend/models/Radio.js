const mongoose = require('mongoose');

const radioSchema = new mongoose.Schema({
    modelo: { type: String, required: true },
    numeroSerie: { type: String, required: true, uppercase: true },
    patrimonio: { type: String, default: '' },
    frequencia: { type: String, required: true },
    status: { type: String, default: 'Disponível', enum: ['Disponível', 'Ocupado', 'Manutenção'] },
    ultimaNfSaida: { type: String, default: null },
    ultimaNfEntrada: { type: String, default: null },
    nfAtual: { type: String, default: null },
    tipoLocacaoAtual: { type: String, enum: ['Mensal', 'Anual', null], default: null },
    cadastradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    ativo: { type: Boolean, default: true }
}, { timestamps: true });

radioSchema.index(
    { numeroSerie: 1 },
    { unique: true, partialFilterExpression: { ativo: true } }
);

module.exports = mongoose.model('Radio', radioSchema);
