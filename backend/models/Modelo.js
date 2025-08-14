// backend/models/Modelo.js

const mongoose = require('mongoose');

const modeloSchema = new mongoose.Schema({
    nome: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        uppercase: true
    }
}, { 
    timestamps: true,
   
    collection: 'modelos' 
  
});

module.exports = mongoose.model('Modelo', modeloSchema);