// backend/routes/notaFiscalRoutes.js
const express = require('express');
const router = express.Router();
const nfController = require('../controllers/notaFiscalController');
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');

router.post('/saida', autenticarToken, temPermissao('saida'), nfController.createNfSaida);
router.post('/entrada', autenticarToken, temPermissao('entrada'), nfController.createNfEntrada);

// ROTAS ANTIGAS MANTIDAS
router.get('/', autenticarToken, nfController.getAllNfs);
router.get('/:nfNumero', autenticarToken, nfController.getNfByNumero);

// NOVAS ROTAS PARA HISTÓRICO
router.get('/saida/historico', autenticarToken, nfController.getNfsSaida);
router.get('/entrada/historico', autenticarToken, nfController.getNfsEntrada);

module.exports = router;