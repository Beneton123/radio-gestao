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
        enum: ['Pendente', 'Manutenção', 'Concluído', 'Condenado', 'Transferido'] 
    },
    transferidoParaOS: { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoManutencao', default: null }
}, { _id: true });

const pedidoManutencaoSchema = new mongoose.Schema({
    idPedido: { type: String, unique: true, sparse: true }, 
    
    tipoOS: {
        type: String,
        enum: ['manual', 'automatica'],
        default: 'manual'
    },

    solicitanteNome: { type: String, required: true },
    solicitanteEmail: { type: String, required: true },
    dataSolicitacao: { type: Date, default: Date.now },
    prioridade: { type: String, required: true, enum: ['baixa', 'media', 'alta', 'urgente'] },
    radios: [radioEmManutencaoSchema],
    statusPedido: { type: String, default: 'aberto', enum: ['aberto', 'aguardando_manutencao', 'em_manutencao', 'finalizado', 'cancelado'] },
    tecnicoResponsavel: { type: String, default: null },
    dataInicioManutencao: { type: Date, default: null },
    dataFimManutencao: { type: Date, default: null },
    observacoesSolicitante: { type: String, default: null },
    observacoesTecnicas: { type: String, default: null }, // <-- VÍRGULA ADICIONADA AQUI

    // Novos campos que você adicionou corretamente
    origemNF: { type: String }, 
    clienteNome: { type: String },

}, { timestamps: true });

module.exports = mongoose.model('PedidoManutencao', pedidoManutencaoSchema);