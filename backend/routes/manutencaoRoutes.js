const express = require('express');
const router = express.Router();
const manutencaoController = require('../controllers/manutencaoController');
const { autenticarToken, temPermissao } = require('../middleware/authMiddleware');


router.get('/historico', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.getManutencaoHistory);
router.get('/estoque', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.getEstoqueManutencao);

router.post('/solicitacoes', autenticarToken, temPermissao('solicitar_manutencao'), manutencaoController.createSolicitacao);
router.get('/solicitacoes', autenticarToken, manutencaoController.getAllSolicitacoes);
router.get('/solicitacoes/:id', autenticarToken, manutencaoController.getSolicitacaoById);

// Rotas de workflow da OS
router.post('/solicitacoes/:id/dar-andamento', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.darAndamento);
router.post('/solicitacoes/:id/iniciar', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.iniciarManutencao);
router.post('/solicitacoes/:id/concluir', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.concluirManutencao);
router.post('/solicitacoes/:id/radio/:radioSubId/status', autenticarToken, temPermissao('manutencao_dashboard'), manutencaoController.atualizarStatusRadio);


// --- NOVAS ROTAS PARA A DECISÃO PÓS-MANUTENÇÃO ---

// Rota para quando o usuário decidir "VOLTAR PARA A NF"
router.post(
    '/acoes/retornar-para-nf/:idPedido',
    autenticarToken,
    temPermissao('manutencao_dashboard'),
    manutencaoController.retornarRadioParaNF
);

// Rota para quando o usuário decidir "MOVER PARA O ESTOQUE"
router.post(
    '/acoes/retornar-para-estoque/:idPedido',
    autenticarToken,
    temPermissao('manutencao_dashboard'),
    manutencaoController.retornarRadioParaEstoque
);


module.exports = router;