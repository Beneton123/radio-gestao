const Radio = require('../models/Radio');
const Modelo = require('../models/Modelo');
const RadioExcluido = require('../models/RadioExcluido'); // Mantido caso use em outra parte

/**
 * @route   POST /api/radios
 * @desc    Cadastra um novo rádio
 * @access  Privado (requer permissão)
 */

exports.createRadio = async (req, res) => {
    try {
        const { modelo, numeroSerie, patrimonio, frequencia } = req.body;
        if (!modelo || !numeroSerie || !frequencia) {
            return res.status(400).json({ message: 'Modelo, Número de Série e Frequência são obrigatórios.' });
        }

        const numeroSerieUpper = numeroSerie.trim().toUpperCase();
        const modeloFormatado = modelo.trim().toUpperCase();

        const modeloExistente = await Modelo.findOne({ nome: modeloFormatado });
        if (!modeloExistente) {
            return res.status(400).json({ message: `O modelo "${modelo}" não é válido. Cadastre o modelo primeiro.` });
        }

        // --- LÓGICA DE VERIFICAÇÃO ATUALIZADA ---
        
        // 1. Procura por QUALQUER rádio com o mesmo número de série, independentemente do status
        const radioDuplicado = await Radio.findOne({ numeroSerie: numeroSerieUpper });

        // 2. Se um rádio for encontrado, verifica o status dele
        if (radioDuplicado) {
            // Se o rádio encontrado estiver condenado, envia a mensagem específica
            if (radioDuplicado.status === 'Condenado') {
                return res.status(409).json({ message: 'Não é possível adicionar. Já existe um rádio com este número de série que foi condenado.' });
            }
            // Se o rádio encontrado estiver ativo, envia a mensagem de rádio ativo
            if (radioDuplicado.ativo === true) {
                 return res.status(409).json({ message: 'Já existe um rádio ativo com este número de série.' });
            }
            // Se for qualquer outro caso (ex: inativo mas não condenado), o índice do banco já bloquearia,
            // mas podemos adicionar uma mensagem genérica para cobrir tudo.
            return res.status(409).json({ message: 'Este número de série já existe no banco de dados e não pode ser reutilizado.' });
        }
        // --- FIM DA LÓGICA DE VERIFICAÇÃO ---

        const novoRadio = new Radio({
            modelo: modeloExistente.nome,
            numeroSerie: numeroSerieUpper,
            patrimonio,
            frequencia,
            cadastradoPor: req.usuario.id
        });

        await novoRadio.save();
        res.status(201).json({ message: 'Rádio cadastrado com sucesso!', radio: novoRadio });
    } catch (error) {
        // Tratamento de erro caso o índice do banco de dados pegue a duplicidade primeiro
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Erro de duplicidade: Este número de série já existe.' });
        }
        console.error("Erro em createRadio:", error);
        res.status(500).json({ message: 'Erro interno ao cadastrar rádio.', error: error.message });
    }
};

/**
 * @route   DELETE /api/radios/serial/:numeroSerie
 * @desc    Baixa (desativa) um rádio manualmente.
 * @access  Privado (Admin)
 */
exports.deleteRadio = async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const numeroSerieUpper = numeroSerie.toUpperCase();

        // 1. Procura pelo rádio para verificar seu status antes de deletar
        const radioParaDeletar = await Radio.findOne({ numeroSerie: numeroSerieUpper });

        if (!radioParaDeletar) {
            return res.status(404).json({ message: 'Rádio não encontrado no banco de dados.' });
        }
        
        // 2. REGRA DE SEGURANÇA: Impede a exclusão se o rádio não estiver 'Disponível'
        // Isso evita apagar um rádio que está em uma NF de Saída ou em Manutenção.
        if (radioParaDeletar.status !== 'Disponível') {
            return res.status(400).json({ message: `Não é possível excluir. O rádio está com status "${radioParaDeletar.status}" e precisa ser retornado/liberado primeiro.` });
        }

        // 3. EXECUTA A EXCLUSÃO PERMANENTE
        await Radio.deleteOne({ numeroSerie: numeroSerieUpper });

        res.status(200).json({ message: `Rádio com S/N ${numeroSerieUpper} foi excluído permanentemente.` });

    } catch (error) {
        console.error('ERRO DETALHADO AO EXCLUIR RÁDIO:', error);
        res.status(500).json({ message: 'Erro interno ao excluir rádio.', error: error.message });
    }
};

/**
 * @route   GET /api/radios
 * @desc    Lista todos os rádios ATIVOS para estoque e listas gerais.
 * @access  Privado
 */
