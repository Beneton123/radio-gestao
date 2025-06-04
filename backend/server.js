// server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db'); // Seu módulo db.js

const app = express();
const port = 3000;
const SECRET_KEY = 'minha-chave-secreta'; // Mantenha segura em produção!

app.use(cors());
app.use(express.json());

// Redireciona raiz para login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Serve arquivos estáticos da pasta frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Simulação de banco de dados em memória (carregados de arquivos JSON)
let radios = db.carregar('radios');
let notasFiscais = db.carregar('notasFiscais');
let usuarios = db.carregar('usuarios');
let pedidosManutencao = db.carregar('pedidosManutencao'); // Carrega os pedidos de manutenção

// Variável para controlar o contador de ID de pedidos de manutenção
// Lógica para carregar o último ID existente ao iniciar o servidor
let ultimoIdPedidoManutencao = 0;
if (pedidosManutencao.length > 0) {
    const idsNumericos = pedidosManutencao
        .map(p => {
            const match = p.idPedido.match(/^PE(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => n > 0);
    if (idsNumericos.length > 0) {
        ultimoIdPedidoManutencao = Math.max(...idsNumericos);
    }
}

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

// Função para gerar o próximo ID de pedido no formato PE******
function gerarProximoIdPedido() {
    ultimoIdPedidoManutencao++;
    return `PE${String(ultimoIdPedidoManutencao).padStart(6, '0')}`;
}

// Middleware de autenticação
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (token == null) return res.sendStatus(401); // Se não há token, não autorizado

    jwt.verify(token, SECRET_KEY, (err, usuario) => {
        if (err) return res.sendStatus(403); // Se o token não for válido, proibido
        req.usuario = usuario; // Adiciona os dados do usuário (payload do token) à requisição
        next(); // Passa para a próxima rota/middleware
    });
}

// Middleware para verificar se o usuário é admin
function autorizarAdmin(req, res, next) {
    if (!req.usuario || !req.usuario.permissoes || !req.usuario.permissoes.includes('admin')) {
        return res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador.' });
    }
    next();
}

// Rota de Login
app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    const usuario = usuarios.find(u => u.email === email);
    if (!usuario) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    bcrypt.compare(senha, usuario.senha, (err, isMatch) => {
        if (err || !isMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const tokenPayload = {
            email: usuario.email,
            nome: usuario.nome, // Adicionando nome ao payload
            permissoes: usuario.permissoes
        };
        const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '8h' });
        res.json({ token, nome: usuario.nome, permissoes: usuario.permissoes });
    });
});

// --- ROTAS DE USUÁRIOS ---
app.post('/usuarios', autenticarToken, autorizarAdmin, (req, res) => {
    const { nome, email, senha, permissoes } = req.body;
    // Corrigido: a validação de 'senha' deve ser '!senha' para verificar se ela é nula/vazia,
    // e não '!!senha' que verifica se é um valor "truthy".
    if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios.' });
    }
    if (usuarios.find(u => u.email === email)) {
        return res.status(409).json({ message: 'Usuário com este email já existe.' });
    }
    const senhaHash = bcrypt.hashSync(senha, 10);
    const novoUsuario = { nome, email, senha: senhaHash, permissoes: permissoes || [] };
    usuarios.push(novoUsuario);
    db.salvar('usuarios', usuarios);
    res.status(201).json({ message: 'Usuário criado com sucesso.' });
});

app.get('/usuarios', autenticarToken, autorizarAdmin, (req, res) => {
    const listaUsuarios = usuarios.map(({ senha, ...resto }) => resto);
    res.json(listaUsuarios);
});

app.delete('/usuarios/:email', autenticarToken, autorizarAdmin, (req, res) => {
    const { email } = req.params;
    if (email === 'admin@admin.com') {
        return res.status(403).json({ message: 'Não é permitido excluir o administrador padrão.' });
    }
    const index = usuarios.findIndex(u => u.email === email);
    if (index === -1) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    usuarios.splice(index, 1);
    db.salvar('usuarios', usuarios);
    res.json({ message: 'Usuário excluído com sucesso.' });
});

