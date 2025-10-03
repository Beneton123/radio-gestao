// frontend/js/manutencao_dashboard.js

// Variáveis globais
let modalTecnicoInstance = null;
let modalInputObservacoesTecnicasInstance = null;
let modalConfirmationInstance = null;
let modalDarBaixaInstance = null;
let modalTransferirRadioInstance = null;
let modalCondenarRadioInstance = null; // ADICIONADO
let todosItensEstoqueManutencao = [];
let todosPedidosHistorico = [];

// Variáveis para o modal de confirmação
let confirmationCallback = null;
let isConfirmed = false;

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

            modalConfirmationEl.addEventListener('hidden.bs.modal', () => {
                if (!isConfirmed && confirmationCallback) {
                    confirmationCallback(false);
                }
                isConfirmed = false;
                confirmationCallback = null;
            });
        }
        
        
        
        // NOVO MODAL DE CONDENAR
        const modalCondenarEl = document.getElementById('modalCondenarRadio');
        if (modalCondenarEl) {
            modalCondenarRadioInstance = new bootstrap.Modal(modalCondenarEl);
            setupModalHeader(modalCondenarEl);
            document.getElementById('btnConfirmarCondenacao')?.addEventListener('click', handleConfirmarCondenacao);
        }
        
        // Listener para o seletor de destino no modal de transferência
        document.querySelectorAll('input[name="tipoDestino"]').forEach(radio => {
            radio.addEventListener('change', function() {
                document.getElementById('campoOsExistente').style.display = this.value === 'existente' ? 'block' : 'none';
            });
        });
        
        document.getElementById('filtroEstoqueManutencao')?.addEventListener('input', filtrarEstoqueManutencao);
        document.getElementById('filtroHistoricoManutencao')?.addEventListener('input', filtrarHistoricoManutencao);

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
            // CORREÇÃO: Trocamos 'pedido.radios.length' por '1' ou pelo número de série
            const numeroSerie = pedido.radio ? pedido.radio.numeroSerie : 'N/A';
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

function getPrioridadeBadge(prioridade) {
    switch (prioridade?.toLowerCase()) {
        case 'baixa': return 'secondary';
        case 'media': return 'warning text-dark';
        case 'alta': return 'danger';
        case 'urgente': return 'danger fw-bold border border-white';
        default: return 'light text-dark';
    }
}

