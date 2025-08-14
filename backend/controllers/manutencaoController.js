// backend/controllers/manutencaoController.js
const PedidoManutencao = require('../models/PedidoManutencao');
const Radio = require('../models/Radio');
const { getNextSequenceValue } = require('../utils/helpers');

exports.createSolicitacao = async (req, res) => {
    try {
        const { prioridade, radios } = req.body;
        if (!prioridade || !Array.isArray(radios) || radios.length === 0) {
            return res.status(400).json({ message: 'Prioridade e lista de rádios são obrigatórios.' });
        }

        const radiosDetalhes = [];
        for (const r of radios) {
            const radioNoEstoque = await Radio.findOne({ numeroSerie: r.numeroSerie });
            if (!radioNoEstoque) return res.status(404).json({ message: `Rádio ${r.numeroSerie} não encontrado.` });
            if (radioNoEstoque.status !== 'Disponível') return res.status(400).json({ message: `Rádio ${r.numeroSerie} não está disponível (status: ${radioNoEstoque.status}).` });
            radiosDetalhes.push({ ...r, modelo: radioNoEstoque.modelo, patrimonio: radioNoEstoque.patrimonio });
        }
        
        const idPedido = await getNextSequenceValue('pedidoId');
        const novoPedido = new PedidoManutencao({
            idPedido, prioridade, radios: radiosDetalhes,
            solicitanteNome: req.usuario.nome,
            solicitanteEmail: req.usuario.email,
            statusPedido: 'aberto'
        });
        await novoPedido.save();
        res.status(201).json({ message: 'Solicitação de manutenção criada com sucesso!', pedido: novoPedido });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno ao criar solicitação.', error: error.message });
    }
};

exports.getAllSolicitacoes = async (req, res) => {
    try {
        let query = {};
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            query.solicitanteEmail = req.usuario.email;
        }
        if (req.query.status) {
            query.statusPedido = { $in: req.query.status.split(',') };
        }
        const solicitacoes = await PedidoManutencao.find(query).sort({ dataSolicitacao: -1 });
        res.json(solicitacoes);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno ao listar solicitações.', error: error.message });
    }
};

exports.getSolicitacaoById = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin') && pedido.solicitanteEmail !== req.usuario.email) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }
        res.json(pedido);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno ao buscar pedido.', error: error.message });
    }
};

exports.darAndamento = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (pedido.statusPedido !== 'aberto') return res.status(400).json({ message: `Status do pedido é "${pedido.statusPedido}".` });

        pedido.statusPedido = 'aguardando_manutencao';
        await pedido.save();

        const numerosSerie = pedido.radios.map(r => r.numeroSerie);
        await Radio.updateMany({ numeroSerie: { $in: numerosSerie } }, { $set: { status: 'Manutenção' } });

        res.status(200).json({ message: 'Status do pedido atualizado.', pedido });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.iniciarManutencao = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const { tecnicoResponsavel } = req.body;
        if (!tecnicoResponsavel) return res.status(400).json({ message: 'Técnico responsável é obrigatório.' });

        const pedido = await PedidoManutencao.findOneAndUpdate(
            { idPedido, statusPedido: 'aguardando_manutencao' },
            { $set: { statusPedido: 'em_manutencao', tecnicoResponsavel, dataInicioManutencao: new Date() } },
            { new: true }
        );
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado ou em status inválido.' });
        res.status(200).json({ message: 'Manutenção iniciada.', pedido });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.concluirManutencao = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const { observacoesTecnicas } = req.body;
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (pedido.statusPedido !== 'em_manutencao') return res.status(400).json({ message: `Status do pedido é "${pedido.statusPedido}".` });
        
        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || 'Nenhuma observação técnica fornecida.';
        await pedido.save();
        
        const numerosSerie = pedido.radios.map(r => r.numeroSerie);
        await Radio.updateMany({ numeroSerie: { $in: numerosSerie } }, { $set: { status: 'Disponível' } });
        
        res.status(200).json({ message: 'Manutenção concluída.', pedido });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.getEstoqueManutencao = async (req, res) => {
    try {
        const radiosEmManutencao = await Radio.find({ status: 'Manutenção' }).lean();
        const estoqueDetalhado = await Promise.all(radiosEmManutencao.map(async (radio) => {
            const pedido = await PedidoManutencao.findOne({
                'radios.numeroSerie': radio.numeroSerie,
                statusPedido: { $in: ['aberto', 'aguardando_manutencao', 'em_manutencao'] }
            }).sort({ dataSolicitacao: -1 }).lean();
            const problema = pedido ? pedido.radios.find(r => r.numeroSerie === radio.numeroSerie)?.descricaoProblema : 'N/A';
            return { ...radio, pedidoManutencao: pedido, descricaoProblema: problema };
        }));
        res.json(estoqueDetalhado);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};