// --- ROTAS DE RÁDIOS ---
app.post('/radios', autenticarToken, (req, res) => {
    const { modelo, numeroSerie, patrimonio, frequencia } = req.body;
    if (!modelo || !numeroSerie || !patrimonio || !frequencia) {
        return res.status(400).json({ message: 'Todos os campos (modelo, número de série, patrimônio, frequência) são obrigatórios.' });
    }
    if (radios.find(r => r.numeroSerie === numeroSerie)) {
        return res.status(409).json({ message: 'Rádio com este número de série já cadastrado.' });
    }
    const novoRadio = {
        modelo,
        numeroSerie,
        patrimonio,
        frequencia,
        status: 'Disponível', // Status inicial
        ultimaNfSaida: null,
        ultimaNfEntrada: null,
        nfAtual: null,
    };
    radios.push(novoRadio);
    db.salvar('radios', radios);
    res.status(201).json({ message: 'Rádio cadastrado com sucesso.', radio: novoRadio });
});

app.get('/radios', autenticarToken, (req, res) => {
    res.json(radios);
});

app.get('/radios/:numeroSerie', autenticarToken, (req, res) => {
    const { numeroSerie } = req.params;
    const radio = radios.find(r => r.numeroSerie === numeroSerie);
    if (!radio) {
        return res.status(404).json({ message: 'Rádio não encontrado.' });
    }
    res.json(radio);
});

app.delete('/radios/:numeroSerie', autenticarToken, (req, res) => {
    const { numeroSerie } = req.params;
    const radioIndex = radios.findIndex(r => r.numeroSerie === numeroSerie);
    if (radioIndex === -1) {
        return res.status(404).json({ message: 'Rádio não encontrado.' });
    }
    if (radios[radioIndex].status === 'Ocupado' || radios[radioIndex].status === 'Manutenção') {
        return res.status(400).json({ message: `Rádio está ${radios[radioIndex].status.toLowerCase()} e não pode ser excluído.` });
    }
    radios.splice(radioIndex, 1);
    db.salvar('radios', radios);
    res.json({ message: 'Rádio excluído com sucesso.' });
});

// NOVA ROTA: Editar Patrimônio de um Rádio
app.put('/radios/:numeroSerie/patrimonio', autenticarToken, (req, res) => {
    // Permissão para editar rádio. Pode ser 'admin' ou uma permissão mais específica como 'editar_radio'
    // Como solicitado, qualquer usuário autenticado (que já tem acesso a 'estoque') pode editar o patrimônio.
    // Se quiser restringir, adicione uma permissão aqui:
    // if (!req.usuario.permissoes.includes('editar_radio') && !req.usuario.permissoes.includes('admin')) {
    //      return res.status(403).json({ message: 'Acesso negado para editar patrimônio.' });
    // }

    const { numeroSerie } = req.params;
    const { patrimonio } = req.body;

    // Permite que o campo patrimônio seja uma string vazia, mas não undefined/null
    if (patrimonio === undefined || patrimonio === null) {
        return res.status(400).json({ message: 'O campo patrimônio é obrigatório e não pode ser nulo.' });
    }

    const radioIndex = radios.findIndex(r => r.numeroSerie === numeroSerie);

    if (radioIndex === -1) {
        return res.status(404).json({ message: 'Rádio não encontrado.' });
    }

    // Atualiza o patrimônio do rádio
    radios[radioIndex].patrimonio = patrimonio;
    db.salvar('radios', radios); // Salva a alteração

    res.json({ message: `Patrimônio do rádio ${numeroSerie} atualizado com sucesso.`, radio: radios[radioIndex] });
});

