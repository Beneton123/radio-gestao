const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db');

const arquivos = {
  usuarios: 'usuarios.json',
  radios: 'radios.json',
  notasFiscais: 'notasFiscais.json'
};

function carregar(nome) {
  const caminho = path.join(dbPath, arquivos[nome]);
  try {
    const dados = fs.readFileSync(caminho, 'utf-8');
    return JSON.parse(dados);
  } catch (err) {
    console.error(`Erro ao carregar ${nome}:`, err);
    return [];
  }
}

function salvar(nome, dados) {
  const caminho = path.join(dbPath, arquivos[nome]);
  try {
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Erro ao salvar ${nome}:`, err);
  }
}

module.exports = { carregar, salvar };
