// frontend/js/manutencao_dashboard.js

// --- VARIÁVEIS GLOBAIS ---
let modalTecnicoInstance = null;
let modalInputObservacoesTecnicasInstance = null;
let modalConfirmationInstance = null;
let modalCondenarRadioInstance = null;
let modalInserirOSInstance = null;
let modalDecisaoInstance = null; // Variável para o novo modal
let todosItensEstoqueManutencao = [];
let todosPedidosHistorico = [];
let todosPedidosEmAndamento = [];
let confirmationCallback = null;
let isConfirmed = false;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('manutencao_dashboard');
        carregarPedidosAbertos();

        const manutencaoTabs = document.getElementById('manutencaoTabs');
        if (manutencaoTabs) {
            manutencaoTabs.addEventListener('shown.bs.tab', function (event) {
                const targetPaneId = event.target.getAttribute('data-bs-target');
                switch (targetPaneId) {
                    case '#pedidos-abertos-pane': carregarPedidosAbertos(); break;
                    case '#pedidos-andamento-pane': carregarPedidosEmAndamento(); break;
                    case '#estoque-manutencao-pane': carregarEstoqueManutencao(); break;
                    case '#historico-manutencao-pane': carregarHistoricoManutencao(); break;
                }
            });
        }

        const checkOsAutomatica = document.getElementById('checkOsAutomatica');
        const campoOsManual = document.getElementById('campoOsManual');
        const inputNumeroOS = document.getElementById('inputNumeroOS');

        checkOsAutomatica?.addEventListener('change', () => {
            if (checkOsAutomatica.checked) {
                campoOsManual.style.display = 'none';
                inputNumeroOS.required = false;
                inputNumeroOS.value = '';
            } else {
                campoOsManual.style.display = 'block';
                inputNumeroOS.required = true;
            }
        });

        const setupModalHeader = (modalEl) => {
            const header = modalEl?.querySelector('.modal-header');
            if (header) {
                header.classList.add('bg-custom-danger', 'text-white');
                header.querySelector('.btn-close')?.classList.add('btn-close-white');
            }
        };

        // Inicialização de todos os modais da página
        const modalTecnicoEl = document.getElementById('modalSelecionarTecnico');
        if (modalTecnicoEl) {
            modalTecnicoInstance = new bootstrap.Modal(modalTecnicoEl);
            setupModalHeader(modalTecnicoEl);
            document.getElementById('selectTecnico')?.addEventListener('change', function () {
                document.getElementById('divNomeOutroTecnico').style.display = this.value === 'Outro' ? 'block' : 'none';
            });
            document.getElementById('btnConfirmarIniciarManutencaoComTecnico')?.addEventListener('click', handleConfirmarIniciarManutencaoComTecnico);
        }

        const modalInputObsTecEl = document.getElementById('modalInputObservacoesTecnicas');
        if (modalInputObsTecEl) {
            modalInputObservacoesTecnicasInstance = new bootstrap.Modal(modalInputObsTecEl);
            setupModalHeader(modalInputObsTecEl);
            document.getElementById('btnConfirmarInputObservacoesTecnicas')?.addEventListener('click', handleConfirmarObservacoesTecnicas);
        }

        const modalConfirmationEl = document.getElementById('modalConfirmation');
        if (modalConfirmationEl) {
            modalConfirmationInstance = new bootstrap.Modal(modalConfirmationEl);
            setupModalHeader(modalConfirmationEl);
            document.getElementById('btnConfirmAction')?.addEventListener('click', () => {
                isConfirmed = true;
                if (confirmationCallback) confirmationCallback(true);
                modalConfirmationInstance.hide();
            });
            modalConfirmationEl.addEventListener('hidden.bs.modal', () => {
                if (!isConfirmed && confirmationCallback) confirmationCallback(false);
                isConfirmed = false;
                confirmationCallback = null;
            });
        }

        const modalCondenarEl = document.getElementById('modalCondenarRadio');
        if (modalCondenarEl) {
            modalCondenarRadioInstance = new bootstrap.Modal(modalCondenarEl);
            setupModalHeader(modalCondenarEl);
            document.getElementById('btnConfirmarCondenacao')?.addEventListener('click', handleConfirmarCondenacao);
        }

        const modalInserirOSEl = document.getElementById('modalInserirOS');
        if (modalInserirOSEl) {
            modalInserirOSInstance = new bootstrap.Modal(modalInserirOSEl);
            setupModalHeader(modalInserirOSEl);
            document.getElementById('formDarAndamento')?.addEventListener('submit', handleConfirmarDarAndamento);
        }

        const modalDecisaoEl = document.getElementById('modalDecisaoPosManutencao');
        if (modalDecisaoEl) {
            modalDecisaoInstance = new bootstrap.Modal(modalDecisaoEl);
            setupModalHeader(modalDecisaoEl);
            document.getElementById('btnDecisaoVoltarParaNf').addEventListener('click', () => {
                const idPedido = document.getElementById('idPedidoParaDecisao').value;
                executarDecisaoPosManutencao(idPedido, 'retornar-para-nf');
            });
            document.getElementById('btnDecisaoVoltarParaEstoque').addEventListener('click', () => {
                const idPedido = document.getElementById('idPedidoParaDecisao').value;
                executarDecisaoPosManutencao(idPedido, 'retornar-para-estoque');
            });
        }

        document.getElementById('filtroEstoqueManutencao')?.addEventListener('input', filtrarEstoqueManutencao);
        document.getElementById('filtroHistoricoManutencao')?.addEventListener('input', filtrarHistoricoManutencao);
        document.getElementById('filtroPedidosEmAndamento')?.addEventListener('input', filtrarPedidosEmAndamento);

    } catch (error) {
        console.error("Erro na inicialização do Painel de Manutenção:", error);
    }
});


