const PedidoManutencao = require('../models/PedidoManutencao');
const Radio = require('../models/Radio');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');

// Função auxiliar para gerar IDs sequenciais
async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findOneAndUpdate(
        { _id: sequenceName },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    );
    return sequenceDocument.sequence_value;
}

async function finalizarOsSeNecessario(pedido) {

    const radioTratado = ['Concluído', 'Condenado'].includes(pedido.radio.status);

    if (radioTratado) {
        pedido.statusPedido = 'finalizado';
        if (!pedido.dataFimManutencao) {
            pedido.dataFimManutencao = new Date();
        }
        await pedido.save();
    }
}


exports.createSolicitacao = async (req, res) => {
    try {
        const { prioridade, radios, observacoesSolicitante } = req.body;
        if (!prioridade || !Array.isArray(radios) || radios.length === 0) {
            return res.status(400).json({ message: 'Prioridade e lista de rádios são obrigatórios.' });
        }

        const pedidosCriados = [];
        // Loop para criar uma OS para cada rádio
        for (const r of radios) {
            const radioNoEstoque = await Radio.findOne({ numeroSerie: r.numeroSerie, ativo: true });
            if (!radioNoEstoque) {
                // Se um rádio falhar, podemos pular ou parar tudo. Vamos pular por enquanto.
                console.error(`Rádio ${r.numeroSerie} não encontrado, pulando...`);
                continue; 
            }
            if (['Manutenção', 'Condenado'].includes(radioNoEstoque.status)) {
                console.error(`Rádio ${r.numeroSerie} já em manutenção, pulando...`);
                continue;
            }

            radioNoEstoque.status = 'Manutenção';
            await radioNoEstoque.save();

            const radioParaPedido = {
                radioId: radioNoEstoque._id,
                numeroSerie: radioNoEstoque.numeroSerie,
                modelo: radioNoEstoque.modelo,
                patrimonio: radioNoEstoque.patrimonio,
                descricaoProblema: r.descricaoProblema,
                status: 'Pendente'
            };

            const idPedido = await getNextSequenceValue('pedidoId');
            const novoPedido = new PedidoManutencao({
                idPedido: `PE${String(idPedido).padStart(6, '0')}`,
                prioridade,
                radio: radioParaPedido, // Agora 'radio', no singular
                solicitanteNome: req.usuario.nome,
                solicitanteEmail: req.usuario.email,
                statusPedido: 'aberto',
                observacoesSolicitante
            });

            await novoPedido.save();
            pedidosCriados.push(novoPedido);
        }

        res.status(201).json({ message: `${pedidosCriados.length} Ordem(ns) de Serviço criada(s) com sucesso!`, pedidos: pedidosCriados });

    } catch (error) {
        console.error("Erro em createSolicitacao:", error);
        res.status(500).json({ message: 'Erro interno ao criar solicitação.', error: error.message });
    }
};

// Obtém o histórico de manutenções finalizadas
exports.getManutencaoHistory = async (req, res) => {
    try {
        const manutencoesHistorico = await PedidoManutencao.find({ statusPedido: 'finalizado' }).sort({ dataFimManutencao: -1, dataSolicitacao: -1 });
        res.json(manutencoesHistorico);
    } catch (error) {
        console.error('Erro ao buscar histórico de manutenções:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.', error: error.message });
    }
};

// Obtém todas as solicitações de manutenção
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


exports.getSolicitacaoById = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido })
            .populate('radio.radioId') 
            .lean();

        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });

        if (pedido.radio && pedido.radio.radioId) {
            const dadosDoEstoque = pedido.radio.radioId;
            pedido.radio = {
                ...dadosDoEstoque,
                ...pedido.radio,
                _id: pedido.radio._id
            };
        }

        res.json(pedido);
    } catch (error) {
        console.error("Erro em getSolicitacaoById:", error);
        res.status(500).json({ message: 'Erro interno ao buscar pedido.', error: error.message });
    }
};


