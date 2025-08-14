// backend/utils/setupAdmin.js

const bcrypt = require('bcrypt');
const Usuario = require('../models/Usuario');

const setupAdminUser = async () => {
    try {
        const adminEmail = 'admin@admin.com';
        const adminPassword = 'admin123';
        const adminUser = await Usuario.findOne({ email: adminEmail });

        if (!adminUser) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await Usuario.create({
                nome: 'Administrador',
                email: adminEmail,
                senha: hashedPassword,
                permissoes: ['admin', 'registrar_radio', 'saida', 'entrada', 'solicitar_manutencao', 'gerenciar_manutencao', 'historico_radio', 'extrato_nf']
            });
            console.log('Usuário administrador padrão criado.');
        }
    } catch (error) {
        console.error("Erro ao configurar usuário admin:", error);
    }
};

// A linha mais importante é esta. Ela exporta a função diretamente.
module.exports = setupAdminUser;