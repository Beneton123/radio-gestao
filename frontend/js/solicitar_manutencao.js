// frontend/js/solicitar_manutencao.js

// ALTERADO: Adicionada a URL base da API com o seu IP
const API_BASE_URL = 'http://10.110.120.237:5000/api';

var radiosParaSolicitacao = [];
var radioVerificadoAtual = null;

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('solicitar_manutencao');

        const solicitanteNomeElem = document.getElementById('solicitanteNome');
        const dataSolicitacaoElem = document.getElementById('dataSolicitacao');
        const nomeUsuario = localStorage.getItem('nomeUsuario');

        if (solicitanteNomeElem && nomeUsuario) solicitanteNomeElem.textContent = nomeUsuario;
        if (dataSolicitacaoElem) dataSolicitacaoElem.textContent = new Date().toLocaleDateString('pt-BR');

        const btnVerificarRadio = document.getElementById('btnVerificarRadio');
        const btnConfirmarAdicionarRadio = document.getElementById('btnConfirmarAdicionarRadio');
        const formSolicitarManutencao = document.getElementById('formSolicitarManutencao');

        if (btnVerificarRadio) btnVerificarRadio.addEventListener('click', verificarRadioParaAdicao);
        if (btnConfirmarAdicionarRadio) btnConfirmarAdicionarRadio.addEventListener('click', confirmarAdicaoRadioLista);
        if (formSolicitarManutencao) formSolicitarManutencao.addEventListener('submit', handleEnviarSolicitacao);

        renderTabelaRadiosSolicitados();
    } catch (error) {
        console.error("Falha na inicialização da página de solicitação:", error.message);
        if (!error.message.toLowerCase().includes('acesso negado')) {
            showAlert('Erro Crítico', 'Não foi possível carregar a página.', 'danger');
        }
    }
});

async function verificarRadioParaAdicao() {
    const numeroSerieInput = document.getElementById('radioNumeroSerieParaAdicionar');
    const infoRadioVerificadoDiv = document.getElementById('infoRadioVerificado');
    const btnVerificar = document.getElementById('btnVerificarRadio');
    const numeroSerie = numeroSerieInput.value.trim();

    if (!numeroSerie) {
        showAlert('Atenção', 'Informe o número de série do rádio.', 'warning');
        return;
    }

    radioVerificadoAtual = null;
    infoRadioVerificadoDiv.innerHTML = '<p class="text-info">Verificando...</p>';
    btnVerificar.disabled = true;

    try {
        const token = localStorage.getItem('token');
        // ALTERADO: Rota padronizada para buscar rádio por número de série
        const res = await fetch(`${API_BASE_URL}/radios/serial/${numeroSerie}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Rádio não encontrado.' }));
            infoRadioVerificadoDiv.innerHTML = `<p class="text-danger">${errorData.message}</p>`;
            showAlert('Erro ao Buscar', errorData.message, 'danger');
            return;
        }

        const radio = await res.json();

        if (radio.status !== 'Disponível') {
            let msg = `O rádio "${numeroSerie}" está com status "${radio.status}" e não pode ser enviado para manutenção.`;
            if (radio.status === 'Ocupado') msg = `O rádio "${numeroSerie}" está "Ocupado" (NF: ${radio.nfAtual}) e precisa retornar antes.`;
            else if (radio.status === 'Manutenção') msg = `O rádio "${numeroSerie}" já está em "Manutenção".`;
            showAlert('Status Inválido', msg, 'warning');
            infoRadioVerificadoDiv.innerHTML = '';
            return;
        }

        if (radiosParaSolicitacao.find(r => r.numeroSerie === radio.numeroSerie)) {
            showAlert('Atenção', 'Este rádio já foi adicionado à lista.', 'warning');
            infoRadioVerificadoDiv.innerHTML = '';
            return;
        }

        radioVerificadoAtual = { numeroSerie: radio.numeroSerie, modelo: radio.modelo, patrimonio: radio.patrimonio };
        infoRadioVerificadoDiv.innerHTML = `<p class="mb-1"><strong>Modelo:</strong> ${radio.modelo || 'N/A'}</p><p class="mb-0"><strong>Patrimônio:</strong> ${radio.patrimonio || 'N/A'}</p>`;
        document.getElementById('descricaoProblemaRadio').focus();

    } catch (error) {
        console.error("Erro ao verificar rádio:", error);
        infoRadioVerificadoDiv.innerHTML = '<p class="text-danger">Falha ao comunicar com o servidor.</p>';
        showAlert('Erro de Comunicação', 'Não foi possível verificar o rádio.', 'danger');
    } finally {
        btnVerificar.disabled = false;
    }
}

function confirmarAdicaoRadioLista() {
    if (!radioVerificadoAtual) {
        showAlert('Atenção', 'Verifique um rádio primeiro.', 'warning');
        return;
    }
    const descricaoProblemaTextarea = document.getElementById('descricaoProblemaRadio');
    const descricaoProblema = descricaoProblemaTextarea.value.trim();

    if (!descricaoProblema) {
        showAlert('Campo Obrigatório', 'A descrição do problema é obrigatória.', 'warning');
        descricaoProblemaTextarea.focus();
        return;
    }

    radiosParaSolicitacao.push({ ...radioVerificadoAtual, descricaoProblema });
    renderTabelaRadiosSolicitados();

    document.getElementById('radioNumeroSerieParaAdicionar').value = '';
    document.getElementById('infoRadioVerificado').innerHTML = '';
    descricaoProblemaTextarea.value = '';
    radioVerificadoAtual = null;
    document.getElementById('radioNumeroSerieParaAdicionar').focus();
}

function renderTabelaRadiosSolicitados() {
    const tbody = document.querySelector('#tabelaRadiosSolicitados tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (radiosParaSolicitacao.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum rádio adicionado.</td></tr>';
        return;
    }

    radiosParaSolicitacao.forEach((radio, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${radio.modelo || 'N/A'}</td><td>${radio.numeroSerie}</td><td>${radio.descricaoProblema}</td><td><button type="button" class="btn btn-sm btn-warning btn-remover-radio-solicitacao" data-index="${index}">Remover</button></td>`;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-remover-radio-solicitacao').forEach(btn => {
        btn.addEventListener('click', function() {
            const indexToRemove = parseInt(this.dataset.index);
            radiosParaSolicitacao.splice(indexToRemove, 1);
            renderTabelaRadiosSolicitados();
        });
    });
}

