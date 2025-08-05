// frontend/js/estoque.js

let todosRadios = []; // Armazena todos os rádios carregados para filtros
let modalEditarPatrimonioInstance = null; // Instância do modal de edição de patrimônio
let modalInputNumeroSerieInstance = null; // Nova instância do modal de input de série
let nfDetailsModalInstance = null; // Instância do modal de detalhes da NF

document.addEventListener('DOMContentLoaded', async () => {
    try {
        checkAuthentication('estoque'); // Permissão para 'estoque' ou 'admin'

        // Inicializa os listeners de filtro
        // APLICAÇÃO DO DEBOUNCE AQUI PARA O FILTRO DE SÉRIE
        document.getElementById('filtroSerie').addEventListener('input', debounce(aplicarFiltro, 300));
        document.getElementById('tipoFiltro').addEventListener('change', () => {
            popularSubFiltro();
            aplicarFiltro();
        });
        document.getElementById('subFiltro').addEventListener('change', aplicarFiltro);
        document.getElementById('chkDisponivel').addEventListener('change', aplicarFiltro);
        // ATUALIZAÇÃO AQUI: o chkOcupado agora é para 'Ocupado (Mensal)'
        document.getElementById('chkOcupado').addEventListener('change', aplicarFiltro);
        document.getElementById('chkManutencao').addEventListener('change', aplicarFiltro);
        // ADICIONADO: Listener para a nova checkbox de Locação Anual
        document.getElementById('chkLocacaoAnual').addEventListener('change', aplicarFiltro);

        // Filtro para Tipo de Locação (Mensal/Anual)
        document.getElementById('filtroTipoLocacao').addEventListener('change', aplicarFiltro);

        // Inicializa o modal de editar patrimônio
        const modalEditarEl = document.getElementById('modalEditarPatrimonio');
        if (modalEditarEl) {
            modalEditarPatrimonioInstance = new bootstrap.Modal(modalEditarEl);
            document.getElementById('btnSalvarPatrimonio').addEventListener('click', salvarNovoPatrimonio);
            modalEditarEl.querySelector('.modal-header').classList.add('bg-primary', 'text-white');
            modalEditarEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');
        }

        // Inicializa o modal de input de número de série
        const modalInputEl = document.getElementById('modalInputNumeroSerie');
        if (modalInputEl) {
            modalInputNumeroSerieInstance = new bootstrap.Modal(modalInputEl);
            document.getElementById('btnConfirmarInputNumeroSerie').addEventListener('click', handleInputNumeroSerie);
        }

        // Inicializa o modal de detalhes da NF
        const nfDetailsModalEl = document.getElementById('nfDetailsModal');
        if (nfDetailsModalEl) {
            nfDetailsModalInstance = new bootstrap.Modal(nfDetailsModalEl);
        }

        // Listener para o botão "Editar Patrimônio"
        document.getElementById('btnEditarPatrimonio').addEventListener('click', () => {
            if (modalInputNumeroSerieInstance) {
                document.getElementById('inputNumeroSerieParaEdicao').value = ''; // Limpa o campo de input
                modalInputNumeroSerieInstance.show();
                document.getElementById('inputNumeroSerieParaEdicao').focus(); // Foca no campo de input
            } else {
                showAlert('Erro', 'Modal de entrada de número de série não inicializado corretamente.', 'danger');
            }
        });

        // Carrega os rádios ao carregar a página
        await carregarRadios();

    } catch (error) {
        console.error("Erro na inicialização da página de Estoque:", error.message);
        showAlert("Erro Crítico", "Não foi possível inicializar a página de estoque corretamente. Tente recarregar.", "danger");
    }
});

/**
 * Função debounce para atrasar a execução de uma função.
 * Útil para campos de busca.
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}


/**
 * Carrega todos os rádios do backend.
 */
async function carregarRadios() {
    const tabelaRadiosBody = document.querySelector('#tabelaRadios');
    if(tabelaRadiosBody) tabelaRadiosBody.innerHTML = '<tr><td colspan="8" class="text-center">Carregando rádios...</td></tr>'; // Colspan aumentado para 8

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/radios', { // URL Relativa
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Não foi possível obter detalhes do erro.' }));
            showAlert('Erro ao Carregar Estoque', `Falha ao carregar dados do estoque: ${errorData.message || res.statusText}`, 'danger');
            if(tabelaRadiosBody) tabelaRadiosBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Falha ao carregar dados.</td></tr>`;
            return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
            todosRadios = [];
            throw new Error("Formato de dados de rádios inválido.");
        }
        todosRadios = data;
        popularSubFiltro(); // Popula o subfiltro com base nos dados carregados
        aplicarFiltro();     // Aplica o filtro inicial (que pode ser nenhum filtro)

    } catch (erro) {
        console.error('Erro ao carregar rádios:', erro);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para carregar o estoque.', 'danger');
        if(tabelaRadiosBody) tabelaRadiosBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Erro de conexão.</td></tr>`;
    }
}

