// frontend/js/manutencao_dashboard.js

// Variáveis globais
let modalTecnicoInstance = null;
let modalInputObservacoesTecnicasInstance = null;
let modalConfirmationInstance = null;
let modalCondenarRadioInstance = null;
let todosItensEstoqueManutencao = [];
let todosPedidosHistorico = [];
let confirmationCallback = null;
let isConfirmed = false;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuthentication('gerenciar_manutencao');
        carregarPedidosAbertos();
        inicializarModais();
        adicionarEventListenersGlobais();
    } catch (error) {
        console.error("Erro na inicialização do Painel de Manutenção:", error);
        showAlert('Erro Crítico', 'Não foi possível carregar a página de manutenção.', 'danger');
    }
});

function inicializarModais() {
    const setupModalHeader = (modalEl) => {
        const header = modalEl?.querySelector('.modal-header');
        if (header) {
            header.classList.add('bg-custom-danger', 'text-white');
            header.querySelector('.btn-close')?.classList.add('btn-close-white');
        }
    };

    const modalTecnicoEl = document.getElementById('modalSelecionarTecnico');
    if (modalTecnicoEl) {
        modalTecnicoInstance = new bootstrap.Modal(modalTecnicoEl);
        setupModalHeader(modalTecnicoEl);
    }

    const modalInputObsEl = document.getElementById('modalInputObservacoesTecnicas');
    if (modalInputObsEl) {
        modalInputObservacoesTecnicasInstance = new bootstrap.Modal(modalInputObsEl);
        setupModalHeader(modalInputObsEl);
    }

    const modalConfirmEl = document.getElementById('modalConfirmation');
    if (modalConfirmEl) {
        modalConfirmationInstance = new bootstrap.Modal(modalConfirmEl);
        setupModalHeader(modalConfirmEl);
    }

    const modalCondenarEl = document.getElementById('modalCondenarRadio');
    if (modalCondenarEl) {
        modalCondenarRadioInstance = new bootstrap.Modal(modalCondenarEl);
        setupModalHeader(modalCondenarEl);
    }
}

function adicionarEventListenersGlobais() {
    document.getElementById('manutencaoTabs')?.addEventListener('shown.bs.tab', (event) => {
        const targetPaneId = event.target.getAttribute('data-bs-target');
        switch (targetPaneId) {
            case '#pedidos-abertos-pane': carregarPedidosAbertos(); break;
            case '#pedidos-andamento-pane': carregarPedidosEmAndamento(); break;
            case '#estoque-manutencao-pane': carregarEstoqueManutencao(); break;
            case '#historico-manutencao-pane': carregarHistoricoManutencao(); break;
        }
    });

    document.getElementById('btnConfirmAction')?.addEventListener('click', () => {
        isConfirmed = true;
        if (confirmationCallback) confirmationCallback(true);
        modalConfirmationInstance.hide();
        confirmationCallback = null;
    });
    document.getElementById('modalConfirmation')?.addEventListener('hidden.bs.modal', () => {
        if (!isConfirmed && confirmationCallback) confirmationCallback(false);
        isConfirmed = false;
        confirmationCallback = null;
    });

    document.getElementById('selectTecnico')?.addEventListener('change', function() {
        document.getElementById('divNomeOutroTecnico').style.display = this.value === 'Outro' ? 'block' : 'none';
    });
    document.getElementById('btnConfirmarIniciarManutencaoComTecnico')?.addEventListener('click', handleConfirmarIniciarManutencaoComTecnico);
    document.getElementById('btnConfirmarInputObservacoesTecnicas')?.addEventListener('click', handleConfirmarObservacoesTecnicas);
    document.getElementById('btnConfirmarCondenacao')?.addEventListener('click', handleConfirmarCondenacao);

    document.getElementById('filtroEstoqueManutencao')?.addEventListener('input', filtrarEstoqueManutencao);
    document.getElementById('filtroHistoricoManutencao')?.addEventListener('input', filtrarHistoricoManutencao);
}

