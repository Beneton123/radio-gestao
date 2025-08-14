// backend/routes/manutencaoRoutes.js
const express = require('express');
const router = express.Router();
const manutencaoController = require('../controllers/manutencaoController');
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');

router.post('/solicitacoes', autenticarToken, temPermissao('solicitar_manutencao'), manutencaoController.createSolicitacao);
router.get('/solicitacoes', autenticarToken, manutencaoController.getAllSolicitacoes);
router.get('/solicitacoes/:idPedido', autenticarToken, manutencaoController.getSolicitacaoById);
router.post('/pedidos/:idPedido/dar-andamento', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.darAndamento);
router.post('/pedidos/:idPedido/iniciar', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.iniciarManutencao);
router.post('/pedidos/:idPedido/concluir', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.concluirManutencao);
router.get('/estoque', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.getEstoqueManutencao);

module.exports = router;