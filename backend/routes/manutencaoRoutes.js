const express = require('express');
const router = express.Router();
const manutencaoController = require('../controllers/manutencaoController');
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');


router.get('/historico', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.getManutencaoHistory);


router.post('/solicitacoes', autenticarToken, temPermissao('solicitar_manutencao'), manutencaoController.createSolicitacao);
router.get('/solicitacoes', autenticarToken, manutencaoController.getAllSolicitacoes);
router.get('/solicitacoes/:idPedido', autenticarToken, manutencaoController.getSolicitacaoById);

// Rotas de workflow da OS (Dar Andamento, Iniciar, etc.)
router.post('/solicitacoes/:idPedido/dar-andamento', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.darAndamento);
router.post('/solicitacoes/:idPedido/iniciar', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.iniciarManutencao);
router.post('/solicitacoes/:idPedido/concluir', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.concluirManutencao);

router.post('/solicitacoes/:idPedido/radio/:radioSubId/status', 
    autenticarToken, 
    temPermissao('gerenciar_manutencao'), 
    manutencaoController.atualizarStatusRadio
);


router.get('/estoque', autenticarToken, temPermissao('gerenciar_manutencao'), manutencaoController.getEstoqueManutencao);

module.exports = router;