// --- FUNÇÕES GERAIS ---
function showBootstrapConfirmation(title, message, callback) {
    document.getElementById('modalConfirmationLabel').textContent = title;
    document.getElementById('modalConfirmationMessage').textContent = message;
    confirmationCallback = callback;
    isConfirmed = false;
    modalConfirmationInstance.show();
}

function getPrioridadeBadge(prioridade) {
    switch (prioridade?.toLowerCase()) {
        case 'baixa': return 'secondary';
        case 'media': return 'warning text-dark';
        case 'alta': return 'danger';
        case 'urgente': return 'danger fw-bold border border-white';
        default: return 'light text-dark';
    }
}

function getStatusPedidoBadge(status) {
    switch (status?.toLowerCase()) {
        case 'aberto': return 'warning text-dark';
        case 'aguardando_manutencao': return 'info text-dark';
        case 'em_manutencao': return 'primary';
        case 'finalizado': return 'success';
        case 'cancelado': return 'danger';
        default: return 'secondary';
    }
}

function formatStatusPedido(status) {
    if (!status) return 'N/D';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}


// --- FUNÇÕES DE PEDIDOS ABERTOS ---
async function carregarPedidosAbertos() {
    const tbody = document.querySelector('#tabelaPedidosAbertos tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/solicitacoes?status=aberto`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Erro ao buscar pedidos.');

        const pedidos = await res.json();
        tbody.innerHTML = '';
        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma solicitação aberta.</td></tr>';
            return;
        }

        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pedido.idPedido || '<i>Aguardando OS</i>'}</td>
                <td>${pedido.solicitanteNome || ''}</td>
                <td>${new Date(pedido.dataSolicitacao).toLocaleDateString('pt-BR')}</td>
                <td><span class="badge bg-${getPrioridadeBadge(pedido.prioridade)}">${pedido.prioridade.toUpperCase()}</span></td>
                <td>${Array.isArray(pedido.radios) ? pedido.radios.length : 1}</td>
                <td>
                    <button class="btn btn-sm btn-info btn-ver-detalhes" data-id="${pedido._id}"><i class="bi bi-eye"></i> Detalhes</button>
                    <button class="btn btn-sm btn-success ms-1 btn-dar-andamento" data-id="${pedido._id}"><i class="bi bi-check-circle"></i> Dar Andamento</button>
                </td>
            `;
            tbody.appendChild(tr);

            const trDetalhes = document.createElement('tr');
            trDetalhes.className = 'detalhes-pedido d-none';
            trDetalhes.id = `detalhes-${pedido._id}`;
            trDetalhes.innerHTML = `<td colspan="6"><div class="p-2">Carregando detalhes...</div></td>`;
            tbody.appendChild(trDetalhes);
        });
        addEventListenersPedidosAbertos();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha: ${error.message}</td></tr>`;
    }
}

