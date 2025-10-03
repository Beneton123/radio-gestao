// SUBSTITUA TODO O CONTEÚDO DO ARQUIVO POR ESTE CÓDIGO
const PedidoManutencao = require('../models/PedidoManutencao');
const Radio = require('../models/Radio');
const Counter = require('../models/Counter');
const mongoose = require('mongoose');

async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findOneAndUpdate(
        { _id: sequenceName },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    );
    return sequenceDocument.sequence_value;
}

// Função auxiliar foi ajustada para receber a sessão do mongoose (transação)
async function finalizarOsSeNecessario(pedido, session) {
    const radioTratado = ['Concluído', 'Condenado'].includes(pedido.radio.status);

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
                console.error(`Rádio ${r.numeroSerie} não encontrado, pulando...`);
                continue;
            }
            if (['Manutenção', 'Condenado'].includes(radioNoEstoque.status)) {
                console.error(`Rádio ${r.numeroSerie} já em manutenção ou condenado, pulando...`);
                continue;
            }

            radioNoEstoque.status = 'Manutenção';
            await radioNoEstoque.save();

            const radioParaPedido = {
                radioId: radioNoEstoque._id,
                numeroSerie: radioNoEstoque.numeroSerie,
                modelo: radioNoEstoque.modelo,
                patrimonio: radioNoEstoque.patrimonio,
                frequencia: radioNoEstoque.frequencia,
                descricaoProblema: r.descricaoProblema,
                status: 'Pendente'
            };

            const idPedido = await getNextSequenceValue('pedidoId');
            const novoPedido = new PedidoManutencao({
                idPedido: `PE${String(idPedido).padStart(6, '0')}`,
                prioridade,
                radio: radioParaPedido,
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

exports.getManutencaoHistory = async (req, res) => {
    try {
        const manutencoesHistorico = await PedidoManutencao.find({ statusPedido: 'finalizado' }).sort({ dataFimManutencao: -1 });
        res.json(manutencoesHistorico);
    } catch (error) {
        console.error('Erro ao buscar histórico de manutenções:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar histórico.' });
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
        console.error("Erro em getAllSolicitacoes:", error);
        res.status(500).json({ message: 'Erro interno ao listar solicitações.' });
    }
};

exports.getSolicitacaoById = async (req, res) => {
        console.log(`--- 4. BUSCANDO DETALHES PARA O PEDIDO: ${req.params.idPedido} ---`); // LOG 4

    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido })
            .populate('radio.radioId')
            .lean();

        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        console.log('--- 5. DADOS VINDOS DO BANCO (ANTES DE MESCLAR):', JSON.stringify(pedido, null, 2)); // LOG 5

        // **CORREÇÃO APLICADA AQUI**
        // A ordem da mesclagem foi invertida para priorizar dados do estoque (mais recentes)
        if (pedido.radio && pedido.radio.radioId) {
            const dadosDoEstoque = pedido.radio.radioId;
            pedido.radio = {
                ...pedido.radio,    // Dados da OS (ex: descricaoProblema)
                ...dadosDoEstoque,  // Dados do Estoque (ex: status atualizado)
                _id: pedido.radio._id // Mantém o ID do subdocumento
            };
        }
        console.log('--- 6. DADOS FINAIS ENVIADOS PARA O FRONTEND:', JSON.stringify(pedido, null, 2)); // LOG 6

        res.json(pedido);
    } catch (error) {
                console.error("--- ERRO DETALHADO EM 'getSolicitacaoById':", error); // LOG DE ERRO


        res.status(500).json({ message: 'Erro interno ao buscar pedido.', error: error.message });
    }
};