exports.darAndamento = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (pedido.statusPedido !== 'aberto') return res.status(400).json({ message: `O status do pedido é "${pedido.statusPedido}".` });

        pedido.statusPedido = 'aguardando_manutencao';
        await pedido.save();

        // CORREÇÃO: Pega o ID do único rádio, em vez de percorrer uma lista
        const radioId = pedido.radio.radioId;
        await Radio.updateOne({ _id: radioId }, { $set: { status: 'Manutenção' } });

        res.status(200).json({ message: 'Status do pedido atualizado.', pedido });
    } catch (error) {
        console.error("Erro em darAndamento:", error);
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
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado ou não está aguardando manutenção.' });
        res.status(200).json({ message: 'Manutenção iniciada.', pedido });
    } catch (error) {
        console.error("Erro em iniciarManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.concluirManutencao = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const { observacoesTecnicas } = req.body;
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (pedido.statusPedido !== 'em_manutencao') return res.status(400).json({ message: 'Este pedido não está em manutenção.' });

        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || 'Nenhuma observação técnica fornecida.';
        
        // --- LÓGICA CORRIGIDA ---
        // Agora, age sobre o único rádio do pedido
        if (pedido.radio && (pedido.radio.status === 'Pendente' || pedido.radio.status === 'pendente')) {
            pedido.radio.status = 'Concluído';
            // Libera o rádio principal no estoque
            await Radio.updateOne({ _id: pedido.radio.radioId }, { $set: { status: 'Disponível' } });
        }
        // --- FIM DA CORREÇÃO ---
        
        await pedido.save();
        
        res.status(200).json({ message: 'Manutenção concluída.', pedido });
    } catch (error) {
        console.error("Erro em concluirManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

// NOVAS Funções de Ações Individuais
exports.atualizarStatusRadio = async (req, res) => {
    try {
        const { idPedido, radioSubId } = req.params;
        const { status, motivoCondenacao } = req.body;
        if (!['Concluído', 'Condenado'].includes(status)) return res.status(400).json({ message: 'Status inválido.' });
        if (status === 'Condenado' && !motivoCondenacao) return res.status(400).json({ message: 'O motivo da condenação é obrigatório.' });
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) throw new Error('Pedido de manutenção não encontrado.');
        const radioNoPedido = pedido.radios.id(radioSubId);
        if (!radioNoPedido) throw new Error('Rádio não encontrado neste pedido.');
        radioNoPedido.status = status;
        if (status === 'Concluído') {
            await Radio.updateOne({ _id: radioNoPedido.radioId }, { $set: { status: 'Disponível' } });
        } else if (status === 'Condenado') {
            await Radio.updateOne({ _id: radioNoPedido.radioId }, {
                $set: {
                    status: 'Condenado', ativo: false, motivoCondenacao: motivoCondenacao,
                    dataCondenacao: new Date(), tecnicoCondenacao: req.usuario._id, osCondenacao: pedido._id
                }
            });
        }
        await pedido.save();
        await finalizarOsSeNecessario(pedido);
        res.status(200).json({ message: `Status do rádio ${radioNoPedido.numeroSerie} atualizado para ${status}.`, pedido });
    } catch (error) {
        console.error("Erro em atualizarStatusRadio:", error);
        res.status(500).json({ message: 'Erro interno ao atualizar status do rádio.', error: error.message });
    }
};


exports.getEstoqueManutencao = async (req, res) => {
    try {
        const radiosEmManutencao = await Radio.find({ status: 'Manutenção', ativo: true }).lean();
        const estoqueDetalhado = await Promise.all(radiosEmManutencao.map(async (radio) => {
            const pedido = await PedidoManutencao.findOne({
                'radio.radioId': radio._id, // Busca pelo ID do rádio
                statusPedido: { $in: ['aberto', 'aguardando_manutencao', 'em_manutencao'] }
            })
            .select('idPedido tecnicoResponsavel statusPedido') // Seleciona apenas os campos necessários
            .sort({ dataSolicitacao: -1 })
            .lean();
            
            return {
                radio: radio,
                pedido: pedido || {}
            };
        }));
        res.json(estoqueDetalhado);
    } catch (error) {
        console.error("Erro em getEstoqueManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};