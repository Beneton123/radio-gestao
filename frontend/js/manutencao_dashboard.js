// frontend/js/manutencao_dashboard.js

// ALTERADO: Adicionada a URL base da API com o seu IP
const API_BASE_URL = 'http://10.110.120.237:5000/api';

// Variáveis globais para instâncias de modais e dados de tabelas
let modalTecnicoInstance = null;
let modalInputObservacoesTecnicasInstance = null;
let modalConfirmationInstance = null;
let todosItensEstoqueManutencao = [];
let todosPedidosHistorico = [];

// Callback para a função de confirmação (necessário porque é assíncrona)
let confirmationCallback = null;

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('gerenciar_manutencao');
        carregarPedidosAbertos();

        const manutencaoTabs = document.getElementById('manutencaoTabs');
        if (manutencaoTabs) {
            const tabButtons = manutencaoTabs.querySelectorAll('.nav-link');
            tabButtons.forEach(button => {
                button.addEventListener('shown.bs.tab', function (event) {
                    const targetPaneId = event.target.getAttribute('data-bs-target');
                    if (targetPaneId === '#pedidos-abertos-pane') carregarPedidosAbertos();
                    else if (targetPaneId === '#pedidos-andamento-pane') carregarPedidosEmAndamento();
                    else if (targetPaneId === '#estoque-manutencao-pane') carregarEstoqueManutencao();
                    else if (targetPaneId === '#historico-manutencao-pane') carregarHistoricoManutencao();
                });
            });
        }

        const modalTecnicoEl = document.getElementById('modalSelecionarTecnico');
        if (modalTecnicoEl) {
            modalTecnicoInstance = new bootstrap.Modal(modalTecnicoEl);
            modalTecnicoEl.querySelector('.modal-header').classList.add('bg-custom-danger', 'text-white');
            modalTecnicoEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');
            const selectTecnico = document.getElementById('selectTecnico');
            if(selectTecnico) selectTecnico.addEventListener('change', function() { document.getElementById('divNomeOutroTecnico').style.display = this.value === 'Outro' ? 'block' : 'none'; });
            const btnConfirmarIniciarComTecnico = document.getElementById('btnConfirmarIniciarManutencaoComTecnico');
            if(btnConfirmarIniciarComTecnico) btnConfirmarIniciarComTecnico.addEventListener('click', handleConfirmarIniciarManutencaoComTecnico);
        }

        const modalInputObsTecEl = document.getElementById('modalInputObservacoesTecnicas');
        if (modalInputObsTecEl) {
            modalInputObservacoesTecnicasInstance = new bootstrap.Modal(modalInputObsTecEl);
            document.getElementById('btnConfirmarInputObservacoesTecnicas').addEventListener('click', handleConfirmarObservacoesTecnicas);
            modalInputObsTecEl.querySelector('.modal-header').classList.add('bg-custom-danger', 'text-white');
            modalInputObsTecEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');
        }

        const modalConfirmationEl = document.getElementById('modalConfirmation');
        if (modalConfirmationEl) {
            modalConfirmationInstance = new bootstrap.Modal(modalConfirmationEl);
            document.getElementById('btnConfirmAction').addEventListener('click', () => {
                if (confirmationCallback) confirmationCallback(true);
                modalConfirmationInstance.hide();
            });
            modalConfirmationEl.querySelector('.modal-header').classList.add('bg-custom-danger', 'text-white');
            modalConfirmationEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');
        }

        const filtroEstoqueInput = document.getElementById('filtroEstoqueManutencao');
        if (filtroEstoqueInput) filtroEstoqueInput.addEventListener('input', filtrarEstoqueManutencao);

        const filtroHistoricoInput = document.getElementById('filtroHistoricoManutencao');
        if (filtroHistoricoInput) filtroHistoricoInput.addEventListener('input', filtrarHistoricoManutencao);

    } catch (error) {
        console.error("Erro na inicialização do Painel de Manutenção:", error.message);
    }
});

