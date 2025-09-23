// frontend/js/manutencao_dashboard.js

const API_BASE_URL = 'http://10.110.120.237:5000/api';

// Variáveis globais
let modalTecnicoInstance = null;
let modalInputObservacoesTecnicasInstance = null;
let modalConfirmationInstance = null;
let todosItensEstoqueManutencao = [];
let todosPedidosHistorico = [];

// Variáveis para o modal de confirmação
let confirmationCallback = null;
let isConfirmed = false; // MELHORIA: Controla se a ação foi confirmada ou cancelada

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('gerenciar_manutencao');
        carregarPedidosAbertos();

        const manutencaoTabs = document.getElementById('manutencaoTabs');
        if (manutencaoTabs) {
            manutencaoTabs.addEventListener('shown.bs.tab', function(event) {
                const targetPaneId = event.target.getAttribute('data-bs-target');
                switch (targetPaneId) {
                    case '#pedidos-abertos-pane': carregarPedidosAbertos(); break;
                    case '#pedidos-andamento-pane': carregarPedidosEmAndamento(); break;
                    case '#estoque-manutencao-pane': carregarEstoqueManutencao(); break;
                    case '#historico-manutencao-pane': carregarHistoricoManutencao(); break;
                }
            });
        }
        
        // MELHORIA: Função auxiliar para configurar cabeçalhos de modais e evitar repetição
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
            document.getElementById('selectTecnico')?.addEventListener('change', function() {
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

            // CORRIGIDO: Trata o cancelamento (fechar o modal no 'X', ESC, etc.)
            modalConfirmationEl.addEventListener('hidden.bs.modal', () => {
                if (!isConfirmed && confirmationCallback) {
                    confirmationCallback(false);
                }
                isConfirmed = false;
                confirmationCallback = null;
            });
        }
        
        document.getElementById('filtroEstoqueManutencao')?.addEventListener('input', filtrarEstoqueManutencao);
        document.getElementById('filtroHistoricoManutencao')?.addEventListener('input', filtrarHistoricoManutencao);

    } catch (error) {
        console.error("Erro na inicialização do Painel de Manutenção:", error);
    }
});

// --- FUNÇÕES GERAIS E DE PEDIDOS ABERTOS ---

function showBootstrapConfirmation(title, message, callback) {
    if (!modalConfirmationInstance) {
        callback(confirm(`${title}\n${message}`));
        return;
    }
    document.getElementById('modalConfirmationLabel').textContent = title;
    document.getElementById('modalConfirmationMessage').textContent = message;
    confirmationCallback = callback;
    isConfirmed = false;
    modalConfirmationInstance.show();
}

async function carregarPedidosAbertos() {
    const tbody = document.querySelector('#tabelaPedidosAbertos tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes?status=aberto`, {
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
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha: ${error.message}</td></tr>`;
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
                const isHidden = detalhesRow.classList.toggle('d-none');
                if (!isHidden) {
                    carregarDetalhesDoPedidoNaLinha(idPedido, detalhesRow.querySelector('td > div'));
                }
            }
        });
    });
    document.querySelectorAll('#tabelaPedidosAbertos .btn-dar-andamento').forEach(btn => {
        btn.addEventListener('click', function() {
            confirmarDarAndamento(this.dataset.id);
        });
    });
}

function confirmarDarAndamento(idPedido) {
    showBootstrapConfirmation(
        'Confirmar "Dar Andamento"',
        `Tem certeza que deseja dar andamento ao pedido ${idPedido}?`,
        async (confirmed) => {
            if (!confirmed) return;
            const btnOriginal = document.querySelector(`.btn-dar-andamento[data-id="${idPedido}"]`);
            const originalButtonHTML = btnOriginal.innerHTML;
            btnOriginal.disabled = true;
            btnOriginal.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
            try {
                const token = localStorage.getItem('token');
                // MELHORIA: Padronizada a rota para "solicitacoes" para consistência
                const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes/${idPedido}/dar-andamento`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error((await res.json()).message);
                showAlert('Sucesso!', `Pedido ${idPedido} encaminhado para manutenção.`, 'success');
                carregarPedidosAbertos();
            } catch (error) {
                showAlert('Erro', error.message, 'danger');
            } finally {
                btnOriginal.disabled = false;
                btnOriginal.innerHTML = originalButtonHTML;
            }
        }
    );
}

// --- FUNÇÕES DE PEDIDOS EM ANDAMENTO ---

