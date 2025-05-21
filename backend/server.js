const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const port = 3000;
const SECRET_KEY = 'minha-chave-secreta';

app.use(cors());
app.use(express.json());

// Redireciona raiz para login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

app.use(express.static(path.join(__dirname, '../frontend')));

// Simulação de banco de dados
let radios = db.carregar('radios');
let notasFiscais = db.carregar('notasFiscais');
let usuarios = db.carregar('usuarios');

// Se for o primeiro uso, garante que o admin exista:
if (usuarios.length === 0) {
  usuarios.push({
    nome: 'Administrador',
    email: 'admin@admin.com',
    senha: bcrypt.hashSync('admin123', 10),
    permissoes: ['admin']
  });
  db.salvar('usuarios', usuarios);
}


// Middleware de autenticação
function autenticarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, usuario) => {
    if (err) return res.sendStatus(403);
    req.usuario = usuario;
    next();
  });
}

// Middleware para admins
function autorizarAdmin(req, res, next) {
  if (!req.usuario?.permissoes.includes('admin')) {
    return res.status(403).json({ message: 'Acesso negado.' });
  }
  next();
}

// Login
app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  const usuario = usuarios.find(u => u.email === email);
  if (!usuario) return res.status(401).json({ message: 'Credenciais inválidas.' });

  bcrypt.compare(senha, usuario.senha, (err, ok) => {
    if (!ok) return res.status(401).json({ message: 'Credenciais inválidas.' });

    const token = jwt.sign(
      { email: usuario.email, permissoes: usuario.permissoes },
      SECRET_KEY,
      { expiresIn: '8h' }
    );

    res.json({ token, nome: usuario.nome, permissoes: usuario.permissoes });
  });
});

// CRUD de usuários
app.post('/usuarios', autenticarToken, autorizarAdmin, (req, res) => {
  const { nome, email, senha, permissoes } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ message: 'Campos obrigatórios.' });
  }
  if (usuarios.find(u => u.email === email)) {
    return res.status(400).json({ message: 'Usuário já existe.' });
  }
  const senhaHash = bcrypt.hashSync(senha, 10);
  usuarios.push({ nome, email, senha: senhaHash, permissoes: permissoes || [] });
db.salvar('usuarios', usuarios);
res.status(201).json({ message: 'Usuário criado com sucesso.' });

});

app.get('/usuarios', autenticarToken, autorizarAdmin, (req, res) => {
  const lista = usuarios.map(u => ({
    nome: u.nome,
    email: u.email,
    permissoes: u.permissoes
  }));
  res.json(lista);
});

app.delete('/usuarios/:email', autenticarToken, autorizarAdmin, (req, res) => {
  const { email } = req.params;
  if (email === 'admin@admin.com') {
    return res.status(403).json({ message: 'Não é permitido excluir o administrador padrão.' });
  }
  const index = usuarios.findIndex(u => u.email === email);
  if (index === -1) return res.status(404).json({ message: 'Usuário não encontrado.' });
 usuarios.splice(index, 1);
db.salvar('usuarios', usuarios);
res.json({ message: 'Usuário excluído com sucesso.' });

});

// CRUD de rádios
app.post('/radios', autenticarToken, (req, res) => {
  const { modelo, numeroSerie, patrimonio, frequencia } = req.body;
  if (!modelo || !numeroSerie || !patrimonio || !frequencia) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }
  if (radios.find(r => r.numeroSerie === numeroSerie)) {
    return res.status(400).json({ message: 'Número de série já cadastrado.' });
  }

 radios.push({
  modelo,
  numeroSerie,
  patrimonio,
  frequencia,
  status: 'Disponível',
  ultimaNfSaida: null,
  ultimaNfEntrada: null,
  nfAtual: null
});
db.salvar('radios', radios);
res.status(201).json({ message: 'Rádio cadastrado com sucesso.' });

});

app.get('/radios', autenticarToken, (req, res) => {
  res.json(radios);
});

app.get('/radios/:numeroSerie', autenticarToken, (req, res) => {
  const radio = radios.find(r => r.numeroSerie === req.params.numeroSerie);
  if (!radio) return res.status(404).json({ message: 'Rádio não encontrado.' });
  res.json(radio);
});

app.delete('/radios/:numeroSerie', autenticarToken, (req, res) => {
  const { numeroSerie } = req.params;
  const index = radios.findIndex(r => r.numeroSerie === numeroSerie);
  if (index === -1) return res.status(404).json({ message: 'Rádio não encontrado.' });
 radios.splice(index, 1);
db.salvar('radios', radios);
res.json({ message: 'Rádio excluído com sucesso.' });

});