exports.darAndamento = async (req, res) => {
        console.log(`--- 1. INICIANDO 'darAndamento' PARA O PEDIDO: ${req.params.idPedido} ---`); // LOG 1

    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado.' });
        if (pedido.statusPedido !== 'aberto') return res.status(400).json({ message: `O status do pedido é "${pedido.statusPedido}".` });
console.log('--- 2. DADOS ANTES DE SALVAR:', { statusPedido: pedido.statusPedido, radioStatus: pedido.radio.status }); // LOG 2
        // **CORREÇÃO APLICADA AQUI**
        // Atualiza o status do rádio DENTRO do pedido e também na coleção principal.
        pedido.statusPedido = 'aguardando_manutencao';
        pedido.radio.status = 'Manutenção'; // Atualiza o subdocumento
        await pedido.save();
  console.log('--- 3. DADOS SALVOS NO BANCO COM SUCESSO! ---'); // LOG 3
        await Radio.updateOne({ _id: pedido.radio.radioId }, { $set: { status: 'Manutenção' } });

        res.status(200).json({ message: 'Status do pedido atualizado.', pedido });
    } catch (error) {
                console.error("--- ERRO DETALHADO EM 'darAndamento':", error); // LOG DE ERRO

        console.error("Erro em darAndamento:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.iniciarManutencao = async (req, res) => {
    try {
        const { idPedido } = req.params;
        const { tecnicoResponsavel } = req.body;
        if (!tecnicoResponsavel) return res.status(400).json({ message: 'Técnico responsável é obrigatório.' });
        
        const pedido = await PedidoManutencao.findOne({ idPedido, statusPedido: 'aguardando_manutencao' });
        
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
        const { idPedido } = req.params;
        const { observacoesTecnicas } = req.body;
        const pedido = await PedidoManutencao.findOne({ idPedido }).session(session);
        if (!pedido) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }

        // REGRA CORRIGIDA: Permite concluir se estiver aguardando OU em manutenção.
        if (!['aguardando_manutencao', 'em_manutencao'].includes(pedido.statusPedido)) {
            return res.status(400).json({ message: `Este pedido não pode ser concluído pois seu status é "${pedido.statusPedido}".` });
        }

        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || 'Nenhuma observação técnica fornecida.';
        
        // Se o rádio não foi condenado, ele é concluído e liberado no estoque.
        if (pedido.radio && pedido.radio.status !== 'Condenado') {
            pedido.radio.status = 'Concluído';
            await Radio.updateOne({ _id: pedido.radio.radioId }, { $set: { status: 'Disponível' } }).session(session);
        }
        
        await pedido.save({ session });
        await session.commitTransaction();
        
        res.status(200).json({ message: 'Manutenção concluída.', pedido });
    } catch (error) {
        await session.abortTransaction();
        console.error("Erro em concluirManutencao:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    } finally {
        session.endSession();
    }
};

// AÇÃO: Substitua a função inteira no arquivo controllers/manutencaoController.js

exports.atualizarStatusRadio = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { idPedido, radioSubId } = req.params;
        const { status, motivoCondenacao } = req.body;
        if (!['Concluído', 'Condenado'].includes(status)) return res.status(400).json({ message: 'Status inválido.' });
        if (status === 'Condenado' && !motivoCondenacao) return res.status(400).json({ message: 'O motivo da condenação é obrigatório.' });

        const pedido = await PedidoManutencao.findOne({ idPedido }).session(session);
        if (!pedido) throw new Error('Pedido de manutenção não encontrado.');

        const radioNoPedido = pedido.radio;
        if (!radioNoPedido || radioNoPedido._id.toString() !== radioSubId) {
            throw new Error('Rádio não encontrado neste pedido.');
        }

        radioNoPedido.status = status;
        
        if (status === 'Concluído') {
            await Radio.updateOne({ _id: radioNoPedido.radioId }, { $set: { status: 'Disponível' } }).session(session);
        } else if (status === 'Condenado') {
            radioNoPedido.motivoCondenacao = motivoCondenacao;
            radioNoPedido.dataCondenacao = new Date();
            radioNoPedido.tecnicoCondenacao = req.usuario._id; // <-- CORREÇÃO #1
            
            await Radio.updateOne({ _id: radioNoPedido.radioId }, {
                $set: {
                    status: 'Condenado', 
                    ativo: false, 
                    motivoCondenacao: motivoCondenacao,
                    dataCondenacao: new Date(), 
                    tecnicoCondenacao: req.usuario._id, // <-- CORREÇÃO #2
                    osCondenacao: pedido._id 
                }
            }).session(session);
        }
        
        await finalizarOsSeNecessario(pedido, session);
        
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
                'radio.radioId': radio._id,
                statusPedido: { $in: ['aberto', 'aguardando_manutencao', 'em_manutencao'] }
            })
            .select('idPedido tecnicoResponsavel statusPedido')
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