// --- FUNÇÕES DE CARREGAMENTO DAS ABAS ---
async function carregarPedidosAbertos() {
    const tbody = document.querySelector('#tabelaPedidosAbertos tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/solicitacoes?status=aberto`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error((await res.json()).message || 'Erro ao buscar pedidos.');
        const pedidos = await res.json();
        tbody.innerHTML = '';
        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma solicitação aberta.</td></tr>';
            return;
        }
        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${pedido.idPedido}</td><td>${pedido.solicitanteNome || ''}</td><td>${new Date(pedido.dataSolicitacao).toLocaleDateString('pt-BR')}</td><td><span class="badge bg-${getPrioridadeBadge(pedido.prioridade)}">${pedido.prioridade.toUpperCase()}</span></td><td>1</td><td><button class="btn btn-sm btn-info btn-ver-detalhes" data-id="${pedido.idPedido}"><i class="bi bi-eye"></i> Detalhes</button><button class="btn btn-sm btn-success ms-1 btn-dar-andamento" data-id="${pedido.idPedido}"><i class="bi bi-check-circle"></i> Dar Andamento</button></td>`;
            tbody.appendChild(tr);
            const trDetalhes = document.createElement('tr');
            trDetalhes.className = 'detalhes-pedido d-none';
            trDetalhes.id = `detalhes-${pedido.idPedido}`;
            trDetalhes.innerHTML = `<td colspan="6"><div class="p-2">Carregando detalhes...</div></td>`;
            tbody.appendChild(trDetalhes);
        });
        addEventListenersPedidosAbertos();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha: ${error.message}</td></tr>`;
    }
}

async function carregarPedidosEmAndamento() {
    const tbody = document.querySelector('#tabelaPedidosEmAndamento tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/solicitacoes?status=aguardando_manutencao,em_manutencao`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error((await res.json()).message);
        const pedidos = await res.json();
        tbody.innerHTML = '';
        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum pedido em processo de manutenção.</td></tr>';
            return;
        }
        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            let acoesHtml = '';
            if (pedido.statusPedido === 'aguardando_manutencao') {
                acoesHtml = `<button class="btn btn-sm btn-warning btn-iniciar-manutencao" data-id="${pedido.idPedido}"><i class="bi bi-tools"></i> Iniciar</button>`;
            } else if (pedido.statusPedido === 'em_manutencao') {
                acoesHtml = `<button class="btn btn-sm btn-primary btn-concluir-manutencao" data-id="${pedido.idPedido}"><i class="bi bi-check2-square"></i> Concluir OS</button>`;
            }
            tr.innerHTML = `<td>${pedido.idPedido}</td><td>${pedido.solicitanteNome}</td><td>${new Date(pedido.dataSolicitacao).toLocaleDateString('pt-BR')}</td><td><span class="badge bg-${getStatusPedidoBadge(pedido.statusPedido)}">${formatStatusPedido(pedido.statusPedido)}</span></td><td>${pedido.tecnicoResponsavel || '-'}</td><td><button class="btn btn-sm btn-info btn-ver-detalhes-andamento" data-id="${pedido.idPedido}"><i class="bi bi-eye"></i> Detalhes</button> ${acoesHtml}</td>`;
            tbody.appendChild(tr);
            const trDetalhes = document.createElement('tr');
            trDetalhes.className = 'detalhes-pedido d-none';
            trDetalhes.id = `detalhes-andamento-${pedido.idPedido}`;
            trDetalhes.innerHTML = `<td colspan="6"><div class="p-2">Carregando...</div></td>`;
            tbody.appendChild(trDetalhes);
        });
        addEventListenersPedidosEmAndamento();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

async function carregarDetalhesDoPedidoNaLinha(idPedido, divElement) {
    divElement.innerHTML = '<div class="text-center p-3"><span class="spinner-border spinner-border-sm"></span> Carregando...</div>';
    try {
        const pedido = await buscarDetalhesPedidoAPI(idPedido);
        const radio = pedido.radio;
        const dataSolicitacao = formatarDataHora(pedido.dataSolicitacao);
        const dataInicio = formatarDataHora(pedido.dataInicioManutencao);
        let acoesHtml = '';
        const isFinalizado = pedido.statusPedido === 'finalizado' || pedido.statusPedido === 'cancelado';

        if (!isFinalizado && radio.status === 'Pendente') {
            acoesHtml = `<button class="btn btn-secondary btn-sm py-0 ms-1 btn-condenar-radio" data-id-pedido="${pedido.idPedido}" data-radio-sub-id="${radio._id}" data-numero-serie="${radio.numeroSerie}">Condenar</button>`;
        } else {
            const statusBadgeClass = radio.status === 'Concluído' ? 'success' : 'dark';
            acoesHtml = `<span class="badge bg-${statusBadgeClass}">${radio.status}</span>`;
        }

        let detalhesHtml = `
            <div class="container-fluid">
                <div class="row mb-3">
                    <div class="col-md-4"><p class="mb-1"><strong>ID Ordem de Serviço:</strong> ${pedido.idPedido}</p><p class="mb-1"><strong>Solicitante:</strong> ${pedido.solicitanteNome}</p></div>
                    <div class="col-md-4"><p class="mb-1"><strong>Data da Solicitação:</strong> ${dataSolicitacao.data} às ${dataSolicitacao.hora}</p>${pedido.dataInicioManutencao ? `<p class="mb-1"><strong>Início da Manutenção:</strong> ${dataInicio.data} às ${dataInicio.hora}</p>` : ''}</div>
                    <div class="col-md-4">${pedido.tecnicoResponsavel ? `<p class="mb-1"><strong>Técnico Responsável:</strong> ${pedido.tecnicoResponsavel}</p>` : ''}</div>
                </div>
                <h6>Rádio na Ordem de Serviço:</h6>
                <ul class="list-group list-group-flush">
                    <li class="list-group-item"><strong>Nº de Série:</strong> ${radio.numeroSerie}</li>
                    <li class="list-group-item"><strong>Modelo:</strong> ${radio.modelo}</li>
                    <li class="list-group-item"><strong>Defeito Relatado:</strong> ${radio.descricaoProblema}</li>
                    <li class="list-group-item"><strong>Ações:</strong> ${acoesHtml}</li>
                </ul>
            </div>`;
        divElement.innerHTML = detalhesHtml;
        adicionarEventListenersDetalhesOS(divElement);
    } catch (error) {
        console.error("Erro em carregarDetalhesDoPedidoNaLinha:", error);
        divElement.innerHTML = `<div class="text-danger p-2">Erro ao carregar detalhes: ${error.message}</div>`;
    }
}