function showBootstrapConfirmation(title, message, callback) {
    if (!modalConfirmationInstance) {
        callback(confirm(`${title}\n${message}`));
        return;
    }
    document.getElementById('modalConfirmationLabel').textContent = title;
    document.getElementById('modalConfirmationMessage').textContent = message;
    confirmationCallback = callback;
    modalConfirmationInstance.show();
}

async function carregarPedidosAbertos() {
    const tbody = document.querySelector('#tabelaPedidosAbertos tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando pedidos abertos...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        // ALTERADO: Rota corrigida
        const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes?status=aberto`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ message: 'Erro ao buscar pedidos.'}));
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha: ${errData.message}</td></tr>`;
            showAlert('Erro ao Carregar', errData.message, 'danger');
            return;
        }
        const pedidos = await res.json();
        tbody.innerHTML = '';

        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma solicitação aberta.</td></tr>';
            return;
        }

        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${pedido.idPedido}</td><td>${pedido.solicitanteNome || pedido.solicitanteEmail}</td><td>${new Date(pedido.dataSolicitacao).toLocaleDateString('pt-BR')}</td><td><span class="badge bg-${getPrioridadeBadge(pedido.prioridade)}">${pedido.prioridade.toUpperCase()}</span></td><td>${pedido.radios.length}</td><td><button class="btn btn-sm btn-info btn-ver-detalhes" data-id="${pedido.idPedido}"><i class="bi bi-eye"></i> Detalhes</button><button class="btn btn-sm btn-success ms-1 btn-dar-andamento" data-id="${pedido.idPedido}"><i class="bi bi-check-circle"></i> Dar Andamento</button></td>`;
            tbody.appendChild(tr);

            const trDetalhes = document.createElement('tr');
            trDetalhes.className = 'detalhes-pedido d-none';
            trDetalhes.id = `detalhes-${pedido.idPedido}`;
            trDetalhes.innerHTML = `<td colspan="6"><div class="p-2">Carregando detalhes...</div></td>`;
            tbody.appendChild(trDetalhes);
        });
        addEventListenersPedidosAbertos();
    } catch (error) {
        console.error("Erro ao carregar pedidos abertos:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha ao carregar: ${error.message}</td></tr>`;
    }
}

function getPrioridadeBadge(prioridade) {
    switch (prioridade?.toLowerCase()) {
        case 'alta': return 'danger';
        case 'media': return 'warning text-dark';
        case 'baixa': return 'secondary';
        default: return 'light text-dark';
    }
}

function addEventListenersPedidosAbertos() {
    document.querySelectorAll('#tabelaPedidosAbertos .btn-ver-detalhes').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            const detalhesRow = document.getElementById(`detalhes-${idPedido}`);
            if (detalhesRow) {
                detalhesRow.classList.toggle('d-none');
                if (!detalhesRow.classList.contains('d-none')) {
                    carregarDetalhesDoPedidoNaLinha(idPedido, detalhesRow.querySelector('td > div'));
                }
            }
        });
    });

    document.querySelectorAll('#tabelaPedidosAbertos .btn-dar-andamento').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            confirmarDarAndamento(idPedido);
        });
    });
}

async function buscarDetalhesPedidoAPI(idPedido) {
    const token = localStorage.getItem('token');
    try {
        // ALTERADO: Rota corrigida
        const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes/${idPedido}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const errorData = await res.json();
            showAlert('Erro ao Buscar Detalhes', errorData.message, 'danger');
            return null;
        }
        return await res.json();
    } catch (error) {
        showAlert('Erro de Comunicação', `Não foi possível buscar detalhes do pedido ${idPedido}.`, 'danger');
        return null;
    }
}

