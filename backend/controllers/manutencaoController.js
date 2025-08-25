// backend/controllers/manutencaoController.js
const PedidoManutencao = require('../models/PedidoManutencao');
const Radio = require('../models/Radio');
// Se você tem um modelo Manutencao separado para histórico, mantenha-o aqui,
// caso contrário, o histórico será baseado em PedidoManutencao.
// const Manutencao = require('../models/Manutencao'); 
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
        console.error("Erro em createSolicitacao:", error); // Adicionado console.error
        res.status(500).json({ message: 'Erro interno ao criar solicitação.', error: error.message });
    }
};

// Obtém o histórico de manutenções finalizadas
// Esta função buscará os pedidos de manutenção que foram concluídos/finalizados.
exports.getManutencaoHistory = async (req, res) => {
    try {
        // Assume que o histórico de manutenção são os PedidoManutencao com status 'finalizado'
        const manutencoesHistorico = await PedidoManutencao.find({ statusPedido: 'finalizado' })
                                                        .sort({ dataFimManutencao: -1, dataSolicitacao: -1 }); // Ordena pela data de fim
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
        // Se o usuário não tem permissão de gerenciar_manutencao ou admin, filtra pelas suas próprias solicitações
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            query.solicitanteEmail = req.usuario.email;
        }
        // Permite filtrar por múltiplos status, se passados como query param (ex: ?status=aberto,em_manutencao)
        if (req.query.status) {
            query.statusPedido = { $in: req.query.status.split(',') };
        }
        const solicitacoes = await PedidoManutencao.find(query).sort({ dataSolicitacao: -1 });
        res.json(solicitacoes);
    } catch (error) {
        console.error("Erro em getAllSolicitacoes:", error); // Adicionado console.error
        res.status(500).json({ message: 'Erro interno ao listar solicitações.', error: error.message });
    }
};

// Obtém uma solicitação de manutenção específica por ID
exports.getSolicitacaoById = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        // Validação de permissão: apenas quem solicitou, ou quem gerencia/admin pode ver
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin') && pedido.solicitanteEmail !== req.usuario.email) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }
        res.json(pedido);
    } catch (error) {
        console.error("Erro em getSolicitacaoById:", error); // Adicionado console.error
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
        console.error("Erro em darAndamento:", error); // Adicionado console.error
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
        console.error("Erro em iniciarManutencao:", error); // Adicionado console.error
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
        pedido.observacoesTecnicas = observacoesTecnicas || pedido.observacoesTecnicas || 'Nenhuma observação técnica fornecida.'; // Mantém as antigas ou adiciona novas
        await pedido.save();
        
        const numerosSerie = pedido.radios.map(r => r.numeroSerie);
        await Radio.updateMany({ numeroSerie: { $in: numerosSerie } }, { $set: { status: 'Disponível' } });
        
        res.status(200).json({ message: 'Manutenção concluída e rádios disponíveis.', pedido });
    } catch (error) {
        console.error("Erro em concluirManutencao:", error); // Adicionado console.error
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

// Obtém os rádios que estão em status 'Manutenção'
exports.getEstoqueManutencao = async (req, res) => {
    try {
        const radiosEmManutencao = await Radio.find({ status: 'Manutenção' }).lean();
        // Detalha os rádios com os pedidos de manutenção abertos/em andamento
        const estoqueDetalhado = await Promise.all(radiosEmManutencao.map(async (radio) => {
            const pedido = await PedidoManutencao.findOne({
                'radios.numeroSerie': radio.numeroSerie,
                statusPedido: { $in: ['aberto', 'aguardando_manutencao', 'em_manutencao'] }
            }).sort({ dataSolicitacao: -1 }).lean(); // Pega o pedido mais recente para esse rádio
            // Adiciona a descrição do problema do rádio específica para esse pedido
            const problema = pedido ? pedido.radios.find(r => r.numeroSerie === radio.numeroSerie)?.descricaoProblema : 'N/A';
            return { ...radio, pedidoManutencao: pedido, descricaoProblema: problema };
        }));
        res.json(estoqueDetalhado);
    } catch (error) {
        console.error("Erro em getEstoqueManutencao:", error); // Adicionado console.error
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};