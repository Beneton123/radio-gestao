// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { autenticarToken, autorizarAdmin } = require('../middleware/authMiddleware');

router.get('/extrato/:numeroSerie', autenticarToken, dashboardController.getExtratoRadio);
router.get('/radios/:numeroSerie/historico-completo', autenticarToken, dashboardController.getHistoricoCompletoRadio);
router.get('/radios-excluidos', autenticarToken, autorizarAdmin, dashboardController.getRadiosExcluidos);
router.get('/movimentacoes/recentes', autenticarToken, dashboardController.getMovimentacoesRecentes);
router.get('/movimentacoes/:id', autenticarToken, dashboardController.getMovimentacaoById);

module.exports = router;