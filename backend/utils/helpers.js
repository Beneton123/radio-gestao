// backend/utils/helpers.js
const Counter = require('../models/Counter');

// Função para gerar IDs sequenciais para Pedidos de Manutenção
const getNextSequenceValue = async (sequenceName) => {
    const counter = await Counter.findOneAndUpdate(
        { _id: sequenceName },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    );
    // Formata o ID com zeros à esquerda (ex: PE000001)
    return `PE${String(counter.sequence_value).padStart(6, '0')}`;
};

module.exports = { getNextSequenceValue };