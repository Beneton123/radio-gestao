// backend/server.js

// --- CONFIGURAÇÃO INICIAL E IMPORTS ---
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// --- Importar Modelos Mongoose ---
const Radio = require('./models/Radio');
const Usuario = require('./models/Usuario');
const NotaFiscal = require('./models/NotaFiscal');
const PedidoManutencao = require('./models/PedidoManutencao');
const Counter = require('./models/Counter');

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'sua-chave-secreta-padrao-para-dev';

app.use(cors());
app.use(express.json());

// --- FUNÇÃO AUXILIAR PARA GERAR IDs ---
async function getNextSequenceValue(sequenceName) {
    const sequenceDocument = await Counter.findOneAndUpdate(
       { _id: sequenceName },
       { $inc: { sequence_value: 1 } },
       { new: true, upsert: true }
    );
    return sequenceDocument.sequence_value;
}

// --- CONEXÃO COM O MONGODB E INICIALIZAÇÃO DO SERVIDOR ---
const mongoUri = process.env.MONGODB_URI;

mongoose.connect(mongoUri)
    .then(async () => {
        console.log('✅ Conectado ao MongoDB Atlas!');

        try {
            const adminUser = await Usuario.findOne({ email: 'admin@admin.com' });
            if (!adminUser) {
                console.log('Criando usuário admin padrão...');
                const senhaHash = bcrypt.hashSync('admin123', 10);
                await Usuario.create({
                    nome: 'Administrador',
                    email: 'admin@admin.com',
                    senha: senhaHash,
                    permissoes: ['admin', 'gerenciar_manutencao', 'solicitar_manutencao']
                });
                console.log('Usuário admin padrão criado.');
            }
        } catch (error) {
            console.error('Erro na inicialização de dados do usuário admin:', error);
        }
        
        app.listen(port, () => {
            console.log(`✅ Servidor RadioScan rodando em http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error('❌ Erro fatal ao conectar ao MongoDB:', err);
        process.exit(1);
    });

// --- Configuração de Caminhos Estáticos ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});
app.use(express.static(path.join(__dirname, '../frontend')));

// --- Middlewares ---
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, usuario) => {
        if (err) return res.sendStatus(403);
        req.usuario = usuario;
        next();
    });
}

function autorizarAdmin(req, res, next) {
    if (!req.usuario || !req.usuario.permissoes || !req.usuario.permissoes.includes('admin')) {
        return res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador.' });
    }
    next();
}

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        const isMatch = await bcrypt.compare(senha, usuario.senha);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        const tokenPayload = {
            email: usuario.email,
            nome: usuario.nome,
            permissoes: usuario.permissoes
        };
        const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: '8h' });
        res.json({ token, nome: usuario.nome, permissoes: usuario.permissoes });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno no servidor.' });
    }
});

// --- ROTAS DE USUÁRIOS ---
app.post('/usuarios', autenticarToken, autorizarAdmin, async (req, res) => {
    const { nome, email, senha, permissoes } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Nome, email e senha são obrigatórios.' });
    }
    try {
        const existingUser = await Usuario.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Usuário com este email já existe.' });
        }
        const novoUsuario = await Usuario.create({ nome, email, senha, permissoes: permissoes || [] });
        const { senha: _, ...usuarioSemSenha } = novoUsuario.toObject();
        res.status(201).json({ message: 'Usuário criado com sucesso.', user: usuarioSemSenha });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ message: 'Erro ao criar usuário.' });
    }
});

app.get('/usuarios', autenticarToken, autorizarAdmin, async (req, res) => {
    try {
        const listaUsuarios = await Usuario.find({}, { senha: 0 });
        res.json(listaUsuarios);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ message: 'Erro ao listar usuários.' });
    }
});

app.delete('/usuarios/:email', autenticarToken, autorizarAdmin, async (req, res) => {
    const { email } = req.params;
    if (email === 'admin@admin.com') {
        return res.status(403).json({ message: 'Não é permitido excluir o administrador padrão.' });
    }
    try {
        const result = await Usuario.deleteOne({ email });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.json({ message: 'Usuário excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ message: 'Erro ao excluir usuário.' });
    }
});

// --- ROTAS DE RÁDIOS ---
app.post('/radios', autenticarToken, async (req, res) => {
    const { modelo, numeroSerie, patrimonio, frequencia } = req.body;
    if (!modelo || !numeroSerie || !patrimonio || !frequencia) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }
    try {
        const existingRadio = await Radio.findOne({ numeroSerie });
        if (existingRadio) {
            return res.status(409).json({ message: 'Rádio com este número de série já cadastrado.' });
        }
        const novoRadio = await Radio.create({ modelo, numeroSerie, patrimonio, frequencia });
        res.status(201).json({ message: 'Rádio cadastrado com sucesso.', radio: novoRadio });
    } catch (error) {
        console.error('Erro ao cadastrar rádio:', error);
        res.status(500).json({ message: 'Erro ao cadastrar rádio.' });
    }
});

app.get('/radios', autenticarToken, async (req, res) => {
    try {
        const radios = await Radio.find({});
        res.json(radios);
    } catch (error) {
        console.error('Erro ao listar rádios:', error);
        res.status(500).json({ message: 'Erro ao listar rádios.' });
    }
});

app.get('/radios/:numeroSerie', autenticarToken, async (req, res) => {
    const { numeroSerie } = req.params;
    try {
        const radio = await Radio.findOne({ numeroSerie });
        if (!radio) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }
        res.json(radio);
    } catch (error) {
        console.error('Erro ao buscar rádio:', error);
        res.status(500).json({ message: 'Erro ao buscar rádio.' });
    }
});

app.delete('/radios/:numeroSerie', autenticarToken, async (req, res) => {
    const { numeroSerie } = req.params;
    try {
        const radio = await Radio.findOne({ numeroSerie });
        if (!radio) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }
        if (radio.status !== 'Disponível') {
            return res.status(400).json({ message: `Rádio está ${radio.status.toLowerCase()} e não pode ser excluído.` });
        }
        await Radio.deleteOne({ numeroSerie });
        res.json({ message: 'Rádio excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir rádio:', error);
        res.status(500).json({ message: 'Erro ao excluir rádio.' });
    }
});

app.put('/radios/:numeroSerie/patrimonio', autenticarToken, async (req, res) => {
    const { numeroSerie } = req.params;
    const { patrimonio } = req.body;
    if (patrimonio === undefined || patrimonio === null) {
        return res.status(400).json({ message: 'O campo patrimônio é obrigatório.' });
    }
    try {
        const radioAtualizado = await Radio.findOneAndUpdate(
            { numeroSerie },
            { patrimonio },
            { new: true }
        );
        if (!radioAtualizado) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }
        res.json({ message: `Patrimônio do rádio ${numeroSerie} atualizado com sucesso.`, radio: radioAtualizado });
    } catch (error) {
        console.error('Erro ao atualizar patrimônio do rádio:', error);
        res.status(500).json({ message: 'Erro ao atualizar patrimônio do rádio.' });
    }
});

// --- ROTAS DE NOTAS FISCAIS ---
app.post('/nf/saida', autenticarToken, async (req, res) => {
    const { nfNumero, cliente, dataSaida, previsaoRetorno, radiosSaida } = req.body;
    if (!nfNumero || !cliente || !dataSaida || !Array.isArray(radiosSaida) || radiosSaida.length === 0) {
        return res.status(400).json({ message: 'Dados incompletos para NF de saída.' });
    }
    try {
        const existingNF = await NotaFiscal.findOne({ nfNumero, tipo: 'Saída' });
        if (existingNF) {
            return res.status(409).json({ message: 'Nota Fiscal de Saída com este número já existe.' });
        }
        for (const serie of radiosSaida) {
            const radio = await Radio.findOne({ numeroSerie: serie });
            if (!radio) {
                return res.status(400).json({ message: `Rádio com número de série ${serie} não encontrado.` });
            }
            if (radio.status !== 'Disponível') {
                return res.status(400).json({ message: `Rádio ${serie} não está disponível.` });
            }
        }
        const novaNFSaida = await NotaFiscal.create({
            nfNumero,
            tipo: 'Saída',
            cliente,
            dataSaida: new Date(dataSaida),
            previsaoRetorno: previsaoRetorno ? new Date(previsaoRetorno) : null,
            radios: radiosSaida,
            usuarioRegistro: req.usuario.email
        });
        for (const serie of radiosSaida) {
            await Radio.updateOne(
                { numeroSerie: serie },
                { status: 'Ocupado', nfAtual: nfNumero, ultimaNfSaida: nfNumero }
            );
        }
        res.status(201).json({ message: 'NF de Saída registrada com sucesso.', nf: novaNFSaida });
    } catch (error) {
        console.error('Erro ao registrar NF de Saída:', error);
        res.status(500).json({ message: 'Erro ao registrar NF de Saída.' });
    }
});

app.post('/nf/entrada', autenticarToken, async (req, res) => {
    const { nfNumero, dataEntrada, observacoes } = req.body;
    if (!nfNumero || !dataEntrada) {
        return res.status(400).json({ message: 'Número da NF e data de entrada são obrigatórios.' });
    }
    try {
        const nfSaidaOriginal = await NotaFiscal.findOne({ nfNumero, tipo: 'Saída' });
        if (!nfSaidaOriginal) {
            return res.status(404).json({ message: `NF de Saída ${nfNumero} não encontrada.` });
        }
        if (nfSaidaOriginal.dataEntrada) {
            return res.status(400).json({ message: `Retorno para a NF ${nfNumero} já foi registrado.` });
        }
        nfSaidaOriginal.dataEntrada = new Date(dataEntrada);
        nfSaidaOriginal.observacoes = Array.isArray(observacoes) ? observacoes : (observacoes ? [observacoes] : []);
        await nfSaidaOriginal.save();
        for (const serie of nfSaidaOriginal.radios) {
            await Radio.updateOne(
                { numeroSerie: serie },
                { status: 'Disponível', nfAtual: null, ultimaNfEntrada: nfNumero }
            );
        }
        res.json({ message: `Retorno para NF ${nfNumero} registrado com sucesso.` });
    } catch (error) {
        console.error('Erro ao registrar NF de Entrada:', error);
        res.status(500).json({ message: 'Erro ao registrar NF de Entrada.' });
    }
});

app.get('/nf', autenticarToken, async (req, res) => {
    try {
        const notasFiscais = await NotaFiscal.find({});
        res.json(notasFiscais);
    } catch (error) {
        console.error('Erro ao listar NFs:', error);
        res.status(500).json({ message: 'Erro ao listar NFs.' });
    }
});

// --- ROTAS DE CONSULTA ---
app.get('/nf/:nfNumero', autenticarToken, async (req, res) => {
    const { nfNumero } = req.params;
    try {
        const nf = await NotaFiscal.findOne({ nfNumero });
        if (!nf) {
            return res.status(404).json({ message: 'Nota Fiscal não encontrada.' });
        }
        const radiosDetalhadosNaNF = [];
        for (const serie of nf.radios) {
            const radioDoEstoque = await Radio.findOne({ numeroSerie: serie });
            radiosDetalhadosNaNF.push({
                numeroSerie: serie,
                modelo: radioDoEstoque?.modelo || 'N/A',
                patrimonio: radioDoEstoque?.patrimonio || 'N/A',
                frequencia: radioDoEstoque?.frequencia || 'N/A'
            });
        }
        res.json({ ...nf.toObject(), radios: radiosDetalhadosNaNF });
    } catch (error) {
        console.error('Erro ao buscar detalhes da NF:', error);
        res.status(500).json({ message: 'Erro ao buscar detalhes da NF.' });
    }
});

app.get('/extrato/:numeroSerie', autenticarToken, async (req, res) => {
    const { numeroSerie } = req.params;
    try {
        const historicoNF = await NotaFiscal.find({ radios: numeroSerie }).sort({ dataSaida: -1 });
        res.json(historicoNF);
    } catch (error) {
        console.error('Erro ao buscar extrato do rádio:', error);
        res.status(500).json({ message: 'Erro ao buscar extrato do rádio.' });
    }
});

// --- NOVA ROTA PARA HISTÓRICO COMPLETO DO RÁDIO ---
app.get('/api/radios/:numeroSerie/historico-completo', autenticarToken, async (req, res) => {
    const { numeroSerie } = req.params;
    let historicoCombinado = [];

    try {
        // 1. Buscar histórico de Notas Fiscais
        const notasFiscais = await NotaFiscal.find({ radios: numeroSerie }).sort({ createdAt: -1 });
        notasFiscais.forEach(nf => {
            if (nf.dataSaida) {
                historicoCombinado.push({
                    tipoEvento: 'NF_SAIDA',
                    dataEvento: nf.dataSaida,
                    documento: `NF Saída: ${nf.nfNumero}`,
                    detalhes: `Cliente: ${nf.cliente}. Previsão Retorno: ${nf.previsaoRetorno ? new Date(nf.previsaoRetorno).toLocaleDateString('pt-BR') : '-'}`,
                    objOriginalTipo: 'NotaFiscal',
                    objOriginal: nf
                });
            }
            if (nf.dataEntrada) {
                historicoCombinado.push({
                    tipoEvento: 'NF_ENTRADA',
                    dataEvento: nf.dataEntrada,
                    documento: `NF Retorno: ${nf.nfNumero}`,
                    detalhes: `Cliente: ${nf.cliente}. Observações: ${(nf.observacoes && nf.observacoes.length > 0) ? nf.observacoes.join(', ') : 'Nenhuma'}`,
                    objOriginalTipo: 'NotaFiscal',
                    objOriginal: nf
                });
            }
        });

        // 2. Buscar histórico de Pedidos de Manutenção
        // A query { 'radios.numeroSerie': numeroSerie } busca em arrays de subdocumentos.
        const pedidosManutencao = await PedidoManutencao.find({ 'radios.numeroSerie': numeroSerie }).sort({ createdAt: -1 });
        
        pedidosManutencao.forEach(pm => {
            // Para cada pedido, verificar se o rádio específico está nele e adicionar eventos
            // A query já garante que o rádio está no pedido, então podemos adicionar os eventos do pedido.
            // Um pedido pode gerar múltiplos eventos na linha do tempo.

            const radioNoPedido = pm.radios.find(r => r.numeroSerie === numeroSerie);
            const problemaDescrito = radioNoPedido ? radioNoPedido.descricaoProblema : 'N/A';

            historicoCombinado.push({
                tipoEvento: 'MANUTENCAO_SOLICITADA',
                dataEvento: pm.dataSolicitacao,
                documento: `Pedido: ${pm.idPedido}`,
                detalhes: `Solicitante: ${pm.solicitanteNome}. Problema: ${problemaDescrito}. Prioridade: ${pm.prioridade}.`,
                objOriginalTipo: 'PedidoManutencao',
                objOriginal: pm 
            });

            if (pm.dataInicioManutencao) {
                historicoCombinado.push({
                    tipoEvento: 'MANUTENCAO_INICIADA',
                    dataEvento: pm.dataInicioManutencao,
                    documento: `Pedido: ${pm.idPedido}`,
                    detalhes: `Início da Manutenção. Técnico: ${pm.tecnicoResponsavel || 'N/A'}.`,
                    objOriginalTipo: 'PedidoManutencao',
                    objOriginal: pm
                });
            }
            if (pm.dataFimManutencao) {
                historicoCombinado.push({
                    tipoEvento: 'MANUTENCAO_FINALIZADA',
                    dataEvento: pm.dataFimManutencao,
                    documento: `Pedido: ${pm.idPedido}`,
                    detalhes: `Manutenção Finalizada. Técnico: ${pm.tecnicoResponsavel || 'N/A'}. Obs. Técnicas: ${pm.observacoesTecnicas || 'Nenhuma'}.`,
                    objOriginalTipo: 'PedidoManutencao',
                    objOriginal: pm
                });
            }
             if (pm.statusPedido === 'cancelado' && pm.updatedAt) { // Considerando updatedAt como data do cancelamento se não houver data específica
                historicoCombinado.push({
                    tipoEvento: 'MANUTENCAO_CANCELADA',
                    dataEvento: pm.updatedAt, // Ou uma data específica de cancelamento se você tiver
                    documento: `Pedido: ${pm.idPedido}`,
                    detalhes: `Pedido de manutenção cancelado.`,
                    objOriginalTipo: 'PedidoManutencao',
                    objOriginal: pm
                });
            }
        });

        // 3. Ordenar o histórico combinado pela data do evento (mais recente primeiro)
        historicoCombinado.sort((a, b) => new Date(b.dataEvento) - new Date(a.dataEvento));

        res.json(historicoCombinado);

    } catch (error) {
        console.error(`Erro ao buscar histórico completo para o rádio ${numeroSerie}:`, error);
        res.status(500).json({ message: 'Erro interno ao buscar histórico completo do rádio.' });
    }
});


app.get('/movimentacoes/recentes', autenticarToken, async (req, res) => {
    try {
        const notasFiscais = await NotaFiscal.find({}).sort({ createdAt: -1 }).limit(20);
        const movimentacoes = [];
        notasFiscais.forEach(nf => {
            if (nf.tipo === 'Saída' && nf.dataSaida) {
                movimentacoes.push({
                    id: `saida-${nf.nfNumero}`,
                    tipo: 'Saída',
                    numeroNF: nf.nfNumero,
                    cliente: nf.cliente,
                    data: nf.dataSaida,
                });
            }
            if (nf.dataEntrada) {
                movimentacoes.push({
                    id: `entrada-${nf.nfNumero}`,
                    tipo: 'Entrada',
                    numeroNF: nf.nfNumero,
                    cliente: nf.cliente,
                    data: nf.dataEntrada,
                });
            }
        });
        movimentacoes.sort((a, b) => new Date(b.data) - new Date(a.data));
        res.json(movimentacoes.slice(0, 20));
    } catch (error) {
        console.error('Erro ao listar movimentações recentes:', error);
        res.status(500).json({ message: 'Erro ao listar movimentações recentes.' });
    }
});

app.get('/movimentacoes/:id', autenticarToken, async (req, res) => {
    const { id } = req.params;
    const [tipoMov, nfNumero] = id.split('-');
    try {
        const nfOriginal = await NotaFiscal.findOne({ nfNumero });
        if (!nfOriginal) {
            return res.status(404).json({ message: 'Movimentação ou NF não encontrada.' });
        }
        const radiosDetalhados = [];
        for (const serie of nfOriginal.radios) {
            const radioInfo = await Radio.findOne({ numeroSerie: serie });
            radiosDetalhados.push({
                modelo: radioInfo?.modelo || 'N/A',
                numeroSerie: serie,
                patrimonio: radioInfo?.patrimonio || 'N/A',
                frequencia: radioInfo?.frequencia || 'N/A'
            });
        }
        let movimentacaoDetalhada;
        if (tipoMov === 'saida') {
            movimentacaoDetalhada = {
                id, tipo: 'Saída', numeroNF: nfOriginal.nfNumero, cliente: nfOriginal.cliente,
                data: nfOriginal.dataSaida, previsaoRetorno: nfOriginal.previsaoRetorno,
                radios: radiosDetalhados, observacoes: nfOriginal.observacoes
            };
        } else if (tipoMov === 'entrada' && nfOriginal.dataEntrada) {
            movimentacaoDetalhada = {
                id, tipo: 'Entrada', numeroNF: nfOriginal.nfNumero, cliente: nfOriginal.cliente,
                data: nfOriginal.dataEntrada, radios: radiosDetalhados, observacoes: nfOriginal.observacoes
            };
        } else {
            return res.status(404).json({ message: 'Tipo de movimentação inválido.' });
        }
        res.json(movimentacaoDetalhada);
    } catch (error) {
        console.error('Erro ao buscar detalhes da movimentação:', error);
        res.status(500).json({ message: 'Erro ao buscar detalhes da movimentação.' });
    }
});

// --- ROTAS DE MANUTENÇÃO ---
app.post('/manutencao/solicitacoes', autenticarToken, async (req, res) => {
    const { solicitanteNome, prioridade, radios: radiosSolicitados, observacoesSolicitante } = req.body;
    const solicitanteEmail = req.usuario.email;
    if (!solicitanteNome || !solicitanteEmail || !prioridade || !Array.isArray(radiosSolicitados) || radiosSolicitados.length === 0) {
        return res.status(400).json({ message: 'Dados incompletos para a solicitação de manutenção.' });
    }
    try {
        for (const radioSol of radiosSolicitados) {
            if (!radioSol.numeroSerie || !radioSol.modelo || !radioSol.patrimonio || !radioSol.descricaoProblema) {
                return res.status(400).json({ message: `Dados incompletos para o rádio ${radioSol.numeroSerie || '(sem série)'}.` });
            }
            const radioExistente = await Radio.findOne({ numeroSerie: radioSol.numeroSerie });
            if (!radioExistente) {
                return res.status(400).json({ message: `Rádio com série ${radioSol.numeroSerie} não encontrado.` });
            }
            if (radioExistente.status !== 'Disponível') {
                return res.status(400).json({ message: `O rádio "${radioExistente.numeroSerie}" não está disponível.` });
            }
        }

        const proximoIdNumerico = await getNextSequenceValue('pedidoId');
        const novoIdPedido = `PE${String(proximoIdNumerico).padStart(6, '0')}`;

        const novoPedido = await PedidoManutencao.create({
            idPedido: novoIdPedido,
            solicitanteNome,
            solicitanteEmail,
            dataSolicitacao: new Date(),
            prioridade,
            radios: radiosSolicitados,
            statusPedido: 'aberto',
            observacoesSolicitante: observacoesSolicitante || null,
        });
        res.status(201).json({ message: 'Solicitação de manutenção criada com sucesso!', idPedido: novoPedido.idPedido, pedido: novoPedido });
    } catch (error) {
        console.error('Erro ao criar solicitação de manutenção:', error);
        res.status(500).json({ message: 'Erro ao criar solicitação de manutenção.' });
    }
});

app.get('/manutencao/solicitacoes', autenticarToken, async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        if (status) {
            query.statusPedido = { $in: status.split(',') };
        }
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            query.solicitanteEmail = req.usuario.email;
        }
        const pedidosFiltrados = await PedidoManutencao.find(query).sort({ dataSolicitacao: -1 });
        const pedidosComRadiosCompletos = [];
        for (const pedido of pedidosFiltrados) {
            const radiosComDetalhesCompletos = [];
            for (const radioDoPedido of pedido.radios) {
                const radioCompletoNoEstoque = await Radio.findOne({ numeroSerie: radioDoPedido.numeroSerie });
                radiosComDetalhesCompletos.push({
                    numeroSerie: radioDoPedido.numeroSerie,
                    modelo: radioCompletoNoEstoque?.modelo || radioDoPedido.modelo || 'N/A',
                    patrimonio: radioCompletoNoEstoque?.patrimonio || radioDoPedido.patrimonio || 'N/A',
                    frequencia: radioCompletoNoEstoque?.frequencia || 'N/A',
                    descricaoProblema: radioDoPedido.descricaoProblema
                });
            }
            pedidosComRadiosCompletos.push({ ...pedido.toObject(), radios: radiosComDetalhesCompletos });
        }
        res.json(pedidosComRadiosCompletos);
    } catch (error) {
        console.error('Erro ao listar solicitações de manutenção:', error);
        res.status(500).json({ message: 'Erro ao listar solicitações de manutenção.' });
    }
});

app.get('/manutencao/solicitacoes/:idPedido', autenticarToken, async (req, res) => {
    const { idPedido } = req.params;
    try {
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            if (pedido.solicitanteEmail !== req.usuario.email) {
                return res.status(403).json({ message: 'Acesso negado. Você só pode ver seus próprios pedidos.' });
            }
        }
        const radiosComDetalhesCompletos = [];
        for (const radioDoPedido of pedido.radios) {
            const radioCompletoNoEstoque = await Radio.findOne({ numeroSerie: radioDoPedido.numeroSerie });
            radiosComDetalhesCompletos.push({
                numeroSerie: radioDoPedido.numeroSerie,
                modelo: radioCompletoNoEstoque?.modelo || radioDoPedido.modelo || 'N/A',
                patrimonio: radioCompletoNoEstoque?.patrimonio || radioDoPedido.patrimonio || 'N/A',
                frequencia: radioCompletoNoEstoque?.frequencia || 'N/A',
                descricaoProblema: radioDoPedido.descricaoProblema
            });
        }
        res.json({ ...pedido.toObject(), radios: radiosComDetalhesCompletos });
    } catch (error) {
        console.error('Erro ao buscar detalhes do pedido de manutenção:', error);
        res.status(500).json({ message: 'Erro ao buscar detalhes do pedido de manutenção.' });
    }
});

app.post('/manutencao/pedidos/:idPedido/dar-andamento', autenticarToken, async (req, res) => {
    const { idPedido } = req.params;
    try {
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }
        if (pedido.statusPedido !== 'aberto') {
            return res.status(400).json({ message: `Este pedido já está com status "${pedido.statusPedido}".` });
        }
        pedido.statusPedido = 'aguardando_manutencao';
        await pedido.save();
        for (const radioSol of pedido.radios) {
            await Radio.updateOne({ numeroSerie: radioSol.numeroSerie }, { status: 'Manutenção' });
        }
        res.json({ message: `Pedido ${idPedido} teve andamento confirmado.` });
    } catch (error) {
        console.error('Erro ao dar andamento no pedido:', error);
        res.status(500).json({ message: 'Erro ao dar andamento no pedido.' });
    }
});

app.post('/manutencao/pedidos/:idPedido/iniciar', autenticarToken, async (req, res) => {
    const { idPedido } = req.params;
    const { tecnico } = req.body;
    try {
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }
        if (!tecnico) {
            return res.status(400).json({ message: 'Nome do técnico é obrigatório.' });
        }
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }
        if (pedido.statusPedido !== 'aguardando_manutencao') {
            return res.status(400).json({ message: `Este pedido não está aguardando manutenção.` });
        }
        pedido.statusPedido = 'em_manutencao';
        pedido.tecnicoResponsavel = tecnico;
        pedido.dataInicioManutencao = new Date();
        await pedido.save();
        res.json({ message: `Manutenção do pedido ${idPedido} iniciada pelo técnico ${tecnico}.` });
    } catch (error) {
        console.error('Erro ao iniciar manutenção:', error);
        res.status(500).json({ message: 'Erro ao iniciar manutenção.' });
    }
});

app.post('/manutencao/pedidos/:idPedido/concluir', autenticarToken, async (req, res) => {
    const { idPedido } = req.params;
    const { observacoesTecnicas } = req.body;
    try {
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }
        const pedido = await PedidoManutencao.findOne({ idPedido });
        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }
        if (pedido.statusPedido !== 'em_manutencao') {
            return res.status(400).json({ message: `Este pedido não está em manutenção.` });
        }
        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || "";
        await pedido.save();
        for (const radioSol of pedido.radios) {
            await Radio.updateOne({ numeroSerie: radioSol.numeroSerie }, { status: 'Disponível' });
        }
        res.json({ message: `Manutenção do pedido ${idPedido} concluída.` });
    } catch (error) {
        console.error('Erro ao concluir manutenção:', error);
        res.status(500).json({ message: 'Erro ao concluir manutenção.' });
    }
});

app.get('/manutencao/estoque', autenticarToken, async (req, res) => {
    const { numeroSerie, modelo, patrimonio, dataInicio, dataFim } = req.query;
    try {
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado.' });
        }
        const radiosEmManutencaoNoEstoque = await Radio.find({ status: 'Manutenção' });
        const seriesEmManutencao = radiosEmManutencaoNoEstoque.map(r => r.numeroSerie);
        let queryPedidos = {
            'radios.numeroSerie': { $in: seriesEmManutencao },
            statusPedido: { $in: ['aguardando_manutencao', 'em_manutencao'] }
        };
        if (dataInicio) {
            queryPedidos.dataSolicitacao = { ...queryPedidos.dataSolicitacao, $gte: new Date(dataInicio) };
        }
        if (dataFim) {
            queryPedidos.dataSolicitacao = { ...queryPedidos.dataSolicitacao, $lte: new Date(dataFim + 'T23:59:59') };
        }
        const pedidosRelevantes = await PedidoManutencao.find(queryPedidos).sort({ dataSolicitacao: -1 });
        let itensEstoqueManutencao = [];
        for (const pedido of pedidosRelevantes) {
            for (const radioDoPedido of pedido.radios) {
                if (seriesEmManutencao.includes(radioDoPedido.numeroSerie)) {
                    const radioPrincipal = radiosEmManutencaoNoEstoque.find(r => r.numeroSerie === radioDoPedido.numeroSerie);
                    const matchesNumeroSerie = !numeroSerie || radioPrincipal.numeroSerie.toLowerCase().includes(numeroSerie.toLowerCase());
                    const matchesModelo = !modelo || radioPrincipal.modelo.toLowerCase().includes(modelo.toLowerCase());
                    const matchesPatrimonio = !patrimonio || (radioPrincipal.patrimonio && radioPrincipal.patrimonio.toLowerCase().includes(patrimonio.toLowerCase()));
                    if (matchesNumeroSerie && matchesModelo && matchesPatrimonio) {
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
                                dataInicioManutencao: pedido.dataInicioManutencao,
                                dataFimManutencao: pedido.dataFimManutencao,
                                solicitanteNome: pedido.solicitanteNome,
                                prioridade: pedido.prioridade
                            },
                            problemaDescrito: radioDoPedido.descricaoProblema
                        });
                    }
                }
            }
        }
        itensEstoqueManutencao.sort((a, b) => {
            const statusOrder = { 'aguardando_manutencao': 1, 'em_manutencao': 2, 'finalizado': 3, 'aberto': 4, 'cancelado': 5 };
            const statusA = statusOrder[a.pedido.statusPedido] || 99;
            const statusB = statusOrder[b.pedido.statusPedido] || 99;
            if (statusA !== statusB) return statusA - statusB;
            if (a.pedido.idPedido < b.pedido.idPedido) return -1;
            if (a.pedido.idPedido > b.pedido.idPedido) return 1;
            if (a.radio.numeroSerie < b.radio.numeroSerie) return -1;
            if (a.radio.numeroSerie > b.radio.numeroSerie) return 1;
            return 0;
        });
        res.json(itensEstoqueManutencao);
    } catch (error) {
        console.error('Erro ao listar estoque de manutenção:', error);
        res.status(500).json({ message: 'Erro ao listar estoque de manutenção.' });
    }
});