// --- FUNÇÕES DE EVENTOS (CLICKS) ---
function addEventListenersPedidosAbertos() {
    document.querySelectorAll('#tabelaPedidosAbertos .btn-ver-detalhes').forEach(btn => {
        btn.addEventListener('click', function() {
            const detalhesRow = this.closest('tr').nextElementSibling;
            if (detalhesRow.classList.toggle('d-none')) return;
            carregarDetalhesDoPedidoNaLinha(this.dataset.id, detalhesRow.querySelector('td > div'));
        });
    });
    document.querySelectorAll('#tabelaPedidosAbertos .btn-dar-andamento').forEach(btn => {
        btn.addEventListener('click', function() { confirmarDarAndamento(this.dataset.id); });
    });
}

function addEventListenersPedidosEmAndamento() {
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-ver-detalhes-andamento').forEach(btn => {
        btn.addEventListener('click', function() {
            const detalhesRow = this.closest('tr').nextElementSibling;
            if (detalhesRow.classList.toggle('d-none')) return;
            carregarDetalhesDoPedidoNaLinha(this.dataset.id, detalhesRow.querySelector('td > div'));
        });
    });
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-iniciar-manutencao').forEach(btn => {
        btn.addEventListener('click', function() { abrirModalSelecionarTecnico(this.dataset.id); });
    });
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-concluir-manutencao').forEach(btn => {
        btn.addEventListener('click', function() { abrirModalConcluirManutencao(this.dataset.id); });
    });
}

function adicionarEventListenersDetalhesOS(divElement) {
    divElement.querySelectorAll('.btn-condenar-radio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { idPedido, radioSubId, numeroSerie } = e.currentTarget.dataset;
            abrirModalCondenar(idPedido, radioSubId, numeroSerie);
        });
    });
}

