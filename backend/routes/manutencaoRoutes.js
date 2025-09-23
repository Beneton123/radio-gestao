const express = require('express');
const router = express.Router();
const manutencaoController = require('../controllers/manutencaoController');
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');

// Rota para obter o histórico de manutenções finalizadas
router.get('/historico', autenticarToken, manutencaoController.getManutencaoHistory);

// Rotas para Solicitações de Manutenção (gerenciamento normal)
router.post('/solicitacoes', autenticarToken, temPermissao('solicitar_manutencao'), manutencaoController.createSolicitacao);
router.get('/solicitacoes', autenticarToken, manutencaoController.getAllSolicitacoes); // Pode listar todas ou filtradas por usuário/admin
router.get('/solicitacoes/:idPedido', autenticarToken, manutencaoController.getSolicitacaoById);

// Rotas para Gerenciar Pedidos de Manutenção (admin/técnico)
router.post('/pedidos/:idPedido/dar-andamento', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.darAndamento);
router.post('/pedidos/:idPedido/iniciar', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.iniciarManutencao);
router.post('/pedidos/:idPedido/concluir', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.concluirManutencao);

// Rota para obter estoque em manutenção
router.get('/estoque', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.getEstoqueManutencao);

module.exports = router;