async function carregarDetalhesDoPedidoNaLinha(idPedido, divElement) {
    if (!divElement) return;
    divElement.innerHTML = '<em>Carregando detalhes...</em>';
    try {
        const pedido = await buscarDetalhesPedidoAPI(idPedido);
        if (!pedido) {
            divElement.innerHTML = '<em>Detalhes não encontrados ou falha ao buscar.</em>';
            return;
        }
        let radiosHtml = `<div class="container-fluid mt-2"><h6>Rádios no Pedido:</h6><div class="row bg-light border-bottom border-top py-1 fw-bold"><div class="col-3">Modelo</div><div class="col-3">Nº Série</div><div class="col-2">Patrimônio</div><div class="col-4">Problema Descrito</div></div>`;
        if (pedido.radios && pedido.radios.length > 0) {
            pedido.radios.forEach(r => { radiosHtml += `<div class="row py-1 border-bottom"><div class="col-3">${r.modelo || 'N/A'}</div><div class="col-3">${r.numeroSerie || 'N/A'}</div><div class="col-2">${r.patrimonio || '-'}</div><div class="col-4">${r.descricaoProblema || 'N/A'}</div></div>`; });
        } else {
            radiosHtml += `<div class="row py-1"><div class="col-12 text-muted">Nenhum rádio associado.</div></div>`;
        }
        radiosHtml += '</div>';

        divElement.innerHTML = `<div class="row"><div class="col-md-6"><p class="mb-1"><strong>ID:</strong> ${pedido.idPedido}</p><p class="mb-1"><strong>Solicitante:</strong> ${pedido.solicitanteNome}</p><p class="mb-1"><strong>Data:</strong> ${new Date(pedido.dataSolicitacao).toLocaleString('pt-BR')}</p><p class="mb-1"><strong>Prioridade:</strong> ${pedido.prioridade.toUpperCase()}</p><p class="mb-1"><strong>Status:</strong> ${formatStatusPedido(pedido.statusPedido)}</p></div><div class="col-md-6">${pedido.tecnicoResponsavel ? `<p class="mb-1"><strong>Técnico:</strong> ${pedido.tecnicoResponsavel}</p>` : ''}${pedido.dataInicioManutencao ? `<p class="mb-1"><strong>Início:</strong> ${new Date(pedido.dataInicioManutencao).toLocaleString('pt-BR')}</p>` : ''}${pedido.dataFimManutencao ? `<p class="mb-1"><strong>Fim:</strong> ${new Date(pedido.dataFimManutencao).toLocaleString('pt-BR')}</p>` : ''}</div></div>${radiosHtml}${pedido.observacoesTecnicas ? `<div class="mt-2"><strong>Obs. Técnicas:</strong><p class="ms-2">${pedido.observacoesTecnicas}</p></div>` : ''}`;
    } catch (error) {
        divElement.innerHTML = '<em>Erro ao carregar detalhes.</em>';
    }
}

function confirmarDarAndamento(idPedido) {
    showBootstrapConfirmation(
        'Confirmar "Dar Andamento"',
        `Tem certeza que deseja dar andamento ao pedido ${idPedido}? Os rádios serão movidos para "Manutenção".`,
        async (confirmed) => {
            if (!confirmed) return;
            const token = localStorage.getItem('token');
            const btnOriginal = document.querySelector(`.btn-dar-andamento[data-id="${idPedido}"]`);
            let originalButtonHTML = '';
            if(btnOriginal) {
                originalButtonHTML = btnOriginal.innerHTML;
                btnOriginal.disabled = true;
                btnOriginal.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
            }
            try {
                // ALTERADO: Rota corrigida
                const res = await fetch(`${API_BASE_URL}/manutencao/pedidos/${idPedido}/dar-andamento`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    showAlert('Sucesso!', `Pedido ${idPedido} encaminhado para manutenção.`, 'success');
                    carregarPedidosAbertos();
                } else {
                    showAlert('Erro', data.message, 'danger');
                }
            } catch (error) {
                showAlert('Erro de Comunicação', `Falha ao processar o pedido ${idPedido}.`, 'danger');
            } finally {
                if(btnOriginal) {
                    btnOriginal.disabled = false;
                    btnOriginal.innerHTML = originalButtonHTML;
                }
            }
        }
    );
}

