const Radio = require('../models/Radio');
const Modelo = require('../models/Modelo');

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

        // VERIFICAÇÃO CORRETA: Procura por um rádio que tenha o mesmo número de série E que esteja ativo.
        const radioExistente = await Radio.findOne({ numeroSerie: numeroSerieUpper, ativo: true });
        if (radioExistente) {
            return res.status(409).json({ message: 'Já existe um rádio ativo com este número de série.' });
        }

        const novoRadio = new Radio({
            modelo: modeloExistente.nome,
            numeroSerie: numeroSerieUpper,
            patrimonio,
            frequencia,
            cadastradoPor: req.usuario.id // Certifique-se que seu middleware de auth anexa 'usuario' ao 'req'
        });

        await novoRadio.save();
        res.status(201).json({ message: 'Rádio cadastrado com sucesso!', radio: novoRadio });
    } catch (error) {
        console.error("Erro em createRadio:", error);
        res.status(500).json({ message: 'Erro interno ao cadastrar rádio.', error: error.message });
    }
};

/**
 * @route   DELETE /api/radios/serial/:numeroSerie
 * @desc    Exclui (desativa) um rádio.
 * @access  Privado (Admin)
 */
exports.deleteRadio = async (req, res) => {
    try {
        const { numeroSerie } = req.params;

        // LÓGICA CORRETA E MAIS SEGURA: Encontra o rádio ATIVO para desativar
        const radioParaExcluir = await Radio.findOne({ numeroSerie: numeroSerie.toUpperCase(), ativo: true });

        if (!radioParaExcluir) {
            return res.status(404).json({ message: 'Rádio não encontrado ou já foi excluído.' });
        }
        
        if (radioParaExcluir.status !== 'Disponível') {
            return res.status(400).json({ message: `Não é possível excluir. O rádio está com status "${radioParaExcluir.status}".` });
        }

        // Ação: Mudar o status para inativo
        radioParaExcluir.ativo = false;
        await radioParaExcluir.save();

        res.status(200).json({ message: 'Rádio excluído com sucesso.' });
    } catch (error) {
        console.error('ERRO DETALHADO AO EXCLUIR:', error);
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
        let query = { ativo: true }; // FILTRO PRINCIPAL (correto, esta função é para o estoque atual)

        if (status) query.status = status;
        if (nfAtual) query.nfAtual = nfAtual;
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [{ modelo: searchRegex }, { numeroSerie: searchRegex }, { patrimonio: searchRegex }];
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
 * @desc    Busca TODOS os registros de rádios (ativos e inativos) para o HISTÓRICO.
 * @access  Privado (Admin)
 */
exports.getRadiosCadastrados = async (req, res) => {
    try {
        // CORREÇÃO: Busca todos os registros e ordena pela data de criação.
        const radios = await Radio.find({})
            .populate('cadastradoPor', 'email')
            .sort({ createdAt: -1 });

        res.json(radios);
    } catch (error) {
        console.error("Erro em getRadiosCadastrados:", error);
        res.status(500).json({ message: 'Erro interno ao listar o histórico de rádios.', error: error.message });
    }
};

/**
 * @route   GET /api/radios/excluidos
 * @desc    Busca apenas os rádios "excluídos" (inativos).
 * @access  Privado (Admin)
 */
exports.getRadiosExcluidos = async (req, res) => {
    try {
        // NOVA FUNÇÃO: Busca apenas rádios onde "ativo" é false.
        const radios = await Radio.find({ ativo: false })
            .populate('cadastradoPor', 'email')
            .sort({ updatedAt: -1 }); // Ordena por quando foi excluído

        res.json(radios);
    } catch (error) {
        console.error("Erro em getRadiosExcluidos:", error);
        res.status(500).json({ message: 'Erro interno ao listar rádios excluídos.', error: error.message });
    }
};