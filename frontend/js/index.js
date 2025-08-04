// frontend/js/index.js

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Verifica autenticação. Para a página inicial, geralmente não há permissão específica
        // além de estar logado. Se houver, passe como argumento.
        checkAuthentication(); 

        // Event Listeners para filtros
        const filtroNFInput = document.getElementById('filtroNF');
        const filtroDataInput = document.getElementById('filtroData');

        if (filtroNFInput) filtroNFInput.addEventListener('input', filtrarMovimentacoes);
        if (filtroDataInput) filtroDataInput.addEventListener('change', filtrarMovimentacoes);

        carregarMovimentacoes();
    } catch (error) {
        // A função checkAuthentication já lida com o redirecionamento ou mostra mensagem.
        // Este catch é para erros inesperados durante a inicialização.
        console.error("Erro na inicialização da página de movimentações:", error.message);
        // Poderia usar showAlert aqui para um erro genérico, se apropriado.
        // showAlert("Erro Crítico", "Não foi possível carregar a página corretamente.", "danger");
    }
});

let movimentacoesOriginais = [];

async function carregarMovimentacoes() {
    const tbody = document.querySelector('#tabela-movimentacoes tbody');
    if (!tbody) return; // Sai se a tabela não estiver na página

    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Carregando movimentações...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        // Usando URL relativa
        const res = await fetch('/movimentacoes/recentes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Erro desconhecido ao buscar dados.' }));
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Erro: ${errorData.message}</td></tr>`;
            // Usando o showAlert centralizado
            showAlert('Erro ao Carregar', `Não foi possível buscar as movimentações: ${errorData.message || 'Resposta inválida do servidor.'}`, 'danger');
            return;
        }
        
        movimentacoesOriginais = await res.json();
        if (!Array.isArray(movimentacoesOriginais)) {
            movimentacoesOriginais = [];
            throw new Error("Formato de dados de movimentações inválido.");
        }
        filtrarMovimentacoes();

    } catch (erro) {
        console.error('Erro ao carregar movimentações:', erro);
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Erro de conexão com o servidor.</td></tr>';
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para carregar as movimentações.', 'danger');
    }
}

function filtrarMovimentacoes() {
    const filtroNF = document.getElementById('filtroNF')?.value.toLowerCase() || "";
    const filtroData = document.getElementById('filtroData')?.value || "";
    const tbody = document.querySelector('#tabela-movimentacoes tbody');

    if (!tbody) return;

    const filtradas = movimentacoesOriginais.filter(mov => {
        // Garante que mov.data exista antes de tentar criar um Date object
        const dataMovimentacaoStr = mov.data ? new Date(mov.data).toISOString().split('T')[0] : "";
        
        const correspondeNF = !filtroNF || (mov.numeroNF && mov.numeroNF.toLowerCase().includes(filtroNF));
        const correspondeData = !filtroData || (dataMovimentacaoStr && dataMovimentacaoStr === filtroData);
        
        return correspondeNF && correspondeData;
    });

    tbody.innerHTML = '';
    if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma movimentação encontrada com os filtros aplicados.</td></tr>';
        return;
    }

    filtradas.forEach(mov => {
        const tr = document.createElement('tr');
        const dataMovimentacao = mov.data ? new Date(mov.data) : null;
        const dataFormatada = dataMovimentacao 
            ? dataMovimentacao.toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              }) 
            : 'N/A';

        tr.innerHTML = `
            <td><strong>${mov.tipo || 'N/A'}</strong></td>
            <td>${mov.numeroNF || 'N/A'}</td>
            <td>${mov.usuario || 'N/A'}</td>
            <td>${dataFormatada}</td>
            <td><button class="btn btn-sm btn-danger btn-table-action">🖨️ Imprimir</button></td>
        `;
        // Adicionando o event listener programaticamente
        const btnImprimir = tr.querySelector('.btn-table-action');
        if (btnImprimir) {
            btnImprimir.addEventListener('click', () => imprimirMovimentacao(mov.id));
        }
        tbody.appendChild(tr);
    });
}

async function imprimirMovimentacao(idMovimentacao) {
    if (!idMovimentacao) {
        showAlert("Erro de Impressão", "ID da movimentação inválido.", "danger");
        return;
    }
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/movimentacoes/${idMovimentacao}`, { // URL relativa
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const mov = await res.json();
            const dataFormatada = mov.data ? new Date(mov.data).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }) : 'N/A';

            const radiosHtml = Array.isArray(mov.radios) ? mov.radios.map(r => `
                <tr>
                    <td>${r.modelo || 'N/A'}</td>
                    <td>${r.numeroSerie || 'N/A'}</td>
                    <td>${r.patrimonio || 'N/A'}</td>
                    <td>${r.frequencia || 'N/A'}</td>
                </tr>`).join('') : '<tr><td colspan="4">Nenhum rádio nesta movimentação.</td></tr>';

            const observacoesHtml = (mov.observacoes && Array.isArray(mov.observacoes) && mov.observacoes.length > 0) ? `
                <div class="observacoes-section">
                    <h3>Observações:</h3>
                    ${mov.observacoes.map(obs => `<p>${obs}</p>`).join('')}
                </div>
            ` : '';

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Movimentação NF ${mov.numeroNF || 'N/A'}</title>
                    <style>
                        body { font-family: 'Inter', Arial, sans-serif; padding: 20px; color: #333; }
                        h2 { color: #880202; margin-bottom: 20px; }
                        p { margin-bottom: 8px; line-height: 1.5; }
                        strong { color: #555; }
                        table { width: 100%; border-collapse: collapse; margin-top: 25px; border: 1px solid #ddd; }
                        th, td { border: 1px solid #eee; padding: 10px; text-align: left; }
                        th { background-color: #f8f8f8; color: #666; font-weight: 600; }
                        .observacoes-section { margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 15px; }
                        .observacoes-section h3 { color: #880202; margin-bottom: 10px; }
                        .observacoes-section p { white-space: pre-wrap; word-wrap: break-word; }
                    </style>
                </head>
                <body>
                    <h2>🧾 Detalhes da Movimentação</h2>
                    <p><strong>Tipo:</strong> ${mov.tipo || 'N/A'}</p>
                    <p><strong>Usuário:</strong> ${mov.usuario || 'N/A'} (Cliente)</p>
                    <p><strong>Data:</strong> ${dataFormatada}</p>
                    <p><strong>Número da NF:</strong> ${mov.numeroNF || 'N/A'}</p>
                    <h3>Rádios na movimentação:</h3>
                    <table>
                        <thead><tr><th>Modelo</th><th>Nº de Série</th><th>Patrimônio</th><th>Frequência</th></tr></thead>
                        <tbody>${radiosHtml}</tbody>
                    </table>
                    ${observacoesHtml}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.onload = () => {
                printWindow.print();
                setTimeout(() => printWindow.close(), 1000); 
            };
        } else {
            const errorData = await res.json().catch(() => ({ message: 'Não foi possível obter detalhes da movimentação.'}));
            showAlert('Erro ao Imprimir', `Falha ao carregar dados da movimentação: ${errorData.message}`, 'danger');
        }
    } catch (erro) {
        console.error('Erro ao imprimir movimentação:', erro);
        showAlert('Erro de Impressão', 'Ocorreu um erro ao tentar imprimir a movimentação. Verifique sua conexão.', 'danger');
    }
}