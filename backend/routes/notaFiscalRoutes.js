// backend/routes/notaFiscalRoutes.js
const express = require('express');
const router = express.Router();
const nfController = require('../controllers/notaFiscalController');
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');

router.post('/saida', autenticarToken, temPermissao('saida'), nfController.createNfSaida);
router.post('/entrada', autenticarToken, temPermissao('entrada'), nfController.createNfEntrada);
router.get('/', autenticarToken, nfController.getAllNfs);
router.get('/:nfNumero', autenticarToken, nfController.getNfByNumero);

module.exports = router;