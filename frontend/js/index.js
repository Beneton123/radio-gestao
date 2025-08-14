// frontend/js/index.js

const API_BASE_URL = 'http://10.110.120.237:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication(); 

        const filtroNFInput = document.getElementById('filtroNF');
        const filtroDataInput = document.getElementById('filtroData');

        if (filtroNFInput) filtroNFInput.addEventListener('input', filtrarMovimentacoes);
        if (filtroDataInput) filtroDataInput.addEventListener('change', filtrarMovimentacoes);

        carregarMovimentacoes();
    } catch (error) {
        console.error("Erro na inicialização da página de movimentações:", error.message);
    }
});

let movimentacoesOriginais = [];

async function carregarMovimentacoes() {
    const tbody = document.querySelector('#tabela-movimentacoes tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Carregando movimentações...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        // ALTERADO: Rota para buscar movimentações recentes no dashboard
        const res = await fetch(`${API_BASE_URL}/dashboard/movimentacoes/recentes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Erro desconhecido.' }));
            tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Erro: ${errorData.message}</td></tr>`;
            showAlert('Erro ao Carregar', `Não foi possível buscar as movimentações: ${errorData.message}`, 'danger');
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
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-danger text-center">Erro de conexão.</td></tr>';
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor.', 'danger');
    }
}

function filtrarMovimentacoes() {
    const filtroNF = document.getElementById('filtroNF')?.value.toLowerCase() || "";
    const filtroData = document.getElementById('filtroData')?.value || "";
    const tbody = document.querySelector('#tabela-movimentacoes tbody');

    if (!tbody) return;

    const filtradas = movimentacoesOriginais.filter(mov => {
        // ALTERADO: Nomes dos campos para bater com a nova API (dataSaida/dataEntrada, nfNumero)
        const dataMovimentacaoStr = (mov.dataSaida || mov.dataEntrada) ? new Date(mov.dataSaida || mov.dataEntrada).toISOString().split('T')[0] : "";
        
        const correspondeNF = !filtroNF || (mov.nfNumero && mov.nfNumero.toLowerCase().includes(filtroNF));
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
        // ALTERADO: Nomes dos campos para bater com a nova API
        const dataMovimentacao = mov.dataSaida || mov.dataEntrada ? new Date(mov.dataSaida || mov.dataEntrada) : null;
        const dataFormatada = dataMovimentacao 
            ? dataMovimentacao.toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              }) 
            : 'N/A';

        tr.innerHTML = `
            <td><strong>${mov.tipo || 'N/A'}</strong></td>
            <td>${mov.nfNumero || 'N/A'}</td>
            <td>${mov.usuarioRegistro || 'N/A'}</td>
            <td>${dataFormatada}</td>
            <td><button class="btn btn-sm btn-danger btn-table-action">🖨️ Imprimir</button></td>
        `;
        
        const btnImprimir = tr.querySelector('.btn-table-action');
        if (btnImprimir) {
            // ALTERADO: Passando o _id da movimentação para a função de imprimir
            btnImprimir.addEventListener('click', () => imprimirMovimentacao(mov._id));
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
        // ALTERADO: Rota para buscar detalhes de uma movimentação no dashboard
        const res = await fetch(`${API_BASE_URL}/dashboard/movimentacoes/${idMovimentacao}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const mov = await res.json();
            // ALTERADO: Nomes dos campos para bater com a nova API
            const dataFormatada = (mov.dataSaida || mov.dataEntrada) ? new Date(mov.dataSaida || mov.dataEntrada).toLocaleDateString('pt-BR', {
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

            const observacoesHtml = (mov.observacoes && mov.observacoes.length > 0) ? `
                <div class="observacoes-section">
                    <h3>Observações:</h3>
                    ${mov.observacoes.map(obs => `<p>${obs}</p>`).join('')}
                </div>
            ` : '';

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Movimentação NF ${mov.nfNumero || 'N/A'}</title>
                    <style>
                        body { font-family: 'Inter', Arial, sans-serif; padding: 20px; }
                        h2 { color: #880202; }
                        table { width: 100%; border-collapse: collapse; margin-top: 25px; }
                        th, td { border: 1px solid #ddd; padding: 8px; }
                        th { background-color: #f2f2f2; }
                    </style>
                </head>
                <body>
                    <h2>🧾 Detalhes da Movimentação</h2>
                    <p><strong>Tipo:</strong> ${mov.tipo || 'N/A'}</p>
                    <p><strong>Cliente:</strong> ${mov.cliente || 'N/A'}</p>
                    <p><strong>Registrado por:</strong> ${mov.usuarioRegistro || 'N/A'}</p>
                    <p><strong>Data:</strong> ${dataFormatada}</p>
                    <p><strong>Número da NF:</strong> ${mov.nfNumero || 'N/A'}</p>
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
            printWindow.onload = () => { printWindow.print(); };
        } else {
            const errorData = await res.json().catch(() => ({ message: 'Erro.'}));
            showAlert('Erro ao Imprimir', `Falha ao carregar dados: ${errorData.message}`, 'danger');
        }
    } catch (erro) {
        console.error('Erro ao imprimir movimentação:', erro);
        showAlert('Erro de Impressão', 'Ocorreu um erro ao tentar imprimir.', 'danger');
    }
}