exports.getAllRadios = async (req, res) => {
    try {
        const { status, nfAtual, search } = req.query;
        let query = { ativo: true };

        if (status) query.status = status;
        if (nfAtual) query.nfAtual = nfAtual;
        
        if (search) {
            // Se a busca terminar com '*', removemos o '*' e fazemos uma busca exata
            if (search.endsWith('*')) {
                const searchTermExact = search.slice(0, -1).toUpperCase(); // Remove o '*' e garante caixa alta
                
                query.$or = [
                    { modelo: searchTermExact }, 
                    { numeroSerie: searchTermExact }, 
                    { patrimonio: searchTermExact }
                ];
            } else { // Senão, faz a busca parcial como antes (case-insensitive)
                const searchRegex = new RegExp(search, 'i');
                query.$or = [
                    { modelo: searchRegex }, 
                    { numeroSerie: searchRegex }, 
                    { patrimonio: searchRegex }
                ];
            }
        }
        
        const radios = await Radio.find(query);
        res.json(radios);
    } catch (error) {
        console.error("Erro em getAllRadios:", error);
        res.status(500).json({ message: 'Erro interno ao listar rádios.', error: error.message });
    }
};
/**
 * @route   GET /api/radios/serial/:numeroSerie
 * @desc    Busca um rádio pelo serial, IGNORANDO se está ativo ou não (para históricos).
 * @access  Privado
 */
exports.getRadioByNumeroSerie = async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const radio = await Radio.findOne({ numeroSerie: numeroSerie.toUpperCase() }).populate('cadastradoPor', 'email');
        if (!radio) {
            return res.status(404).json({ message: 'Rádio não encontrado.' });
        }
        res.json(radio);
    } catch (error) {
        console.error("Erro em getRadioByNumeroSerie:", error);
        res.status(500).json({ message: 'Erro interno ao buscar rádio.', error: error.message });
    }
};

/**
 * @route   PUT /api/radios/serial/:numeroSerie/patrimonio
 * @desc    Atualiza o patrimônio de um rádio.
 * @access  Privado (Admin)
 */
exports.updatePatrimonio = async (req, res) => {
    try {
        const { numeroSerie } = req.params;
        const { novoPatrimonio } = req.body;
        if (typeof novoPatrimonio === 'undefined') {
            return res.status(400).json({ message: 'Novo patrimônio é obrigatório.' });
        }
        const radio = await Radio.findOneAndUpdate(
            { numeroSerie: numeroSerie.toUpperCase(), ativo: true },
            { $set: { patrimonio: novoPatrimonio } },
            { new: true }
        );
        if (!radio) return res.status(404).json({ message: 'Rádio não encontrado.' });
        res.status(200).json({ message: 'Patrimônio atualizado com sucesso.', radio });
    } catch (error) {
        console.error("Erro em updatePatrimonio:", error);
        res.status(500).json({ message: 'Erro interno ao atualizar patrimônio.', error: error.message });
    }
};

/**
 * @route   GET /api/radios/cadastrados
 * @desc    Busca o histórico de rádios CADASTRADOS e ATIVOS para o painel admin.
 * @access  Privado (Admin)
 */
exports.getRadiosCadastrados = async (req, res) => {
    try {
        const radios = await Radio.find({ ativo: true })
            .populate('cadastradoPor', 'email')
            .sort({ createdAt: -1 });

        res.json(radios);
    } catch (error) {
        console.error("Erro em getRadiosCadastrados:", error);
        res.status(500).json({ message: 'Erro interno ao listar o histórico de rádios.', error: error.message });
    }
};

/**
 * @route   GET /api/radios/baixados
 * @desc    Busca todos os rádios "baixados" (inativos), incluindo condenados.
 * @access  Privado (Admin)
 */
exports.getRadiosBaixados = async (req, res) => {
    try {
        const radios = await Radio.find({ ativo: false })
            .sort({ dataBaixa: -1, dataCondenacao: -1 }); // Ordena pelas datas

        res.json(radios);
    } catch (error) {
        console.error("Erro em getRadiosBaixados:", error);
        res.status(500).json({ message: 'Erro interno ao listar rádios baixados.', error: error.message });
    }
};

// ===================================================================================
// NOVA FUNÇÃO E REMOÇÃO DAS ANTIGAS
// ===================================================================================

/**
 * @desc    As funções `transferirOS` e `marcarComoCondenado` foram REMOVIDAS daqui.
 * A lógica correta e mais robusta para essas ações agora está centralizada
 * no arquivo `manutencaoController.js` nas funções `transferirRadio` e
 * `atualizarStatusRadio`.
 */

/**
 * @route   GET /api/radios/condenados
 * @desc    Busca APENAS os rádios com status "Condenado" com detalhes.
 * @access  Privado (Admin)
 */
exports.getRadiosCondenados = async (req, res) => {
    try {
        const radiosCondenados = await Radio.find({ status: 'Condenado' })
            .populate('tecnicoCondenacao', 'nome email') // Busca o nome e email do técnico
            .populate('osCondenacao', 'idPedido') // Busca o ID da OS onde foi condenado
            .sort({ dataCondenacao: -1 }); // Ordena pelos mais recentes

        res.json(radiosCondenados);
    } catch (error) {
        console.error("Erro em getRadiosCondenados:", error);
        res.status(500).json({ message: 'Erro interno ao listar rádios condenados.', error: error.message });
    }
};