function addEventListenersPedidosAbertos() {
    document.querySelectorAll('#tabelaPedidosAbertos .btn-ver-detalhes').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = this.dataset.id;
            const detalhesRow = this.closest('tr').nextElementSibling;
            if (detalhesRow) {
                const isHidden = detalhesRow.classList.toggle('d-none');
                if (!isHidden) {
                    carregarDetalhesDoPedidoNaLinha(id, detalhesRow.querySelector('td > div'));
                }
            }
        });
    });

    document.querySelectorAll('#tabelaPedidosAbertos .btn-dar-andamento').forEach(btn => {
        btn.addEventListener('click', function () {
            abrirModalDarAndamento(this.dataset.id);
        });
    });
}

function abrirModalDarAndamento(id) {
    if (!modalInserirOSInstance) {
        showAlert('Erro de Interface', 'Não foi possível abrir o modal para inserir a OS.', 'danger');
        return;
    }
    document.getElementById('checkOsAutomatica').checked = false;
    document.getElementById('campoOsManual').style.display = 'block';
    const inputOS = document.getElementById('inputNumeroOS');
    inputOS.required = true;
    inputOS.value = '';
    document.getElementById('idPedidoParaDarAndamento').value = id;
    modalInserirOSInstance.show();
}

async function handleConfirmarDarAndamento(event) {
    event.preventDefault();

    const id = document.getElementById('idPedidoParaDarAndamento').value;
    const isAutomatica = document.getElementById('checkOsAutomatica').checked;
    const numeroOSManual = document.getElementById('inputNumeroOS').value.trim();

    let corpoRequisicao = {
        tipoOS: isAutomatica ? 'automatica' : 'manual'
    };

    if (!isAutomatica) {
        if (!numeroOSManual) {
            return showAlert('Campo Obrigatório', 'Você deve inserir um número para a OS manual.', 'warning');
        }
        corpoRequisicao.idPedido = numeroOSManual;
    }

    modalInserirOSInstance.hide();

    const btn = document.querySelector(`.btn-dar-andamento[data-id="${id}"]`);
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/solicitacoes/${id}/dar-andamento`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(corpoRequisicao)
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message);
        }

        showAlert('Sucesso!', data.message, 'success');
        await carregarPedidosAbertos();

        const tab = new bootstrap.Tab(document.getElementById('pedidos-andamento-tab'));
        tab.show();

    } catch (error) {
        showAlert('Erro', error.message, 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}


// --- FUNÇÕES DE PEDIDOS EM ANDAMENTO ---

async function carregarPedidosEmAndamento() {
    const tbody = document.querySelector('#tabelaPedidosEmAndamento tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/solicitacoes?status=aguardando_manutencao,em_manutencao`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error((await res.json()).message);
        
        todosPedidosEmAndamento = await res.json();
        renderizarPedidosEmAndamento(todosPedidosEmAndamento);
        
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

function renderizarPedidosEmAndamento(pedidos) {
    const tbody = document.querySelector('#tabelaPedidosEmAndamento tbody');
    tbody.innerHTML = '';
    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum pedido em processo de manutenção.</td></tr>';
        return;
    }
    pedidos.forEach(pedido => {
        const tr = document.createElement('tr');
        let acoesHtml = '';
        const id = pedido.idPedido || pedido._id;
        if (pedido.statusPedido === 'aguardando_manutencao') {
            acoesHtml = `<button class="btn btn-sm btn-warning btn-iniciar-manutencao" data-id="${id}"><i class="bi bi-tools"></i> Iniciar</button>`;
        } else if (pedido.statusPedido === 'em_manutencao') {
            acoesHtml = `<button class="btn btn-sm btn-primary btn-concluir-manutencao" data-id="${id}"><i class="bi bi-check2-square"></i> Concluir OS</button>`;
        }
        tr.innerHTML = `<td>${pedido.idPedido}</td><td>${pedido.solicitanteNome}</td><td>${new Date(pedido.dataSolicitacao).toLocaleDateString('pt-BR')}</td><td><span class="badge bg-${getStatusPedidoBadge(pedido.statusPedido)}">${formatStatusPedido(pedido.statusPedido)}</span></td><td>${pedido.tecnicoResponsavel || '-'}</td><td><button class="btn btn-sm btn-info btn-ver-detalhes-andamento" data-id="${id}"><i class="bi bi-eye"></i> Detalhes</button> ${acoesHtml}</td>`;
        tbody.appendChild(tr);
        const trDetalhes = document.createElement('tr');
        trDetalhes.className = 'detalhes-pedido d-none';
        trDetalhes.id = `detalhes-andamento-${id}`;
        trDetalhes.innerHTML = `<td colspan="6"><div class="p-2">Carregando...</div></td>`;
        tbody.appendChild(trDetalhes);
    });
    addEventListenersPedidosEmAndamento();
}