/**
 * Preenche o dropdown de subfiltro com base no tipo de filtro selecionado (Modelo ou Frequência).
 */
function popularSubFiltro() {
    const tipoFiltroValor = document.getElementById('tipoFiltro').value;
    const subFiltroSelect = document.getElementById('subFiltro');

    subFiltroSelect.innerHTML = ''; // Limpa opções antigas
    subFiltroSelect.disabled = !tipoFiltroValor;

    if (!tipoFiltroValor) {
        subFiltroSelect.innerHTML = '<option value="">Selecione um tipo de filtro</option>';
        return;
    }

    // Coleta valores únicos para o tipo de filtro selecionado
    const valoresUnicos = [...new Set(todosRadios.map(r => r[tipoFiltroValor]).filter(Boolean))].sort();

    let optionsHtml = '<option value="">Todos</option>';
    valoresUnicos.forEach(valor => {
        optionsHtml += `<option value="${valor}">${valor}</option>`;
    });
    subFiltroSelect.innerHTML = optionsHtml;
}

/**
 * Aplica todos os filtros selecionados e renderiza a tabela de rádios.
 */
function aplicarFiltro() {
    const filtroTexto = document.getElementById('filtroSerie').value.toLowerCase();
    const tipoFiltro = document.getElementById('tipoFiltro').value;
    const subFiltroValorSelecionado = document.getElementById('subFiltro').value;
    const mostrarDisponivel = document.getElementById('chkDisponivel').checked;
    const mostrarOcupado = document.getElementById('chkOcupado').checked; // Este agora filtra 'Ocupado' (Mensal)
    const mostrarManutencao = document.getElementById('chkManutencao').checked;
    // NOVO: Pega o estado da checkbox de Locação Anual
    const mostrarLocacaoAnual = document.getElementById('chkLocacaoAnual').checked;

    const filtroTipoLocacao = document.getElementById('filtroTipoLocacao')?.value;

    const tbody = document.getElementById('tabelaRadios');

    if (!tbody) return;
    tbody.innerHTML = ''; // Limpa a tabela antes de popular

    if (todosRadios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum rádio no estoque de locação.</td></tr>'; // Colspan aumentado
        return;
    }

    const radiosFiltrados = todosRadios.filter(r => {
        const correspondeTexto = !filtroTexto ||
            (r.numeroSerie && r.numeroSerie.toLowerCase().includes(filtroTexto)) ||
            (r.modelo && r.modelo.toLowerCase().includes(filtroTexto)) ||
            (r.patrimonio && r.patrimonio.toLowerCase().includes(filtroTexto));

        const correspondeSubfiltro = !tipoFiltro || !subFiltroValorSelecionado || (r[tipoFiltro] && r[tipoFiltro] === subFiltroValorSelecionado);

        let correspondeStatus = false;
        if (mostrarDisponivel && r.status === 'Disponível') correspondeStatus = true;
        // ATUALIZADO: 'Ocupado' agora é para tipoLocacaoAtual diferente de 'Anual' (ou seja, 'Mensal')
        if (mostrarOcupado && r.status === 'Ocupado' && r.tipoLocacaoAtual !== 'Anual') correspondeStatus = true;
        if (mostrarManutencao && r.status === 'Manutenção') correspondeStatus = true;
        // ADICIONADO: Filtra para rádios 'Ocupado' com tipoLocacaoAtual 'Anual'
        if (mostrarLocacaoAnual && r.status === 'Ocupado' && r.tipoLocacaoAtual === 'Anual') correspondeStatus = true;


        // ATUALIZADO: Se nenhuma checkbox de status estiver marcada, mostra todos os status.
        if (!mostrarDisponivel && !mostrarOcupado && !mostrarManutencao && !mostrarLocacaoAnual) {
            correspondeStatus = true;
        }

        // Filtra por tipo de locação se selecionado
        const correspondeTipoLocacao = !filtroTipoLocacao || filtroTipoLocacao === '' || (r.tipoLocacaoAtual === filtroTipoLocacao);

        return correspondeTexto && correspondeSubfiltro && correspondeStatus && correspondeTipoLocacao;
    });

    if (radiosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum rádio encontrado com os filtros aplicados.</td></tr>'; // Colspan aumentado
        return;
    }

    radiosFiltrados.forEach(r => {
        const tr = document.createElement('tr');

        const tdModelo = document.createElement('td');
        tdModelo.textContent = r.modelo || 'N/A';
        tr.appendChild(tdModelo);

        const tdSerie = document.createElement('td');
        tdSerie.textContent = r.numeroSerie || 'N/A';
        tr.appendChild(tdSerie);

        const tdPatrimonio = document.createElement('td');
        tdPatrimonio.textContent = r.patrimonio || 'N/A';
        tr.appendChild(tdPatrimonio);

        const tdFrequencia = document.createElement('td');
        tdFrequencia.textContent = r.frequencia || 'N/A';
        tr.appendChild(tdFrequencia);

        const tdStatus = document.createElement('td');
        const spanStatus = document.createElement('span');

        let statusBadgeClass = '';
        let statusText = r.status || 'N/D';

        if (r.status === 'Disponível') {
            statusBadgeClass = 'bg-success';
        } else if (r.status === 'Ocupado') {
            // Lógica para diferenciar locação mensal e anual
            if (r.tipoLocacaoAtual === 'Anual') {
                statusBadgeClass = 'bg-warning text-dark'; // Laranja para Anual
                statusText = 'Locação Anual';
            } else { // Mensal ou outro tipo de "Ocupado"
                statusBadgeClass = 'bg-danger'; // Vermelho para Mensal (padrão 'Ocupado')
                statusText = 'Locação Mensal';
            }
        } else if (r.status === 'Manutenção') {
            statusBadgeClass = 'bg-info';
        } else {
            statusBadgeClass = 'bg-secondary';
        }
        spanStatus.className = `badge ${statusBadgeClass}`;
        spanStatus.textContent = statusText;
        tdStatus.appendChild(spanStatus);
        tr.appendChild(tdStatus);

        const tdNfAtual = document.createElement('td');
        tdNfAtual.textContent = r.nfAtual || '-';
        tr.appendChild(tdNfAtual);

        // Coluna para o Tipo de Locação Atual (já existia e está correta)
        const tdTipoLocacaoAtual = document.createElement('td');
        tdTipoLocacaoAtual.textContent = r.tipoLocacaoAtual || 'N/A';
        tr.appendChild(tdTipoLocacaoAtual);

        // Coluna para Ações (Botão Detalhes NF)
        const tdAcoes = document.createElement('td');
        if (r.nfAtual) {
            const btnDetalhes = document.createElement('button');
            btnDetalhes.className = 'btn btn-sm btn-danger btn-details-nf';
            btnDetalhes.textContent = 'Detalhes NF';
            btnDetalhes.dataset.nfNumero = r.nfAtual; // Armazena o número da NF
            btnDetalhes.addEventListener('click', () => fetchNfDetails(r.nfAtual));
            tdAcoes.appendChild(btnDetalhes);
        } else {
            tdAcoes.textContent = '-';
        }
        tr.appendChild(tdAcoes);

        tbody.appendChild(tr);
    });
}

