const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path'); // Adicionado o módulo 'path'

require('dotenv').config(); // Carrega variáveis de ambiente do .env

const Radio = require('./models/Radio');
const Usuario = require('./models/Usuario');
const NotaFiscal = require('./models/NotaFiscal');
const PedidoManutencao = require('./models/PedidoManutencao');
const Counter = require('./models/Counter'); // Para IDs sequenciais

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';
const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey'; // Chave secreta para JWT

// Middlewares
app.use(cors());
app.use(express.json()); // Para parsear JSON no corpo das requisições

// Serve arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend'))); // Corrigido para servir a pasta 'frontend'

// Função para gerar IDs sequenciais
async function getNextSequenceValue(sequenceName) {
    const counter = await Counter.findOneAndUpdate(
        { _id: sequenceName },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    );
    // Formata o ID com zeros à esquerda (ex: PE000001)
    return `PE${String(counter.sequence_value).padStart(6, '0')}`;
}

// Conexão com o MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Conectado ao MongoDB Atlas!');

        // Criar usuário administrador padrão se não existir
        const adminEmail = 'admin@admin.com';
        const adminPassword = 'admin123'; // Senha padrão para o admin
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

        app.listen(port, host, () => {
            console.log(`✅ Servidor rodando.`);
            console.log(`   Acessível localmente em: http://localhost:${port}`);
            console.log(`   Acessível na rede em: http://${host === '0.0.0.0' ? '<SEU_IP_DE_REDE>' : host}:${port}`);
            console.log(`   (Substitua '<SEU_IP_DE_REDE>' pelo IP real da sua máquina na rede, ex: 10.110.120.213).`);
        });
    })
    .catch(err => {
        console.error('Erro de conexão com o MongoDB:', err);
        process.exit(1); // Encerra a aplicação se não conseguir conectar ao DB
    });

// Middleware de autenticação JWT
const autenticarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
    }

    jwt.verify(token, jwtSecret, (err, usuario) => {
        if (err) {
            console.error("Erro na verificação do token:", err.message);
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Token expirado. Faça login novamente.' });
            }
            return res.status(403).json({ message: 'Token inválido.' });
        }
        req.usuario = usuario; // Adiciona as informações do usuário ao objeto request
        next();
    });
};

// Middleware para autorização de administrador
const autorizarAdmin = (req, res, next) => {
    if (!req.usuario || !req.usuario.permissoes.includes('admin')) {
        return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }
    next();
};

// Serve o login.html como página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Rota de login
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
        if (!senhaCorreta) {
            return res.status(400).json({ message: 'Credenciais inválidas.' });
        }

        // Gera token JWT
        const token = jwt.sign(
            {
                email: usuario.email,
                nome: usuario.nome,
                permissoes: usuario.permissoes
            },
            jwtSecret,
            { expiresIn: '1h' } // Token expira em 1 hora
        );

        res.json({ token, nomeUsuario: usuario.nome, permissoes: usuario.permissoes });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rotas de Usuários
