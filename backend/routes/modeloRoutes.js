// backend/routes/modeloRoutes.js
const express = require('express');
const router = express.Router();
const modeloController = require('../controllers/modeloController');
const { autenticarToken, autorizarAdmin } = require('../middleware/authMiddleware');

router.get('/', autenticarToken, modeloController.getAllModelos);
router.post('/', autenticarToken, autorizarAdmin, modeloController.createModelo);

router.get('/', async (req, res) => {
    try {
        const modelos = await Radio.distinct('modelo');
        res.json(modelos);
    } catch (error) {
        console.error('Erro ao buscar modelos de rádio:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});


module.exports = router;