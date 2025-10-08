// backend/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { autenticarToken, autorizarAdmin } = require('../middleware/authMiddleware');

// Rotas existentes
router.post('/', autenticarToken, autorizarAdmin, userController.createUser);
router.get('/', autenticarToken, autorizarAdmin, userController.getAllUsers);

// Rota de atualização (NOVA)
router.put('/:id', autenticarToken, autorizarAdmin, userController.updateUser);

// Rota de exclusão (ALTERADA para usar ID)
router.delete('/:id', autenticarToken, autorizarAdmin, userController.deleteUser);


module.exports = router;