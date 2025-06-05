const mongoose = require('mongoose');

const pedidoManutencaoSchema = new mongoose.Schema({
    idPedido: { type: String, required: true, unique: true }, // PE000001
    solicitanteNome: { type: String, required: true },
    solicitanteEmail: { type: String, required: true },
    dataSolicitacao: { type: Date, default: Date.now },
    prioridade: { type: String, required: true, enum: ['baixa', 'media', 'alta', 'urgente'] },
    radios: [{ // Rádios na solicitação, com detalhes do problema
        numeroSerie: { type: String, required: true },
        modelo: { type: String }, // Pode ser preenchido do estoque, mas vem da solicitação
        patrimonio: { type: String }, // Pode ser preenchido do estoque
        descricaoProblema: { type: String, required: true }
    }],
    statusPedido: { type: String, default: 'aberto', enum: ['aberto', 'aguardando_manutencao', 'em_manutencao', 'finalizado', 'cancelado'] },
    tecnicoResponsavel: { type: String, default: null },
    dataInicioManutencao: { type: Date, default: null },
    dataFimManutencao: { type: Date, default: null },
    observacoesSolicitante: { type: String, default: null },
    observacoesTecnicas: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('PedidoManutencao', pedidoManutencaoSchema);