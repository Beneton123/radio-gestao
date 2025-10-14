// backend/models/Movimentacao.js

const mongoose = require('mongoose');

const movimentacaoSchema = new mongoose.Schema({
    // ID da NF a que este log pertence
    nfId: { type: mongoose.Schema.Types.ObjectId, ref: 'NotaFiscal', required: true, index: true },
    
    // ID do Pedido de Manutenção, se aplicável
    pedidoManutencaoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoManutencao' },

    // Rádio que sofreu a ação
    radioNumeroSerie: { type: String, required: true },

    // Tipo de evento para futuras filtragens
    tipo: {
        type: String,
        required: true,
        enum: [
            'Criação NF', 
            'Adição de Rádio', 
            'Retorno (OK)', 
            'Envio Manutenção', 
            'Retorno Manutenção (para NF)', 
            'Remoção Estoque (pós-manutenção)', 
            'Condenado'
        ]
    },

    // A mensagem completa que será exibida na tela
    descricao: { type: String, required: true },
    
    // Nome do usuário que realizou a ação
    usuarioNome: { type: String, required: true }, 
    
    // Data do evento
    data: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Movimentacao', movimentacaoSchema);