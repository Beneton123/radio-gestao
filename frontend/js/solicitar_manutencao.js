// frontend/js/solicitar_manutencao.js

// Variável para armazenar os rádios adicionados à solicitação atual
var radiosParaSolicitacao = [];
// Variável para armazenar os dados do rádio atualmente verificado para adição
var radioVerificadoAtual = null;

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Certifique-se que seu usuário de teste tenha a permissão 'solicitar_manutencao' ou seja 'admin'.
        // Assumo que 'checkAuthentication' e 'showAlert' são funções globais definidas em outro lugar (ex: ui.js/auth.js)
        checkAuthentication('solicitar_manutencao');

        const solicitanteNomeElem = document.getElementById('solicitanteNome');
        const dataSolicitacaoElem = document.getElementById('dataSolicitacao');
        const nomeUsuario = localStorage.getItem('nomeUsuario');

        if (solicitanteNomeElem && nomeUsuario) {
            solicitanteNomeElem.textContent = nomeUsuario;
        } else if (solicitanteNomeElem) {
            solicitanteNomeElem.textContent = 'Usuário não identificado';
        }

        if (dataSolicitacaoElem) {
            dataSolicitacaoElem.textContent = new Date().toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
        }

        const btnVerificarRadio = document.getElementById('btnVerificarRadio');
        const btnConfirmarAdicionarRadio = document.getElementById('btnConfirmarAdicionarRadio');
        const formSolicitarManutencao = document.getElementById('formSolicitarManutencao');

        if (btnVerificarRadio) {
            btnVerificarRadio.addEventListener('click', verificarRadioParaAdicao);
        }

        if (btnConfirmarAdicionarRadio) {
            btnConfirmarAdicionarRadio.addEventListener('click', confirmarAdicaoRadioLista);
        }

        if (formSolicitarManutencao) {
            formSolicitarManutencao.addEventListener('submit', handleEnviarSolicitacao);
        }

        renderTabelaRadiosSolicitados();

    } catch (error) {
        console.error("Falha na inicialização da página de solicitação:", error.message);
        // Usando showAlert aqui
        if (!error.message.toLowerCase().includes('acesso negado') && !error.message.toLowerCase().includes('autenticado')) {
            showAlert('Erro Crítico', 'Não foi possível carregar componentes da página. Tente recarregar.', 'danger');
        }
    }
});

