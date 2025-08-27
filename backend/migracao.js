require('dotenv').config();
const mongoose = require('mongoose');
const Radio = require('./models/Radio'); // Verifique se o caminho está correto

const migrarRadios = async () => {
  try {
    // 1. Conecta ao banco de dados
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB para migração.');

    // 2. Encontra todos os rádios que NÃO TÊM o campo "ativo" e o define como "true"
    const resultado = await Radio.updateMany(
      { ativo: { $exists: false } }, // A condição: buscar rádios onde o campo "ativo" não existe
      { $set: { ativo: true } }      // A ação: definir "ativo" como true
    );

    console.log('Migração concluída!');
    console.log(`${resultado.matchedCount} rádios encontrados para migração.`);
    console.log(`${resultado.modifiedCount} rádios foram atualizados com sucesso.`);

  } catch (error) {
    console.error('Ocorreu um erro durante a migração:', error);
  } finally {
    // 3. Fecha a conexão com o banco
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB.');
  }
};

// Executa a função
migrarRadios();