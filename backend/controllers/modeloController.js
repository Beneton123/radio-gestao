// backend/controllers/modeloController.js
const Modelo = require('../models/Modelo');

exports.getAllModelos = async (req, res) => {
    try {
        const modelos = await Modelo.find().sort({ nome: 1 });
        res.json(modelos);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.createModelo = async (req, res) => {
    try {
        const { nome } = req.body;
        if (!nome || nome.trim() === '') {
            return res.status(400).json({ message: 'O nome do modelo é obrigatório.' });
        }
        const nomeFormatado = nome.trim().toUpperCase();
        const modeloExistente = await Modelo.findOne({ nome: nomeFormatado });
        if (modeloExistente) {
            return res.status(409).json({ message: 'Já existe um modelo com este nome.' });
        }
        const novoModelo = new Modelo({ nome: nomeFormatado });
        await novoModelo.save();
        res.status(201).json({ message: 'Modelo cadastrado com sucesso!', modelo: novoModelo });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};