/**
 * Função para lidar com a entrada do número de série no modal de input.
 * Esta função substitui a lógica do prompt().
 */
async function handleInputNumeroSerie() {
    const numeroSerieInput = document.getElementById('inputNumeroSerieParaEdicao');
    const numeroSerie = numeroSerieInput.value.trim();

    if (!numeroSerie) {
        showAlert('Campo Vazio', 'Por favor, informe o número de série do rádio.', 'warning');
        numeroSerieInput.focus(); // Mantém o foco no campo
        return;
    }

    // Fecha o modal de input ANTES de tentar buscar o rádio
    if (modalInputNumeroSerieInstance) {
        modalInputNumeroSerieInstance.hide();
    }

    const radioToEdit = todosRadios.find(r => r.numeroSerie === numeroSerie);

    if (!radioToEdit) {
        showAlert('Rádio Não Encontrado', `Rádio com número de série "${numeroSerie}" não encontrado no estoque.`, 'danger');
        return;
    }

    // Preenche e abre o modal de edição de patrimônio
    document.getElementById('editPatrimonioNumeroSerie').value = radioToEdit.numeroSerie;
    document.getElementById('editPatrimonioAtual').value = radioToEdit.patrimonio || 'N/A';
    document.getElementById('editNovoPatrimonio').value = radioToEdit.patrimonio || ''; // Preenche com o atual para facilitar edição

    if (modalEditarPatrimonioInstance) {
        modalEditarPatrimonioInstance.show();
        document.getElementById('editNovoPatrimonio').focus(); // Foca no campo de novo patrimônio
    } else {
        showAlert('Erro', 'Modal de edição de patrimônio não inicializado corretamente.', 'danger');
    }
}

/**
 * Envia a requisição para salvar o novo patrimônio no backend.
 */