app.post('/usuarios', autenticarToken, autorizarAdmin, async (req, res) => {
    try {
        const { nome, email, senha, permissoes } = req.body;

        if (!nome || !email || !senha || !Array.isArray(permissoes)) {
            return res.status(400).json({ message: 'Todos os campos são obrigatórios e as permissões devem ser um array.' });
        }

        const usuarioExistente = await Usuario.findOne({ email });
        if (usuarioExistente) {
            return res.status(409).json({ message: 'Já existe um usuário com este e-mail.' });
        }

        // A senha será hasheada automaticamente pelo pré-save hook no modelo Usuario
        const novoUsuario = new Usuario({ nome, email, senha, permissoes });
        await novoUsuario.save();

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', usuario: { nome: novoUsuario.nome, email: novoUsuario.email, permissoes: novoUsuario.permissoes } });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar usuário.' });
    }
});
app.get('/usuarios', autenticarToken, autorizarAdmin, async (req, res) => {
    try {
        const usuarios = await Usuario.find({}, { senha: 0 }); // Não retorna o campo senha
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
app.delete('/usuarios/:email', autenticarToken, autorizarAdmin, async (req, res) => {
    try {
        const { email } = req.params;

        if (email === 'admin@admin.com') {
            return res.status(403).json({ message: 'O usuário administrador padrão não pode ser excluído.' });
        }

        const result = await Usuario.deleteOne({ email });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        res.status(200).json({ message: 'Usuário excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rotas de Rádios
app.post('/radios', autenticarToken, async (req, res) => {
    try {
        // Verifica se o usuário tem a permissão 'registrar_radio' ou é 'admin'
        if (!req.usuario.permissoes.includes('registrar_radio') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para cadastrar rádios.' });
        }

        const { modelo, numeroSerie, patrimonio, frequencia } = req.body;

        if (!modelo || !numeroSerie || !frequencia) {
            return res.status(400).json({ message: 'Modelo, Número de Série e Frequência são obrigatórios.' });
        }

        const radioExistente = await Radio.findOne({ numeroSerie });
        if (radioExistente) {
            return res.status(409).json({ message: 'Já existe um rádio com este número de série.' });
        }

        const novoRadio = new Radio({ modelo, numeroSerie, patrimonio, frequencia });
        await novoRadio.save();
        res.status(201).json({ message: 'Rádio cadastrado com sucesso!', radio: novoRadio });
    } catch (error) {
        console.error('Erro ao cadastrar rádio:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar rádio.' });
    }
});
app.get('/radios', autenticarToken, async (req, res) => {
    try {
        const { status, nfAtual, search } = req.query;
        let query = {};

        if (status) {
            query.status = status;
        }
        if (nfAtual) {
            query.nfAtual = nfAtual;
        }
        if (search) {
            const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
            query.$or = [
                { modelo: searchRegex },
                { numeroSerie: searchRegex },
                { patrimonio: searchRegex },
                { frequencia: searchRegex }
            ];
        }

        const radios = await Radio.find(query);
        res.json(radios);
    } catch (error) {
        console.error('Erro ao listar rádios:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
app.get('/radios/:numeroSerie', autenticarToken, async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const radio = await Radio.findOne({ numeroSerie });

        if (!radio) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }
        res.json(radio);
    } catch (error) {
        console.error('Erro ao buscar rádio por número de série:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
app.delete('/radios/:numeroSerie', autenticarToken, async (req, res) => {
    try {
        // Verifica se o usuário tem a permissão 'admin'
        if (!req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem excluir rádios.' });
        }

        const { numeroSerie } = req.params;
        const radio = await Radio.findOne({ numeroSerie });

        if (!radio) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }

        if (radio.status !== 'Disponível') {
            return res.status(400).json({ message: `Não é possível excluir o rádio pois ele está com status "${radio.status}".` });
        }

        await Radio.deleteOne({ numeroSerie });
        res.status(200).json({ message: 'Rádio excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir rádio:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.put('/radios/:numeroSerie/patrimonio', autenticarToken, async (req, res) => {
    try {
        // Verifica se o usuário tem a permissão 'admin'
        if (!req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem atualizar o patrimônio de rádios.' });
        }

        const { numeroSerie } = req.params;
        const { novoPatrimonio } = req.body;

        if (typeof novoPatrimonio === 'undefined' || novoPatrimonio === null) {
            return res.status(400).json({ message: 'Novo patrimônio é obrigatório.' });
        }

        const radio = await Radio.findOne({ numeroSerie });

        if (!radio) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }

        radio.patrimonio = novoPatrimonio;
        await radio.save();

        res.status(200).json({ message: 'Patrimônio do rádio atualizado com sucesso.', radio });
    } catch (error) {
        console.error('Erro ao atualizar patrimônio do rádio:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rotas de Notas Fiscais
app.post('/nf/saida', autenticarToken, async (req, res) => {
    try {
        const { nfNumero, cliente, dataSaida, previsaoRetorno, radios, observacoes, tipoLocacao } = req.body;

        // --- Início dos console.log para depuração (Remova em produção) ---
        console.log('--- Início da Requisição POST /nf/saida ---');
        console.log('Dados recebidos no backend para NF de Saída:');
        console.log('nfNumero:', nfNumero);
        console.log('cliente:', cliente);
        console.log('dataSaida:', dataSaida);
        console.log('previsaoRetorno:', previsaoRetorno);
        console.log('radios:', radios);
        console.log('tipoLocacao:', tipoLocacao);
        console.log('Tipo de tipoLocacao:', typeof tipoLocacao);
        console.log('É array radios?', Array.isArray(radios));
        console.log('Tamanho radios:', radios ? radios.length : 'N/A');
        console.log('--- Fim dos Dados Recebidos ---');
        // --- Fim dos console.log para depuração ---

        // Validação básica de todos os campos obrigatórios
        if (!nfNumero || !cliente || !dataSaida || !Array.isArray(radios) || radios.length === 0 || !tipoLocacao) {
            return res.status(400).json({ message: 'Dados da NF de Saída incompletos ou inválidos. (Todos os campos são obrigatórios: NF, Cliente, Data Saída, Rádios, Tipo de Locação)' });
        }

        // Validação específica para o valor de tipoLocacao
        if (!['Mensal', 'Anual'].includes(tipoLocacao)) {
            return res.status(400).json({ message: 'Tipo de Locação inválido. Deve ser "Mensal" ou "Anual".' });
        }

        // Verifica se a NF de saída já existe (nfNumero e tipo 'Saída')
        const nfExistente = await NotaFiscal.findOne({ nfNumero, tipo: 'Saída' });
        if (nfExistente) {
            return res.status(409).json({ message: `Já existe uma NF de Saída com o número ${nfNumero}. Por favor, use um número diferente.` });
        }

        const radiosParaAtualizar = [];
        const radiosNaoEncontradosOuIndisponiveis = [];
        // Verifica cada rádio fornecido na requisição
        for (const numeroSerie of radios) {
            const radio = await Radio.findOne({ numeroSerie });
            if (!radio) {
                // Se o rádio não for encontrado, adiciona à lista de problemas
                radiosNaoEncontradosOuIndisponiveis.push({ numeroSerie, problema: 'não encontrado' });
            } else if (radio.status !== 'Disponível') {
                // Se o rádio não estiver disponível, adiciona à lista de problemas
                radiosNaoEncontradosOuIndisponiveis.push({ numeroSerie, problema: `status "${radio.status}"`, nfAtual: radio.nfAtual });
            } else {
                // Se o rádio estiver disponível, adiciona para atualização posterior
                radiosParaAtualizar.push(radio);
            }
        }

        // Se houver rádios não encontrados ou indisponíveis, retorna erro 400
        if (radiosNaoEncontradosOuIndisponiveis.length > 0) {
            const mensagensDeErroRadio = radiosNaoEncontradosOuIndisponiveis.map(item => {
                if (item.problema === 'não encontrado') {
                    return `Rádio com série "${item.numeroSerie}" não encontrado.`;
                } else {
                    return `Rádio "${item.numeroSerie}" não está disponível (Status: ${item.problema.replace('status "', '').replace('"', '')}${item.nfAtual ? `, NF: ${item.nfAtual}` : ''}).`;
                }
            });
            return res.status(400).json({
                message: 'Problemas com os rádios selecionados:',
                detalhes: mensagensDeErroRadio
            });
        }

        // Cria a Nota Fiscal de Saída
        const novaNf = new NotaFiscal({
            nfNumero,
            tipo: 'Saída',
            cliente,
            dataSaida,
            previsaoRetorno,
            radios, // Armazena os numeroSerie dos rádios
            observacoes, // Inclui observações se existirem no payload
            usuarioRegistro: req.usuario.email, // Assume que req.usuario.email está disponível
            tipoLocacao // Salva o tipo de locação na NF
        });
        await novaNf.save();

        // Atualiza o status de cada rádio para 'Ocupado' e associa a NF
        // Usar Promise.all para executar as atualizações em paralelo de forma eficiente
        await Promise.all(radiosParaAtualizar.map(async (radio) => {
            await Radio.updateOne(
                { numeroSerie: radio.numeroSerie },
                {
                    $set: {
                        status: 'Ocupado',
                        nfAtual: nfNumero,
                        ultimaNfSaida: nfNumero, // Opcional: registrar a última NF de saída no rádio
                        tipoLocacaoAtual: tipoLocacao // NOVO: Atualiza o tipo de locação no rádio
                    }
                }
            );
        }));
        res.status(201).json({ message: 'NF de Saída registrada com sucesso!', nf: novaNf });
    } catch (error) {
        console.error('Erro ao registrar NF de Saída:', error);
        // Se o erro for de validação do Mongoose, pode ser mais específico
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: `Erro de validação: ${error.message}` });
        }
        res.status(500).json({ message: 'Erro interno do servidor ao registrar NF de Saída.' });
    }
});

app.post('/nf/entrada', autenticarToken, async (req, res) => {
    try {
        // Agora, 'radiosRetornados' é esperado no corpo da requisição
        const { nfNumero, dataEntrada, observacoes, radiosRetornados } = req.body;

        // Validação inicial dos campos obrigatórios
        if (!nfNumero || !dataEntrada || !Array.isArray(radiosRetornados) || radiosRetornados.length === 0) {
            return res.status(400).json({ message: 'Dados da NF de Entrada incompletos. Número da NF, Data de Entrada e Rádios Retornados são obrigatórios.' });
        }

        // Busca a Nota Fiscal de Saída original
        const nfSaida = await NotaFiscal.findOne({ nfNumero, tipo: 'Saída' });

        if (!nfSaida) {
            return res.status(404).json({ message: `NF de Saída com o número ${nfNumero} não encontrada.` });
        }

        // Verifica se a NF de Saída já possui uma data de entrada registrada (se for o caso de uma entrada única para a NF)
        // Se a sua lógica permite múltiplas entradas parciais para a mesma NF, você pode ajustar esta validação.
        // Por enquanto, ela impede uma segunda entrada completa.
        if (nfSaida.dataEntrada) {
            return res.status(400).json({ message: `A NF ${nfNumero} já possui uma data de entrada registrada (${new Date(nfSaida.dataEntrada).toLocaleDateString('pt-BR')}).` });
        }

        // Registra a data de entrada na NF original
        nfSaida.dataEntrada = dataEntrada;
        // Adiciona observações, garantindo que 'observacoes' seja um array
        if (observacoes) {
            if (Array.isArray(observacoes)) {
                nfSaida.observacoes.push(...observacoes);
            } else if (typeof observacoes === 'string') {
                nfSaida.observacoes.push(observacoes);
            }
        }
        await nfSaida.save(); // Salva a atualização na Nota Fiscal

        // Prepara para verificar e atualizar os rádios retornados
        const seriesRadiosNaNfSaida = nfSaida.radios.map(s => s.toString()); // Garante que são strings para comparação
        const radiosParaAtualizar = [];
        const radiosComProblemas = [];

        for (const retornoRadio of radiosRetornados) {
            const { numeroSerie, statusRetorno } = retornoRadio;
            // Valida os dados de cada rádio retornado
            if (!numeroSerie || !statusRetorno) {
                radiosComProblemas.push({ numeroSerie: numeroSerie || 'N/A', problema: 'dados incompletos para o rádio' });
                continue;
            }
            if (!['Disponível', 'Manutenção'].includes(statusRetorno)) {
                radiosComProblemas.push({ numeroSerie, problema: `status de retorno inválido: "${statusRetorno}"` });
                continue;
            }
            // Verifica se o rádio retornado realmente estava na NF de Saída original
            if (!seriesRadiosNaNfSaida.includes(numeroSerie)) {
                radiosComProblemas.push({ numeroSerie, problema: 'não pertence a esta NF de Saída' });
                continue;
            }

            const radioNoEstoque = await Radio.findOne({ numeroSerie });
            if (!radioNoEstoque) {
                radiosComProblemas.push({ numeroSerie, problema: 'não encontrado no estoque' });
                continue;
            }
            // Verifica se o rádio está atualmente 'Ocupado' por esta NF
            if (radioNoEstoque.status !== 'Ocupado' || radioNoEstoque.nfAtual !== nfNumero) {
                radiosComProblemas.push({ numeroSerie, problema: `status atual "${radioNoEstoque.status}" ou não associado a esta NF (${radioNoEstoque.nfAtual || 'N/A'})` });
                continue;
            }

            radiosParaAtualizar.push({ radio: radioNoEstoque, statusRetorno });
        }

        // Se houver rádios com problemas, retorna um erro 400
        if (radiosComProblemas.length > 0) {
            const mensagensDeErro = radiosComProblemas.map(item => {
                return `Rádio "${item.numeroSerie}": ${item.problema}.`;
            });
            return res.status(400).json({
                message: 'Problemas encontrados com os rádios retornados:',
                detalhes: mensagensDeErro
            });
        }

        // Atualiza o status de cada rádio retornado
        await Promise.all(radiosParaAtualizar.map(async ({ radio, statusRetorno }) => {
            await Radio.updateOne(
                { numeroSerie: radio.numeroSerie },
                {
                    $set: {
                        status: statusRetorno, // Pode ser 'Disponível' ou 'Manutenção'
                        nfAtual: null, // Limpa a referência à NF atual
                        tipoLocacaoAtual: null // Limpa o tipo de locação no rádio ao retornar
                    }
                }
            );
        }));
        res.status(200).json({ message: `Retorno da NF ${nfNumero} registrado com sucesso!`, nf: nfSaida });
    } catch (error) {
        console.error('Erro ao registrar retorno da NF:', error);
        // Retorna uma mensagem de erro mais genérica para erros inesperados
        res.status(500).json({ message: `Erro interno do servidor ao registrar retorno da NF: ${error.message || 'Verifique o console do servidor para mais detalhes.'}` });
    }
});

app.get('/nf/:nfNumero', autenticarToken, async (req, res) => {
    try {
        const { nfNumero } = req.params;
        const nf = await NotaFiscal.findOne({ nfNumero }).lean(); // Usar .lean() para obter um objeto JS puro

        if (!nf) {
            return res.status(404).json({ message: 'Nota Fiscal não encontrada.' });
        }

        // Popula os detalhes completos dos rádios
        const radiosComDetalhes = await Promise.all(nf.radios.map(async (numeroSerie) => {
            const radio = await Radio.findOne({ numeroSerie }).select('modelo patrimonio frequencia');
            return radio ? { numeroSerie, modelo: radio.modelo, patrimonio: radio.patrimonio, frequencia: radio.frequencia } : { numeroSerie, modelo: 'N/A', patrimonio: 'N/A', frequencia: 'N/A' };
        }));

        res.json({ ...nf, radios: radiosComDetalhes });
    } catch (error) {
        console.error('Erro ao buscar nota fiscal por número:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/nf', autenticarToken, async (req, res) => {
    try {
        // Ordena por data de saída e depois por data de entrada (decrescente)
        const notasFiscais = await NotaFiscal.find().sort({ dataSaida: -1, dataEntrada: -1 });
        res.json(notasFiscais);
    } catch (error) {
        console.error('Erro ao listar notas fiscais:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
// Rotas de Consulta/Histórico
app.get('/extrato/:numeroSerie', autenticarToken, async (req, res) => {
    try {
        const { numeroSerie } = req.params;

        const radio = await Radio.findOne({ numeroSerie });
        if (!radio) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }

        const notasFiscais = await NotaFiscal.find({ radios: numeroSerie }).sort({ dataSaida: 1 });

        const extrato = notasFiscais.map(nf => ({
            nfNumero: nf.nfNumero,
            tipo: nf.tipo,
            cliente: nf.cliente,
            dataSaida: nf.dataSaida,
            dataEntrada: nf.dataEntrada,
            previsaoRetorno: nf.previsaoRetorno,
            observacoes: nf.observacoes,
            usuarioRegistro: nf.usuarioRegistro,
            tipoLocacao: nf.tipoLocacao // Inclui o tipo de locação no extrato
        }));

        res.json({ radio: radio.toObject(), extrato });
    } catch (error) {
        console.error('Erro ao buscar extrato do rádio:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/radios/:numeroSerie/historico-completo', autenticarToken, async (req, res) => {
    try {
        const { numeroSerie } = req.params;

        const radio = await Radio.findOne({ numeroSerie });
        if (!radio) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }

        // Busca todas as Notas Fiscais que contêm este rádio
        const notasFiscais = await NotaFiscal.find({ radios: numeroSerie }).lean();

        // Busca todos os Pedidos de Manutenção que contêm este rádio
        const pedidosManutencao = await PedidoManutencao.find({ 'radios.numeroSerie': numeroSerie }).lean();

        const historico = [];

        // Adiciona eventos de Notas Fiscais
        notasFiscais.forEach(nf => {
            if (nf.tipo === 'Saída') {
                historico.push({
                    tipo: 'Saída de Locação',
                    data: nf.dataSaida,
                    descricao: `Rádio saiu para locação com NF ${nf.nfNumero} para o cliente ${nf.cliente}.`,
                    detalhes: {
                        nfNumero: nf.nfNumero,
                        cliente: nf.cliente,
                        previsaoRetorno: nf.previsaoRetorno,
                        usuarioRegistro: nf.usuarioRegistro,
                        tipoLocacao: nf.tipoLocacao // Inclui o tipo de locação
                    }
                });
                if (nf.dataEntrada) {
                    historico.push({
                        tipo: 'Retorno de Locação',
                        data: nf.dataEntrada,
                        descricao: `Rádio retornou da locação da NF ${nf.nfNumero} do cliente ${nf.cliente}.`,
                        detalhes: {
                            nfNumero: nf.nfNumero,
                            cliente: nf.cliente,
                            usuarioRegistro: nf.usuarioRegistro,
                            observacoes: nf.observacoes,
                            tipoLocacao: nf.tipoLocacao // Inclui o tipo de locação
                        }
                    });
                }
            }
        });
        // Adiciona eventos de Pedidos de Manutenção
        pedidosManutencao.forEach(pedido => {
            const radioNoPedido = pedido.radios.find(r => r.numeroSerie === numeroSerie);
            if (radioNoPedido) {
                historico.push({
                    tipo: 'Solicitação Manutenção',
                    data: pedido.dataSolicitacao,
                    descricao: `Solicitação de manutenção (ID: ${pedido.idPedido}) - Problema: ${radioNoPedido.descricaoProblema}. Prioridade: ${pedido.prioridade}. Status: ${pedido.statusPedido}.`,
                    detalhes: {
                        idPedido: pedido.idPedido,
                        solicitanteNome: pedido.solicitanteNome,
                        solicitanteEmail: pedido.solicitanteEmail,
                        prioridade: pedido.prioridade,
                        statusPedido: pedido.statusPedido,
                        descricaoProblema: radioNoPedido.descricaoProblema
                    }
                });
                if (pedido.dataInicioManutencao) {
                    historico.push({
                        tipo: 'Início Manutenção',
                        data: pedido.dataInicioManutencao,
                        descricao: `Manutenção (ID: ${pedido.idPedido}) iniciada por ${pedido.tecnicoResponsavel || 'N/A'}.`,
                        detalhes: {
                            idPedido: pedido.idPedido,
                            tecnicoResponsavel: pedido.tecnicoResponsavel
                        }
                    });
                }
                if (pedido.dataFimManutencao) {
                    historico.push({
                        tipo: 'Fim Manutenção',
                        data: pedido.dataFimManutencao,
                        descricao: `Manutenção (ID: ${pedido.idPedido}) finalizada. Observações: ${pedido.observacoesTecnicas || 'N/A'}.`,
                        detalhes: {
                            idPedido: pedido.idPedido,
                            observacoesTecnicas: pedido.observacoesTecnicas
                        }
                    });
                }
            }
        });
        // Ordena o histórico por data
        historico.sort((a, b) => a.data - b.data);
        res.json({ radio: radio.toObject(), historico });
    } catch (error) {
        console.error('Erro ao buscar histórico completo do rádio:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/movimentacoes/recentes', autenticarToken, async (req, res) => {
    try {
        const movimentacoes = await NotaFiscal.find({})
            .sort({ createdAt: -1 }) // Ordena pela data de criação
            .limit(20) // Limita aos 20 resultados mais recentes
            .select('nfNumero tipo cliente dataSaida dataEntrada usuarioRegistro radios tipoLocacao'); // Inclui tipoLocacao

        res.json(movimentacoes);
    } catch (error) {
        console.error('Erro ao buscar movimentações recentes:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
app.get('/movimentacoes/:id', autenticarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const movimentacao = await NotaFiscal.findById(id).lean();

        if (!movimentacao) {
            return res.status(404).json({ message: 'Movimentação não encontrada.' });
        }

        // Popula os detalhes completos dos rádios
        const radiosComDetalhes = await Promise.all(movimentacao.radios.map(async (numeroSerie) => {
            const radio = await Radio.findOne({ numeroSerie }).select('modelo patrimonio frequencia');
            return radio ? { numeroSerie, modelo: radio.modelo, patrimonio: radio.patrimonio, frequencia: radio.frequencia } : { numeroSerie, modelo: 'N/A', patrimonio: 'N/A', frequencia: 'N/A' };
        }));

        res.json({ ...movimentacao, radios: radiosComDetalhes });
    } catch (error) {
        console.error('Erro ao buscar detalhes da movimentação:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rotas de Manutenção
app.post('/manutencao/solicitacoes', autenticarToken, async (req, res) => {
    try {
        // Verifica se o usuário tem a permissão 'solicitar_manutencao' ou é 'admin'
        if (!req.usuario.permissoes.includes('solicitar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para solicitar manutenção.' });
        }

        const { prioridade, radios } = req.body; // radios é um array de {numeroSerie, descricaoProblema}

        if (!prioridade || !Array.isArray(radios) || radios.length === 0) {
            return res.status(400).json({ message: 'Prioridade e lista de rádios são obrigatórios.' });
        }

        const radiosDetalhes = [];
        for (const r of radios) {
            if (!r.numeroSerie || !r.descricaoProblema) {
                return res.status(400).json({ message: 'Cada rádio na solicitação deve ter número de série e descrição do problema.' });
            }
            const radioNoEstoque = await Radio.findOne({ numeroSerie: r.numeroSerie });
            if (!radioNoEstoque) {
                return res.status(404).json({ message: `Rádio com número de série ${r.numeroSerie} não encontrado no estoque.` });
            }
            // Condições ajustadas para permitir apenas rádios "Disponíveis" para solicitação inicial
            if (radioNoEstoque.status !== 'Disponível') {
                return res.status(400).json({ message: `O rádio ${r.numeroSerie} não pode ser enviado para manutenção pois está com status "${radioNoEstoque.status}".` });
            }

            radiosDetalhes.push({
                numeroSerie: radioNoEstoque.numeroSerie,
                modelo: radioNoEstoque.modelo,
                patrimonio: radioNoEstoque.patrimonio,
                descricaoProblema: r.descricaoProblema
            });
        }

        const idPedido = await getNextSequenceValue('pedidoId'); // Gera um ID sequencial

        const novoPedido = new PedidoManutencao({
            idPedido,
            solicitanteNome: req.usuario.nome,
            solicitanteEmail: req.usuario.email,
            prioridade,
            radios: radiosDetalhes,
            statusPedido: 'aberto' // Status inicial
        });
        await novoPedido.save();

        res.status(201).json({ message: 'Solicitação de manutenção criada com sucesso!', idPedido: novoPedido.idPedido, pedido: novoPedido });
    } catch (error) {
        console.error('Erro ao criar solicitação de manutenção:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao criar solicitação de manutenção.' });
    }
});
app.get('/manutencao/solicitacoes', autenticarToken, async (req, res) => {
    try {
        const { status } = req.query; // Pode ser 'aberto', 'em_manutencao', 'finalizado', 'cancelado' ou uma lista separada por vírgula
        let query = {};

        // Se o usuário não tem permissão de 'gerenciar_manutencao' ou 'admin', ele só vê os próprios pedidos
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            query.solicitanteEmail = req.usuario.email;
        }

        if (status) {
            const statusArray = status.split(',');
            query.statusPedido = { $in: statusArray };
        }

        const solicitacoes = await PedidoManutencao.find(query).sort({ dataSolicitacao: -1 });
        res.json(solicitacoes);
    } catch (error) {
        console.error('Erro ao listar solicitações de manutenção:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
app.get('/manutencao/solicitacoes/:idPedido', autenticarToken, async (req, res) => {
    try {
        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido });

        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }

        // Verifica se o usuário tem permissão para visualizar este pedido
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin') && pedido.solicitanteEmail !== req.usuario.email) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para visualizar este pedido.' });
        }

        res.json(pedido);
    } catch (error) {
        console.error('Erro ao buscar pedido de manutenção:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
app.post('/manutencao/pedidos/:idPedido/dar-andamento', autenticarToken, async (req, res) => {
    try {
        // Apenas usuários com permissão de gerenciamento ou admin podem dar andamento
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para gerenciar pedidos de manutenção.' });
        }

        const { idPedido } = req.params;
        const pedido = await PedidoManutencao.findOne({ idPedido });

        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }

        if (pedido.statusPedido !== 'aberto') {
            return res.status(400).json({ message: `Não é possível dar andamento ao pedido pois o status atual é "${pedido.statusPedido}".` });
        }

        pedido.statusPedido = 'aguardando_manutencao';
        await pedido.save();

        // Atualiza o status dos rádios para 'Manutenção'
        for (const r of pedido.radios) {
            await Radio.updateOne(
                { numeroSerie: r.numeroSerie },
                { $set: { status: 'Manutenção' } }
            );
        }

        res.status(200).json({ message: 'Status do pedido atualizado para "Aguardando Manutenção". Rádios movidos para "Manutenção".', pedido });
    } catch (error) {
        console.error('Erro ao dar andamento no pedido de manutenção:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.post('/manutencao/pedidos/:idPedido/iniciar', autenticarToken, async (req, res) => {
    try {
        // Apenas usuários com permissão de gerenciamento ou admin podem iniciar
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para gerenciar pedidos de manutenção.' });
        }

        const { idPedido } = req.params;
        const { tecnicoResponsavel } = req.body;

        if (!tecnicoResponsavel) {
            return res.status(400).json({ message: 'O nome do técnico responsável é obrigatório para iniciar a manutenção.' });
        }

        const pedido = await PedidoManutencao.findOne({ idPedido });

        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }

        if (pedido.statusPedido !== 'aguardando_manutencao') {
            return res.status(400).json({ message: `Não é possível iniciar a manutenção pois o status atual é "${pedido.statusPedido}".` });
        }

        pedido.statusPedido = 'em_manutencao';
        pedido.tecnicoResponsavel = tecnicoResponsavel;
        pedido.dataInicioManutencao = new Date();
        await pedido.save();
        res.status(200).json({ message: 'Manutenção iniciada com sucesso!', pedido });
    } catch (error) {
        console.error('Erro ao iniciar manutenção:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.post('/manutencao/pedidos/:idPedido/concluir', autenticarToken, async (req, res) => {
    try {
        // Apenas usuários com permissão de gerenciamento ou admin podem concluir
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para gerenciar pedidos de manutenção.' });
        }

        const { idPedido } = req.params;
        const { observacoesTecnicas } = req.body;

        const pedido = await PedidoManutencao.findOne({ idPedido });

        if (!pedido) {
            return res.status(404).json({ message: 'Pedido de manutenção não encontrado.' });
        }

        if (pedido.statusPedido !== 'em_manutencao') {
            return res.status(400).json({ message: `Não é possível concluir a manutenção pois o status atual é "${pedido.statusPedido}".` });
        }

        pedido.statusPedido = 'finalizado';
        pedido.dataFimManutencao = new Date();
        pedido.observacoesTecnicas = observacoesTecnicas || 'Nenhuma observação técnica fornecida.';
        await pedido.save();
        // Atualiza o status dos rádios para 'Disponível'
        for (const r of pedido.radios) {
            await Radio.updateOne(
                { numeroSerie: r.numeroSerie },
                { $set: { status: 'Disponível' } }
            );
        }

        res.status(200).json({ message: 'Manutenção concluída com sucesso! Rádios retornaram ao estoque como "Disponível".', pedido });
    } catch (error) {
        console.error('Erro ao concluir manutenção:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/manutencao/estoque', autenticarToken, async (req, res) => {
    try {
        // Apenas usuários com permissão de gerenciamento ou admin podem ver o estoque de manutenção
        if (!req.usuario.permissoes.includes('gerenciar_manutencao') && !req.usuario.permissoes.includes('admin')) {
            return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para ver o estoque de manutenção.' });
        }

        // Busca todos os rádios que estão em status 'Manutenção'
        const radiosEmManutencao = await Radio.find({ status: 'Manutenção' }).lean();

        // Para cada rádio, encontrar o pedido de manutenção mais recente associado
        const estoqueDetalhado = await Promise.all(radiosEmManutencao.map(async (radio) => {
            const pedido = await PedidoManutencao.findOne({
                'radios.numeroSerie': radio.numeroSerie,
                statusPedido: { $in: ['aberto', 'aguardando_manutencao', 'em_manutencao'] } // Busca pedidos ativos
            }).sort({ dataSolicitacao: -1 }).lean(); // Pega o mais recente

            const problema = pedido ? pedido.radios.find(r => r.numeroSerie === radio.numeroSerie)?.descricaoProblema : 'N/A';

            return {
                numeroSerie: radio.numeroSerie,
                modelo: radio.modelo,
                patrimonio: radio.patrimonio,
                statusRadio: radio.status,
                pedidoManutencao: pedido ? {
                    idPedido: pedido.idPedido,
                    statusPedido: pedido.statusPedido,
                    dataSolicitacao: pedido.dataSolicitacao,
                    prioridade: pedido.prioridade,
                    tecnicoResponsavel: pedido.tecnicoResponsavel,
                    descricaoProblema: problema // Problema específico do rádio neste pedido
                } : null
            };
        }));

        res.json(estoqueDetalhado);
    } catch (error) {
        console.error('Erro ao buscar estoque de manutenção:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

//ddddddddd

///dddddd