async function carregarPedidosEmAndamento() {
    const tbody = document.querySelector('#tabelaPedidosEmAndamento tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando pedidos...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        // ALTERADO: Rota corrigida
        const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes?status=aguardando_manutencao,em_manutencao`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Erro ao buscar pedidos.');
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
                acoesHtml = `<button class="btn btn-sm btn-primary btn-concluir-manutencao" data-id="${pedido.idPedido}"><i class="bi bi-check2-square"></i> Concluir</button>`;
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
        console.error("Erro ao carregar pedidos em andamento:", error);
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${error.message}</td></tr>`;
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

function addEventListenersPedidosEmAndamento() {
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-ver-detalhes-andamento').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            const detalhesRow = document.getElementById(`detalhes-andamento-${idPedido}`);
            if (detalhesRow) {
                detalhesRow.classList.toggle('d-none');
                if (!detalhesRow.classList.contains('d-none')) {
                    carregarDetalhesDoPedidoNaLinha(idPedido, detalhesRow.querySelector('td > div'));
                }
            }
        });
    });
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-iniciar-manutencao').forEach(btn => {
        btn.addEventListener('click', function() { abrirModalSelecionarTecnico(this.dataset.id); });
    });
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-concluir-manutencao').forEach(btn => {
        btn.addEventListener('click', function() { abrirModalConcluirManutencao(this.dataset.id); });
    });
}

function abrirModalSelecionarTecnico(idPedido) {
    document.getElementById('idPedidoParaIniciarManutencao').value = idPedido;
    document.getElementById('selectTecnico').value = '';
    document.getElementById('inputNomeOutroTecnico').value = '';
    document.getElementById('divNomeOutroTecnico').style.display = 'none';
    if(modalTecnicoInstance) modalTecnicoInstance.show();
}

