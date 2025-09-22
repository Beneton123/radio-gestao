const express = require('express');
const router = express.Router();
const radioController = require('../controllers/radioController');
const { autenticarToken, autorizarAdmin, temPermissao } = require('../middleware/authMiddleware');

router.post('/', autenticarToken, temPermissao('registrar_radio'), radioController.createRadio);
router.get('/', autenticarToken, radioController.getAllRadios);
router.get('/serial/:numeroSerie', autenticarToken, radioController.getRadioByNumeroSerie);
router.put('/serial/:numeroSerie/patrimonio', autenticarToken, autorizarAdmin, radioController.updatePatrimonio);
router.delete('/serial/:numeroSerie', autenticarToken, autorizarAdmin, radioController.deleteRadio);

// Rota para o painel de admin buscar o HISTÓRICO COMPLETO de rádios
router.get('/cadastrados', autenticarToken, autorizarAdmin, radioController.getRadiosCadastrados);

// NOVA ROTA: Rota para buscar apenas os rádios "excluídos"
router.get('/excluidos', autenticarToken, autorizarAdmin, radioController.getRadiosExcluidos);

module.exports = router;