async function verificarRadioParaAdicao() {
    const numeroSerieInput = document.getElementById('radioNumeroSerieParaAdicionar');
    const infoRadioVerificadoDiv = document.getElementById('infoRadioVerificado');
    const btnVerificar = document.getElementById('btnVerificarRadio');
    const numeroSerie = numeroSerieInput.value.trim();

    if (!numeroSerie) {
        // Substituído alert() por showAlert()
        showAlert('Atenção', 'Informe o número de série do rádio.', 'warning');
        return;
    }

    radioVerificadoAtual = null; // Resetar o rádio verificado atual
    infoRadioVerificadoDiv.innerHTML = '<p class="text-info">Verificando...</p>';
    btnVerificar.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/radios/${numeroSerie}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Rádio não encontrado ou erro na busca.' }));
            infoRadioVerificadoDiv.innerHTML = `<p class="text-danger">${errorData.message}</p>`;
            // Substituído alert() por showAlert()
            showAlert('Erro ao Buscar', errorData.message, 'danger');
            return;
        }

        const radio = await res.json();

        // LÓGICA DE VERIFICAÇÃO DE STATUS DO RÁDIO AJUSTADA
        if (radio.status !== 'Disponível') {
            let mensagemAlerta = `O rádio "${numeroSerie}" está com status "${radio.status}" e não pode ser enviado para manutenção.`;
            if (radio.status === 'Ocupado') {
                mensagemAlerta = `O rádio "${numeroSerie}" está "Ocupado" (NF: ${radio.nfAtual || 'N/A'}) e precisa retornar antes de ser enviado para manutenção.`;
            } else if (radio.status === 'Manutenção') {
                mensagemAlerta = `O rádio "${numeroSerie}" já se encontra em "Manutenção" ou com solicitação aberta.`;
            }
            // Substituído alert() por showAlert()
            showAlert('Status Inválido', mensagemAlerta, 'warning');
            infoRadioVerificadoDiv.innerHTML = ''; // Limpa a informação do rádio verificado
            return;
        }
        // FIM DA CORREÇÃO DE LÓGICA DE STATUS E MENSAGEM

        if (radiosParaSolicitacao.find(r => r.numeroSerie === radio.numeroSerie)) {
            // Substituído alert() por showAlert()
            showAlert('Atenção', 'Este rádio já foi adicionado à lista desta solicitação.', 'warning');
            infoRadioVerificadoDiv.innerHTML = '';
            numeroSerieInput.focus();
            return;
        }

        // Armazena todos os dados relevantes do rádio para a solicitação
        radioVerificadoAtual = {
            numeroSerie: radio.numeroSerie,
            modelo: radio.modelo,
            patrimonio: radio.patrimonio,
            // descricaoProblema será adicionado na função confirmarAdicaoRadioLista
        };

        infoRadioVerificadoDiv.innerHTML = `
            <p class="mb-1"><strong>Modelo:</strong> ${radio.modelo || 'N/A'}</p>
            <p class="mb-0"><strong>Patrimônio:</strong> ${radio.patrimonio || 'N/A'}</p>
        `;
        document.getElementById('descricaoProblemaRadio').focus();

    } catch (error) {
        console.error("Erro ao verificar rádio:", error);
        infoRadioVerificadoDiv.innerHTML = '<p class="text-danger">Falha ao comunicar com o servidor.</p>';
        // Substituído alert() por showAlert()
        showAlert('Erro de Comunicação', 'Não foi possível verificar o rádio.', 'danger');
    } finally {
        btnVerificar.disabled = false;
    }
}

function confirmarAdicaoRadioLista() {
    if (!radioVerificadoAtual) {
        // Substituído alert() por showAlert()
        showAlert('Atenção', 'Nenhum rádio verificado. Por favor, verifique um rádio primeiro.', 'warning');
        return;
    }
    const descricaoProblemaTextarea = document.getElementById('descricaoProblemaRadio');
    const descricaoProblema = descricaoProblemaTextarea.value.trim();

    if (!descricaoProblema) {
        // Substituído alert() por showAlert()
        showAlert('Campo Obrigatório', 'A descrição do problema é obrigatória para adicionar o rádio.', 'warning');
        descricaoProblemaTextarea.focus();
        return;
    }

    // Adiciona a descrição do problema ao objeto radioVerificadoAtual
    radiosParaSolicitacao.push({ ...radioVerificadoAtual, descricaoProblema });
    renderTabelaRadiosSolicitados();

    // Limpa os campos após adicionar
    document.getElementById('radioNumeroSerieParaAdicionar').value = '';
    document.getElementById('infoRadioVerificado').innerHTML = '';
    descricaoProblemaTextarea.value = '';
    radioVerificadoAtual = null; // Resetar para evitar adição duplicada acidental
    document.getElementById('radioNumeroSerieParaAdicionar').focus();
}

