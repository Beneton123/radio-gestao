// frontend/js/extrato.js

let todasMovimentacoes = [];
let radiosCadastrados = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        checkAuthentication('extrato');
        await carregarRadiosCadastrados();
        document.getElementById('filtroNfNumero').addEventListener('input', aplicarFiltrosExtrato);
        document.getElementById('filtroNumeroSerieRadio').addEventListener('input', aplicarFiltrosExtrato);
        document.getElementById('filtroModeloRadio').addEventListener('input', aplicarFiltrosExtrato);
        document.getElementById('filtroDataInicio').addEventListener('change', aplicarFiltrosExtrato);
        document.getElementById('filtroDataFim').addEventListener('change', aplicarFiltrosExtrato);
        document.getElementById('btnLimparFiltros').addEventListener('click', limparFiltrosExtrato);
        document.getElementById('btnBuscarExtrato').addEventListener('click', carregarMovimentacoes);
        await carregarMovimentacoes();
    } catch (error) {
        console.error("Erro na inicialização da página de Extrato:", error.message);
        showAlert("Erro Crítico", "Não foi possível inicializar a página de extrato corretamente. Tente recarregar.", "danger");
    }
});

async function carregarRadiosCadastrados() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/radios', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            radiosCadastrados = await res.json();
        } else {
            console.error('Falha ao carregar rádios cadastrados:', await res.json());
        }
    } catch (error) {
        console.error('Erro de rede ao carregar rádios cadastrados:', error);
    }
}