async function handleConfirmarIniciarManutencaoComTecnico() {
    const idPedido = document.getElementById('idPedidoParaIniciarManutencao').value;
    let tecnicoSelecionado = document.getElementById('selectTecnico').value;
    if (tecnicoSelecionado === 'Outro') tecnicoSelecionado = document.getElementById('inputNomeOutroTecnico').value.trim();
    if (!tecnicoSelecionado) {
        showAlert('Campo Obrigatório', 'Selecione ou informe o nome do técnico.', 'warning');
        return;
    }

    const btnConfirmar = document.getElementById('btnConfirmarIniciarManutencaoComTecnico');
    const originalButtonText = btnConfirmar.innerHTML;
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Iniciando...';

    try {
        const token = localStorage.getItem('token');
        // ALTERADO: Rota corrigida
        const res = await fetch(`${API_BASE_URL}/manutencao/pedidos/${idPedido}/iniciar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tecnicoResponsavel: tecnicoSelecionado }) 
        });
        const data = await res.json();
        if (res.ok) {
            showAlert('Sucesso!', `Manutenção do pedido ${idPedido} iniciada.`, 'success');
            if(modalTecnicoInstance) modalTecnicoInstance.hide();
            carregarPedidosEmAndamento();
        } else {
            showAlert('Erro ao Iniciar', data.message, 'danger');
        }
    } catch (error) {
        showAlert('Erro de Comunicação', 'Falha ao comunicar com o servidor.', 'danger');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = originalButtonText;
    }
}

function abrirModalConcluirManutencao(idPedido) {
    document.getElementById('idPedidoParaConcluirManutencao').value = idPedido;
    document.getElementById('inputObservacoesTecnicas').value = '';
    if (modalInputObservacoesTecnicasInstance) modalInputObservacoesTecnicasInstance.show();
}

async function handleConfirmarObservacoesTecnicas() {
    const idPedido = document.getElementById('idPedidoParaConcluirManutencao').value;
    const observacoesTecnicas = document.getElementById('inputObservacoesTecnicas').value.trim();
    if (modalInputObservacoesTecnicasInstance) modalInputObservacoesTecnicasInstance.hide();
    showBootstrapConfirmation(
        'Confirmar Conclusão',
        `Deseja concluir a manutenção do pedido ${idPedido}?`,
        async (confirmed) => {
            if (confirmed) await concluirManutencaoBackend(idPedido, observacoesTecnicas);
        }
    );
}

async function concluirManutencaoBackend(idPedido, observacoesTecnicas) {
    const token = localStorage.getItem('token');
    const btnConcluirOriginal = document.querySelector(`.btn-concluir-manutencao[data-id="${idPedido}"]`);
    let originalConcluirHTML = '';
    if(btnConcluirOriginal) {
        originalConcluirHTML = btnConcluirOriginal.innerHTML;
        btnConcluirOriginal.disabled = true;
        btnConcluirOriginal.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Concluindo...';
    }
    try {
        // ALTERADO: Rota corrigida
        const res = await fetch(`${API_BASE_URL}/manutencao/pedidos/${idPedido}/concluir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ observacoesTecnicas: observacoesTecnicas || undefined })
        });
        const data = await res.json();
        if (res.ok) {
            showAlert('Sucesso!', `Manutenção do pedido ${idPedido} concluída.`, 'success');
            carregarPedidosEmAndamento();
            if (document.getElementById('historico-manutencao-tab')?.classList.contains('active')) carregarHistoricoManutencao();
            if (document.getElementById('estoque-manutencao-tab')?.classList.contains('active')) carregarEstoqueManutencao();
        } else {
            showAlert('Erro ao Concluir', data.message, 'danger');
        }
    } catch (error) {
        showAlert('Erro de Comunicação', 'Falha ao comunicar com o servidor.', 'danger');
    } finally {
        if(btnConcluirOriginal){
            btnConcluirOriginal.disabled = false;
            btnConcluirOriginal.innerHTML = originalConcluirHTML;
        }
    }
}

