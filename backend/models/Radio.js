const mongoose = require('mongoose');

const radioSchema = new mongoose.Schema({
    modelo: { type: String, required: true },
    numeroSerie: { type: String, required: true, uppercase: true },
    patrimonio: { type: String, default: '' },
    frequencia: { type: String, required: true },
    status: { 
        type: String, 
        default: 'Disponível', 
        enum: ['Disponível', 'Ocupado', 'Manutenção', 'Condenado']
    },
    ultimaNfSaida: { type: String, default: null },
    ultimaNfEntrada: { type: String, default: null },
    nfAtual: { type: String, default: null },
    tipoLocacaoAtual: { type: String, enum: ['Mensal', 'Anual', null], default: null },
    cadastradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    ativo: { type: Boolean, default: true },

    // Detalhes da Condenação / Baixa
    motivoCondenacao: { type: String, default: null },
    dataCondenacao: { type: Date, default: null },
    tecnicoCondenacao: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    osCondenacao: { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoManutencao', default: null },
    
    // Campos antigos de baixa (mantidos por compatibilidade se necessário)
    motivoBaixa: { type: String, default: null },
    dataBaixa: { type: Date, default: null },
    usuarioBaixa: { type: String, default: null }
}, { timestamps: true });

// A REGRA CORRETA E SIMPLES
radioSchema.index({ numeroSerie: 1 }, { unique: true });

module.exports = mongoose.model('Radio', radioSchema);