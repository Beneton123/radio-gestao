const mongoose = require('mongoose');

// Subdocumento para cada rádio dentro do pedido
const radioEmManutencaoSchema = new mongoose.Schema({
    radioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Radio', required: true },
    numeroSerie: { type: String, required: true },
    modelo: { type: String },
    patrimonio: { type: String },
    descricaoProblema: { type: String, required: true },
    status: {
        type: String,
        default: 'Pendente',
        enum: ['Pendente', 'Concluído', 'Condenado', 'Transferido']
    },
    transferidoParaOS: { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoManutencao', default: null }
}, { _id: true }); // GARANTE QUE CADA RÁDIO TENHA UM ID ÚNICO

const pedidoManutencaoSchema = new mongoose.Schema({
    idPedido: { type: String, required: true, unique: true },
    solicitanteNome: { type: String, required: true },
    solicitanteEmail: { type: String, required: true },
    dataSolicitacao: { type: Date, default: Date.now },
    prioridade: { type: String, required: true, enum: ['baixa', 'media', 'alta', 'urgente'] },
    radio: radioEmManutencaoSchema,
    statusPedido: { type: String, default: 'aberto', enum: ['aberto', 'aguardando_manutencao', 'em_manutencao', 'finalizado', 'cancelado'] },
    tecnicoResponsavel: { type: String, default: null },
    dataInicioManutencao: { type: Date, default: null },
    dataFimManutencao: { type: Date, default: null },
    observacoesSolicitante: { type: String, default: null },
    observacoesTecnicas: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('PedidoManutencao', pedidoManutencaoSchema);