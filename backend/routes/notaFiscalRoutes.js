// backend/routes/notaFiscalRoutes.js

const express = require('express');
const router = express.Router();
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');
const notaFiscalController = require('../controllers/notaFiscalController');

// --- ROTAS DE CRIAÇÃO ---
// ADICIONADA A ROTA DE SAÍDA QUE ESTAVA FALTANDO
router.post('/saida', autenticarToken, temPermissao('saida'), notaFiscalController.createNfSaida); 
router.post('/entrada', autenticarToken, temPermissao('entrada'), notaFiscalController.createNfEntrada);

// --- ROTAS DE CONSULTA ---
router.get('/', autenticarToken, temPermissao('gerenciar_nf'), notaFiscalController.getAllNotasFiscais);
router.get('/numero/:nfNumero', autenticarToken, temPermissao('entrada'), notaFiscalController.getNfByNumero);
router.get('/:id', autenticarToken, temPermissao('gerenciar_nf'), notaFiscalController.getNfById);

// --- ROTAS DE ATUALIZAÇÃO ---
router.patch('/:id', autenticarToken, temPermissao('gerenciar_nf'), notaFiscalController.alterarNf);

// --- ROTAS DE HISTÓRICO ---
router.get('/saida/historico', autenticarToken, notaFiscalController.getNfsSaida);
router.get('/entrada/historico', autenticarToken, notaFiscalController.getNfsEntrada);

router.get('/saida/historico', autenticarToken, notaFiscalController.getNfsSaida);
router.get('/entrada/historico', autenticarToken, notaFiscalController.getNfsEntrada);

// --- NOVA ROTA PARA BUSCAR MOVIMENTAÇÕES DE UMA NF ---
router.get('/:id/movimentacoes', autenticarToken, temPermissao('gerenciar_nf'), notaFiscalController.getMovimentacoesPorNf);


module.exports = router;