async function salvarNovoPatrimonio() {
    const numeroSerie = document.getElementById('editPatrimonioNumeroSerie').value;
    const novoPatrimonio = document.getElementById('editNovoPatrimonio').value.trim();

    if (!novoPatrimonio) {
        showAlert('Campo Obrigatório', 'O novo número de patrimônio não pode ser vazio.', 'warning');
        return;
    }

    // Se o patrimônio atual for "N/A" (quando não tinha um) e o novo estiver vazio, também alerta.
    // ou se o novo for igual ao atual
    const patrimonioAtualExibido = document.getElementById('editPatrimonioAtual').value.trim();
    if (novoPatrimonio === patrimonioAtualExibido || (patrimonioAtualExibido === 'N/A' && novoPatrimonio === '')) {
        showAlert('Sem Alterações', 'O novo patrimônio é o mesmo que o atual ou não foi alterado de N/A.', 'info');
        modalEditarPatrimonioInstance.hide();
        return;
    }

    const btnSalvar = document.getElementById('btnSalvarPatrimonio');
    const originalBtnHtml = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/radios/${numeroSerie}/patrimonio`, {
            method: 'PUT', // Ou PATCH, dependendo da sua API RESTful
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ patrimonio: novoPatrimonio })
        });

        const data = await res.json();

        if (res.ok) {
            showAlert('Sucesso', `Patrimônio do rádio ${numeroSerie} atualizado para ${novoPatrimonio}.`, 'success');
            modalEditarPatrimonioInstance.hide();
            await carregarRadios(); // Recarrega os rádios para atualizar a tabela
        } else {
            showAlert('Erro ao Salvar', data.message || 'Não foi possível atualizar o patrimônio.', 'danger');
        }
    } catch (error) {
        console.error('Erro ao salvar novo patrimônio:', error);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para salvar o patrimônio.', 'danger');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = originalBtnHtml;
    }
}

/**
 * Busca os detalhes de uma NF específica no backend.
 * @param {string} nfNumero - O número da NF a ser buscada.
 */
async function fetchNfDetails(nfNumero) {
    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('Erro', 'Usuário não autenticado. Redirecionando para o login...', 'danger');
        setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        return;
    }

    try {
        const response = await fetch(`/nf/${nfNumero}`, { // Endpoint para buscar NF por número
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const nf = await response.json();
            displayNfDetailsModal(nf);
        } else {
            const errorData = await response.json();
            showAlert('Erro', errorData.message || `Erro ao carregar detalhes da NF ${nfNumero}.`, 'danger');
        }
    } catch (error) {
        console.error('Erro de rede ou servidor ao carregar detalhes da NF:', error);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para carregar detalhes da NF.', 'danger');
    }
}

/**
 * Preenche e exibe o modal de detalhes da NF.
 * @param {object} nf - O objeto da Nota Fiscal.
 */
function displayNfDetailsModal(nf) {
    if (!nfDetailsModalInstance) {
        showAlert('Erro', 'Modal de detalhes da NF não inicializado corretamente.', 'danger');
        return;
    }

    document.getElementById('modalNfNumero').textContent = nf.nfNumero || 'N/A';
    document.getElementById('modalNfCliente').textContent = nf.cliente || 'N/A';
    document.getElementById('modalNfTipoLocacao').textContent = nf.tipoLocacao || 'N/A';
    document.getElementById('modalNfDataSaida').textContent = nf.dataSaida ? new Date(nf.dataSaida).toLocaleDateString('pt-BR') : 'N/A';
    document.getElementById('modalNfPrevisaoRetorno').textContent = nf.previsaoRetorno ? new Date(nf.previsaoRetorno).toLocaleDateString('pt-BR') : 'N/A';
    document.getElementById('modalNfUsuarioRegistro').textContent = nf.usuarioRegistro || 'N/A';
    document.getElementById('modalNfObservacoes').textContent = (nf.observacoes && nf.observacoes.length > 0) ? nf.observacoes.join(', ') : 'N/A';

    const radiosList = document.getElementById('modalNfRadiosList');
    radiosList.innerHTML = ''; // Limpa a lista de rádios

    if (nf.radios && nf.radios.length > 0) {
        nf.radios.forEach(radio => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = `Série: ${radio.numeroSerie} | Modelo: ${radio.modelo || 'N/A'} | Patrimônio: ${radio.patrimonio || 'N/A'} | Frequência: ${radio.frequencia || 'N/A'}`;
            radiosList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.className = 'list-group-item text-muted';
        li.textContent = 'Nenhum rádio associado a esta NF.';
        radiosList.appendChild(li);
    }

    nfDetailsModalInstance.show();
}

// Assumindo que checkAuthentication() e showAlert() estão disponíveis globalmente (e.g., via ui.js).