function filtrarPedidosEmAndamento() {
    const termo = document.getElementById('filtroPedidosEmAndamento').value.toLowerCase();
    if (!todosPedidosEmAndamento) return;
    const filtrados = todosPedidosEmAndamento.filter(pedido =>
        (pedido.idPedido?.toLowerCase().includes(termo) ||
            pedido.solicitanteNome?.toLowerCase().includes(termo) ||
            pedido.tecnicoResponsavel?.toLowerCase().includes(termo))
    );
    renderizarPedidosEmAndamento(filtrados);
}

function addEventListenersPedidosEmAndamento() {
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-ver-detalhes-andamento').forEach(btn => {
        btn.addEventListener('click', function () {
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
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-iniciar-manutencao').forEach(btn => {
        btn.addEventListener('click', function () { abrirModalSelecionarTecnico(this.dataset.id); });
    });
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-concluir-manutencao').forEach(btn => {
        btn.addEventListener('click', function () {
            abrirModalConcluirManutencao(this.dataset.id);
        });
    });
}

function abrirModalSelecionarTecnico(idPedido) {
    document.getElementById('idPedidoParaIniciarManutencao').value = idPedido;
    document.getElementById('selectTecnico').value = '';
    document.getElementById('inputNomeOutroTecnico').value = '';
    document.getElementById('divNomeOutroTecnico').style.display = 'none';
    modalTecnicoInstance.show();
}

async function handleConfirmarIniciarManutencaoComTecnico() {
    const idPedido = document.getElementById('idPedidoParaIniciarManutencao').value;
    let tecnicoSelecionado = document.getElementById('selectTecnico').value;
    if (tecnicoSelecionado === 'Outro') {
        tecnicoSelecionado = document.getElementById('inputNomeOutroTecnico').value.trim();
    }
    if (!tecnicoSelecionado) {
        return showAlert('Campo Obrigatório', 'Selecione ou informe o nome do técnico.', 'warning');
    }
    const btn = document.getElementById('btnConfirmarIniciarManutencaoComTecnico');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Iniciando...';
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
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// --- LÓGICA DE CONCLUSÃO DE MANUTENÇÃO (ALTERADA) ---

function abrirModalConcluirManutencao(idPedido) {
    document.getElementById('idPedidoParaConcluirManutencao').value = idPedido;
    document.getElementById('inputObservacoesTecnicas').value = '';
    modalInputObservacoesTecnicasInstance.show();
}

async function handleConfirmarObservacoesTecnicas() {
    const idPedido = document.getElementById('idPedidoParaConcluirManutencao').value;
    const observacoesTecnicas = document.getElementById('inputObservacoesTecnicas').value.trim();
    modalInputObservacoesTecnicasInstance.hide();
    await concluirManutencaoBackend(idPedido, observacoesTecnicas);
}

async function concluirManutencaoBackend(idPedido, observacoesTecnicas) {
    const btn = document.querySelector(`.btn-concluir-manutencao[data-id="${idPedido}"]`);
    const originalHtml = btn?.innerHTML || 'Concluir OS';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    }
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}/concluir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ observacoesTecnicas })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        if (data.decisaoNecessaria) {
            abrirModalDecisao(data.pedido);
        } else {
            showAlert('Sucesso!', data.message || `Manutenção da OS ${idPedido} concluída.`, 'success');
            await carregarPedidosEmAndamento();
            const tab = new bootstrap.Tab(document.getElementById('historico-manutencao-tab'));
            tab.show();
        }
    } catch (error) {
        showAlert('Erro ao Concluir', error.message, 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

// --- NOVAS FUNÇÕES PARA O MODAL DE DECISÃO ---

function abrirModalDecisao(pedido) {
    document.getElementById('idPedidoParaDecisao').value = pedido.idPedido;
    document.getElementById('decisaoIdPedido').textContent = pedido.idPedido;
    document.getElementById('decisaoOrigemNf').textContent = pedido.origemNF;
    document.getElementById('decisaoClienteNome').textContent = pedido.clienteNome;
    modalDecisaoInstance.show();
}

async function executarDecisaoPosManutencao(idPedido, decisao) {
    modalDecisaoInstance.hide();
    const observacoesTecnicas = document.getElementById('inputObservacoesTecnicas').value.trim();

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/manutencao/acoes/${decisao}/${idPedido}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ observacoesTecnicas })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message);

        showAlert('Sucesso!', data.message, 'success');
        
        await carregarPedidosEmAndamento();
        const tab = new bootstrap.Tab(document.getElementById('historico-manutencao-tab'));
        tab.show();

    } catch (error) {
        showAlert('Erro ao executar ação', error.message, 'danger');
    }
}


