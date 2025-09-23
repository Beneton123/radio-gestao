const PedidoManutencao = require('../models/PedidoManutencao');
const Radio = require('../models/Radio');
const { getNextSequenceValue } = require('../utils/helpers');

// Cria uma nova solicitação de manutenção
exports.createSolicitacao = async (req, res) => {
    try {
        const { prioridade, radios } = req.body;
        if (!prioridade || !Array.isArray(radios) || radios.length === 0) {
            return res.status(400).json({ message: 'Prioridade e lista de rádios são obrigatórios.' });
        }

        const radiosDetalhes = [];
        for (const r of radios) {
            console.log(`Buscando rádio com número de série: ${r.numeroSerie}`);
            // Verificando se o rádio está ativo e com o status "Disponível" ou "Ocupado"
            const radioNoEstoque = await Radio.findOne({ 
                numeroSerie: r.numeroSerie, 
                ativo: true // Garantindo que estamos buscando apenas rádios ativos
            });

            // Verificando se o rádio foi encontrado
            console.log(`Resultado da busca para o rádio ${r.numeroSerie}: `, radioNoEstoque);

            if (!radioNoEstoque) {
                // Se o rádio não foi encontrado ou está excluído (ativo: false)
                console.log(`Rádio ${r.numeroSerie} não encontrado ou foi excluído.`);
                return res.status(404).json({ message: `Rádio ${r.numeroSerie} não encontrado ou foi excluído.` });
            }

            // Verifica se o status do rádio é "Disponível" ou "Ocupado"
            console.log(`Status do rádio ${r.numeroSerie}: ${radioNoEstoque.status}`);
            if (radioNoEstoque.status !== 'Disponível' && radioNoEstoque.status !== 'Ocupado') {
                return res.status(400).json({ message: `Rádio ${r.numeroSerie} não está disponível (status: ${radioNoEstoque.status}).` });
            }

            // Se o rádio for válido, adiciona ele à lista
            radiosDetalhes.push({ 
                ...r, 
                modelo: radioNoEstoque.modelo, 
                patrimonio: radioNoEstoque.patrimonio 
            });
        }

        // Gera um novo ID para o pedido
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
        console.error("Erro em createSolicitacao:", error);
        res.status(500).json({ message: 'Erro interno ao criar solicitação.', error: error.message });
    }
};

// Obtém o histórico de manutenções finalizadas
exports.getManutencaoHistory = async (req, res) => {
    try {
        const manutencoesHistorico = await PedidoManutencao.find({ statusPedido: 'finalizado' })
                                                        .sort({ dataFimManutencao: -1, dataSolicitacao: -1 });
        res.json(manutencoesHistorico);
    } catch (error) {
        console.error('Erro ao buscar histórico de manutenções:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico de manutenções.', error: error.message });
    }
};

// Obtém todas as solicitações de manutenção (pode ser filtrado por status ou usuário)
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
        console.error("Erro em getAllSolicitacoes:", error);
        res.status(500).json({ message: 'Erro interno ao listar solicitações.', error: error.message });
    }
};

// Obtém uma solicitação de manutenção específica por ID
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
        console.error("Erro em getSolicitacaoById:", error);
        res.status(500).json({ message: 'Erro interno ao buscar pedido.', error: error.message });
    }
};

// Atualiza o status do pedido para 'aguardando_manutencao' e atualiza o status do rádio
exports.darAndamento = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (pedido.statusPedido !== 'aberto') return res.status(400).json({ message: `Status do pedido é "${pedido.statusPedido}". Somente pedidos 'aberto' podem ter andamento.` });

        pedido.statusPedido = 'aguardando_manutencao';
        await pedido.save();

        const numerosSerie = pedido.radios.map(r => r.numeroSerie);
        await Radio.updateMany({ numeroSerie: { $in: numerosSerie } }, { $set: { status: 'Manutenção' } });

        res.status(200).json({ message: 'Status do pedido atualizado para "Aguardando Manutenção".', pedido });
    } catch (error) {
        console.error("Erro em darAndamento:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

// Inicia a manutenção, atualiza status e registra técnico/data
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
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado ou não está em status "aguardando_manutencao".' });
        res.status(200).json({ message: 'Manutenção iniciada.', pedido });
    } catch (error) {
        console.error("Erro em iniciarManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

// Conclui a manutenção, atualiza status e rádio para 'Disponível'
exports.concluirManutencao = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const { observacoesTecnicas } = req.body; // Opção para adicionar observações
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (pedido.statusPedido !== 'em_manutencao') return res.status(400).json({ message: `Status do pedido é "${pedido.statusPedido}". Somente pedidos 'em_manutencao' podem ser concluídos.` });
        
        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || pedido.observacoesTecnicas || 'Nenhuma observação técnica fornecida.';
        await pedido.save();
        
        const numerosSerie = pedido.radios.map(r => r.numeroSerie);
        await Radio.updateMany({ numeroSerie: { $in: numerosSerie } }, { $set: { status: 'Disponível' } });
        
        res.status(200).json({ message: 'Manutenção concluída e rádios disponíveis.', pedido });
    } catch (error) {
        console.error("Erro em concluirManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

// Obtém os rádios que estão em status 'Manutenção'
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
        console.error("Erro em getEstoqueManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};