function renderTabelaRadiosSolicitados() {
    const tbody = document.querySelector('#tabelaRadiosSolicitados tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (radiosParaSolicitacao.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum rádio adicionado à solicitação.</td></tr>';
        return;
    }

    radiosParaSolicitacao.forEach((radio, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${radio.modelo || 'N/A'}</td>
            <td>${radio.numeroSerie}</td>
            <td>${radio.descricaoProblema}</td>
            <td><button type="button" class="btn btn-sm btn-warning btn-remover-radio-solicitacao" data-index="${index}">Remover</button></td>
        `;
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
        // Substituído alert() por showAlert()
        showAlert('Lista Vazia', 'Adicione pelo menos um rádio à solicitação antes de enviar.', 'warning');
        return;
    }

    const prioridadeSelect = document.getElementById('prioridadeSolicitacao');
    const prioridade = prioridadeSelect.value;
    if (!prioridade) {
        // Substituído alert() por showAlert()
        showAlert('Campo Obrigatório', 'Selecione a prioridade da solicitação.', 'warning');
        prioridadeSelect.focus();
        return;
    }

    const solicitanteNome = localStorage.getItem('nomeUsuario') || 'Usuário Desconhecido';
    let solicitanteEmail = 'email.nao.fornecido@sistema.com'; // Valor padrão
    const token = localStorage.getItem('token');
    if (token) {
        // A função jwt_decode é crucial para obter o email do usuário do token
        // Certifique-se de que jwt_decode esteja disponível (definida em js/auth.js ou ui.js, ou aqui mesmo)
        const decodedToken = jwt_decode(token);
        if (decodedToken && decodedToken.email) {
            solicitanteEmail = decodedToken.email;
        }
    }

    // O backend espera que cada objeto de rádio tenha: numeroSerie, modelo, descricaoProblema e patrimonio
    const radiosPayload = radiosParaSolicitacao.map(r => ({
        numeroSerie: r.numeroSerie,
        modelo: r.modelo,
        descricaoProblema: r.descricaoProblema,
        patrimonio: r.patrimonio // Garante que o patrimônio seja enviado
    }));

    const payload = {
        solicitanteNome: solicitanteNome,
        solicitanteEmail: solicitanteEmail,
        prioridade: prioridade,
        radios: radiosPayload, // Usa a lista de rádios com o formato correto para o backend
        // dataSolicitacao e statusPedido serão definidos pelo backend
    };

    const btnEnviar = document.getElementById('btnEnviarSolicitacao');
    const originalButtonText = btnEnviar.textContent;
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Enviando...';

    try {
        const res = await fetch('/manutencao/solicitacoes', { // Endpoint para o backend
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            // Se o backend retorna o idPedido, podemos exibi-lo
            const idGerado = data.idPedido ? ` (ID: ${data.idPedido})` : '';
            // Substituído alert() por showAlert()
            showAlert('Sucesso!', `Solicitação de manutenção enviada com sucesso!${idGerado}`, 'success');
            // Resetar formulário e lista
            radiosParaSolicitacao = [];
            renderTabelaRadiosSolicitados();
            document.getElementById('formSolicitarManutencao').reset(); // Limpa os campos do formulário
            document.getElementById('radioNumeroSerieParaAdicionar').value = '';
            document.getElementById('infoRadioVerificado').innerHTML = '';
            document.getElementById('descricaoProblemaRadio').value = '';
            radioVerificadoAtual = null;

            // Re-popula as informações fixas do solicitante e data
            document.getElementById('solicitanteNome').textContent = localStorage.getItem('nomeUsuario') || 'Usuário não identificado';
            document.getElementById('dataSolicitacao').textContent = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            document.getElementById('prioridadeSolicitacao').value = ""; // Garante que o select de prioridade volte ao placeholder
        } else {
            // Substituído alert() por showAlert()
            showAlert('Erro ao Enviar', data.message || 'Falha ao enviar solicitação de manutenção.', 'danger');
        }
    } catch (error) {
        console.error("Erro ao enviar solicitação de manutenção:", error);
        // Substituído alert() por showAlert()
        showAlert('Erro de Comunicação', 'Não foi possível conectar ao servidor para enviar a solicitação.', 'danger');
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = originalButtonText;
    }
}

// Função auxiliar para decodificar JWT (forma simples, sem verificar assinatura)
// Se você já tem essa função em 'auth.js' ou 'ui.js', PODE REMOVER DAQUI.
function jwt_decode(token) {
    if (!token || typeof token !== 'string') return null;
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Erro ao decodificar token JWT:", e);
        return null;
    }
}