// --- ROTAS DE NOTAS FISCAIS (SAÍDA E ENTRADA) ---
app.post('/nf/saida', autenticarToken, (req, res) => {
    const { nfNumero, cliente, dataSaida, previsaoRetorno, radiosSaida } = req.body;
    if (!nfNumero || !cliente || !dataSaida || !Array.isArray(radiosSaida) || radiosSaida.length === 0) {
        return res.status(400).json({ message: 'Dados incompletos para NF de saída. Número da NF, cliente, data de saída e ao menos um rádio são obrigatórios.' });
    }
    if (notasFiscais.find(nf => nf.nfNumero === nfNumero && nf.tipo === 'Saída')) {
        return res.status(409).json({ message: 'Nota Fiscal de Saída com este número já existe.' });
    }

    for (const serie of radiosSaida) {
        const radio = radios.find(r => r.numeroSerie === serie);
        if (!radio) {
            return res.status(400).json({ message: `Rádio com número de série ${serie} não encontrado.` });
        }
        if (radio.status !== 'Disponível') {
            return res.status(400).json({ message: `Rádio ${serie} (${radio.modelo}) não está disponível (Status: ${radio.status}).` });
        }
    }

    const novaNFSaida = {
        nfNumero,
        tipo: 'Saída',
        cliente,
        dataSaida,
        previsaoRetorno: previsaoRetorno || null,
        radios: radiosSaida,
        dataEntrada: null,
        observacoes: [],
        usuarioRegistro: req.usuario.email
    };
    notasFiscais.push(novaNFSaida);

    radiosSaida.forEach(serie => {
        const radioIndex = radios.findIndex(r => r.numeroSerie === serie);
        if (radioIndex !== -1) {
            radios[radioIndex].status = 'Ocupado';
            radios[radioIndex].nfAtual = nfNumero;
            radios[radioIndex].ultimaNfSaida = nfNumero;
        }
    });

    db.salvar('notasFiscais', notasFiscais);
    db.salvar('radios', radios);
    res.status(201).json({ message: 'NF de Saída registrada com sucesso.', nf: novaNFSaida });
});

app.post('/nf/entrada', autenticarToken, (req, res) => {
    const { nfNumero, dataEntrada, observacoes } = req.body;
    if (!nfNumero || !dataEntrada) {
        return res.status(400).json({ message: 'Número da NF de Saída e data de entrada são obrigatórios.' });
    }

    const nfSaidaOriginal = notasFiscais.find(nf => nf.nfNumero === nfNumero && nf.tipo === 'Saída');
    if (!nfSaidaOriginal) {
        return res.status(404).json({ message: `NF de Saída original com número ${nfNumero} não encontrada.` });
    }
    if (nfSaidaOriginal.dataEntrada) {
        return res.status(400).json({ message: `Retorno para a NF ${nfNumero} já foi registrado anteriormente.` });
    }

    nfSaidaOriginal.dataEntrada = dataEntrada;
    nfSaidaOriginal.observacoes = Array.isArray(observacoes) ? observacoes : (observacoes ? [observacoes] : []);

    nfSaidaOriginal.radios.forEach(serie => {
        const radioIndex = radios.findIndex(r => r.numeroSerie === serie);
        if (radioIndex !== -1) {
            radios[radioIndex].status = 'Disponível';
            radios[radioIndex].nfAtual = null;
            radios[radioIndex].ultimaNfEntrada = nfNumero;
        }
    });

    db.salvar('notasFiscais', notasFiscais);
    db.salvar('radios', radios);
    res.json({ message: `Retorno para NF ${nfNumero} registrado com sucesso.` });
});

// --- ROTA PARA LISTAR TODAS AS NOTAS FISCAIS ---
// ESTA É A ROTA QUE PRECISA ESTAR NO SEU server.js
app.get('/nf', autenticarToken, (req, res) => {
    res.json(notasFiscais);
});
// --- FIM DA ROTA ---

