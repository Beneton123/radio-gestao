// backend/controllers/radioController.js
const Radio = require('../models/Radio');
const RadioExcluido = require('../models/RadioExcluido'); // Garanta que esta linha existe e o modelo está definido!
const Modelo = require('../models/Modelo'); 

exports.createRadio = async (req, res) => {
    try {
        const { modelo, numeroSerie, patrimonio, frequencia } = req.body;
        if (!modelo || !numeroSerie || !frequencia) {
            return res.status(400).json({ message: 'Modelo, Número de Série e Frequência são obrigatórios.' });
        }
        const modeloFormatado = modelo.trim().toUpperCase();
        const modeloExistente = await Modelo.findOne({ nome: modeloFormatado });
        if (!modeloExistente) {
            return res.status(400).json({ message: `O modelo "${modelo}" não é válido. Cadastre o modelo primeiro.` });
        }
        const radioExistente = await Radio.findOne({ numeroSerie });
        if (radioExistente) {
            return res.status(409).json({ message: 'Já existe um rádio com este número de série.' });
        }
        const novoRadio = new Radio({ modelo: modeloExistente.nome, numeroSerie, patrimonio, frequencia });
        await novoRadio.save();
        res.status(201).json({ message: 'Rádio cadastrado com sucesso!', radio: novoRadio });
    } catch (error) {
        console.error("Erro em createRadio:", error);
        res.status(500).json({ message: 'Erro interno ao cadastrar rádio.', error: error.message });
    }
};

exports.getAllRadios = async (req, res) => {
    try {
        const { status, nfAtual, search } = req.query;
        let query = {};
        if (status) query.status = status;
        if (nfAtual) query.nfAtual = nfAtual;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [{ modelo: searchRegex }, { numeroSerie: searchRegex }, { patrimonio: searchRegex }, { frequencia: searchRegex }];
        }
        const radios = await Radio.find(query);
        res.json(radios);
    } catch (error) {
        console.error("Erro em getAllRadios:", error);
        res.status(500).json({ message: 'Erro interno ao listar rádios.', error: error.message });
    }
};

exports.getRadioByNumeroSerie = async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const radio = await Radio.findOne({ numeroSerie });
        if (!radio) return res.status(404).json({ message: 'Rádio não encontrado.' });
        res.json(radio);
    } catch (error) {
        console.error("Erro em getRadioByNumeroSerie:", error);
        res.status(500).json({ message: 'Erro interno ao buscar rádio.', error: error.message });
    }
};

exports.deleteRadio = async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const { motivo } = req.body; 
        const radio = await Radio.findOne({ numeroSerie });

        if (!radio) return res.status(404).json({ message: 'Rádio não encontrado.' });
        if (radio.status !== 'Disponível') {
            return res.status(400).json({ message: `Não é possível excluir. Status atual: "${radio.status}".` });
        }

        const radioDeletado = new RadioExcluido({
            ...radio.toObject(),
            deletadoPor: req.usuario.email,
            motivoExclusao: motivo || 'Não especificado' 
        });
        await radioDeletado.save();
        await Radio.deleteOne({ numeroSerie });

        res.status(200).json({ message: 'Rádio excluído e movido para o histórico.' });
    } catch (error) {
        console.error('ERRO DETALHADO AO EXCLUIR:', error);
        res.status(500).json({ message: 'Erro interno ao excluir rádio.', error: error.message });
    }
};

// FUNÇÃO CORRIGIDA: Obtém rádios excluídos do modelo RadioExcluido
exports.getDeletedRadios = async (req, res) => {
    try {
        // A rota já usa temPermissao('admin'), então a verificação manual aqui é opcional.
        // if (!req.usuario || !req.usuario.permissoes.includes('admin')) {
        //     return res.status(403).json({ message: 'Acesso negado. Requer permissão de administrador.' });
        // }

        // ***** CORREÇÃO FINAL: BUSCANDO DO MODELO RadioExcluido *****
        const deletedRadios = await RadioExcluido.find().sort({ deletadoEm: -1 }); 
        res.json(deletedRadios);
    } catch (error) {
        console.error('Erro ao buscar rádios excluídos:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar rádios excluídos.', error: error.message });
    }
};

exports.updatePatrimonio = async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const { novoPatrimonio } = req.body;
        if (typeof novoPatrimonio === 'undefined') {
            return res.status(400).json({ message: 'Novo patrimônio é obrigatório.' });
        }
        const radio = await Radio.findOneAndUpdate(
            { numeroSerie },
            { $set: { patrimonio: novoPatrimonio } },
            { new: true }
        );
        if (!radio) return res.status(404).json({ message: 'Rádio não encontrado.' });
        res.status(200).json({ message: 'Patrimônio atualizado com sucesso.', radio });
    } catch (error) {
        console.error("Erro em updatePatrimonio:", error);
        res.status(500).json({ message: 'Erro interno ao atualizar patrimônio.', error: error.message });
    }
};