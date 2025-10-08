const PedidoManutencao = require('../models/PedidoManutencao');
const Radio = require('../models/Radio');
const mongoose = require('mongoose');

// Função auxiliar ajustada para "radios" (plural)
async function finalizarOsSeNecessario(pedido, session) {
    // CORRIGIDO: Acessa o primeiro rádio no array
    const radioNoPedido = pedido.radios[0];
    const radioTratado = ['Concluído', 'Condenado'].includes(radioNoPedido.status);

    if (radioTratado) {
        pedido.statusPedido = 'finalizado';
        if (!pedido.dataFimManutencao) {
            pedido.dataFimManutencao = new Date();
        }
        await pedido.save({ session });
    }
}

exports.createSolicitacao = async (req, res) => {
    try {
        const { prioridade, radios, observacoesSolicitante } = req.body;
        if (!prioridade || !Array.isArray(radios) || radios.length === 0) {
            return res.status(400).json({ message: 'Prioridade e lista de rádios são obrigatórios.' });
        }

        const pedidosCriados = [];
        for (const r of radios) {
            const radioNoEstoque = await Radio.findOne({ numeroSerie: r.numeroSerie, ativo: true });
            if (!radioNoEstoque) {
                console.warn(`Rádio ${r.numeroSerie} não encontrado no estoque, será pulado.`);
                continue;
            }
            if (['Manutenção', 'Condenado'].includes(radioNoEstoque.status)) {
                console.warn(`Rádio ${r.numeroSerie} já está em ${radioNoEstoque.status}, será pulado.`);
                continue;
            }

            const radioParaPedido = {
                radioId: radioNoEstoque._id,
                numeroSerie: radioNoEstoque.numeroSerie,
                modelo: radioNoEstoque.modelo,
                patrimonio: radioNoEstoque.patrimonio,
                descricaoProblema: r.descricaoProblema,
                status: 'Pendente'
            };

            const novoPedido = new PedidoManutencao({
                prioridade,
                // CORRIGIDO: Salva em 'radios' (plural) e como um array
                radios: [radioParaPedido], 
                solicitanteNome: req.usuario.nome,
                solicitanteEmail: req.usuario.email,
                statusPedido: 'aberto',
                observacoesSolicitante
            });

            await novoPedido.save();
            pedidosCriados.push(novoPedido);
        }

        if (pedidosCriados.length === 0) {
            return res.status(400).json({ message: 'Nenhum dos rádios fornecidos era válido para criar uma solicitação.' });
        }

        res.status(201).json({ message: `${pedidosCriados.length} Ordem(ns) de Serviço criada(s) com sucesso!`, pedidos: pedidosCriados });

    } catch (error) {
        console.error("Erro em createSolicitacao:", error);
        res.status(500).json({ message: 'Erro interno ao criar solicitação.', error: error.message });
    }
};

exports.getAllSolicitacoes = async (req, res) => {
    try {
        let query = {};
        if (!req.usuario.permissoes.includes('manutencao_dashboard') && !req.usuario.permissoes.includes('admin')) {
            query.solicitanteEmail = req.usuario.email;
        }
        if (req.query.status) {
            query.statusPedido = { $in: req.query.status.split(',') };
        }
        // CORRIGIDO: Popula os dados do rádio para exibição na lista
        const solicitacoes = await PedidoManutencao.find(query).populate('radios.radioId').sort({ dataSolicitacao: -1 });
        res.json(solicitacoes);
    } catch (error) {
        console.error("Erro em getAllSolicitacoes:", error);
        res.status(500).json({ message: 'Erro interno ao listar solicitações.' });
    }
};