// --- ROTAS DE CONSULTA (EXTRATO, DETALHES NF, MOVIMENTAÇÕES) ---
app.get('/nf/:nfNumero', autenticarToken, (req, res) => {
    const { nfNumero } = req.params;
    const nf = notasFiscais.find(n => n.nfNumero === nfNumero);
    if (!nf) {
        return res.status(404).json({ message: 'Nota Fiscal não encontrada.' });
    }
    // Ao retornar os detalhes de uma NF específica, precisamos enriquecer os dados dos rádios
    // para que o frontend não precise fazer requisições extras por cada rádio.
    const radiosDetalhadosNaNF = nf.radios.map(radioSerie => {
        const radioDoEstoque = radios.find(r => r.numeroSerie === radioSerie);
        return {
            numeroSerie: radioSerie, // Sempre inclua a série
            modelo: radioDoEstoque?.modelo || 'N/A',
            patrimonio: radioDoEstoque?.patrimonio || 'N/A',
            frequencia: radioDoEstoque?.frequencia || 'N/A'
            // Adicione outros campos do rádio que sejam relevantes aqui
        };
    });
    res.json({ ...nf, radios: radiosDetalhadosNaNF });
});

app.get('/extrato/:numeroSerie', autenticarToken, (req, res) => {
    const { numeroSerie } = req.params;
    const historicoNF = notasFiscais.filter(nf => nf.radios.includes(numeroSerie));
    res.json(historicoNF);
});

app.get('/movimentacoes/recentes', autenticarToken, (req, res) => {
    const movimentacoes = [];
    notasFiscais.forEach(nf => {
        if (nf.tipo === 'Saída' && nf.dataSaida) {
            movimentacoes.push({
                id: `saida-${nf.nfNumero}`,
                tipo: 'Saída',
                numeroNF: nf.nfNumero,
                cliente: nf.cliente, // Usar 'cliente' para consistência
                data: nf.dataSaida,
            });
        }
        if (nf.dataEntrada) {
            movimentacoes.push({
                id: `entrada-${nf.nfNumero}`,
                tipo: 'Entrada',
                numeroNF: nf.nfNumero,
                cliente: nf.cliente, // Usar 'cliente' para consistência
                data: nf.dataEntrada,
            });
        }
    });

    movimentacoes.sort((a, b) => new Date(b.data) - new Date(a.data));
    res.json(movimentacoes.slice(0, 20));
});

app.get('/movimentacoes/:id', autenticarToken, (req, res) => {
    const { id } = req.params;
    const [tipoMov, nfNumero] = id.split('-');

    const nfOriginal = notasFiscais.find(n => n.nfNumero === nfNumero);

    if (!nfOriginal) {
        return res.status(404).json({ message: 'Movimentação ou NF de referência não encontrada.' });
    }

    const radiosDetalhados = nfOriginal.radios.map(serie => {
        const radioInfo = radios.find(r => r.numeroSerie === serie);
        return {
            modelo: radioInfo?.modelo || 'N/A',
            numeroSerie: serie,
            patrimonio: radioInfo?.patrimonio || 'N/A',
            frequencia: radioInfo?.frequencia || 'N/A'
        };
    });

    let movimentacaoDetalhada;
    if (tipoMov === 'saida') {
        movimentacaoDetalhada = {
            id,
            tipo: 'Saída',
            numeroNF: nfOriginal.nfNumero,
            cliente: nfOriginal.cliente, // Usar 'cliente' para consistência
            data: nfOriginal.dataSaida,
            previsaoRetorno: nfOriginal.previsaoRetorno,
            radios: radiosDetalhados,
            observacoes: nfOriginal.observacoes
        };
    } else if (tipoMov === 'entrada' && nfOriginal.dataEntrada) {
        movimentacaoDetalhada = {
            id,
            tipo: 'Entrada',
            numeroNF: nfOriginal.nfNumero,
            cliente: nfOriginal.cliente, // Usar 'cliente' para consistência
            data: nfOriginal.dataEntrada,
            radios: radiosDetalhados,
            observacoes: nfOriginal.observacoes
        };
    } else {
        return res.status(404).json({ message: 'Tipo de movimentação inválido ou dados de entrada ausentes.' });
    }
    res.json(movimentacaoDetalhada);
});