async function carregarMovimentacoes() {
    const tbody = document.querySelector('#tabela-movimentacoes tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando movimentações...</td></tr>';

    const btnBuscar = document.getElementById('btnBuscarExtrato');
    const originalBtnHtml = btnBuscar.innerHTML;
    btnBuscar.disabled = true;
    btnBuscar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Buscando...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/nf', { // Busca todas as NFs
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Não foi possível obter detalhes do erro.' }));
            tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Erro ao carregar: ${errorData.message}</td></tr>`;
            showAlert('Erro ao Carregar', `Não foi possível buscar as movimentações: ${errorData.message || 'Resposta inválida do servidor.'}`, 'danger');
            return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
            todasMovimentacoes = [];
            throw new Error("Formato de dados de movimentações inválido recebido do servidor.");
        }
        todasMovimentacoes = data;
        aplicarFiltrosExtrato();

    } catch (erro) {
        console.error('Erro ao carregar movimentações:', erro);
        tbody.innerHTML = '<tr><td colspan="6" class="text-danger text-center">Erro de conexão com o servidor. Tente novamente.</td></tr>';
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para carregar as movimentações.', 'danger');
    } finally {
        btnBuscar.disabled = false;
        btnBuscar.innerHTML = originalBtnHtml;
    }
}

function aplicarFiltrosExtrato() {
    const filtroNfNumero = document.getElementById('filtroNfNumero')?.value.toLowerCase() || "";
    const filtroNumeroSerieRadio = document.getElementById('filtroNumeroSerieRadio')?.value.toLowerCase() || "";
    const filtroModeloRadio = document.getElementById('filtroModeloRadio')?.value.toLowerCase() || "";
    const filtroDataInicio = document.getElementById('filtroDataInicio')?.value;
    const filtroDataFim = document.getElementById('filtroDataFim')?.value;

    const tbody = document.querySelector('#tabela-movimentacoes tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (todasMovimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma movimentação registrada ainda.</td></tr>';
        return;
    }

    const movimentacoesFiltradas = todasMovimentacoes.filter(mov => {
        // Prioriza a data de entrada para NFs que são apenas de entrada (se houver)
        // ou dataSaida para NFs de saída (que podem ou não ter dataEntrada)
        const dataReferenciaMov = mov.tipo === 'Saída' ? mov.dataSaida : (mov.dataEntrada || mov.dataSaida);
        const dataMovimentacaoDate = dataReferenciaMov ? new Date(dataReferenciaMov) : null;


        const correspondeNfNumero = !filtroNfNumero || (mov.nfNumero && mov.nfNumero.toLowerCase().includes(filtroNfNumero));

        const correspondeRadio = !filtroNumeroSerieRadio && !filtroModeloRadio ||
            (Array.isArray(mov.radios) && mov.radios.some(radioSerie => {
                const radioDetail = radiosCadastrados.find(r => r.numeroSerie === radioSerie);
                const serieMatch = !filtroNumeroSerieRadio || radioSerie.toLowerCase().includes(filtroNumeroSerieRadio);
                const modeloMatch = !filtroModeloRadio || (radioDetail?.modelo && radioDetail.modelo.toLowerCase().includes(filtroModeloRadio));
                return serieMatch && modeloMatch;
            }));
        
        let dataInicioObj = null;
        if (filtroDataInicio) {
            const [year, month, day] = filtroDataInicio.split('-');
            dataInicioObj = new Date(year, month - 1, day, 0, 0, 0, 0);
        }

        let dataFimObj = null;
        if (filtroDataFim) {
            const [year, month, day] = filtroDataFim.split('-');
            dataFimObj = new Date(year, month - 1, day, 23, 59, 59, 999);
        }

        const correspondeDataInicio = !dataInicioObj || (dataMovimentacaoDate && dataMovimentacaoDate >= dataInicioObj);
        const correspondeDataFim = !dataFimObj || (dataMovimentacaoDate && dataMovimentacaoDate <= dataFimObj);

        return correspondeNfNumero && correspondeRadio && correspondeDataInicio && correspondeDataFim;
    });

    if (movimentacoesFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma movimentação encontrada com os filtros aplicados.</td></tr>';
        return;
    }
    
    // Ordena as movimentações filtradas pela data mais recente primeiro
    movimentacoesFiltradas.sort((a, b) => {
        const dateA = new Date(a.dataSaida || a.dataEntrada || a.createdAt); // Usa createdAt como fallback
        const dateB = new Date(b.dataSaida || b.dataEntrada || b.createdAt);
        return dateB - dateA;
    });


    movimentacoesFiltradas.forEach(mov => {
        const tr = document.createElement('tr');
        // Usa a data de Saída para NFs de Saída, e data de Entrada para NFs de Entrada (Retorno)
        const dataMovimentacao = mov.tipo === 'Saída' ? mov.dataSaida : mov.dataEntrada;
        
        const dataFormatada = dataMovimentacao
            ? new Date(dataMovimentacao).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                // Removido hour e minute para consistência, já que nem toda NF terá hora
            }) : 'N/A';

        const tipoMovimentacao = mov.tipo; // O backend já deve enviar 'Saída' ou 'Entrada'

        tr.innerHTML = `
            <td><strong>${tipoMovimentacao}</strong></td>
            <td>${mov.nfNumero || 'N/A'}</td>
            <td>${mov.cliente || 'N/A'}</td>
            <td>${dataFormatada}</td>
            <td>${mov.radios?.length || 0}</td>
            <td>
                <button class="btn btn-sm btn-info btn-ver-detalhes-mov" data-nf="${mov.nfNumero}" title="Ver Detalhes">
                    <i class="bi bi-eye"></i> Detalhes
                </button>
                <button class="btn btn-sm btn-danger btn-imprimir-mov ms-1" data-id="${mov.nfNumero}" data-tipo="${tipoMovimentacao}" title="Imprimir Nota">
                    <i class="bi bi-printer"></i> Imprimir
                </button>
            </td>
        `;
        tbody.appendChild(tr);

        const trDetalhes = document.createElement('tr');
        trDetalhes.classList.add('detalhes-movimentacao', 'd-none');
        trDetalhes.id = `detalhes-mov-${mov.nfNumero}`;
        trDetalhes.innerHTML = `<td colspan="6"></td>`;
        tbody.appendChild(trDetalhes);
    });

    addEventListenersExtrato();
}

function addEventListenersExtrato() {
    document.querySelectorAll('.btn-ver-detalhes-mov').forEach(btn => {
        btn.addEventListener('click', function () {
            const nfNumero = this.dataset.nf;
            const detalhesRow = document.getElementById(`detalhes-mov-${nfNumero}`);
            if (detalhesRow) {
                detalhesRow.classList.toggle('d-none');
                if (!detalhesRow.classList.contains('d-none')) {
                    renderDetalhesMovimentacao(nfNumero, detalhesRow.querySelector('td'));
                }
            }
        });
    });

    document.querySelectorAll('.btn-imprimir-mov').forEach(btn => {
        btn.addEventListener('click', function () {
            const nfNumero = this.dataset.id; // Pega o nfNumero do data-id
            imprimirMovimentacao(nfNumero); // Chama a nova função de impressão
        });
    });
}

async function renderDetalhesMovimentacao(nfNumero, tdElement) {
    tdElement.innerHTML = `<em>Carregando detalhes da NF ${nfNumero}...</em>`;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/nf/${nfNumero}`, { // Endpoint para buscar detalhes de UMA NF
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Erro ao buscar detalhes da NF.' }));
            tdElement.innerHTML = `<span class="text-danger">Erro ao carregar detalhes: ${errorData.message}</span>`;
            return;
        }

        const detalhesNF = await res.json();
        const dataSaidaFormatada = detalhesNF.dataSaida ? new Date(detalhesNF.dataSaida).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'N/A';
        const dataEntradaFormatada = detalhesNF.dataEntrada ? new Date(detalhesNF.dataEntrada).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'N/A';
        const previsaoRetornoFormatada = detalhesNF.previsaoRetorno ? new Date(detalhesNF.previsaoRetorno).toLocaleDateString('pt-BR') : 'N/A';

        let radiosHtml = `<div class="container-fluid mt-2">
            <h6>Rádios na NF:</h6>
            <div class="row bg-light border-bottom border-top py-1 fw-bold">
                <div class="col-3">Modelo</div>
                <div class="col-3">Nº Série</div>
                <div class="col-2">Patrimônio</div>
                <div class="col-4">Frequência</div>
            </div>`;

        if (detalhesNF.radios && detalhesNF.radios.length > 0) {
            detalhesNF.radios.forEach(r => {
                radiosHtml += `
                    <div class="row py-1 border-bottom">
                        <div class="col-3">${r.modelo || 'N/A'}</div>
                        <div class="col-3">${r.numeroSerie || 'N/A'}</div>
                        <div class="col-2">${r.patrimonio || '-'}</div>
                        <div class="col-4">${r.frequencia || 'N/A'}</div>
                    </div>`;
            });
        } else {
            radiosHtml += `<div class="row py-1"><div class="col-12 text-muted">Nenhum rádio associado a esta NF.</div></div>`;
        }
        radiosHtml += '</div>';

        const observacoesHtml = detalhesNF.observacoes?.length > 0
            ? `<div class="mt-2"><strong>Observações:</strong><p class="ms-2">${Array.isArray(detalhesNF.observacoes) ? detalhesNF.observacoes.join('; ') : detalhesNF.observacoes}</p></div>`
            : '';

        tdElement.innerHTML = `
            <div class="p-2">
                <div class="row">
                    <div class="col-md-6">
                        <p class="mb-1"><strong>Tipo:</strong> ${detalhesNF.tipo || (detalhesNF.dataEntrada ? 'Retorno' : 'Saída')}</p>
                        <p class="mb-1"><strong>Nº NF:</strong> ${detalhesNF.nfNumero || 'N/A'}</p>
                        <p class="mb-1"><strong>Cliente:</strong> ${detalhesNF.cliente || 'N/A'}</p>
                        <p class="mb-1"><strong>Data Saída:</strong> ${dataSaidaFormatada}</p>
                    </div>
                    <div class="col-md-6">
                        ${detalhesNF.tipo === 'Saída' && detalhesNF.previsaoRetorno ? `<p class="mb-1"><strong>Previsão Retorno:</strong> ${previsaoRetornoFormatada}</p>` : ''}
                        ${detalhesNF.dataEntrada ? `<p class="mb-1"><strong>Data Retorno:</strong> ${dataEntradaFormatada}</p>` : ''}
                        <p class="mb-1"><strong>Registrado por:</strong> ${detalhesNF.usuarioRegistro || 'N/A'}</p>
                    </div>
                </div>
                ${radiosHtml}
                ${observacoesHtml}
            </div>`;

    } catch (error) {
        console.error('Erro ao carregar detalhes da movimentação:', error);
        tdElement.innerHTML = '<em>Erro ao carregar detalhes. Tente novamente.</em>';
    }
}

