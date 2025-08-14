// backend/controllers/dashboardController.js
const NotaFiscal = require('../models/NotaFiscal');
const Radio = require('../models/Radio');
const RadioExcluido = require('../models/RadioExcluido');
const PedidoManutencao = require('../models/PedidoManutencao');

exports.getExtratoRadio = async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const radio = await Radio.findOne({ numeroSerie });
        if (!radio) return res.status(404).json({ message: 'Rádio não encontrado.' });

        const notasFiscais = await NotaFiscal.find({ radios: numeroSerie }).sort({ dataSaida: 1 }).lean();
        res.json({ radio: radio.toObject(), extrato: notasFiscais });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.getHistoricoCompletoRadio = async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const radio = await Radio.findOne({ numeroSerie }).lean();
        if (!radio) return res.status(404).json({ message: 'Rádio não encontrado.' });
        
        const notasFiscais = await NotaFiscal.find({ radios: numeroSerie }).lean();
        const pedidosManutencao = await PedidoManutencao.find({ 'radios.numeroSerie': numeroSerie }).lean();
        
        const historico = [];
        notasFiscais.forEach(nf => {
            historico.push({ tipo: 'Saída de Locação', data: nf.dataSaida, descricao: `NF ${nf.nfNumero} para ${nf.cliente}` });
            if (nf.dataEntrada) historico.push({ tipo: 'Retorno de Locação', data: nf.dataEntrada, descricao: `Retorno da NF ${nf.nfNumero}` });
        });
        pedidosManutencao.forEach(pedido => {
            historico.push({ tipo: 'Solicitação Manutenção', data: pedido.dataSolicitacao, descricao: `Pedido ${pedido.idPedido}` });
            if (pedido.dataFimManutencao) historico.push({ tipo: 'Fim Manutenção', data: pedido.dataFimManutencao, descricao: `Finalização do Pedido ${pedido.idPedido}` });
        });

        historico.sort((a, b) => new Date(a.data) - new Date(b.data));
        res.json({ radio, historico });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.getRadiosExcluidos = async (req, res) => {
    try {
        const excluidos = await RadioExcluido.find().sort({ deletadoEm: -1 });
        res.json(excluidos);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.getMovimentacoesRecentes = async (req, res) => {
    try {
        const movimentacoes = await NotaFiscal.find({})
            .sort({ createdAt: -1 })
            .limit(20)
            .select('nfNumero tipo cliente dataSaida dataEntrada usuarioRegistro radios tipoLocacao');
        res.json(movimentacoes);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.getMovimentacaoById = async (req, res) => {
    try {
        const { id } = req.params;
        const movimentacao = await NotaFiscal.findById(id).lean();
        if (!movimentacao) return res.status(404).json({ message: 'Movimentação não encontrada.' });

        const radiosComDetalhes = await Promise.all(movimentacao.radios.map(async (numeroSerie) => {
            const radio = await Radio.findOne({ numeroSerie }).select('modelo patrimonio frequencia');
            return radio || { numeroSerie, modelo: 'N/A', patrimonio: 'N/A' };
        }));
        
        res.json({ ...movimentacao, radios: radiosComDetalhes });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};