// --- ROTAS DE MANUTENÇÃO ---// Criar uma nova solicitação de manutenção
app.post('/manutencao/solicitacoes', autenticarToken, (req, res) => {
    const { solicitanteNome, prioridade, radios: radiosSolicitados, observacoesSolicitante } = req.body;
    const solicitanteEmail = req.usuario.email;

    if (!solicitanteNome || !solicitanteEmail || !prioridade || !Array.isArray(radiosSolicitados) || radiosSolicitados.length === 0) {
        return res.status(400).json({ message: 'Dados incompletos para a solicitação de manutenção. Verifique solicitante, prioridade e rádios.' });
    }

    for (const radioSol of radiosSolicitados) {
        // Validação mais rigorosa para os campos que vêm do frontend
        if (!radioSol.numeroSerie || !radioSol.modelo || !radioSol.patrimonio || !radioSol.descricaoProblema) {
            return res.status(400).json({ message: `Dados incompletos para o rádio ${radioSol.numeroSerie || '(sem série)'} na solicitação. Modelo, Patrimônio e Descrição do Problema são obrigatórios.` });
        }
        const radioExistente = radios.find(r => r.numeroSerie === radioSol.numeroSerie);
        if (!radioExistente) {
            return res.status(400).json({ message: `Rádio com série ${radioSol.numeroSerie} não encontrado no sistema principal.` });
        }
        if (radioExistente.status !== 'Disponível') {
            let mensagemErro = `O rádio "${radioExistente.numeroSerie}" está com status "${radioExistente.status}" e não pode ser enviado para manutenção.`;
            if (radioExistente.status === 'Ocupado') {
                mensagemErro = `O rádio "${radioExistente.numeroSerie}" está "Ocupado" (NF: ${radioExistente.nfAtual || 'N/A'}) e precisa retornar antes de ser enviado para manutenção.`;
            } else if (radioExistente.status === 'Manutenção') {
                mensagemErro = `O rádio "${radioExistente.numeroSerie}" já se encontra em "Manutenção" ou com solicitação aberta.`
            }
            return res.status(400).json({ message: mensagemErro });
        }
    }

    // Gerar o ID do pedido de manutenção
    const novoIdPedido = gerarProximoIdPedido();

    const novoPedido = {
        idPedido: novoIdPedido,
        solicitanteNome,
        solicitanteEmail,
        dataSolicitacao: new Date().toISOString(),
        prioridade,
        radios: radiosSolicitados, // Já vêm com numeroSerie, modelo, patrimonio, descricaoProblema
        statusPedido: 'aberto', // Status inicial padrão
        tecnicoResponsavel: null,
        dataInicioManutencao: null,
        dataFimManutencao: null,
        observacoesSolicitante: observacoesSolicitante || null,
        observacoesTecnicas: null
    };

    pedidosManutencao.push(novoPedido);
    db.salvar('pedidosManutencao', pedidosManutencao);
    res.status(201).json({ message: 'Solicitação de manutenção criada com sucesso!', idPedido: novoPedido.idPedido, pedido: novoPedido });
});