// NF de saída
app.post('/nf/saida', autenticarToken, (req, res) => {
  const { nfNumero, cliente, dataSaida, previsaoRetorno, radiosSaida } = req.body;
  if (!nfNumero || !cliente || !dataSaida || !radiosSaida?.length) {
    return res.status(400).json({ message: 'Dados incompletos para NF de saída.' });
  }
  if (notasFiscais.find(nf => nf.nfNumero === nfNumero)) {
    return res.status(400).json({ message: 'NF já existe.' });
  }

  const nf = {
    nfNumero,
    cliente,
    dataSaida,
    previsaoRetorno,
    radios: radiosSaida,
    dataEntrada: null,
    observacoes: []
  };

  notasFiscais.push(nf);

  
radios = radios.map(r => {
    if (radiosSaida.includes(r.numeroSerie)) {
      r.status = 'Ocupado';
      r.nfAtual = nfNumero;
      r.ultimaNfSaida = nfNumero;
    }
    return r;
  }); 
db.salvar('notasFiscais', notasFiscais);
db.salvar('radios', radios);
res.status(201).json({ message: 'NF de saída registrada.' });

});

// NF de entrada
app.post('/nf/entrada', autenticarToken, (req, res) => {
  const { nfNumero, dataEntrada, observacoes } = req.body;
  const nf = notasFiscais.find(n => n.nfNumero === nfNumero);
  if (!nf) return res.status(404).json({ message: 'NF não encontrada.' });

  nf.dataEntrada = dataEntrada || new Date().toISOString();
nf.observacoes = observacoes || [];

nf.radios.forEach(numeroSerie => {
  const radio = radios.find(r => r.numeroSerie === numeroSerie);
  if (radio) {
    radio.status = 'Disponível';
    radio.nfAtual = null;
    radio.ultimaNfEntrada = nfNumero;
  }
});

db.salvar('notasFiscais', notasFiscais);
db.salvar('radios', radios);

res.json({ message: 'NF de entrada concluída com sucesso.' });

});

// Histórico e detalhes
app.get('/nf/:nfNumero', autenticarToken, (req, res) => {
  const nf = notasFiscais.find(n => n.nfNumero === req.params.nfNumero);
  if (!nf) return res.status(404).json({ message: 'NF não encontrada.' });
  res.json(nf);
});

app.get('/extrato/:numeroSerie', autenticarToken, (req, res) => {
  const numeroSerie = req.params.numeroSerie;
  const historico = notasFiscais.filter(nf => nf.radios.includes(numeroSerie));
  res.json(historico);
});

// NOVAS ROTAS: movimentações
app.get('/movimentacoes/recentes', autenticarToken, (req, res) => {
  const movimentacoes = [];

  notasFiscais.forEach(nf => {
    if (nf.dataSaida) {
      movimentacoes.push({
        id: `saida-${nf.nfNumero}`,
        tipo: 'Saída',
        numeroNF: nf.nfNumero,
        usuario: nf.cliente,
        data: nf.dataSaida,
        radios: nf.radios.map(numeroSerie => {
          const radio = radios.find(r => r.numeroSerie === numeroSerie);
          return {
            modelo: radio?.modelo || '',
            numeroSerie: radio?.numeroSerie || '',
            patrimonio: radio?.patrimonio || '',
            frequencia: radio?.frequencia || ''
          };
        })
      });
    }
    if (nf.dataEntrada) {
      movimentacoes.push({
        id: `entrada-${nf.nfNumero}`,
        tipo: 'Entrada',
        numeroNF: nf.nfNumero,
        usuario: nf.cliente,
        data: nf.dataEntrada,
        radios: nf.radios.map(numeroSerie => {
          const radio = radios.find(r => r.numeroSerie === numeroSerie);
          return {
            modelo: radio?.modelo || '',
            numeroSerie: radio?.numeroSerie || '',
            patrimonio: radio?.patrimonio || '',
            frequencia: radio?.frequencia || ''
          };
        })
      });
    }
  });

  movimentacoes.sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json(movimentacoes.slice(0, 10));
});

app.get('/movimentacoes/:id', autenticarToken, (req, res) => {
  const { id } = req.params;
  const [tipo, nfNumero] = id.split('-');
  const nf = notasFiscais.find(n => n.nfNumero === nfNumero);

  if (!nf) return res.status(404).json({ message: 'Movimentação não encontrada.' });

  const radiosDetalhados = nf.radios.map(numeroSerie => {
    const radio = radios.find(r => r.numeroSerie === numeroSerie);
    return {
      modelo: radio?.modelo || '',
      numeroSerie: radio?.numeroSerie || '',
      patrimonio: radio?.patrimonio || '',
      frequencia: radio?.frequencia || ''
    };
  });

  res.json({
    id,
    tipo: tipo === 'saida' ? 'Saída' : 'Entrada',
    numeroNF: nf.nfNumero,
    usuario: nf.cliente,
    data: tipo === 'saida' ? nf.dataSaida : nf.dataEntrada,
    radios: radiosDetalhados
  });
});

// Inicialização
app.listen(port, () => {
  console.log(`✅ Servidor rodando em http://localhost:${port}`);
});