exports.getSolicitacaoById = async (req, res) => {
    try {
        const { id } = req.params;
        let query;

        if (mongoose.Types.ObjectId.isValid(id)) {
            query = { $or: [{ _id: id }, { idPedido: id }] };
        } else {
            query = { idPedido: id };
        }

        // CORRIGIDO: Garante que o populate usa o caminho correto 'radios.radioId'
        const solicitacao = await PedidoManutencao.findOne(query).populate('radios.radioId');

        if (!solicitacao) {
            return res.status(404).json({ message: `Solicitação com ID "${id}" não encontrada.` });
        }
        res.status(200).json(solicitacao);
    } catch (error) {
        console.error("--- ERRO DETALHADO EM 'getSolicitacaoById':", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.darAndamento = async (req, res) => {
    try {
        const { id } = req.params;
        const { idPedido: numeroOS } = req.body;

        if (!numeroOS) {
            return res.status(400).json({ message: 'O número da Ordem de Serviço (OS) é obrigatório.' });
        }
        const osExistente = await PedidoManutencao.findOne({ idPedido: numeroOS });
        if (osExistente) {
            return res.status(409).json({ message: `O número de OS "${numeroOS}" já está em uso.` });
        }

        // CORRIGIDO: Usa a query robusta para encontrar por _id ou idPedido
        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { idPedido: id };
        const pedido = await PedidoManutencao.findOne(query).populate('radios.radioId');

        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }
        if (!pedido.radios || pedido.radios.length === 0 || !pedido.radios[0].radioId) {
            return res.status(404).json({ message: 'Rádio associado a este pedido não foi encontrado.' });
        }
        if (pedido.statusPedido !== 'aberto') {
            return res.status(400).json({ message: `O status do pedido já é "${pedido.statusPedido}".` });
        }

        pedido.idPedido = numeroOS;
        pedido.statusPedido = 'aguardando_manutencao';
        
        const radioParaAtualizar = pedido.radios[0].radioId;
        
        await Radio.updateOne({ _id: radioParaAtualizar._id }, { $set: { status: 'Manutenção' } });
        await pedido.save();

        res.status(200).json({ message: 'Status do pedido atualizado com sucesso.', pedido });
    } catch (error) {
        console.error("Erro detalhado em darAndamento:", error); 
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

// ... As outras funções (iniciar, concluir, etc.) também precisam de ajustes ...
// Abaixo estão as versões corrigidas para as demais funções para garantir consistência.

exports.iniciarManutencao = async (req, res) => {
    try {
        const { id } = req.params; 
        const { tecnicoResponsavel } = req.body;
        if (!tecnicoResponsavel) return res.status(400).json({ message: 'Técnico responsável é obrigatório.' });
        
        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { idPedido: id };
        const pedido = await PedidoManutencao.findOne({ ...query, statusPedido: 'aguardando_manutencao' });
        
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado ou não está aguardando manutenção.' });

        pedido.statusPedido = 'em_manutencao';
        pedido.tecnicoResponsavel = tecnicoResponsavel;
        pedido.dataInicioManutencao = new Date();
        
        await pedido.save();
        
        res.status(200).json({ message: 'Manutenção iniciada.', pedido });
    } catch (error) {
        console.error("Erro em iniciarManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.concluirManutencao = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const { observacoesTecnicas } = req.body;
        
        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { idPedido: id };
        // CORRIGIDO: Adiciona o populate para ter acesso aos dados do rádio
        const pedido = await PedidoManutencao.findOne(query).populate('radios.radioId').session(session);

        if (!pedido) {
            throw new Error('Pedido não encontrado.');
        }

        if (!['aguardando_manutencao', 'em_manutencao'].includes(pedido.statusPedido)) {
            throw new Error(`Este pedido não pode ser concluído pois seu status é "${pedido.statusPedido}".`);
        }

        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || 'Nenhuma observação técnica fornecida.';
        
        // CORRIGIDO: Acessa o rádio através do array 'radios'
        const radioNoPedido = pedido.radios && pedido.radios.length > 0 ? pedido.radios[0] : null;

        if (radioNoPedido && radioNoPedido.status !== 'Condenado') {
            radioNoPedido.status = 'Concluído'; // Atualiza o status no subdocumento
            // Atualiza o documento principal do Rádio para 'Disponível'
            await Radio.updateOne({ _id: radioNoPedido.radioId._id }, { $set: { status: 'Disponível' } }).session(session);
        }
        
        await pedido.save({ session });
        await session.commitTransaction();
        
        res.status(200).json({ message: 'Manutenção concluída.', pedido });
    } catch (error) {
        await session.abortTransaction();
        console.error("Erro em concluirManutencao:", error);
        res.status(500).json({ message: error.message || 'Erro interno do servidor.' });
    } finally {
        session.endSession();
    }
};

// Note que a lógica de `atualizarStatusRadio` e `getEstoqueManutencao` já estava usando a abordagem correta nos seus exemplos.
// Mantive-as aqui para garantir que o arquivo esteja completo.
exports.atualizarStatusRadio = async (req, res) => {
    // Esta função parece complexa e pode precisar de uma revisão mais a fundo,
    // mas o princípio de popular 'radios.radioId' e acessar 'pedido.radios[0]' se aplica.
    // O código abaixo é uma tentativa de correção baseada nesse princípio.
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id, radioSubId } = req.params;
        const { status, motivoCondenacao } = req.body;
        if (!['Concluído', 'Condenado'].includes(status)) {
            return res.status(400).json({ message: 'Status inválido.' });
        }
        if (status === 'Condenado' && !motivoCondenacao) {
            return res.status(400).json({ message: 'O motivo da condenação é obrigatório.' });
        }

        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { idPedido: id };
        const pedido = await PedidoManutencao.findOne(query).session(session);
        if (!pedido) throw new Error('Pedido de manutenção não encontrado.');

        // CORRIGIDO: Acessa o rádio correto no array
        const radioNoPedido = pedido.radios.find(r => r._id.toString() === radioSubId);
        if (!radioNoPedido) {
            throw new Error('Rádio não encontrado neste pedido.');
        }

        radioNoPedido.status = status;
        
        const radioPrincipalId = radioNoPedido.radioId;

        if (status === 'Concluído') {
            await Radio.updateOne({ _id: radioPrincipalId }, { $set: { status: 'Disponível' } }).session(session);
        } else if (status === 'Condenado') {
            const updateFields = {
                motivoCondenacao: motivoCondenacao,
                dataCondenacao: new Date(),
                tecnicoCondenacao: req.usuario._id
            };
            
            await Radio.updateOne({ _id: radioPrincipalId }, {
                $set: {
                    status: 'Condenado', 
                    ativo: false, 
                    ...updateFields,
                    osCondenacao: pedido._id 
                }
            }).session(session);
        }
        
        await finalizarOsSeNecessario(pedido, session);
        await pedido.save({ session }); // Salva as alterações no subdocumento
        
        await session.commitTransaction();
        res.status(200).json({ message: `Status do rádio ${radioNoPedido.numeroSerie} atualizado para ${status}.`, pedido });
    } catch (error) {
        await session.abortTransaction();
        console.error("Erro em atualizarStatusRadio:", error);
        res.status(500).json({ message: 'Erro interno ao atualizar status do rádio.', error: error.message });
    } finally {
        session.endSession();
    }
};

exports.getEstoqueManutencao = async (req, res) => {
    try {
        const radiosEmManutencao = await Radio.find({ status: 'Manutenção', ativo: true }).lean();
        const estoqueDetalhado = await Promise.all(radiosEmManutencao.map(async (radio) => {
            const pedido = await PedidoManutencao.findOne({
                // CORRIGIDO: O caminho da query deve corresponder ao schema
                'radios.radioId': radio._id,
                statusPedido: { $in: ['aberto', 'aguardando_manutencao', 'em_manutencao'] }
            })
            .sort({ dataSolicitacao: -1 })
            .lean();
            
            return { radio, pedido: pedido || {} };
        }));
        res.json(estoqueDetalhado);
    } catch (error) {
        console.error("Erro em getEstoqueManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.getManutencaoHistory = async (req, res) => {
    try {
        // Busca todos os pedidos que estão com status 'finalizado'
        const manutencoesHistorico = await PedidoManutencao.find({ statusPedido: 'finalizado' })
            .populate('radios.radioId') // Popula para mostrar detalhes do rádio
            .sort({ dataFimManutencao: -1 });

        res.json(manutencoesHistorico);
    } catch (error) {
        console.error('Erro ao buscar histórico de manutenções:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.' });
    }
};