// Listar pedidos de manutenção com filtro por status
app.get('/manutencao/solicitacoes', autenticarToken, (req, res) => {
    // Permissão para gerenciar ou solicitar
    if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin') && !req.usuario.permissoes.includes('solicitar_manutencao')) {
        return res.status(403).json({ message: 'Acesso negado para listar solicitações.' });
    }
    const { status } = req.query;
    let pedidosFiltrados = pedidosManutencao;

    if (status) {
        const statusArray = status.split(',');
        pedidosFiltrados = pedidosManutencao.filter(p => statusArray.includes(p.statusPedido));
    }

    // Se o usuário não tem permissão de gerenciar, ele só vê os próprios pedidos
    if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
        pedidosFiltrados = pedidosFiltrados.filter(p => p.solicitanteEmail === req.usuario.email);
    }

    pedidosFiltrados.sort((a,b) => new Date(b.dataSolicitacao) - new Date(a.dataSolicitacao));

    // Para cada pedido, garantir que os dados dos rádios estejam completos
    const pedidosComRadiosCompletos = pedidosFiltrados.map(pedido => {
        const radiosComDetalhesCompletos = pedido.radios.map(radioDoPedido => {
            const radioCompletoNoEstoque = radios.find(r => r.numeroSerie === radioDoPedido.numeroSerie);
            return {
                numeroSerie: radioDoPedido.numeroSerie,
                modelo: radioCompletoNoEstoque?.modelo || radioDoPedido.modelo || 'N/A',
                patrimonio: radioCompletoNoEstoque?.patrimonio || radioDoPedido.patrimonio || 'N/A',
                frequencia: radioCompletoNoEstoque?.frequencia || 'N/A', // Frequência do estoque principal
                descricaoProblema: radioDoPedido.descricaoProblema // Problema vem da solicitação
            };
        });
        return { ...pedido, radios: radiosComDetalhesCompletos };
    });

    res.json(pedidosComRadiosCompletos);
});

// Buscar detalhes de UM pedido de manutenção específico
app.get('/manutencao/solicitacoes/:idPedido', autenticarToken, (req, res) => {
    // Permissão para gerenciar ou solicitar
    if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin') && !req.usuario.permissoes.includes('solicitar_manutencao')) {
        return res.status(403).json({ message: 'Acesso negado para ver detalhes do pedido.' });
    }
    const { idPedido } = req.params;
    const pedido = pedidosManutencao.find(p => p.idPedido === idPedido);

    if (!pedido) {
        return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
    }

    // Se o usuário não tem permissão de gerenciar, verifica se o pedido é dele
    if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
        if (pedido.solicitanteEmail !== req.usuario.email) {
            return res.status(403).json({ message: 'Acesso negado. Você só pode visualizar seus próprios pedidos.' });
        }
    }

    // Para cada rádio no pedido, buscar informações completas do rádio principal
    const radiosComDetalhesCompletos = pedido.radios.map(radioDoPedido => {
        const radioCompletoNoEstoque = radios.find(r => r.numeroSerie === radioDoPedido.numeroSerie);
        return {
            numeroSerie: radioDoPedido.numeroSerie,
            modelo: radioCompletoNoEstoque?.modelo || radioDoPedido.modelo || 'N/A', // Prioriza o modelo do estoque, se não tiver, usa o do pedido ou N/A
            patrimonio: radioCompletoNoEstoque?.patrimonio || radioDoPedido.patrimonio || 'N/A', // Prioriza o patrimônio do estoque, se não tiver, usa o do pedido ou N/A
            frequencia: radioCompletoNoEstoque?.frequencia || 'N/A', // Frequência só viria do estoque principal
            descricaoProblema: radioDoPedido.descricaoProblema // Problema vem da solicitação
        };
    });

    res.json({ ...pedido, radios: radiosComDetalhesCompletos });
});

// Dar andamento a um pedido
app.post('/manutencao/pedidos/:idPedido/dar-andamento', autenticarToken, (req, res) => {
    if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
        return res.status(403).json({ message: 'Acesso negado para dar andamento ao pedido.' });
    }
    const { idPedido } = req.params;
    const pedidoIndex = pedidosManutencao.findIndex(p => p.idPedido === idPedido);

    if (pedidoIndex === -1) {
        return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
    }
    const pedido = pedidosManutencao[pedidoIndex];

    if (pedido.statusPedido !== 'aberto') {
        return res.status(400).json({ message: `Este pedido já está com status "${pedido.statusPedido}". Somente pedidos 'aberto' podem receber andamento.` });
    }

    pedido.statusPedido = 'aguardando_manutencao';

    // ATUALIZA O STATUS DO RÁDIO NO ESTOQUE PRINCIPAL PARA 'Manutenção'
    pedido.radios.forEach(radioSol => {
        const radioPrincipalIndex = radios.findIndex(r => r.numeroSerie === radioSol.numeroSerie);
        if (radioPrincipalIndex !== -1) {
            radios[radioPrincipalIndex].status = 'Manutenção'; // Define o status principal do rádio como 'Manutenção'
        }
    });

    db.salvar('pedidosManutencao', pedidosManutencao);
    db.salvar('radios', radios); // Salva as alterações nos rádios
    res.json({ message: `Pedido ${idPedido} teve andamento confirmado. Rádios aguardando manutenção.` });
});

