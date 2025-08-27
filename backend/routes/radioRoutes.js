const express = require('express');
const router = express.Router();
const radioController = require('../controllers/radioController');
const { autenticarToken, autorizarAdmin, temPermissao } = require('../middleware/authMiddleware');

router.post('/', autenticarToken, temPermissao('registrar_radio'), radioController.createRadio);
router.get('/', autenticarToken, radioController.getAllRadios);
router.get('/serial/:numeroSerie', autenticarToken, radioController.getRadioByNumeroSerie);
router.put('/serial/:numeroSerie/patrimonio', autenticarToken, autorizarAdmin, radioController.updatePatrimonio);
router.delete('/serial/:numeroSerie', autenticarToken, autorizarAdmin, radioController.deleteRadio);

// Rota para o painel de admin buscar a lista de rádios com detalhes do usuário
router.get('/cadastrados', autenticarToken, autorizarAdmin, radioController.getRadiosCadastrados);

module.exports = router;
 