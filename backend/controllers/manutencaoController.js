const PedidoManutencao = require('../models/PedidoManutencao');
const Radio = require('../models/Radio');
const NotaFiscal = require('../models/NotaFiscal');
const mongoose = require('mongoose');
const Movimentacao = require('../models/Movimentacao');

async function finalizarOsSeNecessario(pedido, session) {
    const radioNoPedido = pedido.radios[0];
    if (radioNoPedido && ['Concluído', 'Condenado'].includes(radioNoPedido.status)) {
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
            if (!radioNoEstoque || ['Manutenção', 'Condenado'].includes(radioNoEstoque.status)) {
                console.warn(`Rádio ${r.numeroSerie} indisponível ou não encontrado, será pulado.`);
                continue;
            }
            const radioParaPedido = {
                radioId: radioNoEstoque._id, numeroSerie: radioNoEstoque.numeroSerie, modelo: radioNoEstoque.modelo,
                patrimonio: radioNoEstoque.patrimonio, descricaoProblema: r.descricaoProblema, status: 'Pendente'
            };
            const novoPedido = new PedidoManutencao({
                prioridade, radios: [radioParaPedido], solicitanteNome: req.usuario.nome,
                solicitanteEmail: req.usuario.email, statusPedido: 'aberto', observacoesSolicitante, tipoOS: 'manual'
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
        let query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { idPedido: id }] } : { idPedido: id };
        const solicitacao = await PedidoManutencao.findOne(query).populate('radios.radioId');
        if (!solicitacao) {
            return res.status(404).json({ message: `Solicitação com ID "${id}" não encontrada.` });
        }
        res.status(200).json(solicitacao);
    } catch (error) {
        console.error("Erro em getSolicitacaoById:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.darAndamento = async (req, res) => {
    try {
        const { id } = req.params;
        const { tipoOS, idPedido } = req.body;
        let numeroOS;

        if (tipoOS === 'automatica') {
            const ultimoPedidoAutomatico = await PedidoManutencao.findOne({ tipoOS: 'automatica' }).sort({ idPedido: -1 });
            let proximoNumero = 150000;
            if (ultimoPedidoAutomatico && ultimoPedidoAutomatico.idPedido) {
                const ultimoNumero = parseInt(ultimoPedidoAutomatico.idPedido);
                proximoNumero = Math.max(ultimoNumero + 1, 150000);
            }
            numeroOS = proximoNumero.toString();
        } else {
            if (!idPedido) {
                return res.status(400).json({ message: 'O número da Ordem de Serviço (OS) é obrigatório.' });
            }
            numeroOS = idPedido;
        }
        const osExistente = await PedidoManutencao.findOne({ idPedido: numeroOS });
        if (osExistente) {
            return res.status(409).json({ message: `O número de OS "${numeroOS}" já está em uso.` });
        }
        const pedido = await PedidoManutencao.findById(id).populate('radios.radioId');
        if (!pedido || pedido.statusPedido !== 'aberto' || !pedido.radios || pedido.radios.length === 0 || !pedido.radios[0].radioId) {
            return res.status(404).json({ message: 'Pedido inválido ou não encontrado.' });
        }
        pedido.idPedido = numeroOS;
        pedido.statusPedido = 'aguardando_manutencao';
        pedido.tipoOS = tipoOS;
        const radioParaAtualizar = pedido.radios[0].radioId;
        await Radio.updateOne({ _id: radioParaAtualizar._id }, { $set: { status: 'Manutenção' } });
        await pedido.save();
        res.status(200).json({ message: `Status do pedido atualizado para a OS: ${numeroOS}`, pedido });
    } catch (error) {
        console.error("Erro detalhado em darAndamento:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

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
    try {
        const { id } = req.params;
        const { observacoesTecnicas } = req.body;
        const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { idPedido: id };
        const pedido = await PedidoManutencao.findOne(query);

        if (!pedido) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
        if (!['aguardando_manutencao', 'em_manutencao'].includes(pedido.statusPedido)) {
            return res.status(400).json({ message: `Este pedido não pode ser concluído pois seu status é "${pedido.statusPedido}".` });
        }

        if (pedido.origemNF) {
            res.status(200).json({
                message: 'Ação necessária: Rádio pertence a uma NF de Saída.',
                decisaoNecessaria: true,
                pedido: pedido
            });
        } else {
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                pedido.statusPedido = 'finalizado';
                pedido.dataFimManutencao = new Date();
                pedido.observacoesTecnicas = observacoesTecnicas || 'Nenhuma observação técnica fornecida.';
                const radioNoPedido = pedido.radios[0];
                if (radioNoPedido && radioNoPedido.status !== 'Condenado') {
                    radioNoPedido.status = 'Concluído';
                    await Radio.updateOne({ _id: radioNoPedido.radioId }, { $set: { status: 'Disponível', nfAtual: null, tipoLocacaoAtual: null } }, { session });
                }
                await pedido.save({ session });
                await session.commitTransaction();
                res.status(200).json({ message: 'Manutenção concluída com sucesso.', pedido });
            } catch (error) {
                await session.abortTransaction();
                throw error;
            } finally {
                session.endSession();
            }
        }
    } catch (error) {
        console.error("Erro em concluirManutencao:", error);
        res.status(500).json({ message: error.message || 'Erro interno do servidor.' });
    }
};

exports.retornarRadioParaNF = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { idPedido } = req.params;
        const { observacoesTecnicas } = req.body;
        const pedido = await PedidoManutencao.findOne({ idPedido }).session(session);
        if (!pedido || !pedido.origemNF) {
            throw new Error('Pedido inválido ou não pertence a uma NF de Saída.');
        }
        const radioNoPedido = pedido.radios[0];
        const nfOrigem = await NotaFiscal.findOne({ nfNumero: pedido.origemNF, tipo: 'Saída' }).session(session);
        if (!nfOrigem) {
            console.warn(`NF de Saída ${pedido.origemNF} não encontrada. Movendo rádio ${radioNoPedido.numeroSerie} para o estoque.`);
            return exports.retornarRadioParaEstoque(req, res);
        }
        await Radio.updateOne({ _id: radioNoPedido.radioId }, { $set: { status: 'Ocupado', nfAtual: nfOrigem.nfNumero } }, { session });
        nfOrigem.radiosRetornados = nfOrigem.radiosRetornados.filter(sn => sn !== radioNoPedido.numeroSerie);
        await nfOrigem.save({ session });
        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || 'Rádio consertado e devolvido à locação original.';
        radioNoPedido.status = 'Concluído';
        await pedido.save({ session });
         await Movimentacao.create([{
            nfId: nfOrigem._id,
            pedidoManutencaoId: pedido._id,
            radioNumeroSerie: radioNoPedido.numeroSerie,
            tipo: 'Retorno Manutenção (para NF)',
            descricao: `Rádio retornou da manutenção (OS ${idPedido}) e voltou para a locação do cliente ${nfOrigem.cliente}.`,
            usuarioNome: req.usuario.nome
        }], { session });
        await session.commitTransaction();
        res.status(200).json({ message: `Rádio retornado para a NF ${pedido.origemNF} com sucesso.` });
    } catch (error) {
        await session.abortTransaction();
        console.error("Erro em retornarRadioParaNF:", error);
        res.status(500).json({ message: error.message || 'Erro interno.' });
    } finally {
        session.endSession();
    }
};

exports.retornarRadioParaEstoque = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { idPedido } = req.params;
        const { observacoesTecnicas } = req.body;
        
        const pedido = await PedidoManutencao.findOne({ idPedido }).session(session);
        if (!pedido) {
            throw new Error('Pedido não encontrado.');
        }

        const radioNoPedido = pedido.radios[0];
        
        // --- LÓGICA DE HISTÓRICO ADICIONADA AQUI ---
        let nfOrigem = null;
        if (pedido.origemNF) {
            nfOrigem = await NotaFiscal.findOne({ nfNumero: pedido.origemNF, tipo: 'Saída' }).session(session);
            if (nfOrigem) {
                nfOrigem.radiosRemovidos.push({
                    numeroSerie: radioNoPedido.numeroSerie,
                    dataRemocao: new Date(),
                    motivo: `Movido para o estoque após manutenção na OS ${idPedido}.`
                });
                await nfOrigem.save({ session });
            }
        }
        // --- FIM DA LÓGICA ---

        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || 'Rádio consertado e movido para o estoque de disponíveis.';
        
        if (radioNoPedido && radioNoPedido.status !== 'Condenado') {
            radioNoPedido.status = 'Concluído';
            await Radio.updateOne({ _id: radioNoPedido.radioId }, { 
                $set: { 
                    status: 'Disponível', 
                    nfAtual: null, 
                    tipoLocacaoAtual: null
                } 
            }, { session });
        }
        
        await pedido.save({ session });

        // --- REGISTRO DE HISTÓRICO ---
        if (nfOrigem) { // Só registra se a NF de origem ainda existir
            await Movimentacao.create([{
                nfId: nfOrigem._id,
                pedidoManutencaoId: pedido._id,
                radioNumeroSerie: radioNoPedido.numeroSerie,
                tipo: 'Remoção Estoque (pós-manutenção)',
                descricao: `Rádio foi movido para o estoque após manutenção na OS ${idPedido}.`,
                usuarioNome: req.usuario.nome
            }], { session });
        }
        // --- FIM DO REGISTRO ---

        await session.commitTransaction();
        res.status(200).json({ message: `Rádio movido para o estoque de disponíveis com sucesso.` });

    } catch (error) {
        await session.abortTransaction();
        console.error("Erro em retornarRadioParaEstoque:", error);
        res.status(500).json({ message: error.message || 'Erro interno.' });
    } finally {
        session.endSession();
    }
};