// Iniciar Manutenção em um pedido
app.post('/manutencao/pedidos/:idPedido/iniciar', autenticarToken, (req, res) => {
    if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
        return res.status(403).json({ message: 'Acesso negado para iniciar manutenção.' });
    }
    const { idPedido } = req.params;
    const { tecnico } = req.body;

    if (!tecnico) {
        return res.status(400).json({ message: 'Nome do técnico é obrigatório para iniciar a manutenção.' });
    }

    const pedidoIndex = pedidosManutencao.findIndex(p => p.idPedido === idPedido);
    if (pedidoIndex === -1) {
        return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
    }

    const pedido = pedidosManutencao[pedidoIndex];
    if (pedido.statusPedido !== 'aguardando_manutencao') {
        return res.status(400).json({ message: `Este pedido não está aguardando manutenção (status atual: ${pedido.statusPedido}).` });
    }

    pedido.statusPedido = 'em_manutencao';
    pedido.tecnicoResponsavel = tecnico;
    pedido.dataInicioManutencao = new Date().toISOString();

    // Rádios já devem estar com status 'Manutenção' desde o "Dar Andamento",
    // mas garantimos aqui que não houve regressão.
    pedido.radios.forEach(radioSol => {
        const radioPrincipalIndex = radios.findIndex(r => r.numeroSerie === radioSol.numeroSerie);
        if (radioPrincipalIndex !== -1) {
             radios[radioPrincipalIndex].status = 'Manutenção';
        }
    });

    db.salvar('pedidosManutencao', pedidosManutencao);
    db.salvar('radios', radios);
    res.json({ message: `Manutenção do pedido ${idPedido} iniciada com sucesso pelo técnico ${tecnico}.` });
});

// Concluir Manutenção de um pedido
app.post('/manutencao/pedidos/:idPedido/concluir', autenticarToken, (req, res) => {
    if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
        return res.status(403).json({ message: 'Acesso negado para concluir manutenção.' });
    }
    const { idPedido } = req.params;
    const { observacoesTecnicas } = req.body;

    const pedidoIndex = pedidosManutencao.findIndex(p => p.idPedido === idPedido);
    if (pedidoIndex === -1) {
        return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
    }

    const pedido = pedidosManutencao[pedidoIndex];
    if (pedido.statusPedido !== 'em_manutencao') {
        return res.status(400).json({ message: `Este pedido não está em processo de manutenção (status atual: ${pedido.statusPedido}).` });
    }

    pedido.statusPedido = 'finalizado';
    pedido.dataFimManutencao = new Date().toISOString();
    pedido.observacoesTecnicas = observacoesTecnicas || "";

    // ATUALIZA O STATUS DO RÁDIO NO ESTOQUE PRINCIPAL PARA 'Disponível'
    pedido.radios.forEach(radioSol => {
        const radioPrincipalIndex = radios.findIndex(r => r.numeroSerie === radioSol.numeroSerie);
        if (radioPrincipalIndex !== -1) {
            radios[radioPrincipalIndex].status = 'Disponível'; // Retorna o rádio para 'Disponível'
        }
    });

    db.salvar('pedidosManutencao', pedidosManutencao);
    db.salvar('radios', radios); // Salva as alterações nos rádios
    res.json({ message: `Manutenção do pedido ${idPedido} concluída com sucesso. Rádios retornaram ao estoque como 'Disponível'.` });
});

