document.addEventListener('DOMContentLoaded', async () => {
    // A URL base da sua API.
    const API_BASE_URL = 'http://10.110.120.237:5000/api';

    // Formata a data para o padrão DD/MM/AAAA HH:mm.
    function formatarDataHora(dataString) {
        if (!dataString) return 'N/A';
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
        return new Date(dataString).toLocaleString('pt-BR', options);
    }
    
    function formatarData(dataString) {
        if (!dataString) return 'N/A';
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        return new Date(dataString).toLocaleDateString('pt-BR', options);
    }
    
    // --- Carregamento e Preenchimento das Tabelas de Histórico ---

    /**
     * Carrega e exibe o Histórico de Rádios Cadastrados.
     */
    async function carregarRadiosCadastrados() {
        const tabelaRadios = document.getElementById('tabelaRadiosCadastrados');
        if (!tabelaRadios) {
            console.error("Elemento 'tabelaRadiosCadastrados' não encontrado.");
            return;
        }
        tabelaRadios.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/radios/cadastrados`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || 'Erro ao carregar rádios cadastrados.');
            }

            const radios = await response.json();
            tabelaRadios.innerHTML = '';

            if (radios.length === 0) {
                tabelaRadios.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum rádio cadastrado encontrado.</td></tr>';
                return;
            }

            radios.forEach(radio => {
                
                const cadastradoPor = radio.cadastradoPor ? radio.cadastradoPor.email : 'Usuário desconhecido';
                const row = `
                    <tr>
                        <td>${radio.modelo}</td>
                        <td>${radio.numeroSerie}</td>
                        <td>${radio.frequencia}</td>
                        <td>${formatarDataHora(radio.createdAt)}</td>
                        <td>${cadastradoPor}</td>
                    </tr>
                `;
                tabelaRadios.innerHTML += row;
            });

        } catch (error) {
            console.error('Erro ao carregar rádios cadastrados:', error);
            showAlert('Erro de Carregamento', `Erro ao carregar rádios cadastrados: ${error.message}`, 'danger');
            if (tabelaRadios) {
                tabelaRadios.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Falha ao carregar dados.</td></tr>';
            }
        }
    }

    async function carregarHistoricoSaidas() {
        // ... (seu código original para carregar saídas, que já está correto)
    }

    async function carregarHistoricoEntradas() {
        // ... (seu código original para carregar entradas, que já está correto)
    }

    async function carregarHistoricoManutencao() {
        // ... (seu código original para carregar manutenção, que já está correto)
    }

    async function carregarHistoricoExcluidos() {
        // ... (seu código original para carregar excluídos, que já está correto)
    }

    // --- Lógica para mostrar detalhes (sem alteração) ---
    async function mostrarDetalhesNf(nfNumero) {
        // ... (seu código original)
    }

    async function mostrarDetalhesManutencao(idPedido) {
        // ... (seu código original)
    }

    // --- Lógica de Filtro (sem alteração) ---
    function aplicarFiltro(inputId, tableId) {
        // ... (seu código original)
    }

    // --- Funções de Gerenciamento de Usuários (sem alteração) ---
    async function loadUsers() {
        // ... (seu código original)
    }
    
    function renderUsers(users) {
        // ... (seu código original)
    }

    async function addUser(userData) {
        // ... (seu código original)
    }

    async function updateUser(id, userData) {
        // ... (seu código original)
    }

    async function deleteUser(id) {
        // ... (seu código original)
    }

    // --- Inicialização e Eventos das Abas ---
    const adminTabs = document.getElementById('adminTabs');
    if (adminTabs) {
        const handleTabChange = async (tabId) => {
            const customAlertModalElement = document.getElementById('customAlertModal');
            if (customAlertModalElement) {
                const modalBody = customAlertModalElement.querySelector('.modal-body');
                if (modalBody) modalBody.innerHTML = '';
                const modalTitleElement = customAlertModalElement.querySelector('#customAlertModalLabel');
                if (modalTitleElement) modalTitleElement.textContent = 'Detalhes';
            }

            switch (tabId) {
                case 'cadastrados-tab':
                    await carregarRadiosCadastrados();
                    aplicarFiltro('filtroRadiosCadastrados', 'tabelaRadiosCadastrados');
                    break;
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
            }
        };
        
        adminTabs.addEventListener('shown.bs.tab', (event) => {
            handleTabChange(event.target.id);
        });

        const activeTabButton = document.querySelector('#adminTabs .nav-link.active');
        if (activeTabButton) {
            handleTabChange(activeTabButton.id);
        }
    }

    if (typeof setupLogout === 'function') {
        setupLogout();
    }
});