exports.atualizarStatusRadio = async (req, res) => {
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
        
        const radioNoPedido = pedido.radios.find(r => r._id.toString() === radioSubId);
        if (!radioNoPedido) {
            throw new Error('Rádio não encontrado neste pedido.');
        }
        
        radioNoPedido.status = status;
        const radioPrincipalId = radioNoPedido.radioId;

        if (status === 'Concluído') {
            await Radio.updateOne({ _id: radioPrincipalId }, { $set: { status: 'Disponível' } }, { session });
        } else if (status === 'Condenado') {
            const updateFields = {
                motivoCondenacao: motivoCondenacao,
                dataCondenacao: new Date(),
                tecnicoCondenacao: req.usuario.id
            };
            await Radio.updateOne({ _id: radioPrincipalId }, {
                $set: {
                    status: 'Condenado', ativo: false, ...updateFields, osCondenacao: pedido._id
                }
            }).session(session);

            // --- LÓGICA DE HISTÓRICO (AGORA CORRETA) ---
            if (pedido.origemNF) { 
                const nfOrigem = await NotaFiscal.findOne({ nfNumero: pedido.origemNF }).session(session);
                if (nfOrigem) {
                    const novaMovimentacao = new Movimentacao({
                        nfId: nfOrigem._id,
                        pedidoManutencaoId: pedido._id,
                        radioNumeroSerie: radioNoPedido.numeroSerie,
                        tipo: 'Condenado',
                        descricao: `Rádio ${radioNoPedido.numeroSerie} foi condenado na OS ${pedido.idPedido}.`,
                        usuarioNome: req.usuario.nome
                    });
                    await novaMovimentacao.save({ session });
                }
            }
            // --- FIM DA LÓGICA DE HISTÓRICO ---
        }
        
        await finalizarOsSeNecessario(pedido, session);
        await pedido.save({ session });
        
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
                'radios.radioId': radio._id,
                statusPedido: { $in: ['aberto', 'aguardando_manutencao', 'em_manutencao'] }
            }).sort({ dataSolicitacao: -1 }).lean();
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
        const manutencoesHistorico = await PedidoManutencao.find({ statusPedido: 'finalizado' })
            .populate('radios.radioId')
            .sort({ dataFimManutencao: -1 });
        res.json(manutencoesHistorico);
    } catch (error) {
        console.error('Erro ao buscar histórico de manutenções:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.' });
    }
};