// Rota para listar os rádios que estão no "estoque de manutenção"
app.get('/manutencao/estoque', autenticarToken, (req, res) => {
    if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
        return res.status(403).json({ message: 'Acesso negado para visualizar o estoque de manutenção.' });
    }

    const { numeroSerie, modelo, patrimonio, dataInicio, dataFim } = req.query; // Novas query params

    let itensEstoqueManutencao = [];

    pedidosManutencao.forEach(pedido => {
        if (pedido.statusPedido === 'aguardando_manutencao' || pedido.statusPedido === 'em_manutencao') {
            pedido.radios.forEach(radioDoPedido => {
                const radioPrincipal = radios.find(r => r.numeroSerie === radioDoPedido.numeroSerie);

                if (radioPrincipal) {
                    if (radioPrincipal.status === 'Manutenção') {
                        itensEstoqueManutencao.push({
                            radio: {
                                numeroSerie: radioPrincipal.numeroSerie,
                                modelo: radioPrincipal.modelo,
                                patrimonio: radioPrincipal.patrimonio,
                                frequencia: radioPrincipal.frequencia,
                                statusPrincipalEstoque: radioPrincipal.status
                            },
                            pedido: {
                                idPedido: pedido.idPedido,
                                statusPedido: pedido.statusPedido,
                                tecnicoResponsavel: pedido.tecnicoResponsavel,
                                dataSolicitacao: pedido.dataSolicitacao,
                                dataInicioManutencao: pedido.dataInicioManutencao, // Add for potential future filter
                                dataFimManutencao: pedido.dataFimManutencao, // Add for potential future filter
                                solicitanteNome: pedido.solicitanteNome,
                                prioridade: pedido.prioridade
                            },
                            problemaDescrito: radioDoPedido.descricaoProblema
                        });
                    }
                } else {
                    console.warn(`Rádio com S/N ${radioDoPedido.numeroSerie} do pedido ${pedido.idPedido} não encontrado no estoque principal.`);
                }
            });
        }
    });

    // Apply filters from query parameters
    let filteredItens = itensEstoqueManutencao.filter(item => {
        const matchesNumeroSerie = !numeroSerie || item.radio.numeroSerie.toLowerCase().includes(numeroSerie.toLowerCase());
        const matchesModelo = !modelo || item.radio.modelo.toLowerCase().includes(modelo.toLowerCase());
        const matchesPatrimonio = !patrimonio || (item.radio.patrimonio && item.radio.patrimonio.toLowerCase().includes(patrimonio.toLowerCase()));

        // Date filtering based on dataSolicitacao
        const dataSolicitacaoDate = item.pedido.dataSolicitacao ? new Date(item.pedido.dataSolicitacao) : null;
        const matchesDataInicio = !dataInicio || (dataSolicitacaoDate && dataSolicitacaoDate >= new Date(dataInicio));
        // Add 23:59:59 to dataFim to include the whole day
        const matchesDataFim = !dataFim || (dataSolicitacaoDate && dataSolicitacaoDate <= new Date(dataFim + 'T23:59:59'));

        return matchesNumeroSerie && matchesModelo && matchesPatrimonio && matchesDataInicio && matchesDataFim;
    });

    filteredItens.sort((a, b) => {
        const statusOrder = { 'aguardando_manutencao': 1, 'em_manutencao': 2 };
        const statusA = statusOrder[a.pedido.statusPedido] || 99;
        const statusB = statusOrder[b.pedido.statusPedido] || 99;

        if (statusA !== statusB) return statusA - statusB;

        if (a.pedido.idPedido < b.pedido.idPedido) return -1;
        if (a.pedido.idPedido > b.pedido.idPedido) return 1;
        if (a.radio.numeroSerie < b.radio.numeroSerie) return -1;
        if (a.radio.numeroSerie > b.radio.numeroSerie) return 1;
        return 0;
    });

    res.json(filteredItens);
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(port, () => {
    console.log(`✅ Servidor RadioScan rodando em http://localhost:${port}`);
});