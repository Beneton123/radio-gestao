document.addEventListener('DOMContentLoaded', async () => {

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

    function aplicarFiltro(inputId, tableBodyId) {
        const input = document.getElementById(inputId);
        const tbody = document.getElementById(tableBodyId);
        if (!input || !tbody) return;

        input.addEventListener('keyup', () => {
            const filter = input.value.toUpperCase();
            // Seleciona apenas as linhas de dados, ignorando as de detalhes
            const rows = tbody.querySelectorAll('tr:not(.detalhes-condenacao-row)');
            
            rows.forEach(row => {
                const cells = row.getElementsByTagName('td');
                let found = false;
                for (let j = 0; j < cells.length; j++) {
                    if (cells[j] && cells[j].textContent.toUpperCase().indexOf(filter) > -1) {
                        found = true;
                        break;
                    }
                }
                row.style.display = found ? '' : 'none';
                // Esconde a linha de detalhes correspondente se a linha principal for escondida
                const detalhesRow = row.nextElementSibling;
                if (detalhesRow && detalhesRow.classList.contains('detalhes-condenacao-row')) {
                    detalhesRow.style.display = 'none';
                }
            });
        });
    }
    
    // --- CARREGAMENTO DE DADOS DAS ABAS ---

    async function carregarRadiosCadastrados() {
        const tabela = document.getElementById('tabelaRadiosCadastrados');
        if (!tabela) return;
        tabela.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/radios/cadastrados`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao carregar o histórico de rádios.');
            const radios = await response.json();
            
            if (radios.length === 0) {
                tabela.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum rádio cadastrado.</td></tr>';
                return;
            }
            
            tabela.innerHTML = radios.map(radio => `
                <tr>
                    <td>${radio.modelo}</td>
                    <td>${radio.numeroSerie}</td>
                    <td>${radio.frequencia}</td>
                    <td>${formatarDataHora(radio.createdAt)}</td>
                    <td>${radio.cadastradoPor ? radio.cadastradoPor.email : 'N/A'}</td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Erro:', error);
            tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${error.message}</td></tr>`;
        }
    }

    // FUNÇÃO TOTALMENTE REFEITA PARA RÁDIOS CONDENADOS
    async function carregarRadiosBaixados() {
        const tabela = document.getElementById('tabelaRadiosBaixados');
        if (!tabela) return;
        tabela.innerHTML = '<tr><td colspan="7" class="text-center">Carregando...</td></tr>';

        try {
            const token = localStorage.getItem('token');
            // 1. Buscando do novo endpoint /condenados
            const response = await fetch(`/api/radios/condenados`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao carregar rádios condenados.');
            const radiosCondenados = await response.json();
            
            if (radiosCondenados.length === 0) {
                tabela.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum rádio condenado encontrado.</td></tr>';
                return;
            }
            
            let content = '';
            // 2. Criando as linhas da tabela com os novos dados e a linha de detalhes oculta
            radiosCondenados.forEach(radio => {
                const dataCondenacaoFormatada = formatarData(radio.dataCondenacao);
                const osCondenacaoId = radio.osCondenacao ? radio.osCondenacao.idPedido : 'N/A';
                
                // Linha principal, visível
                content += `
                    <tr class="linha-radio-condenado">
                        <td>${radio.modelo}</td>
                        <td>${radio.numeroSerie}</td>
                        <td>${radio.patrimonio || 'N/A'}</td>
                        <td><span class="badge status-condenado">Condenado</span></td>
                        <td>${dataCondenacaoFormatada}</td>
                        <td>${osCondenacaoId}</td>
                        <td>
                            <button class="btn btn-sm btn-info btn-ver-detalhes-condenacao" data-bs-toggle="collapse" data-bs-target="#detalhes-condenacao-${radio._id}">
                                <i class="bi bi-eye"></i> Ver Detalhes
                            </button>
                        </td>
                    </tr>
                `;
                
                // Linha de detalhes, oculta (usa a classe .collapse do Bootstrap)
                const tecnico = radio.tecnicoCondenacao ? `${radio.tecnicoCondenacao.nome} (${radio.tecnicoCondenacao.email})` : 'Não informado';
                content += `
                    <tr class="detalhes-condenacao-row collapse" id="detalhes-condenacao-${radio._id}">
                        <td colspan="7">
                            <div class="detalhes-condenacao-content">
                                <p><strong>Motivo da Condenação:</strong> ${radio.motivoCondenacao || 'Não especificado.'}</p>
                                <p><strong>Técnico Responsável:</strong> ${tecnico}</p>
                                <p><strong>Data e Hora Exata:</strong> ${formatarDataHora(radio.dataCondenacao)}</p>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            tabela.innerHTML = content;

        } catch (error) {
            console.error('Erro:', error);
            tabela.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${error.message}</td></tr>`;
        }
    }

    // --- Suas outras funções de carregamento podem ser adicionadas aqui ---
    // async function carregarHistoricoSaidas() { /* ... */ }
    // async function carregarHistoricoEntradas() { /* ... */ }
    // async function loadUsers() { /* ... */ }

    // --- INICIALIZAÇÃO E EVENTOS ---

    const adminTabs = document.getElementById('adminTabs');
    if (adminTabs) {
        const handleTabChange = async (tabId) => {
            switch (tabId) {
                case 'baixados-tab':
                    await carregarRadiosBaixados();
                    break;
                case 'cadastrados-tab':
                    await carregarRadiosCadastrados();
                    break;
                // Adicione os 'cases' para suas outras abas aqui
            }
        };
        
        document.querySelectorAll('#adminTabs .nav-link').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (event) => {
                handleTabChange(event.target.id);
            });
        });
        
        // Aplica os filtros
        aplicarFiltro('filtroBaixados', 'tabelaRadiosBaixados');
        aplicarFiltro('filtroRadiosCadastrados', 'tabelaRadiosCadastrados');
        
        // Carrega o conteúdo da aba ativa inicial
        const activeTabButton = document.querySelector('#adminTabs .nav-link.active');
        if (activeTabButton) {
            handleTabChange(activeTabButton.id);
        }
    }

    if (typeof checkAuthentication === 'function') {
        checkAuthentication('admin');
    }
});