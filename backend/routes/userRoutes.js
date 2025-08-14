// backend/routes/userRoutes.js

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { autenticarToken, autorizarAdmin } = require('../middleware/authMiddleware');

router.post('/', autenticarToken, autorizarAdmin, userController.createUser);
router.get('/', autenticarToken, autorizarAdmin, userController.getAllUsers);
router.delete('/:email', autenticarToken, autorizarAdmin, userController.deleteUser);

module.exports = router;