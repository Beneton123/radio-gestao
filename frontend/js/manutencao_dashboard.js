// frontend/js/manutencao_dashboard.js

// Variáveis globais para instâncias de modais e dados de tabelas
let modalTecnicoInstance = null;
let modalInputObservacoesTecnicasInstance = null; // Nova instância para o modal de observações
let modalConfirmationInstance = null; // Nova instância para o modal de confirmação
let todosItensEstoqueManutencao = [];
let todosPedidosHistorico = []; // Para o filtro do lado do cliente do histórico

// Callback para a função de confirmação (necessário porque é assíncrona)
let confirmationCallback = null;

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Verifica a autenticação para a permissão de gerenciar manutenção
        // Assumo que 'checkAuthentication' e 'showAlert' são funções globais definidas em outro lugar
        checkAuthentication('gerenciar_manutencao');

        // Carrega a aba padrão (Pedidos Abertos) ao iniciar
        carregarPedidosAbertos();

        const manutencaoTabs = document.getElementById('manutencaoTabs');
        if (manutencaoTabs) {
            const tabButtons = manutencaoTabs.querySelectorAll('.nav-link');
            tabButtons.forEach(button => {
                button.addEventListener('shown.bs.tab', function (event) {
                    const targetPaneId = event.target.getAttribute('data-bs-target');

                    if (targetPaneId === '#pedidos-abertos-pane') {
                        carregarPedidosAbertos();
                    } else if (targetPaneId === '#pedidos-andamento-pane') {
                        carregarPedidosEmAndamento();
                    } else if (targetPaneId === '#estoque-manutencao-pane') {
                        carregarEstoqueManutencao();
                    } else if (targetPaneId === '#historico-manutencao-pane') {
                        carregarHistoricoManutencao();
                    }
                });
            });
        }

        // Inicializa o modal de selecionar técnico
        const modalTecnicoEl = document.getElementById('modalSelecionarTecnico');
        if (modalTecnicoEl) {
            modalTecnicoInstance = new bootstrap.Modal(modalTecnicoEl);
            // Certifica-se de que o cabeçalho do modal de técnico tenha a cor correta
            modalTecnicoEl.querySelector('.modal-header').classList.add('bg-custom-danger', 'text-white');
            modalTecnicoEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');

            const selectTecnico = document.getElementById('selectTecnico');
            if(selectTecnico) {
                selectTecnico.addEventListener('change', function() {
                    document.getElementById('divNomeOutroTecnico').style.display = this.value === 'Outro' ? 'block' : 'none';
                });
            }
            const btnConfirmarIniciarComTecnico = document.getElementById('btnConfirmarIniciarManutencaoComTecnico');
            if(btnConfirmarIniciarComTecnico){
                btnConfirmarIniciarComTecnico.addEventListener('click', handleConfirmarIniciarManutencaoComTecnico);
            }
        }

        // NOVO: Inicializa o modal de input de observações técnicas
        const modalInputObsTecEl = document.getElementById('modalInputObservacoesTecnicas');
        if (modalInputObsTecEl) {
            modalInputObservacoesTecnicasInstance = new bootstrap.Modal(modalInputObsTecEl);
            document.getElementById('btnConfirmarInputObservacoesTecnicas').addEventListener('click', handleConfirmarObservacoesTecnicas);
            // Certifica-se de que o cabeçalho do modal de observações tenha a cor correta
            modalInputObsTecEl.querySelector('.modal-header').classList.add('bg-custom-danger', 'text-white');
            modalInputObsTecEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');
        }

        // NOVO: Inicializa o modal de confirmação genérico
        const modalConfirmationEl = document.getElementById('modalConfirmation');
        if (modalConfirmationEl) {
            modalConfirmationInstance = new bootstrap.Modal(modalConfirmationEl);
            document.getElementById('btnConfirmAction').addEventListener('click', () => {
                if (confirmationCallback) {
                    confirmationCallback(true);
                }
                modalConfirmationInstance.hide();
            });
            // Certifica-se de que o cabeçalho do modal de confirmação tenha a cor correta
            modalConfirmationEl.querySelector('.modal-header').classList.add('bg-custom-danger', 'text-white');
            modalConfirmationEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');
        }


        const filtroEstoqueInput = document.getElementById('filtroEstoqueManutencao');
        if (filtroEstoqueInput) {
            filtroEstoqueInput.addEventListener('input', filtrarEstoqueManutencao);
        }

        const filtroHistoricoInput = document.getElementById('filtroHistoricoManutencao');
        if (filtroHistoricoInput) {
            filtroHistoricoInput.addEventListener('input', filtrarHistoricoManutencao);
        }

    } catch (error) {
        console.error("Erro na inicialização do Painel de Manutenção:", error.message);
        if (!error.message.toLowerCase().includes('acesso negado') && !error.message.toLowerCase().includes('autenticado')) {
            showAlert('Erro Crítico', 'Não foi possível carregar o painel de manutenção.', 'danger');
        }
    }
});

