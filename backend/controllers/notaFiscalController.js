// backend/controllers/notaFiscalController.js
const NotaFiscal = require('../models/NotaFiscal');
const Radio = require('../models/Radio');

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
        const { nfNumero, dataEntrada, observacoes, radiosRetornados } = req.body;
        if (!nfNumero || !dataEntrada || !Array.isArray(radiosRetornados) || radiosRetornados.length === 0) {
            return res.status(400).json({ message: 'Dados da NF de Entrada incompletos (NF, Data e Rádios são obrigatórios).' });
        }
        const nfSaida = await NotaFiscal.findOne({ nfNumero, tipo: 'Saída' });
        if (!nfSaida) {
            return res.status(404).json({ message: `NF de Saída com o número ${nfNumero} não encontrada.` });
        }
        const radiosJaRetornadosNaSaida = nfSaida.radiosRetornados || [];
        const numerosSerieDesteRetorno = [];
        for (const retorno of radiosRetornados) {
            if (!nfSaida.radios.includes(retorno.numeroSerie)) {
                return res.status(400).json({ message: `O rádio ${retorno.numeroSerie} não pertence à NF de Saída original.` });
            }
            if (radiosJaRetornadosNaSaida.includes(retorno.numeroSerie)) {
                return res.status(400).json({ message: `O rádio ${retorno.numeroSerie} já foi retornado anteriormente para esta NF.` });
            }
            numerosSerieDesteRetorno.push(retorno.numeroSerie);
        }
        const novaNfEntrada = new NotaFiscal({
            nfNumero, tipo: 'Entrada', cliente: nfSaida.cliente, dataEntrada,
            radios: numerosSerieDesteRetorno, observacoes,
            usuarioRegistro: req.usuario.email,
            nfNumeroReferencia: nfNumero // Vincula a NF de entrada à NF de saída original
        });
        await novaNfEntrada.save();
        nfSaida.radiosRetornados.push(...numerosSerieDesteRetorno);
        await nfSaida.save();
        for (const retorno of radiosRetornados) {
            await Radio.updateOne(
                { numeroSerie: retorno.numeroSerie },
                { $set: { status: retorno.statusRetorno, nfAtual: null, tipoLocacaoAtual: null } }
            );
        }
        res.status(201).json({ message: `Retorno (parcial/total) da NF ${nfNumero} registrado com sucesso!`, nf: novaNfEntrada });
    } catch (error) {
        console.error("Erro em createNfEntrada:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao registrar retorno.', error: error.message });
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

exports.getAllNfs = async (req, res) => {
    try {
        const notasFiscais = await NotaFiscal.find().sort({ dataSaida: -1, dataEntrada: -1 });
        res.json(notasFiscais);
    } catch (error) {
        console.error("Erro em getAllNfs:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao listar NFs.', error: error.message });
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