// backend/routes/notaFiscalRoutes.js (VERSÃO FINAL E ORGANIZADA)

const express = require('express');
const router = express.Router();
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');
const notaFiscalController = require('../controllers/notaFiscalController');

// --- ROTAS DE CRIAÇÃO ---
router.post('/saida', autenticarToken, temPermissao('saida'), notaFiscalController.createNfSaida);
router.post('/entrada', autenticarToken, temPermissao('entrada'), notaFiscalController.createNfEntrada);

// --- ROTAS DE CONSULTA ---

// Busca TODAS as NFs para a tela de gerenciamento
router.get('/', autenticarToken, temPermissao('gerenciar_nf'), notaFiscalController.getAllNotasFiscais);

// Busca UMA NF de Saída pelo seu NÚMERO (para a tela de Retorno de Locação)
router.get('/numero/:nfNumero', autenticarToken, temPermissao('entrada'), notaFiscalController.getNfByNumero);

// Busca UMA NF (qualquer tipo) pelo seu ID do Banco de Dados (para o modal de Detalhes)
router.get('/:id', autenticarToken, temPermissao('gerenciar_nf'), notaFiscalController.getNfById);


// --- ROTAS DE ATUALIZAÇÃO ---

// Atualiza UMA NF pelo seu ID do Banco de Dados (para o modal de Alterar)
router.patch('/:id', autenticarToken, temPermissao('gerenciar_nf'), notaFiscalController.alterarNf);


// --- ROTAS DE HISTÓRICO (se necessário) ---
router.get('/saida/historico', autenticarToken, notaFiscalController.getNfsSaida);
router.get('/entrada/historico', autenticarToken, notaFiscalController.getNfsEntrada);


module.exports = router;