// backend/server.js (VERSÃO COM BLOCO DE INVESTIGAÇÃO)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Importando os arquivos de rotas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const radioRoutes = require('./routes/radioRoutes');
const modeloRoutes = require('./routes/modeloRoutes');
const notaFiscalRoutes = require('./routes/notaFiscalRoutes');
const manutencaoRoutes = require('./routes/manutencaoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const port = process.env.PORT || 5000;
const host = process.env.HOST || '0.0.0.0';

// Middlewares Globais
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

// Delegação para os Routers da API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/radios', radioRoutes);
app.use('/api/modelos', modeloRoutes);
app.use('/api/notasfiscais', notaFiscalRoutes);
app.use('/api/manutencao', manutencaoRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Conexão com o MongoDB e Inicialização do Servidor
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Conectado ao MongoDB!');
        app.listen(port, host, () => {
            console.log(`✅ Servidor rodando na porta ${port}`);
            
            
require('./utils/setupAdmin')(); // Chama a função de setup do admin

        });
    })
    .catch(err => {
        console.error('Erro de conexão com o MongoDB:', err);
        process.exit(1);
    });