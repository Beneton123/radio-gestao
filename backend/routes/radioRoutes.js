const express = require('express');
const router = express.Router();
const radioController = require('../controllers/radioController');
const { autenticarToken, autorizarAdmin, temPermissao } = require('../middleware/authMiddleware');

// Rota para cadastrar um novo rádio
router.post('/', autenticarToken, temPermissao('registrar'), radioController.createRadio);

// Rota para buscar todos os rádios ativos
router.get('/', autenticarToken, radioController.getAllRadios);

// Rota para buscar um rádio pelo número de série
router.get('/serial/:numeroSerie', autenticarToken, radioController.getRadioByNumeroSerie);

// Rota para atualizar o patrimônio de um rádio
router.put('/serial/:numeroSerie/patrimonio', autenticarToken, autorizarAdmin, radioController.updatePatrimonio);

// Rota para desativar (baixar) um rádio
router.delete('/serial/:numeroSerie', autenticarToken, autorizarAdmin, radioController.deleteRadio);

// Rota para buscar o histórico de rádios cadastrados (ativos) para o painel de admin
router.get('/cadastrados', autenticarToken, autorizarAdmin, radioController.getRadiosCadastrados);

// Rota para buscar todos os rádios baixados (inativos)
router.get('/baixados', autenticarToken, autorizarAdmin, radioController.getRadiosBaixados);


router.get('/condenados', autenticarToken, autorizarAdmin, radioController.getRadiosCondenados);

// ROTA DE TESTE TEMPORÁRIA
const Radio = require('../models/Radio'); // Garante que o modelo Radio está acessível aqui
router.get('/test-create', autenticarToken, async (req, res) => {
    try {
        console.log('Executando a rota de teste para criar um rádio...');
        const uniqueSerial = `TEST-SN-${Date.now()}`;
        const testRadio = new Radio({
            modelo: 'TESTE',
            numeroSerie: uniqueSerial,
            frequencia: '123.456',
            cadastradoPor: req.usuario.id 
        });
        await testRadio.save();
        console.log('Rádio de teste salvo com sucesso!', testRadio);
        res.status(200).send(`<h1>Rádio de teste criado com sucesso!</h1><p>A coleção 'radios' agora deve existir no banco de dados.</p><p>Agora você pode voltar ao mongosh e continuar os passos.</p>`);
    } catch (error) {
        console.error('ERRO NA ROTA DE TESTE:', error);
        res.status(500).send('Erro ao criar rádio de teste: ' + error.message);
    }
});

module.exports = router;