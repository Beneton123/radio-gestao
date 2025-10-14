// backend/controllers/notaFiscalController.js
const mongoose = require('mongoose');
const NotaFiscal = require('../models/NotaFiscal');
const Radio = require('../models/Radio');
const PedidoManutencao = require('../models/PedidoManutencao');
const Usuario = require('../models/Usuario');
const Movimentacao = require('../models/Movimentacao');

// --- CORREÇÃO APLICADA AQUI ---
exports.createNfSaida = async (req, res) => {
    try {
        const { nfNumero, cliente, dataSaida, previsaoRetorno, radios, observacoes, tipoLocacao } = req.body;
        if (!nfNumero || !cliente || !dataSaida || !Array.isArray(radios) || radios.length === 0 || !tipoLocacao) {
            return res.status(400).json({ message: 'Dados da NF de Saída incompletos ou inválidos.' });
        }
        if (!['Mensal', 'Anual'].includes(tipoLocacao)) {
            return res.status(400).json({ message: 'Tipo de Locação inválido.' });
        }
        const nfExistente = await NotaFiscal.findOne({ nfNumero, tipo: 'Saída' });
        if (nfExistente) {
            return res.status(409).json({ message: `Já existe uma NF de Saída com o número ${nfNumero}.` });
        }

        const radiosNaoEncontradosOuIndisponiveis = [];
        for (const numeroSerie of radios) {
            const radio = await Radio.findOne({ numeroSerie });
            if (!radio) {
                radiosNaoEncontradosOuIndisponiveis.push({ numeroSerie, problema: 'não encontrado' });
            } else if (radio.status !== 'Disponível') {
                radiosNaoEncontradosOuIndisponiveis.push({ numeroSerie, problema: `status "${radio.status}"`, nfAtual: radio.nfAtual });
            }
        }
        if (radiosNaoEncontradosOuIndisponiveis.length > 0) {
            return res.status(400).json({ message: 'Problemas com os rádios selecionados', detalhes: radiosNaoEncontradosOuIndisponiveis });
        }

        const novaNf = new NotaFiscal({
            nfNumero, tipo: 'Saída', cliente, dataSaida, previsaoRetorno, radios, observacoes,
            usuarioRegistro: req.usuario.email,
            tipoLocacao,
            radiosRetornados: [],
            radiosRemovidos: [] // Garante que o array exista na criação
        });
        await novaNf.save();

        // --- INÍCIO DA NOVA LÓGICA DE HISTÓRICO ---
        // Para cada rádio na nova NF, criamos um registro de movimentação
        const movimentacoes = radios.map(numeroSerie => ({
            nfId: novaNf._id,
            radioNumeroSerie: numeroSerie,
            tipo: 'Criação NF',
            descricao: `Rádio adicionado à NF de Saída ${nfNumero} para o cliente ${cliente}.`,
            usuarioNome: req.usuario.nome // Usando o nome do usuário do token
        }));

        // Salva todos os novos registros de movimentação no banco de dados
        await Movimentacao.insertMany(movimentacoes);
        // --- FIM DA NOVA LÓGICA DE HISTÓRICO ---

        await Radio.updateMany(
            { numeroSerie: { $in: radios } },
            { $set: { status: 'Ocupado', nfAtual: nfNumero, ultimaNfSaida: nfNumero, tipoLocacaoAtual: tipoLocacao } }
        );
        res.status(201).json({ message: 'NF de Saída registrada com sucesso!', nf: novaNf });
    } catch (error) {
        console.error("Erro em createNfSaida:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.createNfEntrada = async (req, res) => {
    try {
        // Agora recebemos também o tipoNumero do frontend
        const { tipoNumero, nfNumero, nfNumeroReferencia, radios, observacoes } = req.body;
        let numeroFinalNF;

        // --- INÍCIO DA NOVA LÓGICA DE GERAÇÃO DE NÚMERO ---
        if (tipoNumero === 'automatica') {
            const ultimaNFAutomatica = await NotaFiscal.findOne({
                tipo: 'Entrada',
                tipoNumero: 'automatica'
            }).sort({ nfNumero: -1 }); // Ordena numericamente para pegar o maior

            let proximoNumero = 1000000;
            if (ultimaNFAutomatica && parseInt(ultimaNFAutomatica.nfNumero) >= 1000000) {
                proximoNumero = parseInt(ultimaNFAutomatica.nfNumero) + 1;
            }
            numeroFinalNF = proximoNumero.toString();
        } else { // Se for manual
            if (!nfNumero) {
                return res.status(400).json({ message: 'O número da NF de Entrada é obrigatório no modo manual.' });
            }
            numeroFinalNF = nfNumero;
        }
        // --- FIM DA NOVA LÓGICA ---

        if (!nfNumeroReferencia || !Array.isArray(radios) || radios.length === 0) {
            return res.status(400).json({ message: 'NF de Referência e Rádios são obrigatórios.' });
        }
        
        const nfExistente = await NotaFiscal.findOne({ nfNumero: numeroFinalNF, tipo: 'Entrada' });
        if (nfExistente) {
            return res.status(409).json({ message: `Já existe uma NF de Entrada com o número ${numeroFinalNF}.` });
        }

        const nfSaidaOriginal = await NotaFiscal.findOne({ nfNumero: nfNumeroReferencia, tipo: 'Saída' });
        if (!nfSaidaOriginal) {
            return res.status(404).json({ message: `Nota Fiscal de Saída de referência "${nfNumeroReferencia}" não encontrada.` });
        }

        const novaNfEntrada = new NotaFiscal({
            nfNumero: numeroFinalNF, // Usa o número final gerado
            tipoNumero: tipoNumero, // Salva o tipo (manual ou automatica)
            tipo: 'Entrada',
            nfNumeroReferencia,
            radios: radios.map(r => r.numeroSerie),
            observacoes,
            usuarioRegistro: req.usuario.email
        });

        // O resto da sua função continua exatamente igual
        for (const radioInfo of radios) {
            const radioDB = await Radio.findOne({ numeroSerie: radioInfo.numeroSerie });
            if (!radioDB) {
                console.warn(`Rádio com S/N ${radioInfo.numeroSerie} não encontrado no DB.`);
                continue;
            }
            if (radioInfo.status === 'Defeituoso') {
                radioDB.status = 'Manutenção';
                const radioParaPedido = {
                    radioId: radioDB._id, numeroSerie: radioDB.numeroSerie, modelo: radioDB.modelo,
                    patrimonio: radioDB.patrimonio,
                    descricaoProblema: radioInfo.descricaoProblema || 'Defeito não informado no retorno.',
                    status: 'Pendente'
                };
                const novoPedido = new PedidoManutencao({
                    prioridade: 'media', radios: [radioParaPedido], solicitanteNome: req.usuario.nome,
                    solicitanteEmail: req.usuario.email, statusPedido: 'aberto',
                    origemNF: nfNumeroReferencia, clienteNome: nfSaidaOriginal.cliente,
                    observacoesSolicitante: `Pedido gerado automaticamente do retorno da NF de Saída.`
                });
                await novoPedido.save();

                const novaMovimentacao = new Movimentacao({
    nfId: nfSaidaOriginal._id,
    radioNumeroSerie: radioInfo.numeroSerie,
    pedidoManutencaoId: novoPedido._id,
    tipo: 'Envio Manutenção',
    descricao: `Rádio enviado para manutenção na OS ${novoPedido.idPedido || ''} pelo usuário ${req.usuario.nome}.`,
    usuarioNome: req.usuario.nome
});
await novaMovimentacao.save();

            } else {
                radioDB.status = 'Disponível';
                radioDB.nfAtual = null;
                radioDB.tipoLocacaoAtual = null;

const novaMovimentacao = new Movimentacao({
        nfId: nfSaidaOriginal._id,
        radioNumeroSerie: radioInfo.numeroSerie,
        tipo: 'Retorno (OK)',
        descricao: `Rádio retornado para o estoque após locação pelo usuário ${req.usuario.nome}.`,
        usuarioNome: req.usuario.nome
    });
    await novaMovimentacao.save();
    // --- FIM DA ADIÇÃO ---
}
            await radioDB.save();
            if (!nfSaidaOriginal.radiosRetornados.includes(radioInfo.numeroSerie)) {
                nfSaidaOriginal.radiosRetornados.push(radioInfo.numeroSerie);
            }
        }

        await novaNfEntrada.save();
        await nfSaidaOriginal.save();
        res.status(201).json({ message: 'Nota Fiscal de Entrada registrada com sucesso!', nf: novaNfEntrada });

    } catch (error) {
        console.error("Erro em createNfEntrada:", error);
        res.status(500).json({ message: 'Erro interno do servidor.', error: error.message });
    }
};

exports.alterarNf = async (req, res) => {
    try {
        const { id } = req.params;
        const { novoRadioNumeroSerie, novaObservacao } = req.body;

        if (!novoRadioNumeroSerie && !novaObservacao) {
            return res.status(400).json({ message: 'Nenhuma alteração fornecida.' });
        }

        const nf = await NotaFiscal.findById(id);
        if (!nf) {
            return res.status(404).json({ message: 'Nota Fiscal não encontrada.' });
        }

        // Lógica para adicionar um novo rádio
        if (novoRadioNumeroSerie) {
            if (nf.tipo !== 'Saída') {
                return res.status(400).json({ message: 'Rádios só podem ser adicionados a uma NF de Saída.' });
            }

            const radio = await Radio.findOne({ numeroSerie: novoRadioNumeroSerie });
            if (!radio) {
                return res.status(404).json({ message: `Rádio com S/N ${novoRadioNumeroSerie} não encontrado.` });
            }
            if (radio.status !== 'Disponível') {
                return res.status(409).json({ message: `Rádio ${novoRadioNumeroSerie} não está disponível (status: ${radio.status}).` });
            }

            // Adiciona o rádio à NF e atualiza o status do rádio
            nf.radios.push(novoRadioNumeroSerie);
            radio.status = 'Ocupado';
            radio.nfAtual = nf.nfNumero;
            await radio.save();

            const novaMovimentacao = new Movimentacao({
            nfId: nf._id,
            radioNumeroSerie: novoRadioNumeroSerie,
            tipo: 'Adição de Rádio',
            descricao: `Rádio ${novoRadioNumeroSerie} foi adicionado a esta NF pelo usuário ${req.usuario.nome}.`,
            usuarioNome: req.usuario.nome
        });
        await novaMovimentacao.save();
        }

        // Lógica para adicionar uma nova observação
        if (novaObservacao) {
            nf.observacoes.push(novaObservacao);
        }

        await nf.save();
        res.json({ message: 'Nota Fiscal atualizada com sucesso!', nf });

    } catch (error) {
        console.error("Erro em alterarNf:", error);
        res.status(500).json({ message: 'Erro interno ao alterar a NF.' });
    }
};

exports.getNfByNumero = async (req, res) => {
    try {
        const { nfNumero } = req.params;
        const nfSaida = await NotaFiscal.findOne({ nfNumero, tipo: 'Saída' }).lean();
        if (!nfSaida) return res.status(404).json({ message: `Nota Fiscal de Saída com número ${nfNumero} não encontrada.` });

        const retornosParciais = await NotaFiscal.find({ nfNumeroReferencia: nfNumero, tipo: 'Entrada' }).sort({ dataEntrada: 1 }).lean();

        const radiosComDetalhes = await Promise.all(nfSaida.radios.map(async (numeroSerie) => {
            const radio = await Radio.findOne({ numeroSerie }).select('modelo patrimonio frequencia numeroSerie');
            return radio ? radio.toObject() : { numeroSerie, modelo: 'N/A', patrimonio: 'N/A' };
        }));

        res.json({ ...nfSaida, radios: radiosComDetalhes, retornosParciais });
    } catch (error) {
        console.error("Erro em getNfByNumero:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar NF.', error: error.message });
    }
};


exports.getAllNotasFiscais = async (req, res) => {
    try {
        // 1. Busca todas as NFs do banco, da mais nova para a mais antiga
        const notasFiscais = await NotaFiscal.find({}).sort({ createdAt: -1 }).lean(); // .lean() para performance

        // 2. Adiciona o campo de status virtual para cada NF
        const notasComStatus = notasFiscais.map(nf => {
            let statusNF = 'Aberta'; // Padrão é 'Aberta'

            if (nf.tipo === 'Entrada') {
                statusNF = 'Finalizada';
            } else if (nf.tipo === 'Saída') {
                // Compara o tamanho do array de rádios que saíram com o de retornados
                if (nf.radios.length === (nf.radiosRetornados || []).length) {
                    statusNF = 'Finalizada';
                }
            }
            
            // Retorna um novo objeto com todos os dados da NF + o novo campo de status
            return { ...nf, statusNF };
        });

        res.json(notasComStatus);

    } catch (error) {
        console.error("Erro em getAllNotasFiscais:", error);
        res.status(500).json({ message: 'Erro interno ao buscar notas fiscais.' });
    }
};


exports.getNfById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'ID da Nota Fiscal inválido.' });
        }

        const nf = await NotaFiscal.findById(id).lean();
        if (!nf) {
            return res.status(404).json({ message: 'Nota Fiscal não encontrada.' });
        }

        const usuario = await Usuario.findOne({ email: nf.usuarioRegistro }).lean();
        const nomeUsuario = usuario ? usuario.nome : nf.usuarioRegistro;

        let statusNF = 'Aberta';
        // Lógica de statusNF atualizada para contar os removidos
        if (nf.tipo === 'Entrada' || ((nf.radios?.length || 0) === (nf.radiosRetornados?.length || 0) + (nf.radiosRemovidos?.length || 0))) {
            statusNF = 'Finalizada';
        }

        // LÓGICA DE FILTRO QUE FAZ O RÁDIO SUMIR
        const seriesRemovidas = (nf.radiosRemovidos || []).map(r => r.numeroSerie);
        const radiosVisiveis = (nf.radios || []).filter(numeroSerie => !seriesRemovidas.includes(numeroSerie));

        const radiosComDetalhes = await Promise.all(radiosVisiveis.map(async (numeroSerie) => {
            const radio = await Radio.findOne({ numeroSerie }).lean();
            if (!radio) {
                return { numeroSerie, modelo: 'NÃO ENCONTRADO', patrimonio: 'N/A' };
            }
            const foiRetornado = (nf.radiosRetornados || []).includes(numeroSerie);
            let osAtual = null;
            let retornoInfo = null;
            if (foiRetornado) {
                if (radio.status === 'Manutenção') {
                    const pedido = await PedidoManutencao.findOne({
                        'radios.numeroSerie': numeroSerie,
                        statusPedido: { $ne: 'finalizado' }
                    }).sort({ createdAt: -1 }).lean();
                    if (pedido) {
                        osAtual = pedido.idPedido || `(OS Aberta)`;
                    }
                }
                const nfEntrada = await NotaFiscal.findOne({
                    tipo: 'Entrada',
                    nfNumeroReferencia: nf.nfNumero,
                    radios: numeroSerie
                }).lean();
                if (nfEntrada) {
                    retornoInfo = {
                        nfNumero: nfEntrada.nfNumero,
                        data: new Date(nfEntrada.createdAt).toLocaleDateString('pt-BR')
                    };
                }
            }
            return { ...radio, foiRetornado, osAtual, retornoInfo };
        }));
        
        res.json({ ...nf, usuarioRegistro: nomeUsuario, statusNF, radios: radiosComDetalhes });

    } catch (error) {
        console.error("Erro em getNfById:", error);
        res.status(500).json({ message: 'Erro interno ao buscar detalhes da NF.' });
    }
};

// NOVAS FUNÇÕES EXPORTADAS PARA O HISTÓRICO
exports.getNfsSaida = async (req, res) => {
    try {
        const notasFiscais = await NotaFiscal.find({ tipo: 'Saída' }).sort({ dataSaida: -1 });
        res.json(notasFiscais);
    } catch (error) {
        console.error("Erro em getNfsSaida:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.getNfsEntrada = async (req, res) => {
    try {
        const notasFiscais = await NotaFiscal.find({ tipo: 'Entrada' }).sort({ dataEntrada: -1 });
        res.json(notasFiscais);
    } catch (error) {
        console.error("Erro em getNfsEntrada:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.getMovimentacoesPorNf = async (req, res) => {
    try {
        const { id } = req.params; // ID da Nota Fiscal

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'ID da Nota Fiscal inválido.' });
        }
        
        // Busca todas as movimentações associadas a este nfId, da mais recente para a mais antiga
        const movimentacoes = await Movimentacao.find({ nfId: id }).sort({ data: -1 });

        res.status(200).json(movimentacoes);

    } catch (error) {
        console.error("Erro em getMovimentacoesPorNf:", error);
        res.status(500).json({ message: 'Erro interno ao buscar movimentações da NF.' });
    }
};