function limparFiltrosExtrato() {
    document.getElementById('filtroNfNumero').value = '';
    document.getElementById('filtroNumeroSerieRadio').value = '';
    document.getElementById('filtroModeloRadio').value = '';
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    aplicarFiltrosExtrato();
}

// NOVA FUNÇÃO PARA IMPRESSÃO
async function imprimirMovimentacao(nfNumero) {
    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('Erro de Autenticação', 'Você não está autenticado para realizar esta ação.', 'danger');
        return;
    }

    const btnImprimirOriginal = document.querySelector(`.btn-imprimir-mov[data-id="${nfNumero}"]`);
    let originalBtnImprimirHTML = '';
    if (btnImprimirOriginal) {
        originalBtnImprimirHTML = btnImprimirOriginal.innerHTML;
        btnImprimirOriginal.disabled = true;
        btnImprimirOriginal.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Preparando...';
    }

    try {
        const res = await fetch(`/nf/${nfNumero}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: `Erro ao buscar detalhes da NF ${nfNumero} para impressão.` }));
            showAlert('Erro ao Imprimir', errorData.message, 'danger');
            if (btnImprimirOriginal) {
                btnImprimirOriginal.disabled = false;
                btnImprimirOriginal.innerHTML = originalBtnImprimirHTML;
            }
            return;
        }

        const nf = await res.json();

        let printWindowContent = `
            <html>
            <head>
                <title>Comprovante: ${nf.nfNumero}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; margin: 20px; color: #333; }
                    .container { width: 90%; margin: auto; }
                    h1, h2 { text-align: center; color: #d9534f; /* Vermelho RadioScan */ }
                    h1 { font-size: 1.8em; margin-bottom: 5px;}
                    h2 { font-size: 1.4em; margin-top: 0; margin-bottom: 20px; }
                    hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
                    .header-info p, .radios-section p, .observacoes-section p { margin: 5px 0; font-size: 0.95em; }
                    .header-info strong, .radios-section strong, .observacoes-section strong { color: #555; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: 600; }
                    
                    .radios-section { margin-top: 25px; }
                    .radios-section h3 { font-size: 1.2em; margin-bottom: 10px; text-align:left; color: #333;}

                    .observacoes-section { margin-top: 25px; }
                    .observacoes-section h3 { font-size: 1.2em; margin-bottom: 5px; text-align:left; color: #333;}
                    .observacoes-section p { white-space: pre-wrap; } /* Para manter quebras de linha das observações */

                    .footer { margin-top: 30px; text-align: center; font-size: 0.8em; color: #777; }
                    .logo-print { display: block; margin: 0 auto 20px auto; max-width: 200px; max-height: 70px; }

                    @media print {
                        body { margin: 1cm; font-size: 10pt; } /* Ajusta margens e tamanho da fonte para impressão */
                        .no-print { display: none; }
                        h1 { font-size: 16pt; }
                        h2 { font-size: 13pt; }
                        h3 { font-size: 11pt; }
                        table { font-size: 9pt; }
                        .container { width: 100%;}
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <img src="https://www.radioscan.com.br/cliente_files/img/empresa/banner-empresa-06.jpg" alt="Logo RadioScan" class="logo-print">
                    <h1>RadioScan Telecomunicações</h1>
                    <h2>Comprovante de Movimentação</h2>
                    <h3>Nota Fiscal: ${nf.nfNumero} (${nf.tipo || (nf.dataEntrada ? 'Retorno de Locação' : 'Saída para Locação')})</h3>
                    <hr>
                    <div class="header-info">
                        <p><strong>Cliente:</strong> ${nf.cliente || 'N/A'}</p>
                        ${nf.dataSaida ? `<p><strong>Data Saída:</strong> ${new Date(nf.dataSaida).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</p>` : ''}
                        ${nf.previsaoRetorno && nf.tipo === 'Saída' ? `<p><strong>Previsão Retorno:</strong> ${new Date(nf.previsaoRetorno).toLocaleDateString('pt-BR')}</p>` : ''}
                        ${nf.dataEntrada ? `<p><strong>Data Retorno:</strong> ${new Date(nf.dataEntrada).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</p>` : ''}
                        <p><strong>Registrado por:</strong> ${nf.usuarioRegistro || 'N/A'}</p>
                    </div>

                    <div class="radios-section">
                        <h3>Rádios na Movimentação</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Modelo</th>
                                    <th>Nº Série</th>
                                    <th>Patrimônio</th>
                                    <th>Frequência</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        if (nf.radios && nf.radios.length > 0) {
            nf.radios.forEach(r => {
                printWindowContent += `
                    <tr>
                        <td>${r.modelo || 'N/A'}</td>
                        <td>${r.numeroSerie || 'N/A'}</td>
                        <td>${r.patrimonio || '-'}</td>
                        <td>${r.frequencia || 'N/A'}</td>
                    </tr>
                `;
            });
        } else {
            printWindowContent += '<tr><td colspan="4" style="text-align:center;">Nenhum rádio associado.</td></tr>';
        }

        printWindowContent += `
                            </tbody>
                        </table>
                    </div>`;

        if (nf.observacoes && nf.observacoes.length > 0) {
            printWindowContent += `
                <div class="observacoes-section">
                    <h3>Observações:</h3>
                    <p>${Array.isArray(nf.observacoes) ? nf.observacoes.join('<br>') : nf.observacoes}</p>
                </div>
            `;
        }
        
        printWindowContent += `
                    <div class="footer">
                        <p>Documento gerado pelo sistema RadioScan em ${new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div> <!-- Fim .container -->
                <script>
                    window.onload = function() {
                        window.print();
                        // Adicionar um pequeno delay antes de fechar pode ajudar em alguns navegadores
                        // setTimeout(function(){ window.close(); }, 500);
                        // Ou deixar que o usuário feche manualmente.
                    }
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'height=700,width=900,scrollbars=yes');
        if (printWindow) {
            printWindow.document.write(printWindowContent);
            printWindow.document.close(); 
        } else {
            showAlert('Erro de Impressão', 'Não foi possível abrir a janela de impressão. Verifique as configurações do seu navegador (bloqueador de pop-ups).', 'warning');
        }

    } catch (error) {
        console.error('Erro ao preparar impressão da NF:', error);
        showAlert('Erro de Impressão', 'Ocorreu um erro ao preparar os dados para impressão.', 'danger');
    } finally {
        if (btnImprimirOriginal) {
            btnImprimirOriginal.disabled = false;
            btnImprimirOriginal.innerHTML = originalBtnImprimirHTML;
        }
    }
}