async function handleEnviarSolicitacao(e) {
    e.preventDefault();

    if (radiosParaSolicitacao.length === 0) {
        showAlert('Lista Vazia', 'Adicione pelo menos um rádio à solicitação.', 'warning');
        return;
    }

    const prioridadeSelect = document.getElementById('prioridadeSolicitacao');
    const prioridade = prioridadeSelect.value;
    if (!prioridade) {
        showAlert('Campo Obrigatório', 'Selecione a prioridade da solicitação.', 'warning');
        prioridadeSelect.focus();
        return;
    }

    const token = localStorage.getItem('token');
    const payload = {
        prioridade: prioridade,
        radios: radiosParaSolicitacao,
    };

    const btnEnviar = document.getElementById('btnEnviarSolicitacao');
    const originalButtonText = btnEnviar.textContent;
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';

    try {
        // ALTERADO: Rota padronizada para criar uma solicitação de manutenção
        const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            const idGerado = data.idPedido ? ` (ID: ${data.idPedido})` : '';
            showAlert('Sucesso!', `Solicitação enviada com sucesso!${idGerado}`, 'success');
            radiosParaSolicitacao = [];
            renderTabelaRadiosSolicitados();
            document.getElementById('formSolicitarManutencao').reset();
            // Repopula dados fixos
            document.getElementById('solicitanteNome').textContent = localStorage.getItem('nomeUsuario') || 'Usuário não identificado';
            document.getElementById('dataSolicitacao').textContent = new Date().toLocaleDateString('pt-BR');
        } else {
            showAlert('Erro ao Enviar', data.message || 'Falha ao enviar solicitação.', 'danger');
        }
    } catch (error) {
        console.error("Erro ao enviar solicitação:", error);
        showAlert('Erro de Comunicação', 'Não foi possível conectar ao servidor.', 'danger');
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = originalButtonText;
    }
}