// --- NOVO: Função para exibir o modal de confirmação genérico ---
/**
 * Exibe um modal de confirmação Bootstrap.
 * @param {string} title - O título do modal de confirmação.
 * @param {string} message - A mensagem de confirmação.
 * @param {Function} callback - A função a ser chamada com `true` se confirmado, `false` se cancelado.
 */
function showBootstrapConfirmation(title, message, callback) {
    if (!modalConfirmationInstance) {
        console.error("Modal de confirmação não inicializado.");
        // Fallback para confirm() nativo se o modal não estiver pronto
        callback(confirm(`${title}\n${message}`));
        return;
    }

    document.getElementById('modalConfirmationLabel').textContent = title;
    document.getElementById('modalConfirmationMessage').textContent = message;
    confirmationCallback = callback; // Armazena o callback para ser executado quando o usuário interagir

    modalConfirmationInstance.show();
}


// --- Funções para PEDIDOS ABERTOS ---

/**
 * Carrega e exibe os pedidos de manutenção com status 'aberto'.
 */
async function carregarPedidosAbertos() {
    const tbody = document.querySelector('#tabelaPedidosAbertos tbody');
    if (!tbody) {
        console.error("Elemento tbody de #tabelaPedidosAbertos não encontrado.");
        return;
    }
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando pedidos abertos...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/manutencao/solicitacoes?status=aberto', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ message: 'Erro ao buscar pedidos abertos.'}));
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha ao carregar: ${errData.message}</td></tr>`;
            showAlert('Erro ao Carregar', errData.message, 'danger'); // Usando showAlert
            return;
        }
        const pedidos = await res.json();
        tbody.innerHTML = ''; // Limpa o corpo da tabela

        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma solicitação de manutenção aberta no momento.</td></tr>';
            return;
        }

        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${pedido.idPedido}</td>
                <td>${pedido.solicitanteNome || pedido.solicitanteEmail}</td>
                <td>${new Date(pedido.dataSolicitacao).toLocaleDateString('pt-BR')}</td>
                <td><span class="badge bg-${getPrioridadeBadge(pedido.prioridade)}">${pedido.prioridade.toUpperCase()}</span></td>
                <td>${pedido.radios.length}</td>
                <td>
                    <button class="btn btn-sm btn-info btn-ver-detalhes" data-id="${pedido.idPedido}" title="Ver Detalhes do Pedido">
                        <i class="bi bi-eye"></i> Detalhes
                    </button>
                    <button class="btn btn-sm btn-success ms-1 btn-dar-andamento" data-id="${pedido.idPedido}" title="Confirmar recebimento e encaminhar para fluxo de manutenção">
                        <i class="bi bi-check-circle"></i> Dar Andamento
                    </button>
                </td>
            `;
            tbody.appendChild(tr);

            // Linha para exibir os detalhes expandidos
            const trDetalhes = document.createElement('tr');
            trDetalhes.classList.add('detalhes-pedido', 'd-none'); // d-none para ocultar inicialmente
            trDetalhes.id = `detalhes-${pedido.idPedido}`;
            trDetalhes.innerHTML = `<td colspan="6"><div class="p-2">Carregando detalhes...</div></td>`;
            tbody.appendChild(trDetalhes);
        });
        addEventListenersPedidosAbertos();
    } catch (error) {
        console.error("Erro ao carregar pedidos abertos:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Falha ao carregar dados dos pedidos abertos.</td></tr>';
        showAlert('Erro de Comunicação', 'Falha ao carregar pedidos abertos.', 'danger'); // Usando showAlert
    }
}

/**
 * Retorna a classe CSS do badge Bootstrap para a prioridade.
 * @param {string} prioridade - A prioridade do pedido.
 * @returns {string} Classe CSS do badge.
 */
function getPrioridadeBadge(prioridade) {
    if (!prioridade) return 'light text-dark';
    switch (prioridade.toLowerCase()) {
        case 'alta': return 'danger';
        case 'media': return 'warning text-dark';
        case 'baixa': return 'secondary';
        default: return 'light text-dark';
    }
}

/**
 * Adiciona listeners aos botões da tabela de pedidos abertos.
 */