async function carregarEstoqueManutencao() {
    const tbody = document.querySelector('#tabelaEstoqueManutencao tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Carregando estoque de manutenção...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        // ALTERADO: Rota corrigida
        const res = await fetch(`${API_BASE_URL}/manutencao/estoque`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Erro ao buscar estoque.');
        todosItensEstoqueManutencao = await res.json();
        renderizarEstoqueManutencao(todosItensEstoqueManutencao);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Falha: ${error.message}</td></tr>`;
    }
}

function renderizarEstoqueManutencao(itens) {
    const tbody = document.querySelector('#tabelaEstoqueManutencao tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (itens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum rádio em manutenção.</td></tr>';
        return;
    }
    itens.forEach(item => {
        const tr = document.createElement('tr');
        // A resposta do backend para estoque foi simplificada na refatoração, 
        // então ajustamos os campos para item.pedidoManutencao...
        const statusPedido = item.pedidoManutencao?.statusPedido || 'N/A';
        const badgeClass = getStatusPedidoBadgeEstoqueManutencao(statusPedido);
        tr.innerHTML = `<td>${item.numeroSerie}</td><td>${item.modelo}</td><td>${item.patrimonio || '-'}</td><td>${item.descricaoProblema}</td><td>${item.pedidoManutencao?.idPedido || 'N/A'}</td><td><span class="badge ${badgeClass}">${formatStatusPedido(statusPedido)}</span></td><td>${item.pedidoManutencao?.tecnicoResponsavel || '-'}</td>`;
        tbody.appendChild(tr);
    });
}

function getStatusPedidoBadgeEstoqueManutencao(status) {
    switch (status?.toLowerCase()) {
        case 'aguardando_manutencao': return 'warning text-dark';
        case 'em_manutencao': return 'danger';
        default: return 'secondary';
    }
}

function filtrarEstoqueManutencao() {
    const termo = document.getElementById('filtroEstoqueManutencao').value.toLowerCase();
    if (!todosItensEstoqueManutencao) return;
    const filtrados = todosItensEstoqueManutencao.filter(item => {
        return (item.numeroSerie?.toLowerCase().includes(termo) ||
                item.modelo?.toLowerCase().includes(termo) ||
                item.patrimonio?.toLowerCase().includes(termo) ||
                item.pedidoManutencao?.idPedido?.toLowerCase().includes(termo) ||
                item.pedidoManutencao?.tecnicoResponsavel?.toLowerCase().includes(termo) ||
                item.descricaoProblema?.toLowerCase().includes(termo) );
    });
    renderizarEstoqueManutencao(filtrados);
}

async function carregarHistoricoManutencao() {
    const tbody = document.querySelector('#tabelaHistoricoManutencao tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Carregando histórico...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        // ALTERADO: Rota corrigida
        const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes?status=finalizado`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error((await res.json()).message || 'Erro ao buscar histórico.');
        todosPedidosHistorico = await res.json();
        renderizarHistoricoManutencao(todosPedidosHistorico);
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Falha: ${error.message}</td></tr>`;
    }
}

function renderizarHistoricoManutencao(pedidos) {
    const tbody = document.querySelector('#tabelaHistoricoManutencao tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum registro no histórico.</td></tr>';
        return;
    }
    pedidos.forEach(pedido => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${pedido.idPedido}</td><td>${pedido.solicitanteNome}</td><td>${new Date(pedido.dataFimManutencao).toLocaleDateString('pt-BR')}</td><td>${pedido.tecnicoResponsavel || '-'}</td><td>${pedido.radios.length} rádios</td><td>${(pedido.observacoesTecnicas || '-').substring(0, 50)}...</td><td><button class="btn btn-sm btn-info btn-ver-detalhes-historico" data-id="${pedido.idPedido}"><i class="bi bi-eye"></i> Detalhes</button></td>`;
        tbody.appendChild(tr);
        const trDetalhes = document.createElement('tr');
        trDetalhes.className = 'detalhes-pedido d-none';
        trDetalhes.id = `detalhes-historico-${pedido.idPedido}`;
        trDetalhes.innerHTML = `<td colspan="7"><div class="p-2">Carregando...</div></td>`;
        tbody.appendChild(trDetalhes);
    });
    document.querySelectorAll('#tabelaHistoricoManutencao .btn-ver-detalhes-historico').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            const detalhesRow = document.getElementById(`detalhes-historico-${idPedido}`);
            if (detalhesRow) {
                detalhesRow.classList.toggle('d-none');
                if (!detalhesRow.classList.contains('d-none')) {
                    carregarDetalhesDoPedidoNaLinha(idPedido, detalhesRow.querySelector('td > div'));
                }
            }
        });
    });
}

function filtrarHistoricoManutencao() {
    const termo = document.getElementById('filtroHistoricoManutencao').value.toLowerCase();
    if (!todosPedidosHistorico) return;
    const filtrados = todosPedidosHistorico.filter(pedido => {
        const dataFim = pedido.dataFimManutencao ? new Date(pedido.dataFimManutencao).toLocaleDateString('pt-BR') : '';
        const radiosConcatenated = pedido.radios.map(r => `${r.numeroSerie} ${r.modelo} ${r.patrimonio} ${r.descricaoProblema}`).join(' ').toLowerCase();
        return (pedido.idPedido?.toLowerCase().includes(termo) ||
                pedido.solicitanteNome?.toLowerCase().includes(termo) ||
                pedido.solicitanteEmail?.toLowerCase().includes(termo) ||
                dataFim.includes(termo) ||
                pedido.tecnicoResponsavel?.toLowerCase().includes(termo) ||
                pedido.observacoesTecnicas?.toLowerCase().includes(termo) ||
                radiosConcatenated.includes(termo));
    });
    renderizarHistoricoManutencao(filtrados);
}