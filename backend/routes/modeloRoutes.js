// backend/routes/modeloRoutes.js
const express = require('express');
const router = express.Router();
const modeloController = require('../controllers/modeloController');
const { autenticarToken, autorizarAdmin } = require('../middleware/authMiddleware');

router.get('/', autenticarToken, modeloController.getAllModelos);
router.post('/', autenticarToken, autorizarAdmin, modeloController.createModelo);

module.exports = router;