function addEventListenersPedidosAbertos() {
    document.querySelectorAll('#tabelaPedidosAbertos .btn-ver-detalhes').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            const detalhesRow = document.getElementById(`detalhes-${idPedido}`);
            if (detalhesRow) {
                // Alterna a visibilidade da linha de detalhes
                detalhesRow.classList.toggle('d-none');
                if (!detalhesRow.classList.contains('d-none')) { // Se for para mostrar, carrega os detalhes
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

/**
 * Busca os detalhes completos de um pedido na API.
 * @param {string} idPedido - O ID do pedido.
 * @returns {Promise<Object|null>} Os dados do pedido ou null em caso de erro.
 */
async function buscarDetalhesPedidoAPI(idPedido) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`/manutencao/solicitacoes/${idPedido}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: `Falha ao buscar detalhes do pedido ${idPedido}.` }));
            console.error(errorData.message);
            showAlert('Erro ao Buscar Detalhes', errorData.message, 'danger');
            return null;
        }
        return await res.json();
    } catch (error) {
        console.error(`Erro na API ao buscar detalhes do pedido ${idPedido}:`, error);
        showAlert('Erro de Comunicação', `Não foi possível buscar detalhes do pedido ${idPedido}.`, 'danger');
        return null;
    }
}

/**
 * Carrega e exibe os detalhes de um pedido em uma linha expandida da tabela,
 * com os rádios organizados em colunas.
 * @param {string} idPedido - O ID do pedido.
 * @param {HTMLElement} divElement - O elemento DIV dentro da célula TD onde os detalhes serão renderizados.
 */
async function carregarDetalhesDoPedidoNaLinha(idPedido, divElement) {
    if (!divElement) return;
    divElement.innerHTML = '<em>Carregando detalhes...</em>';

    try {
        const pedido = await buscarDetalhesPedidoAPI(idPedido);

        if (!pedido) {
            divElement.innerHTML = '<em>Detalhes não encontrados ou falha ao buscar.</em>';
            return;
        }

        // Construindo a lista de rádios com colunas para Modelo, Série, Patrimônio e Problema
        let radiosHtml = `<div class="container-fluid mt-2">
                            <h6>Rádios no Pedido:</h6>
                            <div class="row bg-light border-bottom border-top py-1 fw-bold">
                                <div class="col-3">Modelo</div>
                                <div class="col-3">Nº Série</div>
                                <div class="col-2">Patrimônio</div>
                                <div class="col-4">Problema Descrito</div>
                            </div>`;
        if (pedido.radios && pedido.radios.length > 0) {
            pedido.radios.forEach(r => {
                radiosHtml += `
                    <div class="row py-1 border-bottom">
                        <div class="col-3">${r.modelo || 'N/A'}</div>
                        <div class="col-3">${r.numeroSerie || 'N/A'}</div>
                        <div class="col-2">${r.patrimonio || '-'}</div>
                        <div class="col-4">${r.descricaoProblema || 'N/A'}</div>
                    </div>`;
            });
        } else {
            radiosHtml += `<div class="row py-1"><div class="col-12 text-muted">Nenhum rádio associado a este pedido.</div></div>`;
        }
        radiosHtml += '</div>'; // Fecha container-fluid

        divElement.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <p class="mb-1"><strong>ID do Pedido:</strong> ${pedido.idPedido}</p>
                    <p class="mb-1"><strong>Solicitante:</strong> ${pedido.solicitanteNome} (${pedido.solicitanteEmail || 'N/A'})</p>
                    <p class="mb-1"><strong>Data da Solicitação:</strong> ${new Date(pedido.dataSolicitacao).toLocaleString('pt-BR')}</p>
                    <p class="mb-1"><strong>Prioridade:</strong> ${pedido.prioridade.toUpperCase()}</p>
                    <p class="mb-1"><strong>Status Atual:</strong> ${formatStatusPedido(pedido.statusPedido)}</p>
                </div>
                <div class="col-md-6">
                    ${pedido.tecnicoResponsavel ? `<p class="mb-1"><strong>Técnico Responsável:</strong> ${pedido.tecnicoResponsavel}</p>` : ''}
                    ${pedido.dataInicioManutencao ? `<p class="mb-1"><strong>Início Manutenção:</strong> ${new Date(pedido.dataInicioManutencao).toLocaleString('pt-BR')}</p>` : ''}
                    ${pedido.dataFimManutencao ? `<p class="mb-1"><strong>Fim Manutenção:</strong> ${new Date(pedido.dataFimManutencao).toLocaleString('pt-BR')}</p>` : ''}
                    ${pedido.observacoesSolicitante ? `<div class="mt-2"><strong>Obs. do Solicitante:</strong><p class="ms-2">${pedido.observacoesSolicitante}</p></div>` : ''}
                </div>
            </div>
            ${radiosHtml}
            ${pedido.observacoesTecnicas ? `<div class="mt-2"><strong>Observações Técnicas:</strong><p class="ms-2">${pedido.observacoesTecnicas}</p></div>` : ''}
        `;
    } catch (error) {
        console.error(`Erro ao carregar e exibir detalhes do pedido ${idPedido}:`, error);
        divElement.innerHTML = '<em>Erro ao carregar detalhes. Tente novamente.</em>';
        showAlert('Erro', 'Erro ao exibir detalhes do pedido.', 'danger'); // Usando showAlert
    }
}

/**
 * Confirma a ação de "Dar Andamento" a um pedido.
 * Esta ação muda o status do pedido e dos rádios associados no backend.
 * @param {string} idPedido - O ID do pedido a ser processado.
 */
function confirmarDarAndamento(idPedido) {
    showBootstrapConfirmation( // Usando o novo modal de confirmação
        'Confirmar "Dar Andamento"',
        `Tem certeza que deseja dar andamento ao pedido ${idPedido}? \nIsso confirmará o recebimento e o colocará no fluxo para manutenção. Os rádios associados terão seu status principal alterado para "Manutenção".`,
        async (confirmed) => {
            if (!confirmed) {
                showAlert('Ação Cancelada', 'Operação de "Dar Andamento" cancelada.', 'info'); // Usando showAlert
                return;
            }

            const token = localStorage.getItem('token');
            const btnOriginal = document.querySelector(`#tabelaPedidosAbertos .btn-dar-andamento[data-id="${idPedido}"]`);
            let originalButtonHTML = '';
            if(btnOriginal) {
                originalButtonHTML = btnOriginal.innerHTML;
                btnOriginal.disabled = true;
                btnOriginal.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processando...';
            }

            try {
                const res = await fetch(`/manutencao/pedidos/${idPedido}/dar-andamento`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok) {
                    showAlert('Sucesso!', `Pedido ${idPedido} encaminhado para manutenção. Status dos rádios atualizado.`, 'success');
                    carregarPedidosAbertos(); // Recarrega para remover o pedido da aba "Abertos"
                    if (document.getElementById('pedidos-andamento-tab')?.classList.contains('active')) {
                        carregarPedidosEmAndamento(); // Recarrega se a aba de andamento estiver ativa
                    }
                    // Também recarregar o estoque de manutenção se estiver visível, pois o status do rádio mudou
                    if (document.getElementById('estoque-manutencao-tab')?.classList.contains('active')) {
                        carregarEstoqueManutencao();
                    }
                } else {
                    showAlert('Erro', data.message || `Falha ao dar andamento ao pedido ${idPedido}.`, 'danger');
                    if(btnOriginal) {
                        btnOriginal.disabled = false;
                        btnOriginal.innerHTML = originalButtonHTML;
                    }
                }
            } catch (error) {
                console.error("Erro ao dar andamento no pedido:", error);
                showAlert('Erro de Comunicação', `Não foi possível conectar ao servidor para processar o pedido ${idPedido}.`, 'danger');
                if(btnOriginal) {
                    btnOriginal.disabled = false;
                    btnOriginal.innerHTML = originalButtonHTML;
                }
            }
        }
    );
}

// --- Funções para PEDIDOS EM ANDAMENTO / AGUARDANDO ---

/**
 * Carrega e exibe os pedidos de manutenção com status 'aguardando_manutencao' ou 'em_manutencao'.
 */
async function carregarPedidosEmAndamento() {
    const tbody = document.querySelector('#tabelaPedidosEmAndamento tbody');
    if (!tbody) {
        console.error("Elemento tbody de #tabelaPedidosEmAndamento não encontrado.");
        return;
    }
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando pedidos aguardando ou em manutenção...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/manutencao/solicitacoes?status=aguardando_manutencao,em_manutencao', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ message: 'Erro ao buscar pedidos.'}));
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${errData.message}</td></tr>`;
            showAlert('Erro ao Carregar', errData.message, 'danger'); // Usando showAlert
            return;
        }
        const pedidos = await res.json();
        tbody.innerHTML = ''; // Limpa o corpo da tabela

        if (pedidos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum pedido aguardando ou em processo de manutenção.</td></tr>';
            return;
        }

        pedidos.forEach(pedido => {
            const tr = document.createElement('tr');
            let acoesHtml = '';
            if (pedido.statusPedido === 'aguardando_manutencao') {
                acoesHtml = `<button class="btn btn-sm btn-warning btn-iniciar-manutencao" data-id="${pedido.idPedido}" title="Selecionar técnico e iniciar o reparo">
                                 <i class="bi bi-tools"></i> Iniciar Manutenção
                               </button>`;
            } else if (pedido.statusPedido === 'em_manutencao') {
                acoesHtml = `<button class="btn btn-sm btn-primary btn-concluir-manutencao" data-id="${pedido.idPedido}" title="Finalizar manutenção e retornar rádio ao estoque disponível">
                                 <i class="bi bi-check2-square"></i> Concluir Manutenção
                               </button>`;
            }

            tr.innerHTML = `
                <td>${pedido.idPedido}</td>
                <td>${pedido.solicitanteNome || pedido.solicitanteEmail}</td>
                <td>${new Date(pedido.dataSolicitacao).toLocaleDateString('pt-BR')}</td>
                <td><span class="badge bg-${getStatusPedidoBadge(pedido.statusPedido)}">${formatStatusPedido(pedido.statusPedido)}</span></td>
                <td>${pedido.tecnicoResponsavel || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-info btn-ver-detalhes-andamento" data-id="${pedido.idPedido}" title="Ver Detalhes do Pedido">
                        <i class="bi bi-eye"></i> Detalhes
                    </button>
                    ${acoesHtml}
                </td>
            `;
            tbody.appendChild(tr);

            // Linha para exibir os detalhes expandidos
            const trDetalhes = document.createElement('tr');
            trDetalhes.classList.add('detalhes-pedido', 'd-none'); // d-none para ocultar inicialmente
            trDetalhes.id = `detalhes-andamento-${pedido.idPedido}`;
            trDetalhes.innerHTML = `<td colspan="6"><div class="p-2">Carregando detalhes...</div></td>`;
            tbody.appendChild(trDetalhes);
        });
        addEventListenersPedidosEmAndamento();
    } catch (error) {
        console.error("Erro ao carregar pedidos em andamento/aguardando:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Falha ao carregar dados.</td></tr>';
        showAlert('Erro de Comunicação', 'Falha ao carregar pedidos em andamento.', 'danger'); // Usando showAlert
    }
}

/**
 * Retorna a classe CSS do badge Bootstrap para o status do pedido.
 * Ajustado para as cores desejadas no painel de manutenção.
 * @param {string} status - O status do pedido.
 * @returns {string} Classe CSS do badge.
 */
function getStatusPedidoBadge(status) {
    if(!status) return 'light text-dark';
    switch (status.toLowerCase()) {
        case 'aberto': return 'warning text-dark'; // Amarelo
        case 'aguardando_manutencao': return 'info text-dark'; // Azul claro/Ciano para "Aguardando Manutenção"
        case 'em_manutencao': return 'primary'; // Azul padrão do Bootstrap, simulando um laranja/azul mais forte para "Em Manutenção"
        case 'finalizado': return 'success'; // Verde
        case 'cancelado': return 'danger'; // Vermelho
        default: return 'secondary'; // Cinza
    }
}

/**
 * Formata o status do pedido para exibição amigável.
 * @param {string} status - O status bruto do pedido.
 * @returns {string} O status formatado.
 */
function formatStatusPedido(status) {
    if (!status) return 'N/D';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Adiciona listeners aos botões da tabela de pedidos em andamento.
 */
function addEventListenersPedidosEmAndamento() {
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-ver-detalhes-andamento').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            const detalhesRow = document.getElementById(`detalhes-andamento-${idPedido}`);
            if (detalhesRow) {
                // Alterna a visibilidade da linha de detalhes
                detalhesRow.classList.toggle('d-none');
                if (!detalhesRow.classList.contains('d-none')) { // Se for para mostrar, carrega os detalhes
                    carregarDetalhesDoPedidoNaLinha(idPedido, detalhesRow.querySelector('td > div'));
                }
            }
        });
    });
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-iniciar-manutencao').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            abrirModalSelecionarTecnico(idPedido);
        });
    });
    document.querySelectorAll('#tabelaPedidosEmAndamento .btn-concluir-manutencao').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            abrirModalConcluirManutencao(idPedido); // Chama o novo modal de input de observações
        });
    });
}

/**
 * Abre o modal para selecionar o técnico responsável por iniciar a manutenção.
 * @param {string} idPedido - O ID do pedido a ser iniciado.
 */
function abrirModalSelecionarTecnico(idPedido) {
    document.getElementById('idPedidoParaIniciarManutencao').value = idPedido;
    document.getElementById('selectTecnico').value = '';
    document.getElementById('inputNomeOutroTecnico').value = '';
    document.getElementById('divNomeOutroTecnico').style.display = 'none'; // Esconde campo "Outro"

    if(modalTecnicoInstance) {
        modalTecnicoInstance.show();
    } else {
        console.error("Instância do modal de técnico não encontrada.");
        showAlert("Erro de Interface", "Não foi possível abrir o seletor de técnico.", "danger");
    }
}

/**
 * Lida com a confirmação para iniciar a manutenção com um técnico selecionado.
 */
async function handleConfirmarIniciarManutencaoComTecnico() {
    const idPedido = document.getElementById('idPedidoParaIniciarManutencao').value;
    let tecnicoSelecionado = document.getElementById('selectTecnico').value;

    if (tecnicoSelecionado === 'Outro') {
        tecnicoSelecionado = document.getElementById('inputNomeOutroTecnico').value.trim();
    }

    if (!tecnicoSelecionado) {
        showAlert('Campo Obrigatório', 'Por favor, selecione ou informe o nome do técnico.', 'warning');
        return;
    }

    const btnConfirmar = document.getElementById('btnConfirmarIniciarManutencaoComTecnico');
    const originalButtonText = btnConfirmar.innerHTML;
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Iniciando...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/manutencao/pedidos/${idPedido}/iniciar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ tecnico: tecnicoSelecionado })
        });
        const data = await res.json();
        if (res.ok) {
            showAlert('Sucesso!', `Manutenção do pedido ${idPedido} iniciada pelo técnico ${tecnicoSelecionado}.`, 'success');
            if(modalTecnicoInstance) modalTecnicoInstance.hide();
            carregarPedidosEmAndamento(); // Recarrega a aba de pedidos em andamento
            // Recarrega o estoque de manutenção se estiver visível, caso o status de algum rádio mude de aguardando para em_manutencao
            if (document.getElementById('estoque-manutencao-tab')?.classList.contains('active')) {
                carregarEstoqueManutencao();
            }
        } else {
            showAlert('Erro ao Iniciar', data.message || 'Não foi possível iniciar a manutenção.', 'danger');
        }
    } catch (error) {
        console.error("Erro ao iniciar manutenção:", error);
        showAlert('Erro de Comunicação', 'Falha ao comunicar com o servidor.', 'danger');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = originalButtonText;
    }
}

// --- NOVO: Função para abrir o modal de input de observações ---
/**
 * Abre o modal para coletar observações técnicas antes de concluir a manutenção.
 * @param {string} idPedido - O ID do pedido a ser concluído.
 */
function abrirModalConcluirManutencao(idPedido) {
    document.getElementById('idPedidoParaConcluirManutencao').value = idPedido;
    document.getElementById('inputObservacoesTecnicas').value = ''; // Limpa o campo
    if (modalInputObservacoesTecnicasInstance) {
        modalInputObservacoesTecnicasInstance.show();
    } else {
        showAlert("Erro de Interface", "Não foi possível abrir o modal de observações.", "danger");
    }
}

// --- NOVO: Função para lidar com a confirmação do modal de observações ---
/**
 * Lida com a confirmação do modal de input de observações,
 * então exibe o modal de confirmação final para concluir a manutenção.
 */
async function handleConfirmarObservacoesTecnicas() {
    const idPedido = document.getElementById('idPedidoParaConcluirManutencao').value;
    const observacoesTecnicas = document.getElementById('inputObservacoesTecnicas').value.trim();

    // Fecha o modal de observações
    if (modalInputObservacoesTecnicasInstance) {
        modalInputObservacoesTecnicasInstance.hide();
    }

    // Agora, mostra o modal de confirmação final
    showBootstrapConfirmation(
        'Confirmar Conclusão de Manutenção',
        `Deseja realmente marcar a manutenção do pedido ${idPedido} como concluída? \nOs rádios retornarão ao estoque como "Disponível".`,
        async (confirmed) => {
            if (!confirmed) {
                showAlert('Ação Cancelada', 'Conclusão de manutenção cancelada.', 'info');
                return;
            }
            // Se confirmado, prossegue com a conclusão da manutenção
            await concluirManutencaoBackend(idPedido, observacoesTecnicas);
        }
    );
}

/**
 * Envia a requisição para concluir a manutenção para o backend.
 * Separado do fluxo para ser chamado após a confirmação.
 * @param {string} idPedido - O ID do pedido a ser concluído.
 * @param {string} observacoesTecnicas - As observações técnicas (pode ser vazia).
 */
async function concluirManutencaoBackend(idPedido, observacoesTecnicas) {
    const token = localStorage.getItem('token');
    const btnConcluirOriginal = document.querySelector(`#tabelaPedidosEmAndamento .btn-concluir-manutencao[data-id="${idPedido}"]`);
    let originalConcluirHTML = '';
    if(btnConcluirOriginal){
        originalConcluirHTML = btnConcluirOriginal.innerHTML;
        btnConcluirOriginal.disabled = true;
        btnConcluirOriginal.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Concluindo...';
    }

    try {
        const res = await fetch(`/manutencao/pedidos/${idPedido}/concluir`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ observacoesTecnicas: observacoesTecnicas || undefined }) // Envia undefined se vazio
        });
        const data = await res.json();
        if (res.ok) {
            showAlert('Sucesso!', `Manutenção do pedido ${idPedido} concluída. Rádios disponíveis no estoque.`, 'success');
            carregarPedidosEmAndamento(); // Recarrega para remover o pedido da aba "Em Andamento"
            if (document.getElementById('historico-manutencao-tab')?.classList.contains('active')) {
                carregarHistoricoManutencao(); // Chama para atualizar o histórico se estiver visível
            }
            // Recarrega o estoque de manutenção se estiver visível, pois o status do rádio mudou
            if (document.getElementById('estoque-manutencao-tab')?.classList.contains('active')) {
                carregarEstoqueManutencao();
            }
        } else {
            showAlert('Erro ao Concluir', data.message || 'Não foi possível concluir a manutenção.', 'danger');
        }
    } catch (error) {
        console.error("Erro ao concluir manutenção:", error);
        showAlert('Erro de Comunicação', 'Falha ao comunicar com o servidor.', 'danger');
    } finally {
        if(btnConcluirOriginal){
            btnConcluirOriginal.disabled = false;
            btnConcluirOriginal.innerHTML = originalConcluirHTML;
        }
    }
}


