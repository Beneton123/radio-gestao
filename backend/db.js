// db.js
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db'); // Define o caminho da pasta onde os JSONs serão salvos

// Garante que a pasta 'db' exista antes de tentar ler ou escrever
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true }); // Cria a pasta (e subpastas, se necessário)
    console.log(`Pasta 'db' criada em: ${dbPath}`);
}

const arquivos = {
    usuarios: 'usuarios.json',
    radios: 'radios.json',
    notasFiscais: 'notasFiscais.json',
    pedidosManutencao: 'pedidosManutencao.json'
};

function carregar(nome) {
    const caminho = path.join(dbPath, arquivos[nome]);
    try {
        const dados = fs.readFileSync(caminho, 'utf-8');
        return JSON.parse(dados);
    } catch (err) {
        // Se o arquivo não existir, ou houver erro na leitura/parsing, retorna um array vazio
        // console.error(`Erro ao carregar ${nome}:`, err); // Você pode descomentar para depuração
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