async function carregarPedidosEmAndamento() {
    const tbody = document.querySelector('#tabelaPedidosEmAndamento tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando pedidos...</td></tr>';
    try {
        const token = localStorage.getItem('token');
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
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

function addEventListenersPedidosEmAndamento() {
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-ver-detalhes-andamento').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            const detalhesRow = document.getElementById(`detalhes-andamento-${idPedido}`);
            if (detalhesRow) {
                const isHidden = detalhesRow.classList.toggle('d-none');
                if (!isHidden) {
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
    modalTecnicoInstance?.show();
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
        // MELHORIA: Padronizada a rota para "solicitacoes" para consistência
        const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes/${idPedido}/iniciar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tecnicoResponsavel: tecnicoSelecionado })
        });
        if (!res.ok) throw new Error((await res.json()).message);
        showAlert('Sucesso!', `Manutenção do pedido ${idPedido} iniciada.`, 'success');
        modalTecnicoInstance?.hide();
        carregarPedidosEmAndamento();
    } catch (error) {
        showAlert('Erro ao Iniciar', error.message, 'danger');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = originalButtonText;
    }
}

function abrirModalConcluirManutencao(idPedido) {
    document.getElementById('idPedidoParaConcluirManutencao').value = idPedido;
    document.getElementById('inputObservacoesTecnicas').value = '';
    modalInputObservacoesTecnicasInstance?.show();
}

async function handleConfirmarObservacoesTecnicas() {
    const idPedido = document.getElementById('idPedidoParaConcluirManutencao').value;
    const observacoesTecnicas = document.getElementById('inputObservacoesTecnicas').value.trim();
    modalInputObservacoesTecnicasInstance?.hide();
    showBootstrapConfirmation(
        'Confirmar Conclusão',
        `Deseja concluir a manutenção do pedido ${idPedido}?`,
        async (confirmed) => {
            if (confirmed) await concluirManutencaoBackend(idPedido, observacoesTecnicas);
        }
    );
}

async function concluirManutencaoBackend(idPedido, observacoesTecnicas) {
    const btnConcluirOriginal = document.querySelector(`.btn-concluir-manutencao[data-id="${idPedido}"]`);
    let originalConcluirHTML = '';
    if (btnConcluirOriginal) {
        originalConcluirHTML = btnConcluirOriginal.innerHTML;
        btnConcluirOriginal.disabled = true;
        btnConcluirOriginal.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Concluindo...';
    }
    try {
        const token = localStorage.getItem('token');
        // MELHORIA: Padronizada a rota para "solicitacoes" para consistência
        const res = await fetch(`${API_BASE_URL}/manutencao/solicitacoes/${idPedido}/concluir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ observacoesTecnicas: observacoesTecnicas || undefined })
        });
        if (!res.ok) throw new Error((await res.json()).message);
        showAlert('Sucesso!', `Manutenção do pedido ${idPedido} concluída.`, 'success');
        carregarPedidosEmAndamento();
    } catch (error) {
        showAlert('Erro ao Concluir', error.message, 'danger');
    } finally {
        if (btnConcluirOriginal) {
            btnConcluirOriginal.disabled = false;
            btnConcluirOriginal.innerHTML = originalConcluirHTML;
        }
    }
}

// --- FUNÇÕES DE ESTOQUE ---

async function carregarEstoqueManutencao() {
    // ... (código mantido)
}
function renderizarEstoqueManutencao(itens) {
    // ... (código mantido)
}
function getStatusPedidoBadgeEstoqueManutencao(status) {
    // ... (código mantido)
}
function filtrarEstoqueManutencao() {
    // ... (código mantido)
}

// --- FUNÇÕES DE HISTÓRICO ---

async function carregarHistoricoManutencao() {
    // ... (código mantido)
}
function renderizarHistoricoManutencao(pedidos) {
    // ... (código mantido)
}
function filtrarHistoricoManutencao() {
    // ... (código mantido)
}


// --- FUNÇÕES AUXILIARES COMUNS ---

async function buscarDetalhesPedidoAPI(idPedido) {
    // ... (código mantido)
}

async function carregarDetalhesDoPedidoNaLinha(idPedido, divElement) {
    // ... (código mantido e corrigido para usar a função de formatar status)
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


// --- Funções que precisam da sua implementação ---
function checkAuthentication(permission) { /* ... sua lógica ... */ }
function showAlert(title, message, type = 'info') { /* ... sua lógica ... */ }