async function confirmarDarAndamento(idPedido) {
    showBootstrapConfirmation('Confirmar Andamento', `Tem certeza que deseja dar andamento ao pedido ${idPedido}?`, async (confirmed) => {
        if (!confirmed) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}/dar-andamento`, {
                method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error((await res.json()).message);
            showAlert('Sucesso!', `Pedido ${idPedido} encaminhado para manutenção.`, 'success');
            await carregarPedidosAbertos();
            new bootstrap.Tab(document.getElementById('pedidos-andamento-tab')).show();
        } catch (error) {
            showAlert('Erro', error.message, 'danger');
        }
    });
}

async function handleConfirmarIniciarManutencaoComTecnico() {
    const idPedido = document.getElementById('idPedidoParaIniciarManutencao').value;
    let tecnicoSelecionado = document.getElementById('selectTecnico').value;
    if (tecnicoSelecionado === 'Outro') {
        tecnicoSelecionado = document.getElementById('inputNomeOutroTecnico').value.trim();
    }
    if (!tecnicoSelecionado) return showAlert('Campo Obrigatório', 'Selecione ou informe o nome do técnico.', 'warning');
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}/iniciar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tecnicoResponsavel: tecnicoSelecionado })
        });
        if (!res.ok) throw new Error((await res.json()).message);
        showAlert('Sucesso!', `Manutenção do pedido ${idPedido} iniciada.`, 'success');
        modalTecnicoInstance.hide();
        await carregarPedidosEmAndamento();
    } catch (error) {
        showAlert('Erro ao Iniciar', error.message, 'danger');
    }
}

function abrirModalCondenar(idPedido, radioSubId, numeroSerie) {
    document.getElementById('radioParaCondenarInfo').textContent = numeroSerie;
    document.getElementById('idPedidoParaCondenar').value = idPedido;
    document.getElementById('radioSubIdParaCondenar').value = radioSubId;
    document.getElementById('motivoCondenacao').value = '';
    modalCondenarRadioInstance.show();
}

async function handleConfirmarCondenacao() {
    const idPedido = document.getElementById('idPedidoParaCondenar').value;
    const radioSubId = document.getElementById('radioSubIdParaCondenar').value;
    const motivo = document.getElementById('motivoCondenacao').value.trim();
    if (!motivo) return showAlert('Campo Obrigatório', 'Por favor, informe o motivo da condenação.', 'warning');
    modalCondenarRadioInstance.hide();
    await atualizarStatusRadioAPI(idPedido, radioSubId, 'Condenado', motivo);
}

function abrirModalConcluirManutencao(idPedido) {
    document.getElementById('idPedidoParaConcluirManutencao').value = idPedido;
    document.getElementById('inputObservacoesTecnicas').value = '';
    modalInputObservacoesTecnicasInstance.show();
}

async function handleConfirmarObservacoesTecnicas() {
    const idPedido = document.getElementById('idPedidoParaConcluirManutencao').value;
    const observacoesTecnicas = document.getElementById('inputObservacoesTecnicas').value.trim();
    modalInputObservacoesTecnicasInstance.hide();
    showBootstrapConfirmation('Confirmar Conclusão', `Deseja concluir a Ordem de Serviço ${idPedido}?`, async (confirmed) => {
        if (confirmed) await concluirManutencaoBackend(idPedido, observacoesTecnicas);
    });
}

async function concluirManutencaoBackend(idPedido, observacoesTecnicas) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}/concluir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ observacoesTecnicas })
        });
        if (!res.ok) throw new Error((await res.json()).message);
        showAlert('Sucesso!', `Manutenção da OS ${idPedido} concluída.`, 'success');
        await carregarPedidosEmAndamento();
        const tab = new bootstrap.Tab(document.getElementById('historico-manutencao-tab'));
        tab.show();
    } catch (error) {
        showAlert('Erro ao Concluir', error.message, 'danger');
    }
}

// --- FUNÇÕES DE API ---
async function atualizarStatusRadioAPI(idPedido, radioSubId, status, motivoCondenacao = null) {
    try {
        const token = localStorage.getItem('token');
        const body = { status };
        if (motivoCondenacao) body.motivoCondenacao = motivoCondenacao;
        const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}/radio/${radioSubId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error((await res.json()).message);
        showAlert('Sucesso!', `Rádio atualizado para "${status}".`, 'success');
        const detalhesDiv = document.querySelector(`.detalhes-pedido:not(.d-none) > td > div`);
        if (detalhesDiv) {
            const osId = detalhesDiv.closest('.detalhes-pedido').id.replace('detalhes-andamento-', '').replace('detalhes-', '');
            await carregarDetalhesDoPedidoNaLinha(osId, detalhesDiv);
        }
        await carregarPedidosEmAndamento();
    } catch (error) {
        showAlert('Erro ao Atualizar Status', error.message, 'danger');
    }
}

async function buscarDetalhesPedidoAPI(idPedido) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Não foi possível carregar os detalhes do pedido.');
    return res.json();
}

// --- FUNÇÕES AUXILIARES ---
function getPrioridadeBadge(p) { return { 'baixa': 'secondary', 'media': 'warning text-dark', 'alta': 'danger', 'urgente': 'danger fw-bold' }[p] || 'light'; }
function getStatusPedidoBadge(s) { return { 'aberto': 'warning text-dark', 'aguardando_manutencao': 'info text-dark', 'em_manutencao': 'primary', 'finalizado': 'success', 'cancelado': 'danger' }[s] || 'secondary'; }
function formatStatusPedido(s) { return s ? s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/D'; }
function formatarDataHora(d) { if (!d) return { data: '-', hora: '-' }; const dt = new Date(d); return { data: dt.toLocaleDateString('pt-BR'), hora: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }; }
function checkUserPermissions(p) { const u = JSON.parse(localStorage.getItem('usuario')); return u && u.permissoes ? p.some(r => u.permissoes.includes(r)) : false; }
function getStatusRadioBadge(status) {
    switch (status) {
        case 'Disponível': return 'bg-success';
        case 'Ocupado': return 'bg-warning text-dark';
        case 'Manutenção': return 'bg-primary';
        case 'Condenado': return 'bg-dark';
        default: return 'bg-secondary';
    }
}

// --- FUNÇÕES DE ESTOQUE E HISTÓRICO ---
async function carregarEstoqueManutencao() {
    const tbody = document.querySelector('#tabelaEstoqueManutencao tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/estoque`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error((await res.json()).message);
        todosItensEstoqueManutencao = await res.json();
        renderizarEstoqueManutencao(todosItensEstoqueManutencao);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha: ${error.message}</td></tr>`;
    }
}

function renderizarEstoqueManutencao(itens) {
    const tbody = document.querySelector('#tabelaEstoqueManutencao tbody');
    tbody.innerHTML = '';
    if (itens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum rádio em manutenção.</td></tr>';
        return;
    }
    itens.forEach(item => {
        const tr = document.createElement('tr');
        const statusRadio = item.radio?.status || 'N/A';
        const statusBadgeClass = getStatusRadioBadge(statusRadio);
        tr.innerHTML = `
            <td>${item.pedido?.idPedido || 'N/A'}</td>
            <td>${item.radio?.modelo || 'N/A'}</td>
            <td>${item.radio?.frequencia || 'N/A'}</td>
            <td>${item.radio?.numeroSerie || 'N/A'}</td>
            <td>${item.pedido?.tecnicoResponsavel || '-'}</td>
            <td><span class="badge ${statusBadgeClass}">${statusRadio}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function filtrarEstoqueManutencao() {
    const filtro = document.getElementById('filtroEstoqueManutencao').value.toLowerCase();
    const filtrados = todosItensEstoqueManutencao.filter(item => 
        item.radio?.numeroSerie?.toLowerCase().includes(filtro) ||
        item.radio?.modelo?.toLowerCase().includes(filtro) ||
        (item.pedido?.idPedido && item.pedido.idPedido.toLowerCase().includes(filtro))
    );
    renderizarEstoqueManutencao(filtrados);
}

async function carregarHistoricoManutencao() {
    const tbody = document.querySelector('#tabelaHistoricoManutencao tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/historico`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error((await res.json()).message);
        todosPedidosHistorico = await res.json();
        renderizarHistoricoManutencao(todosPedidosHistorico);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha: ${error.message}</td></tr>`;
    }
}

function renderizarHistoricoManutencao(pedidos) {
    const tbody = document.querySelector('#tabelaHistoricoManutencao tbody');
    tbody.innerHTML = '';
    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum histórico de manutenção.</td></tr>';
        return;
    }
    pedidos.forEach(pedido => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${pedido.idPedido}</td>
            <td>${pedido.solicitanteNome}</td>
            <td>${new Date(pedido.dataFimManutencao).toLocaleDateString('pt-BR')}</td>
            <td>${pedido.tecnicoResponsavel || '-'}</td>
            <td>1</td>
            <td><button class="btn btn-sm btn-info btn-ver-detalhes-historico" data-id="${pedido.idPedido}"><i class="bi bi-eye"></i> Detalhes</button></td>
        `;
        tbody.appendChild(tr);
        const trDetalhes = document.createElement('tr');
        trDetalhes.className = 'detalhes-pedido d-none';
        trDetalhes.id = `detalhes-historico-${pedido.idPedido}`;
        trDetalhes.innerHTML = `<td colspan="6"><div class="p-2">Carregando...</div></td>`;
        tbody.appendChild(trDetalhes);
    });
    addEventListenersHistorico();
}

function addEventListenersHistorico() {
    document.querySelectorAll('#tabelaHistoricoManutencao .btn-ver-detalhes-historico').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            const detalhesRow = this.closest('tr').nextElementSibling;
            if (detalhesRow) {
                const isHidden = detalhesRow.classList.toggle('d-none');
                if (!isHidden) {
                    carregarDetalhesDoPedidoNaLinha(idPedido, detalhesRow.querySelector('td > div'));
                }
            }
        });
    });
}

function filtrarHistoricoManutencao() {
    const filtro = document.getElementById('filtroHistoricoManutencao').value.toLowerCase();
    const filtrados = todosPedidosHistorico.filter(pedido => 
        pedido.idPedido.toLowerCase().includes(filtro) ||
        pedido.solicitanteNome.toLowerCase().includes(filtro) ||
        (pedido.tecnicoResponsavel && pedido.tecnicoResponsavel.toLowerCase().includes(filtro))
    );
    renderizarHistoricoManutencao(filtrados);
}