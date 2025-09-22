document.addEventListener('DOMContentLoaded', async () => {
    // A URL base da sua API.
    const API_BASE_URL = 'http://10.110.120.237:5000/api';

    // --- FUNÇÕES UTILITÁRIAS ---

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

    // FUNÇÃO DE FILTRO CORRIGIDA E CENTRALIZADA
    function aplicarFiltro(inputId, tableId) {
        const input = document.getElementById(inputId);
        const table = document.getElementById(tableId)?.getElementsByTagName('tbody')[0]; // Pega o corpo da tabela
        if (!input || !table) return;

        const handleFilter = () => {
            const filter = input.value.toUpperCase();
            const rows = table.getElementsByTagName('tr');
            
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].getElementsByTagName('td');
                let found = false;
                if (cells.length > 0) { // Garante que não é uma linha de "carregando" ou "vazio"
                    for (let j = 0; j < cells.length; j++) {
                        if (cells[j]) {
                            if (cells[j].textContent.toUpperCase().indexOf(filter) > -1) {
                                found = true;
                                break;
                            }
                        }
                    }
                    rows[i].style.display = found ? '' : 'none';
                }
            }
        };
        input.addEventListener('keyup', handleFilter);
    }
    
    // --- CARREGAMENTO DE DADOS DAS ABAS ---

    async function carregarRadiosCadastrados() {
        const tabela = document.getElementById('tabelaRadiosCadastrados');
        if (!tabela) return;
        tabela.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/radios/cadastrados`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao carregar o histórico de rádios.');

            const radios = await response.json();
            tabela.innerHTML = '';

            if (radios.length === 0) {
                tabela.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum rádio cadastrado.</td></tr>';
                return;
            }

            // A lista já vem ordenada do backend
            radios.forEach(radio => {
                const cadastradoPor = radio.cadastradoPor ? radio.cadastradoPor.email : 'N/A';
                const row = `
                    <tr>
                        <td>${radio.modelo}</td>
                        <td>${radio.numeroSerie}</td>
                        <td>${radio.frequencia}</td>
                        <td>${formatarDataHora(radio.createdAt)}</td>
                        <td>${cadastradoPor}</td>
                    </tr>
                `;
                tabela.innerHTML += row;
            });

        } catch (error) {
            console.error('Erro:', error);
            tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${error.message}</td></tr>`;
        }
    }

    async function carregarHistoricoExcluidos() {
        const tabela = document.getElementById('tabelaExcluidos');
        if (!tabela) return;
        tabela.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/radios/excluidos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao carregar rádios excluídos.');

            const radios = await response.json();
            tabela.innerHTML = '';

            if (radios.length === 0) {
                tabela.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum rádio excluído encontrado.</td></tr>';
                return;
            }

            radios.forEach(radio => {
                const cadastradoPor = radio.cadastradoPor ? radio.cadastradoPor.email : 'N/A';
                const row = `
                    <tr>
                        <td>${radio.numeroSerie}</td>
                        <td>${radio.modelo}</td>
                        <td>${radio.patrimonio || 'N/A'}</td>
                        <td>${cadastradoPor}</td>
                        <td>${formatarDataHora(radio.updatedAt)}</td>
                        <td>N/A</td>
                    </tr>
                `;
                tabela.innerHTML += row;
            });
        } catch (error) {
            console.error('Erro:', error);
            tabela.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${error.message}</td></tr>`;
        }
    }

    // --- Coloque aqui suas outras funções que já existem (se houver) ---
    async function carregarHistoricoSaidas() { /* ... Seu código ... */ }
    async function carregarHistoricoEntradas() { /* ... Seu código ... */ }
    async function carregarHistoricoManutencao() { /* ... Seu código ... */ }
    async function loadUsers() { /* ... Seu código ... */ }

    // --- INICIALIZAÇÃO E EVENTOS ---

    const adminTabs = document.getElementById('adminTabs');
    if (adminTabs) {
        const handleTabChange = async (tabId) => {
            switch (tabId) {
                case 'cadastrados-tab':
                    await carregarRadiosCadastrados();
                    break;
                case 'saidas-tab':
                    // await carregarHistoricoSaidas(); // Implemente esta função se necessário
                    break;
                case 'entradas-tab':
                    // await carregarHistoricoEntradas(); // Implemente esta função se necessário
                    break;
                case 'manutencao-tab':
                    // await carregarHistoricoManutencao(); // Implemente esta função se necessário
                    break;
                case 'excluidos-tab':
                    await carregarHistoricoExcluidos();
                    break;
                case 'usuarios-tab':
                    // await loadUsers(); // Implemente esta função se necessário
                    break;
            }
        };
        
        document.querySelectorAll('#adminTabs .nav-link').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (event) => {
                handleTabChange(event.target.id);
            });
        });

        // Aplica os filtros para todas as abas
        aplicarFiltro('filtroRadiosCadastrados', 'tabelaRadiosCadastrados');
        aplicarFiltro('filtroSaidas', 'tabelaSaidas');
        aplicarFiltro('filtroEntradas', 'tabelaEntradas');
        aplicarFiltro('filtroManutencao', 'tabelaManutencao');
        aplicarFiltro('filtroExcluidos', 'tabelaExcluidos');
        aplicarFiltro('filtroUsuarios', 'tabelaUsuarios');

        // Carrega o conteúdo da aba que já está ativa ao carregar a página
        const activeTabButton = document.querySelector('#adminTabs .nav-link.active');
        if (activeTabButton) {
            handleTabChange(activeTabButton.id);
        }
    }

    if (typeof setupLogout === 'function') {
        setupLogout();
    }
});