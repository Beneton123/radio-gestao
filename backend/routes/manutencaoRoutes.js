const express = require('express');
const router = express.Router();
const manutencaoController = require('../controllers/manutencaoController');
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');


router.get('/historico', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.getManutencaoHistory);


router.post('/solicitacoes', autenticarToken, temPermissao('solicitar_manutencao'), manutencaoController.createSolicitacao);
router.get('/solicitacoes', autenticarToken, manutencaoController.getAllSolicitacoes);
// ALTERADO AQUI
router.get('/solicitacoes/:id', autenticarToken, manutencaoController.getSolicitacaoById);

// Rotas de workflow da OS (Dar Andamento, Iniciar, etc.)
// ALTERADO AQUI
router.post('/solicitacoes/:id/dar-andamento', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.darAndamento);
// ALTERADO AQUI
router.post('/solicitacoes/:id/iniciar', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.iniciarManutencao);
// ALTERADO AQUI
router.post('/solicitacoes/:id/concluir', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.concluirManutencao);

// ALTERADO AQUI
router.post('/solicitacoes/:id/radio/:radioSubId/status', 
    autenticarToken, 
    temPermissao('manutencao_dashboard'), 
    manutencaoController.atualizarStatusRadio
);


router.get('/estoque', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.getEstoqueManutencao);

module.exports = router;