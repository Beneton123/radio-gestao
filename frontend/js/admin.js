// frontend/js/admin.js

document.addEventListener('DOMContentLoaded', async () => {
    // A URL base da sua API. Confirmada e corrigida.
    const API_BASE_URL = 'http://10.110.120.237:5000/api';

    // --- Funções Auxiliares Comuns (assumem que showAlert está em ui.js e formatarData é local ou em ui.js) ---

    // Formata a data para o padrão DD/MM/AAAA. Mantida aqui por clareza.
    function formatarData(dataString) {
        if (!dataString) return 'N/A';
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        return new Date(dataString).toLocaleDateString('pt-BR', options);
    }

    // A função 'showAlert' é esperada do seu arquivo ui.js.
    // Certifique-se de que ui.js está carregado ANTES de admin.js no seu HTML.


    // --- Carregamento e Preenchimento das Tabelas de Histórico ---

    /**
     * Carrega e exibe o Histórico de Saídas.
     */
    async function carregarHistoricoSaidas() {
        try {
            const token = localStorage.getItem('token');
            // Corrigido para 'notasfiscais' (sem hífen)
            const response = await fetch(`${API_BASE_URL}/notasfiscais/saida/historico`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                if (response.status === 401) {
                    showAlert('Autenticação Necessária', 'Sessão expirada ou não autorizado. Faça login novamente.', 'warning');
                    setTimeout(() => window.location.href = 'login.html', 2000);
                }
                throw new Error(errorData.message || `Erro ao carregar histórico de saídas: ${response.statusText}`);
            }

            const nfsSaida = await response.json();
            const tabelaSaidas = document.getElementById('tabelaSaidas');
            if (!tabelaSaidas) {
                console.error("Elemento 'tabelaSaidas' não encontrado.");
                showAlert("Erro de Renderização", "Erro interno: Tabela de Saídas não encontrada no HTML.", "danger");
                return;
            }
            tabelaSaidas.innerHTML = ''; // Limpa a tabela

            if (nfsSaida.length === 0) {
                tabelaSaidas.innerHTML = '<tr><td colspan="6">Nenhum histórico de saída encontrado.</td></tr>';
                return;
            }

            nfsSaida.forEach(nf => {
                const radiosList = nf.radios && nf.radios.length > 0 ? nf.radios.map(r => r).join(', ') : 'Nenhum rádio';
                const row = `
                    <tr>
                        <td>${nf.nfNumero}</td>
                        <td>${nf.cliente}</td>
                        <td>${formatarData(nf.dataSaida)}</td>
                        <td>${radiosList}</td>
                        <td>${nf.tipoLocacao || 'N/A'}</td>
                        <td>
                            <button class="btn btn-sm btn-info ver-detalhes-nf" data-nf-numero="${nf.nfNumero}">
                                <i class="bi bi-eye"></i> Detalhes
                            </button>
                        </td>
                    </tr>
                `;
                tabelaSaidas.innerHTML += row;
            });

            document.querySelectorAll('#tabelaSaidas .ver-detalhes-nf').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const nfNumero = event.currentTarget.dataset.nfNumero;
                    await mostrarDetalhesNf(nfNumero);
                });
            });

        } catch (error) {
            console.error('Erro ao carregar histórico de saídas:', error);
            showAlert('Erro de Carregamento', `Erro ao carregar histórico de saídas: ${error.message}`, 'danger');
        }
    }

    /**
     * Carrega e exibe o Histórico de Entradas.
     */
    async function carregarHistoricoEntradas() {
        try {
            const token = localStorage.getItem('token');
            // Corrigido para 'notasfiscais' (sem hífen)
            const response = await fetch(`${API_BASE_URL}/notasfiscais/entrada/historico`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                if (response.status === 401) {
                    showAlert('Autenticação Necessária', 'Sessão expirada ou não autorizado. Faça login novamente.', 'warning');
                }
                throw new Error(errorData.message || `Erro ao carregar histórico de entradas: ${response.statusText}`);
            }

            const nfsEntrada = await response.json();
            const tabelaEntradas = document.getElementById('tabelaEntradas');
            if (!tabelaEntradas) {
                console.error("Elemento 'tabelaEntradas' não encontrado.");
                showAlert("Erro de Renderização", "Erro interno: Tabela de Entradas não encontrada no HTML.", "danger");
                return;
            }
            tabelaEntradas.innerHTML = '';

            if (nfsEntrada.length === 0) {
                tabelaEntradas.innerHTML = '<tr><td colspan="5">Nenhum histórico de entrada encontrado.</td></tr>';
                return;
            }

            nfsEntrada.forEach(nf => {
                const radiosList = nf.radios && nf.radios.length > 0 ? nf.radios.map(r => r).join(', ') : 'Nenhum rádio';
                const row = `
                    <tr>
                        <td>${nf.nfNumero}</td>
                        <td>${nf.cliente || 'N/A'}</td>
                        <td>${formatarData(nf.dataEntrada)}</td>
                        <td>${radiosList}</td>
                        <td>
                             <button class="btn btn-sm btn-info ver-detalhes-nf" data-nf-numero="${nf.nfNumero}">
                                <i class="bi bi-eye"></i> Detalhes
                            </button>
                        </td>
                    </tr>
                `;
                tabelaEntradas.innerHTML += row;
            });

            document.querySelectorAll('#tabelaEntradas .ver-detalhes-nf').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const nfNumero = event.currentTarget.dataset.nfNumero;
                    await mostrarDetalhesNf(nfNumero);
                });
            });

        } catch (error) {
            console.error('Erro ao carregar histórico de entradas:', error);
            showAlert('Erro de Carregamento', `Erro ao carregar histórico de entradas: ${error.message}`, 'danger');
        }
    }

    /**
     * Carrega e exibe o Histórico de Manutenção.
     * Requer que a rota no backend seja `/api/manutencao/historico` (singular).
     */
    async function carregarHistoricoManutencao() {
        try {
            const token = localStorage.getItem('token');
            // CORREÇÃO AQUI: de 'manutencoes' para 'manutencao' (singular, como no server.js)
            const response = await fetch(`${API_BASE_URL}/manutencao/historico`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                if (response.status === 401) {
                    showAlert('Autenticação Necessária', 'Sessão expirada ou não autorizado. Faça login novamente.', 'warning');
                }
                throw new Error(errorData.message || `Erro ao carregar histórico de manutenção: ${response.statusText}. Verifique se a rota /api/manutencao/historico existe e está funcionando corretamente no seu backend.`);
            }

            const manutencoes = await response.json();
            const tabelaManutencao = document.getElementById('tabelaManutencao');
            if (!tabelaManutencao) {
                console.error("Elemento 'tabelaManutencao' não encontrado.");
                showAlert("Erro de Renderização", "Erro interno: Tabela de Manutenção não encontrada no HTML.", "danger");
                return;
            }
            tabelaManutencao.innerHTML = '';

            if (manutencoes.length === 0) {
                tabelaManutencao.innerHTML = '<tr><td colspan="6">Nenhum histórico de manutenção encontrado.</td></tr>';
                return;
            }

            manutencoes.forEach(manutencao => {
                const radiosAfetados = manutencao.radios && manutencao.radios.length > 0 ?
                                      manutencao.radios.map(r => r.numeroSerie || r).join(', ') : 'Nenhum';
                const row = `
                    <tr>
                        <td>${manutencao.idPedido || 'N/A'}</td> <td>${manutencao.solicitanteNome || 'N/A'}</td>
                        <td>${formatarData(manutencao.dataFimManutencao || manutencao.dataSolicitacao)}</td>
                        <td>${manutencao.tecnicoResponsavel || 'N/A'}</td>
                        <td>${radiosAfetados}</td>
                        <td>
                            <button class="btn btn-sm btn-info ver-detalhes-manutencao" data-manutencao-id="${manutencao.idPedido}">
                                <i class="bi bi-eye"></i> Detalhes
                            </button>
                        </td>
                    </tr>
                `;
                tabelaManutencao.innerHTML += row;
            });

            // Adiciona evento de clique para os botões de detalhes da Manutenção
            document.querySelectorAll('#tabelaManutencao .ver-detalhes-manutencao').forEach(button => {
                button.addEventListener('click', async (event) => {
                    const idPedido = event.currentTarget.dataset.manutencaoId;
                    await mostrarDetalhesManutencao(idPedido);
                });
            });

        } catch (error) {
            console.error('Erro ao carregar histórico de manutenção:', error);
            showAlert('Erro de Carregamento', `Erro ao carregar histórico de manutenção: ${error.message}`, 'danger');
        }
    }

    /**
     * Carrega e exibe o Histórico de Rádios Excluídos.
     * Requer uma rota `/radios/excluidos` no backend e uma função `getDeletedRadios` no controller.
     */
    async function carregarHistoricoExcluidos() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/radios/excluidos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                if (response.status === 401) {
                    showAlert('Autenticação Necessária', 'Sessão expirada ou não autorizado. Faça login novamente.', 'warning');
                }
                throw new Error(errorData.message || `Erro ao carregar rádios excluídos: ${response.statusText}`);
            }

            const radiosExcluidos = await response.json();
            const tabelaExcluidos = document.getElementById('tabelaExcluidos');
            if (!tabelaExcluidos) {
                console.error("Elemento 'tabelaExcluidos' não encontrado.");
                showAlert("Erro de Renderização", "Erro interno: Tabela de Rádios Excluídos não encontrada no HTML.", "danger");
                return;
            }
            tabelaExcluidos.innerHTML = '';

            if (radiosExcluidos.length === 0) {
                tabelaExcluidos.innerHTML = '<tr><td colspan="6">Nenhum rádio excluído encontrado.</td></tr>';
                return;
            }

            radiosExcluidos.forEach(radio => {
                const row = `
                    <tr>
                        <td>${radio.numeroSerie}</td>
                        <td>${radio.modelo}</td>
                        <td>${radio.patrimonio || 'N/A'}</td>
                        <td>${radio.deletadoPor || 'Desconhecido'}</td>
                        <td>${formatarData(radio.deletadoEm)}</td>
                        <td>${radio.motivoExclusao || 'Não especificado'}</td>
                    </tr>
                `;
                tabelaExcluidos.innerHTML += row;
            });

        } catch (error) {
            console.error('Erro ao carregar histórico de excluídos:', error);
            showAlert('Erro de Carregamento', `Erro ao carregar histórico de rádios excluídos: ${error.message}`, 'danger');
        }
    }

    // --- Lógica para mostrar detalhes da NF (incluindo devoluções parciais) ---

    /**
     * Exibe os detalhes de uma Nota Fiscal em um modal.
     * @param {string} nfNumero - O número da Nota Fiscal a ser exibida.
     */
    async function mostrarDetalhesNf(nfNumero) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/notasfiscais/${nfNumero}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const customAlertModalElement = document.getElementById('customAlertModal');
            if (!customAlertModalElement) {
                console.error("Elemento 'customAlertModal' não encontrado no HTML para detalhes da NF.");
                showAlert("Erro interno", "Não foi possível exibir detalhes da NF. Modal não encontrado.", "danger");
                return;
            }
            const customAlertModal = new bootstrap.Modal(customAlertModalElement);
            const modalBody = customAlertModalElement.querySelector('.modal-body');
            const modalTitleElement = customAlertModalElement.querySelector('#customAlertModalLabel');

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                if (response.status === 401) {
                    showAlert('Autenticação Necessária', 'Sessão expirada ou não autorizado. Faça login novamente.', 'warning');
                    setTimeout(() => window.location.href = 'login.html', 2000);
                    return;
                }
                if (modalTitleElement) modalTitleElement.textContent = 'Erro';
                if (modalBody) {
                    modalBody.innerHTML = `
                        <div class="alert alert-danger" role="alert">
                            Não foi possível carregar os detalhes da NF: ${errorData.message || response.statusText}
                        </div>
                    `;
                }
                customAlertModal.show();
                return;
            }

            const nfDetalhes = await response.json();
            console.log('Detalhes da NF:', nfDetalhes);

            let radiosHtml = '';
            if (nfDetalhes.radios && nfDetalhes.radios.length > 0) {
                radiosHtml = nfDetalhes.radios.map(radio => `
                    <li><strong>${radio.numeroSerie}</strong> - ${radio.modelo} (${radio.patrimonio || 'Sem Patrimônio'})</li>
                `).join('');
            } else {
                radiosHtml = '<li>Nenhum rádio associado.</li>';
            }

            let retornosParciaisHtml = '';
            if (nfDetalhes.retornosParciais && nfDetalhes.retornosParciais.length > 0) {
                retornosParciaisHtml = `
                    <h6 class="mt-3">Devoluções Parciais (NFs de Entrada Vinculadas):</h6>
                    <ul class="list-group mb-3">
                        ${nfDetalhes.retornosParciais.map(retorno => `
                            <li class="list-group-item">
                                <strong>NF de Entrada:</strong> ${retorno.nfNumero}<br>
                                <strong>Data Entrada:</strong> ${formatarData(retorno.dataEntrada)}<br>
                                <strong>Rádios Retornados:</strong> ${retorno.radios.join(', ')}<br>
                                <strong>Registrado por:</strong> ${retorno.usuarioRegistro || 'N/A'}
                            </li>
                        `).join('')}
                    </ul>
                `;
            } else {
                retornosParciaisHtml = '<p class="mt-3">Nenhuma devolução parcial registrada para esta NF de saída.</p>';
            }

            if (modalTitleElement) modalTitleElement.textContent = `Detalhes da NF ${nfDetalhes.nfNumero}`;
            if (modalBody) {
                modalBody.innerHTML = `
                    <h5>Detalhes da Nota Fiscal ${nfDetalhes.nfNumero} (${nfDetalhes.tipo})</h5>
                    <p><strong>Cliente:</strong> ${nfDetalhes.cliente}</p>
                    <p><strong>Data de Saída:</strong> ${formatarData(nfDetalhes.dataSaida)}</p>
                    <p><strong>Previsão de Retorno:</strong> ${formatarData(nfDetalhes.previsaoRetorno)}</p>
                    <p><strong>Tipo de Locação:</strong> ${nfDetalhes.tipoLocacao || 'N/A'}</p>
                    <p><strong>Observações:</strong> ${nfDetalhes.observacoes || 'N/A'}</p>
                    <p><strong>Registrado por:</strong> ${nfDetalhes.usuarioRegistro || 'N/A'}</p>
                    <h6>Rádios nesta NF:</h6>
                    <ul>${radiosHtml}</ul>
                    ${retornosParciaisHtml}
                `;
            }
            customAlertModal.show();

        } catch (error) {
            console.error('Erro ao mostrar detalhes da NF:', error);
            showAlert('Erro ao Carregar Detalhes', `Não foi possível carregar os detalhes da NF: ${error.message}`, 'danger');
        }
    }

    // --- NOVA FUNÇÃO: Lógica para mostrar detalhes da Manutenção ---
    /**
     * Exibe os detalhes de um Pedido de Manutenção em um modal.
     * @param {string} idPedido - O ID do Pedido de Manutenção a ser exibido.
     */
    async function mostrarDetalhesManutencao(idPedido) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/manutencao/solicitacoes/${idPedido}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const customAlertModalElement = document.getElementById('customAlertModal');
            if (!customAlertModalElement) {
                console.error("Elemento 'customAlertModal' não encontrado no HTML para detalhes da Manutenção.");
                showAlert("Erro interno", "Não foi possível exibir detalhes da Manutenção. Modal não encontrado.", "danger");
                return;
            }
            const customAlertModal = new bootstrap.Modal(customAlertModalElement);
            const modalBody = customAlertModalElement.querySelector('.modal-body');
            const modalTitleElement = customAlertModalElement.querySelector('#customAlertModalLabel');

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                if (response.status === 401) {
                    showAlert('Autenticação Necessária', 'Sessão expirada ou não autorizado. Faça login novamente.', 'warning');
                    setTimeout(() => window.location.href = 'login.html', 2000);
                }
                if (modalTitleElement) modalTitleElement.textContent = 'Erro';
                if (modalBody) modalBody.innerHTML = `<div class="alert alert-danger" role="alert">Não foi possível carregar os detalhes da manutenção: ${errorData.message || response.statusText}</div>`;
                customAlertModal.show();
                return;
            }

            const manutencaoDetalhes = await response.json();
            console.log('Detalhes da Manutenção:', manutencaoDetalhes);

            let radiosAfetadosHtml = '';
            if (manutencaoDetalhes.radios && manutencaoDetalhes.radios.length > 0) {
                radiosAfetadosHtml = manutencaoDetalhes.radios.map(r => `
                    <li><strong>${r.numeroSerie}</strong> - ${r.modelo} (${r.patrimonio || 'Sem Patrimônio'}) - Problema: ${r.descricaoProblema || 'N/A'}</li>
                `).join('');
            } else {
                radiosAfetadosHtml = '<li>Nenhum rádio associado.</li>';
            }

            if (modalTitleElement) modalTitleElement.textContent = `Detalhes da Manutenção ID: ${manutencaoDetalhes.idPedido}`;
            if (modalBody) {
                modalBody.innerHTML = `
                    <h5>Detalhes do Pedido de Manutenção ${manutencaoDetalhes.idPedido}</h5>
                    <p><strong>Status:</strong> ${manutencaoDetalhes.statusPedido || 'N/A'}</p>
                    <p><strong>Prioridade:</strong> ${manutencaoDetalhes.prioridade || 'N/A'}</p>
                    <p><strong>Solicitante:</strong> ${manutencaoDetalhes.solicitanteNome} (${manutencaoDetalhes.solicitanteEmail})</p>
                    <p><strong>Data da Solicitação:</strong> ${formatarData(manutencaoDetalhes.dataSolicitacao)}</p>
                    <p><strong>Técnico Responsável:</strong> ${manutencaoDetalhes.tecnicoResponsavel || 'N/A'}</p>
                    <p><strong>Data Início Manutenção:</strong> ${formatarData(manutencaoDetalhes.dataInicioManutencao)}</p>
                    <p><strong>Data Fim Manutenção:</strong> ${formatarData(manutencaoDetalhes.dataFimManutencao)}</p>
                    <p><strong>Observações Técnicas:</strong> ${manutencaoDetalhes.observacoesTecnicas || 'N/A'}</p>
                    <h6>Rádios Afetados:</h6>
                    <ul>${radiosAfetadosHtml}</ul>
                `;
            }
            customAlertModal.show();

        } catch (error) {
            console.error('Erro ao mostrar detalhes da manutenção:', error);
            showAlert('Erro ao Carregar Detalhes', `Não foi possível carregar os detalhes da manutenção: ${error.message}`, 'danger');
        }
    }


    // --- Lógica de Filtro Genérica para as Tabelas ---

    /**
     * Aplica filtro em uma tabela HTML.
     * @param {string} inputId - ID do campo de input do filtro.
     * @param {string} tableId - ID da tabela a ser filtrada.
     */
    function aplicarFiltro(inputId, tableId) {
        const input = document.getElementById(inputId);
        const table = document.getElementById(tableId);
        const tbody = table ? table.querySelector('tbody') : null;
        
        if (!input) {
            console.warn(`Input de filtro com ID: ${inputId} não encontrado.`);
            return;
        }
        if (!tbody) {
            console.warn(`Tbody não encontrado para a tabela com ID: ${tableId}.`);
            return;
        }

        input.onkeyup = null; 
        input.onkeyup = function() {
            const filter = input.value.toLowerCase();
            const rowsArray = Array.from(tbody.getElementsByTagName('tr'));

            rowsArray.forEach(row => {
                let cells = row.getElementsByTagName('td');
                let found = false;
                for (let j = 0; j < cells.length; j++) {
                    let cell = cells[j];
                    if (cell && cell.textContent.toLowerCase().includes(filter)) {
                        found = true;
                        break;
                    }
                }
                row.style.display = found ? '' : 'none';
            });
        };
    }

    // --- Funções de Gerenciamento de Usuários (Integradas) ---

    /**
     * Carrega a lista de usuários do backend.
     */
    async function loadUsers() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                if (response.status === 401) {
                    showAlert('Autenticação Necessária', 'Sessão expirada ou não autorizado. Faça login novamente.', 'warning');
                    setTimeout(() => window.location.href = 'login.html', 2000);
                } else if (response.status === 403) {
                    showAlert('Permissão Negada', 'Você não tem permissão para gerenciar usuários.', 'danger');
                }
                throw new Error(errorData.message || `Erro ao carregar usuários: ${response.statusText}`);
            }

            const users = await response.json();
            renderUsers(users);
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            showAlert('Erro de Carregamento', `Erro ao carregar usuários: ${error.message}`, 'danger');
        }
    }

    /**
     * Renderiza a lista de usuários na tabela.
     * @param {Array<Object>} users - Lista de objetos de usuário.
     */
    function renderUsers(users) {
        const userManagementContent = document.getElementById('userManagementContent');
        if (!userManagementContent) {
            console.error("Elemento 'userManagementContent' não encontrado.");
            showAlert("Erro de Renderização", "Erro interno: Conteúdo de gerenciamento de usuários não encontrado no HTML.", "danger");
            return;
        }

        let usersHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-hover" id="tabelaUsuarios">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Permissões</th>
                            <th>Ativo</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (users.length === 0) {
            usersHtml += '<tr><td colspan="4">Nenhum usuário encontrado.</td></tr>';
        } else {
            users.forEach(user => {
                usersHtml += `
                    <tr>
                        <td>${user.email}</td>
                        <td>${user.permissoes.join(', ')}</td>
                        <td>${user.ativo ? 'Sim' : 'Não'}</td>
                        <td>
                            <button class="btn btn-sm btn-warning edit-user-btn" data-id="${user._id}" data-email="${user.email}" data-permissoes="${user.permissoes.join(',')}" data-ativo="${user.ativo}">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                            <button class="btn btn-sm btn-danger delete-user-btn" data-id="${user._id}">
                                <i class="bi bi-trash"></i> Excluir
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        usersHtml += `
                    </tbody>
                </table>
            </div>
            <hr>
            <h4>Adicionar/Editar Usuário</h4>
            <form id="userForm">
                <input type="hidden" id="userId">
                <div class="mb-3">
                    <label for="userEmail" class="form-label">Email</label>
                    <input type="email" class="form-control" id="userEmail" required>
                </div>
                <div class="mb-3">
                    <label for="userPassword" class="form-label">Senha (apenas para novo usuário ou reset)</label>
                    <input type="password" class="form-control" id="userPassword">
                </div>
                <div class="mb-3">
                    <label for="userPermissoes" class="form-label">Permissões (separadas por vírgula)</label>
                    <input type="text" class="form-control" id="userPermissoes" value="padrao">
                </div>
                <div class="form-check mb-3">
                    <input class="form-check-input" type="checkbox" id="userAtivo" checked>
                    <label class="form-check-label" for="userAtivo">
                        Usuário Ativo
                    </label>
                </div>
                <button type="submit" class="btn btn-primary" id="saveUserBtn">Salvar Usuário</button>
                <button type="button" class="btn btn-secondary" id="cancelEditBtn" style="display:none;">Cancelar Edição</button>
            </form>
        `;
        userManagementContent.innerHTML = usersHtml;

        document.querySelectorAll('.edit-user-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const email = e.currentTarget.dataset.email;
                const permissoes = e.currentTarget.dataset.permissoes;
                const ativo = e.currentTarget.dataset.ativo === 'true';

                document.getElementById('userId').value = id;
                document.getElementById('userEmail').value = email;
                document.getElementById('userPermissoes').value = permissoes;
                document.getElementById('userAtivo').checked = ativo;
                document.getElementById('userPassword').value = ''; 
                document.getElementById('userPassword').removeAttribute('required'); 
                document.getElementById('saveUserBtn').textContent = 'Atualizar Usuário';
                document.getElementById('cancelEditBtn').style.display = 'inline-block';
            });
        });

        document.querySelectorAll('.delete-user-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                // Usando o showConfirmation do ui.js (se implementado)
                if (typeof showConfirmation === 'function') {
                    showConfirmation('Confirmar Exclusão', 'Tem certeza que deseja excluir este usuário?', () => deleteUser(id));
                } else if (confirm('Tem certeza que deseja excluir este usuário?')) { 
                    await deleteUser(id);
                }
            });
        });

        const userForm = document.getElementById('userForm');
        const oldUserForm = userForm.cloneNode(true);
        userForm.parentNode.replaceChild(oldUserForm, userForm);
        const newUserForm = document.getElementById('userForm');

        newUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('userId').value;
            const email = document.getElementById('userEmail').value;
            const password = document.getElementById('userPassword').value;
            const permissoes = document.getElementById('userPermissoes').value.split(',').map(p => p.trim()).filter(p => p !== '');
            const ativo = document.getElementById('userAtivo').checked;

            const userData = { email, permissoes, ativo };
            if (password) {
                userData.password = password;
            }

            if (userId) {
                await updateUser(userId, userData);
            } else {
                if (!password) {
                    showAlert('Campo Obrigatório', 'A senha é obrigatória para um novo usuário.', 'warning');
                    return;
                }
                await addUser(userData);
            }
        });

        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            document.getElementById('userForm').reset();
            document.getElementById('userId').value = '';
            document.getElementById('userPassword').setAttribute('required', 'required');
            document.getElementById('saveUserBtn').textContent = 'Salvar Usuário';
            document.getElementById('cancelEditBtn').style.display = 'none';
        });
    }

    async function addUser(userData) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json().catch(() => ({ message: 'Resposta inválida do servidor.' }));
            if (response.ok) {
                showAlert('Sucesso', data.message, 'success');
                document.getElementById('userForm').reset();
                document.getElementById('userPassword').setAttribute('required', 'required');
                await loadUsers();
            } else {
                showAlert('Erro ao Adicionar', data.message || 'Erro ao adicionar usuário.', 'danger');
            }
        } catch (error) {
            console.error('Erro ao adicionar usuário:', error);
            showAlert('Erro de Conexão', `Erro de conexão ao adicionar usuário: ${error.message}`, 'danger');
        }
    }

    async function updateUser(id, userData) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json().catch(() => ({ message: 'Resposta inválida do servidor.' }));
            if (response.ok) {
                showAlert('Sucesso', data.message, 'success');
                document.getElementById('userForm').reset();
                document.getElementById('userId').value = '';
                document.getElementById('userPassword').setAttribute('required', 'required');
                document.getElementById('saveUserBtn').textContent = 'Atualizar Usuário';
                document.getElementById('cancelEditBtn').style.display = 'none';
                await loadUsers();
            } else {
                showAlert('Erro ao Atualizar', data.message || 'Erro ao atualizar usuário.', 'danger');
            }
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            showAlert('Erro de Conexão', `Erro de conexão ao atualizar usuário: ${error.message}`, 'danger');
        }
    }

    async function deleteUser(id) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json().catch(() => ({ message: 'Resposta inválida do servidor.' }));
            if (response.ok) {
                showAlert('Sucesso', data.message, 'success');
                await loadUsers();
            } else {
                showAlert('Erro ao Excluir', data.message || 'Erro ao excluir usuário.', 'danger');
            }
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            showAlert('Erro de Conexão', `Erro de conexão ao excluir usuário: ${error.message}`, 'danger');
        }
    }

    // --- Inicialização ao Carregar a Página e ao Mudar de Aba ---
    const adminTabs = document.getElementById('adminTabs');
    if (adminTabs) {
        adminTabs.addEventListener('shown.bs.tab', async function (event) {
            const activeTabId = event.target.id;

            // Limpa o conteúdo do modal para a próxima exibição e reseta o título
            const customAlertModalElement = document.getElementById('customAlertModal');
            if (customAlertModalElement) {
                const modalBody = customAlertModalElement.querySelector('.modal-body');
                if (modalBody) {
                    modalBody.innerHTML = '';
                }
                const modalTitleElement = customAlertModalElement.querySelector('#customAlertModalLabel');
                if (modalTitleElement) modalTitleElement.textContent = 'Detalhes';
                const modalHeader = customAlertModalElement.querySelector('.modal-header');
                if (modalHeader) modalHeader.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-primary', 'bg-secondary');
            }
            
            switch (activeTabId) {
                case 'saidas-tab':
                    await carregarHistoricoSaidas();
                    aplicarFiltro('filtroSaidas', 'tabelaSaidas');
                    break;
                case 'entradas-tab':
                    await carregarHistoricoEntradas();
                    aplicarFiltro('filtroEntradas', 'tabelaEntradas');
                    break;
                case 'manutencao-tab':
                    await carregarHistoricoManutencao();
                    aplicarFiltro('filtroManutencao', 'tabelaManutencao');
                    break;
                case 'excluidos-tab':
                    await carregarHistoricoExcluidos();
                    aplicarFiltro('filtroExcluidos', 'tabelaExcluidos');
                    break;
                case 'usuarios-tab':
                    await loadUsers();
                    aplicarFiltro('filtroUsuarios', 'tabelaUsuarios');
                    break;
                default:
                    console.warn(`Nenhuma função de carregamento para a aba ativa: ${activeTabId}`);
            }
        });

        // Carrega a aba ativa por padrão ao carregar a página pela primeira vez
        const activeTabButton = document.querySelector('#adminTabs .nav-link.active');
        if (activeTabButton) {
            const activeTabId = activeTabButton.id;
            switch (activeTabId) {
                case 'saidas-tab':
                    await carregarHistoricoSaidas();
                    aplicarFiltro('filtroSaidas', 'tabelaSaidas');
                    break;
                case 'entradas-tab':
                    await carregarHistoricoEntradas();
                    aplicarFiltro('filtroEntradas', 'tabelaEntradas');
                    break;
                case 'manutencao-tab':
                    await carregarHistoricoManutencao();
                    aplicarFiltro('filtroManutencao', 'tabelaManutencao');
                    break;
                case 'excluidos-tab':
                    await carregarHistoricoExcluidos();
                    aplicarFiltro('filtroExcluidos', 'tabelaExcluidos');
                    break;
                case 'usuarios-tab':
                    await loadUsers();
                    aplicarFiltro('filtroUsuarios', 'tabelaUsuarios');
                    break;
                default:
                    console.warn(`Nenhuma função de carregamento para a aba ativa na carga inicial: ${activeTabId}`);
            }
        }
    } else {
        console.error("Elemento com ID 'adminTabs' não encontrado. Verifique seu admin.html.");
    }

    // Inicializa o logout chamando a função do ui.js
    if (typeof setupLogout === 'function') {
        setupLogout();
    } else {
        console.warn("Função 'setupLogout' não encontrada. Verifique se 'ui.js' está carregado corretamente e define essa função globalmente.");
    }
});