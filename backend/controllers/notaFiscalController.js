// backend/controllers/notaFiscalController.js
const mongoose = require('mongoose');
const NotaFiscal = require('../models/NotaFiscal');
const Radio = require('../models/Radio');
// Importe o modelo de PedidoManutencao no topo do arquivo
const PedidoManutencao = require('../models/PedidoManutencao');


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
            radiosRetornados: []
        });
        await novaNf.save();
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
        const { nfNumero, nfNumeroReferencia, radios, observacoes } = req.body;

        if (!nfNumero || !nfNumeroReferencia || !Array.isArray(radios) || radios.length === 0) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
        }

        const nfSaidaOriginal = await NotaFiscal.findOne({ nfNumero: nfNumeroReferencia, tipo: 'Saída' });
        if (!nfSaidaOriginal) {
            return res.status(404).json({ message: `Nota Fiscal de Saída de referência "${nfNumeroReferencia}" não encontrada.` });
        }

        const novaNfEntrada = new NotaFiscal({
            nfNumero,
            tipo: 'Entrada',
            nfNumeroReferencia,
            radios: radios.map(r => r.numeroSerie), // Salva apenas os números de série na NF
            observacoes,
            usuarioRegistro: req.usuario.email
        });

        // Loop para atualizar cada rádio individualmente
        for (const radioInfo of radios) {
            const radioDB = await Radio.findOne({ numeroSerie: radioInfo.numeroSerie });
            if (!radioDB) {
                console.warn(`Rádio com S/N ${radioInfo.numeroSerie} não encontrado no DB durante o retorno.`);
                continue; // Pula para o próximo rádio
            }

            // --- LÓGICA PRINCIPAL ALTERADA ---
            if (radioInfo.status === 'Defeituoso') {
                // 1. Muda o status do rádio principal para 'Manutenção'
                radioDB.status = 'Manutenção';

                // 2. Cria um novo Pedido de Manutenção para este rádio
                const radioParaPedido = {
                    radioId: radioDB._id,
                    numeroSerie: radioDB.numeroSerie,
                    modelo: radioDB.modelo,
                    patrimonio: radioDB.patrimonio,
                    descricaoProblema: radioInfo.descricaoProblema || 'Defeito constatado no retorno da locação.',
                    status: 'Pendente'
                };

                const novoPedido = new PedidoManutencao({
                    prioridade: 'media', // Ou defina uma prioridade padrão
                    radios: [radioParaPedido],
                    solicitanteNome: req.usuario.nome,
                    solicitanteEmail: req.usuario.email,
                    statusPedido: 'aberto',
                    observacoesSolicitante: `Gerado automaticamente pelo retorno da NF de Saída ${nfNumeroReferencia}.`
                });
                await novoPedido.save(); // Salva o novo pedido de manutenção

            } else { // Se o status for 'Bom' ou outro
                radioDB.status = 'Disponível';
            }
            await radioDB.save(); // Salva a alteração de status do rádio

            // Atualiza a NF de Saída original para marcar o rádio como retornado
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

        // Valida se o ID tem o formato correto
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'ID da Nota Fiscal inválido.' });
        }

        const nf = await NotaFiscal.findById(id).lean();

        if (!nf) {
            return res.status(404).json({ message: 'Nota Fiscal não encontrada.' });
        }

        // Como a NF só guarda os números de série, precisamos buscar os detalhes dos rádios
        const radiosComDetalhes = await Promise.all(nf.radios.map(async (numeroSerie) => {
            const radio = await Radio.findOne({ numeroSerie }).lean();
            return radio || { numeroSerie, modelo: 'Não encontrado', patrimonio: 'N/A' };
        }));

        // Retorna a NF com a lista de rádios enriquecida com detalhes
        res.json({ ...nf, radios: radiosComDetalhes });

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