// --- Funções para ESTOQUE DE MANUTENÇÃO ---

/**
 * Carrega e exibe os itens que estão no estoque de manutenção.
 */
async function carregarEstoqueManutencao() {
    const tbody = document.querySelector('#tabelaEstoqueManutencao tbody');
    if (!tbody) {
        console.error("Elemento tbody de #tabelaEstoqueManutencao não encontrado.");
        return;
    }
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Carregando estoque de manutenção...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/manutencao/estoque', { // Esta rota deve retornar rádios com status 'Manutenção'
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ message: 'Erro ao buscar estoque de manutenção.' }));
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Falha ao carregar: ${errData.message}</td></tr>`;
            showAlert('Erro ao Carregar Estoque', errData.message, 'danger'); // Usando showAlert
            return;
        }

        todosItensEstoqueManutencao = await res.json();
        renderizarEstoqueManutencao(todosItensEstoqueManutencao);

    } catch (error) {
        console.error("Erro ao carregar estoque de manutenção:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Falha ao carregar dados do estoque de manutenção.</td></tr>';
        showAlert('Erro de Comunicação', 'Falha ao carregar estoque de manutenção.', 'danger'); // Usando showAlert
    }
}

/**
 * Renderiza os itens do estoque de manutenção na tabela.
 * @param {Array<Object>} itens - Lista de itens no estoque de manutenção.
 */
function renderizarEstoqueManutencao(itens) {
    const tbody = document.querySelector('#tabelaEstoqueManutencao tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (itens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum rádio atualmente no estoque de manutenção.</td></tr>';
        return;
    }

    itens.forEach(item => {
        const tr = document.createElement('tr');
        // Determina a cor do badge com base no status do PEDIDO de manutenção
        let badgeClass = '';
        if (item.pedido.statusPedido === 'aguardando_manutencao') {
            badgeClass = 'bg-warning text-dark'; // Amarelo para "Aguardando Manutenção"
        } else if (item.pedido.statusPedido === 'em_manutencao') {
            badgeClass = 'bg-danger'; // Vermelho para "Em Manutenção" (ou bg-primary/customizado para laranja)
        } else {
            badgeClass = 'bg-secondary'; // Default para outros casos
        }

        tr.innerHTML = `
            <td>${item.radio.numeroSerie}</td>
            <td>${item.radio.modelo}</td>
            <td>${item.radio.patrimonio}</td>
            <td>${item.problemaDescrito}</td>
            <td>${item.pedido.idPedido}</td>
            <td><span class="badge ${badgeClass}">${formatStatusPedido(item.pedido.statusPedido)}</span></td>
            <td>${item.pedido.tecnicoResponsavel || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Retorna a classe CSS do badge Bootstrap para o status do pedido,
 * específico para a tela de Estoque de Manutenção.
 * @param {string} status - O status do pedido.
 * @returns {string} Classe CSS do badge.
 */
function getStatusPedidoBadgeEstoqueManutencao(status) {
    if (!status) return 'light text-dark';
    switch (status.toLowerCase()) {
        case 'aguardando_manutencao': return 'warning text-dark'; // Amarelo (para aguardando manutenção)
        case 'em_manutencao': return 'danger'; // Laranja/Vermelho (para em manutenção)
        default: return 'secondary'; // Outros status
    }
}


/**
 * Filtra os itens do estoque de manutenção com base no termo de busca.
 */
function filtrarEstoqueManutencao() {
    const termo = document.getElementById('filtroEstoqueManutencao').value.toLowerCase();
    if (!todosItensEstoqueManutencao) return;

    const filtrados = todosItensEstoqueManutencao.filter(item => {
        return (item.radio.numeroSerie?.toLowerCase().includes(termo) ||
                item.radio.modelo?.toLowerCase().includes(termo) ||
                item.radio.patrimonio?.toLowerCase().includes(termo) || // Adicionado filtro por patrimônio
                item.pedido.idPedido?.toLowerCase().includes(termo) ||
                item.pedido.tecnicoResponsavel?.toLowerCase().includes(termo) ||
                item.problemaDescrito?.toLowerCase().includes(termo) );
    });
    renderizarEstoqueManutencao(filtrados);
}


// --- Funções para HISTÓRICO DE MANUTENÇÃO ---

/**
 * Carrega e exibe o histórico de manutenções finalizadas.
 */
async function carregarHistoricoManutencao() {
    const tbody = document.querySelector('#tabelaHistoricoManutencao tbody');
    if (!tbody) {
        console.error("Elemento tbody de #tabelaHistoricoManutencao não encontrado.");
        return;
    }
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Carregando histórico de manutenções...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        // Reutiliza a rota de listagem de solicitações, filtrando por status 'finalizado'
        const res = await fetch('/manutencao/solicitacoes?status=finalizado', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({ message: 'Erro ao buscar histórico de manutenção.' }));
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Falha ao carregar: ${errData.message}</td></tr>`;
            showAlert('Erro ao Carregar Histórico', errData.message, 'danger'); // Usando showAlert
            return;
        }

        todosPedidosHistorico = await res.json(); // Armazena para filtro no cliente
        renderizarHistoricoManutencao(todosPedidosHistorico);

    } catch (error) {
        console.error("Erro ao carregar histórico de manutenção:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Falha ao carregar dados do histórico.</td></tr>';
        showAlert('Erro de Comunicação', 'Falha ao carregar histórico de manutenção.', 'danger'); // Usando showAlert
    }
}

/**
 * Renderiza os pedidos no histórico de manutenção na tabela.
 * @param {Array<Object>} pedidos - Lista de pedidos finalizados.
 */
function renderizarHistoricoManutencao(pedidos) {
    const tbody = document.querySelector('#tabelaHistoricoManutencao tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum registro no histórico de manutenção.</td></tr>';
        return;
    }

    pedidos.forEach(pedido => {
        const tr = document.createElement('tr');
        // A lista de rádios e problemas será exibida na linha de detalhes expandida
        // Então aqui mostramos apenas um resumo ou o número de rádios.
        // O `radiosProblemasHtml` completo será usado na função de detalhes.

        tr.innerHTML = `
            <td>${pedido.idPedido}</td>
            <td>${pedido.solicitanteNome || pedido.solicitanteEmail}</td>
            <td>${pedido.dataFimManutencao ? new Date(pedido.dataFimManutencao).toLocaleDateString('pt-BR') : 'N/A'}</td>
            <td>${pedido.tecnicoResponsavel || '-'}</td>
            <td>${pedido.radios.length} rádios</td>
            <td>${pedido.observacoesTecnicas ? (pedido.observacoesTecnicas.substring(0, 50) + (pedido.observacoesTecnicas.length > 50 ? '...' : '')) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-info btn-ver-detalhes-historico" data-id="${pedido.idPedido}" title="Ver Detalhes Completos do Pedido">
                    <i class="bi bi-eye"></i> Detalhes
                </button>
            </td>
        `;
        tbody.appendChild(tr);

        // Linha de detalhes para o histórico (será similar às outras)
        const trDetalhes = document.createElement('tr');
        trDetalhes.classList.add('detalhes-pedido', 'd-none'); // Oculta inicialmente
        trDetalhes.id = `detalhes-historico-${pedido.idPedido}`; // ID único para a linha de detalhes
        trDetalhes.innerHTML = `<td colspan="7"><div class="p-2">Carregando detalhes...</div></td>`;
        tbody.appendChild(trDetalhes);
    });

    // Adicionar event listeners para os botões de detalhes do histórico
    document.querySelectorAll('#tabelaHistoricoManutencao .btn-ver-detalhes-historico').forEach(btn => {
        btn.addEventListener('click', function() {
            const idPedido = this.dataset.id;
            const detalhesRow = document.getElementById(`detalhes-historico-${idPedido}`);
            if (detalhesRow) {
                // Alterna a visibilidade da linha de detalhes
                detalhesRow.classList.toggle('d-none');
                if (!detalhesRow.classList.contains('d-none')) { // Se for para mostrar, carrega os detalhes
                    // Reutiliza a função carregarDetalhesDoPedidoNaLinha para popular os detalhes
                    carregarDetalhesDoPedidoNaLinha(idPedido, detalhesRow.querySelector('td > div'));
                }
            }
        });
    });
}

/**
 * Filtra os pedidos no histórico de manutenção com base no termo de busca.
 */
function filtrarHistoricoManutencao() {
    const termo = document.getElementById('filtroHistoricoManutencao').value.toLowerCase();
    if (!todosPedidosHistorico) return;

    const filtrados = todosPedidosHistorico.filter(pedido => {
        const dataFim = pedido.dataFimManutencao ? new Date(pedido.dataFimManutencao).toLocaleDateString('pt-BR') : '';
        const radiosConcatenated = pedido.radios.map(r =>
            `${r.numeroSerie} ${r.modelo} ${r.patrimonio} ${r.descricaoProblema}` // Incluído patrimônio no filtro
        ).join(' ').toLowerCase();

        return (pedido.idPedido?.toLowerCase().includes(termo) ||
                pedido.solicitanteNome?.toLowerCase().includes(termo) ||
                pedido.solicitanteEmail?.toLowerCase().includes(termo) ||
                dataFim.includes(termo) ||
                pedido.tecnicoResponsavel?.toLowerCase().includes(termo) ||
                pedido.observacoesTecnicas?.toLowerCase().includes(termo) ||
                radiosConcatenated.includes(termo)
               );
    });
    renderizarHistoricoManutencao(filtrados);
}