// --- RESTANTE DAS FUNÇÕES ORIGINAIS ---

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

function getStatusRadioBadge(status) {
    switch (status) {
        case 'Disponível': return 'bg-success';
        case 'Ocupado': return 'bg-warning text-dark';
        case 'Manutenção': return 'bg-primary';
        case 'Condenado': return 'bg-dark';
        default: return 'bg-secondary';
    }
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

    document.querySelectorAll('#tabelaHistoricoManutencao .btn-ver-detalhes-historico').forEach(btn => {
        btn.addEventListener('click', function () {
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

function adicionarEventListenersDetalhesOS(divElement) {
    divElement.querySelectorAll('.btn-condenar-radio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { idPedido, radioSubId, numeroSerie } = e.currentTarget.dataset;
            abrirModalCondenar(idPedido, radioSubId, numeroSerie);
        });
    });
}

function handleStatusChange(event) {
    const select = event.target;
    const { idPedido, radioSubId, numeroSerie } = select.dataset;
    const selectedValue = select.value;
    if (!selectedValue) return;
    if (selectedValue === 'Concluído') {
        showBootstrapConfirmation('Confirmar Conclusão', `Tem certeza que deseja marcar o rádio ${numeroSerie} como "Concluído"?`, confirmed => {
            if (confirmed) {
                atualizarStatusRadioAPI(idPedido, radioSubId, 'Concluído');
            }
            select.value = "";
        });
    } else if (selectedValue === 'Condenado') {
        abrirModalCondenar(idPedido, radioSubId, numeroSerie);
        select.value = "";
    }
}

function abrirModalCondenar(idPedido, radioSubId, numeroSerie) {
    document.getElementById('radioParaCondenarInfo').textContent = numeroSerie;
    document.getElementById('idPedidoParaCondenar').value = idPedido;
    document.getElementById('radioSubIdParaCondenar').value = radioSubId;
    document.getElementById('motivoCondenacao').value = '';
    if (!modalCondenarRadioInstance) {
        modalCondenarRadioInstance = new bootstrap.Modal(document.getElementById('modalCondenarRadio'));
    }
    modalCondenarRadioInstance.show();
}

async function carregarDetalhesDoPedidoNaLinha(id, divElement) {
    divElement.innerHTML = '<div class="text-center p-3"><span class="spinner-border spinner-border-sm"></span> Carregando...</div>';
    try {
        const pedido = await buscarDetalhesPedidoAPI(id);
        const radios = Array.isArray(pedido.radios) ? pedido.radios : [];
        const dataSolicitacao = formatarDataHora(pedido.dataSolicitacao);
        const dataInicio = formatarDataHora(pedido.dataInicioManutencao);
        let radiosHtml = radios.map(radio => {
            if (!radio) return '';
            const radioDetalhes = radio.radioId || radio;
            const isFinalizado = pedido.statusPedido === 'finalizado' || pedido.statusPedido === 'cancelado';
            const isRadioTratado = radio.status === 'Concluído' || radio.status === 'Condenado';
            let acoesHtml = '';
            const dataId = pedido.idPedido || pedido._id;
            if (!isFinalizado && !isRadioTratado) {
                acoesHtml = `<button class="btn btn-dark btn-sm py-0 ms-1 btn-condenar-radio" data-id-pedido="${dataId}" data-radio-sub-id="${radio._id}" data-numero-serie="${radioDetalhes.numeroSerie}">Condenar</button>`;
            } else {
                const statusBadgeClass = radio.status === 'Concluído' ? 'success' : (radio.status === 'Condenado' ? 'dark' : 'secondary');
                acoesHtml = `<span class="badge bg-${statusBadgeClass}">${radio.status}</span>`;
            }
            return `<li class="list-group-item"><div class="row align-items-center"><div class="col-md-3"><strong>Nº Série:</strong> ${radioDetalhes.numeroSerie}</div><div class="col-md-3"><strong>Modelo:</strong> ${radioDetalhes.modelo}</div><div class="col-md-4"><strong>Defeito:</strong> ${radio.descricaoProblema}</div><div class="col-md-2 text-end">${acoesHtml}</div></div></li>`;
        }).join('');
        if (radios.length === 0) {
            radiosHtml = '<li class="list-group-item">Nenhum rádio associado a este pedido.</li>';
        }
        let detalhesHtml = `
            <div class="container-fluid">
                <div class="row mb-3">
                    <div class="col-md-4">
                        <p class="mb-1"><strong>ID Ordem de Serviço:</strong> ${pedido.idPedido || 'N/A'}</p>
                        <p class="mb-1"><strong>Solicitante:</strong> ${pedido.solicitanteNome}</p>
                        ${pedido.origemNF ? `<p class="mb-1 text-danger fw-bold"><i class="bi bi-diagram-3-fill"></i> Origem: NF ${pedido.origemNF}</p>` : ''}
                        ${pedido.clienteNome ? `<p class="mb-1 text-danger fw-bold"><i class="bi bi-person-check-fill"></i> Cliente: ${pedido.clienteNome}</p>` : ''}
                    </div>
                    <div class="col-md-4">
                        <p class="mb-1"><strong>Data da Solicitação:</strong> ${dataSolicitacao.data} às ${dataSolicitacao.hora}</p>
                        ${pedido.dataInicioManutencao ? `<p class="mb-1"><strong>Início da Manutenção:</strong> ${dataInicio.data} às ${dataInicio.hora}</p>` : ''}
                    </div>
                    <div class="col-md-4">
                        ${pedido.tecnicoResponsavel ? `<p class="mb-1"><strong>Técnico Responsável:</strong> ${pedido.tecnicoResponsavel}</p>` : ''}
                    </div>
                </div>
                <h6>Rádios na Ordem de Serviço:</h6>
                <ul class="list-group list-group-flush">${radiosHtml}</ul>
            </div>
        `;
        divElement.innerHTML = detalhesHtml;
        adicionarEventListenersDetalhesOS(divElement);
    } catch (error) {
        console.error("Erro em carregarDetalhesDoPedidoNaLinha:", error);
        divElement.innerHTML = `<div class="text-danger p-2">Erro ao carregar detalhes: ${error.message}</div>`;
    }
}

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

function formatarDataHora(data) {
    if (!data) return { data: '-', hora: '-' };
    const d = new Date(data);
    return {
        data: d.toLocaleDateString('pt-BR'),
        hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
}

async function handleConfirmarCondenacao() {
    const idPedido = document.getElementById('idPedidoParaCondenar').value;
    const radioSubId = document.getElementById('radioSubIdParaCondenar').value;
    const motivo = document.getElementById('motivoCondenacao').value.trim();
    if (!motivo) {
        return showAlert('Campo Obrigatório', 'Por favor, informe o motivo da condenação.', 'warning');
    }
    modalCondenarRadioInstance.hide();
    await atualizarStatusRadioAPI(idPedido, radioSubId, 'Condenado', motivo);
}