function addEventListenersPedidosAbertos() {
    document.querySelectorAll('#tabelaPedidosAbertos .btn-ver-detalhes').forEach(btn => {
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
    document.querySelectorAll('#tabelaPedidosAbertos .btn-dar-andamento').forEach(btn => {
        btn.addEventListener('click', function() { confirmarDarAndamento(this.dataset.id); });
    });
}

function confirmarDarAndamento(idPedido) {
    showBootstrapConfirmation('Confirmar Andamento', `Tem certeza que deseja dar andamento ao pedido ${idPedido}?`, async (confirmed) => {
        if (!confirmed) return;
        const btn = document.querySelector(`.btn-dar-andamento[data-id="${idPedido}"]`);
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}/dar-andamento`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error((await res.json()).message);
            showAlert('Sucesso!', `Pedido ${idPedido} encaminhado para manutenção.`, 'success');
            await carregarPedidosAbertos();
            const tab = new bootstrap.Tab(document.getElementById('pedidos-andamento-tab'));
            tab.show();
        } catch (error) {
            showAlert('Erro', error.message, 'danger');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    });
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

// Arquivo: frontend/js/manutencao_dashboard.js
// AÇÃO: Substitua a função inteira por esta versão

function addEventListenersPedidosEmAndamento() {
    // Listener para o botão 'Detalhes' (já existia)
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-ver-detalhes-andamento').forEach(btn => {
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

    // Listener para o botão 'Iniciar' (já existia)
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-iniciar-manutencao').forEach(btn => {
        btn.addEventListener('click', function() { abrirModalSelecionarTecnico(this.dataset.id); });
    });

    // PARTE FALTANTE ADICIONADA AQUI
    // Listener para o botão 'Concluir OS'
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-concluir-manutencao').forEach(btn => {
        btn.addEventListener('click', function() { 
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

function abrirModalConcluirManutencao(idPedido) {
    document.getElementById('idPedidoParaConcluirManutencao').value = idPedido;
    document.getElementById('inputObservacoesTecnicas').value = '';
    modalInputObservacoesTecnicasInstance.show();
}

async function handleConfirmarObservacoesTecnicas() {
    const idPedido = document.getElementById('idPedidoParaConcluirManutencao').value;
    const observacoesTecnicas = document.getElementById('inputObservacoesTecnicas').value.trim();
    modalInputObservacoesTecnicasInstance.hide();
    showBootstrapConfirmation('Confirmar Conclusão', `Deseja concluir toda a Ordem de Serviço ${idPedido}? Rádios pendentes serão marcados como concluídos.`, async (confirmed) => {
        if (confirmed) await concluirManutencaoBackend(idPedido, observacoesTecnicas);
    });
}

async function concluirManutencaoBackend(idPedido, observacoesTecnicas) {
    const btn = document.querySelector(`.btn-concluir-manutencao[data-id="${idPedido}"]`);
    const originalHtml = btn?.innerHTML || 'Concluir OS';
    if(btn) {
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
        if (!res.ok) throw new Error((await res.json()).message);
        showAlert('Sucesso!', `Manutenção da OS ${idPedido} concluída.`, 'success');
        await carregarPedidosEmAndamento();
        const tab = new bootstrap.Tab(document.getElementById('historico-manutencao-tab'));
        tab.show();
    } catch (error) {
        showAlert('Erro ao Concluir', error.message, 'danger');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

// --- FUNÇÕES DE ESTOQUE ---
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
        const statusBadgeClass = getStatusRadioBadge(statusRadio); // Usando a nova função de cor

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

function getStatusRadioBadge(status) {
    switch (status) {
        case 'Disponível':
            return 'bg-success';
        case 'Ocupado':
            return 'bg-warning text-dark';
        case 'Manutenção':
            return 'bg-primary';
        case 'Condenado':
            return 'bg-dark';
        default:
            return 'bg-secondary';
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

// --- FUNÇÕES DE HISTÓRICO ---
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

// AÇÃO: Substitua a sua função por esta versão corrigida

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



// --- FUNÇÃO DE RENDERIZAÇÃO DE DETALHES (SUBSTITUÍDA) ---

function adicionarEventListenersDetalhesOS(divElement) {
    divElement.querySelectorAll('.btn-concluir-radio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { idPedido, radioSubId, numeroSerie } = e.currentTarget.dataset;
            showBootstrapConfirmation('Confirmar Conclusão', `Tem certeza que deseja marcar o rádio ${numeroSerie} como "Concluído"?`, confirmed => {
                if (confirmed) {
                    atualizarStatusRadioAPI(idPedido, radioSubId, 'Concluído');
                }
            });
        });
    });

    divElement.querySelectorAll('.btn-condenar-radio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { idPedido, radioSubId, numeroSerie } = e.currentTarget.dataset;
            abrirModalCondenar(idPedido, radioSubId, numeroSerie);
        });
    });

    divElement.querySelectorAll('.btn-transferir-radio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { idPedido, radioSubId, numeroSerie } = e.currentTarget.dataset;
            abrirModalTransferirNovo(idPedido, radioSubId, numeroSerie);
        });
    });
}


// --- NOVAS FUNÇÕES ADICIONADAS ---
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
            select.value = ""; // Reseta o select
        });
    } else if (selectedValue === 'Condenado') {
        abrirModalCondenar(idPedido, radioSubId, numeroSerie);
        select.value = ""; // Reseta o select
    }
}

function abrirModalCondenar(idPedido, radioSubId, numeroSerie) {
    document.getElementById('radioParaCondenarInfo').textContent = numeroSerie;
    document.getElementById('idPedidoParaCondenar').value = idPedido;
    document.getElementById('radioSubIdParaCondenar').value = radioSubId;
    document.getElementById('motivoCondenacao').value = '';
    modalCondenarRadioInstance.show();
}

// SUBSTITUA A FUNÇÃO INTEIRA NO SEU ARQUIVO
// Arquivo: frontend/js/manutencao_dashboard.js
// AÇÃO: Substitua a função inteira por esta versão

async function carregarDetalhesDoPedidoNaLinha(idPedido, divElement) {
    divElement.innerHTML = '<div class="text-center p-3"><span class="spinner-border spinner-border-sm"></span> Carregando...</div>';
    try {
        const pedido = await buscarDetalhesPedidoAPI(idPedido);
        const radio = pedido.radio;
        const dataSolicitacao = formatarDataHora(pedido.dataSolicitacao);
        const dataInicio = formatarDataHora(pedido.dataInicioManutencao);

        let acoesHtml = '';
        const isFinalizado = pedido.statusPedido === 'finalizado' || pedido.statusPedido === 'cancelado';
        const isRadioTratado = radio.status === 'Concluído' || radio.status === 'Condenado';

        if (!isFinalizado && !isRadioTratado) {
            acoesHtml = `

                <button class="btn btn-dark btn-sm py-0 ms-1 btn-condenar-radio" data-id-pedido="${pedido.idPedido}" data-radio-sub-id="${radio._id}" data-numero-serie="${radio.numeroSerie}">Condenar</button>
            `;
        } else {
            const statusBadgeClass = radio.status === 'Concluído' ? 'success' : (radio.status === 'Condenado' ? 'dark' : 'secondary');
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

// --- FUNÇÕES AUXILIARES COMUNS ---
async function buscarDetalhesPedidoAPI(idPedido){
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Não foi possível carregar os detalhes do pedido.');
    return res.json();
}

function checkUserPermissions(requiredPermissions) {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario || !usuario.permissoes) return false;
    return requiredPermissions.some(p => usuario.permissoes.includes(p));
}

function formatarDataHora(data) {
    if (!data) return { data: '-', hora: '-' };
    const d = new Date(data);
    return {
        data: d.toLocaleDateString('pt-BR'),
        hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
}

function checkUserPermissions(requiredPermissions) {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario || !usuario.permissoes) return false;
    return requiredPermissions.some(p => usuario.permissoes.includes(p));
}

// --- NOVAS FUNÇÕES DE LÓGICA DE AÇÕES ---

function abrirModalCondenar(idPedido, radioSubId) {
    // Busca o número de série na interface para exibir no modal
    const detalhesDiv = document.querySelector(`#detalhes-andamento-${idPedido}, #detalhes-${idPedido}`);
    const numeroSerie = detalhesDiv ? detalhesDiv.querySelector('.list-group-item:first-child').textContent.replace('Nº de Série:', '').trim() : '';

    document.getElementById('radioParaCondenarInfo').textContent = numeroSerie;
    document.getElementById('idPedidoParaCondenar').value = idPedido;
    document.getElementById('radioSubIdParaCondenar').value = radioSubId;
    document.getElementById('motivoCondenacao').value = '';
    
    // Certifique-se de que a instância do modal existe
    if (!modalCondenarRadioInstance) {
        modalCondenarRadioInstance = new bootstrap.Modal(document.getElementById('modalCondenarRadio'));
    }
    modalCondenarRadioInstance.show();
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

async function atualizarStatusRadioAPI(idPedido, radioSubId, status, motivoCondenacao = null) {
    try {
        const token = localStorage.getItem('token');
        const body = { status };
        if (motivoCondenacao) {
            body.motivoCondenacao = motivoCondenacao;
        }

        const res = await fetch(`/api/manutencao/solicitacoes/${idPedido}/radio/${radioSubId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error((await res.json()).message);

        showAlert('Sucesso!', `Rádio atualizado para "${status}".`, 'success');
        
        // Recarrega os detalhes da OS para refletir a mudança
        const detalhesDiv = document.querySelector(`.detalhes-pedido:not(.d-none) > td > div`);
        if (detalhesDiv) {
            const osId = detalhesDiv.closest('.detalhes-pedido').id.replace('detalhes-andamento-', '').replace('detalhes-', '');
            await carregarDetalhesDoPedidoNaLinha(osId, detalhesDiv);
        }
        
        await carregarPedidosEmAndamento();
    } catch (error) {
        showAlert('Erro ao Atualizar Status', error.message, 'danger');
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
}

function abrirModalConcluirManutencao(idPedido) {
    document.getElementById('idPedidoParaConcluirManutencao').value = idPedido;
    document.getElementById('inputObservacoesTecnicas').value = '';
    
    if (!modalInputObservacoesTecnicasInstance) {
        modalInputObservacoesTecnicasInstance = new bootstrap.Modal(document.getElementById('modalInputObservacoesTecnicas'));
    }
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

// ADICIONE ESTE BLOCO DE FUNÇÕES NOVAS

function adicionarEventListenersDetalhesOS(divElement) {
    divElement.querySelectorAll('.btn-concluir-radio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { idPedido, radioSubId, numeroSerie } = e.currentTarget.dataset;
            showBootstrapConfirmation('Confirmar Conclusão', `Tem certeza que deseja marcar o rádio ${numeroSerie} como "Concluído"?`, confirmed => {
                if (confirmed) {
                    atualizarStatusRadioAPI(idPedido, radioSubId, 'Concluído');
                }
            });
        });
    });

    divElement.querySelectorAll('.btn-condenar-radio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const { idPedido, radioSubId, numeroSerie } = e.currentTarget.dataset;
            abrirModalCondenar(idPedido, radioSubId, numeroSerie);
        });
    });
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

async function atualizarStatusRadioAPI(idPedido, radioSubId, status, motivoCondenacao = null) {
    try {
        const token = localStorage.getItem('token');
        const body = { status };
        if (motivoCondenacao) {
            body.motivoCondenacao = motivoCondenacao;
        }

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