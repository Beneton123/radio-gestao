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
        const res = await fetch('/nf', {
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
        const movData = mov.dataSaida || mov.dataEntrada;
        const dataMovimentacaoDate = movData ? new Date(movData) : null;

        const correspondeNfNumero = !filtroNfNumero || (mov.nfNumero && mov.nfNumero.toLowerCase().includes(filtroNfNumero));

        const correspondeRadio = !filtroNumeroSerieRadio && !filtroModeloRadio ||
            (Array.isArray(mov.radios) && mov.radios.some(radioSerie => {
                const radioDetail = radiosCadastrados.find(r => r.numeroSerie === radioSerie);
                return (radioSerie.toLowerCase().includes(filtroNumeroSerieRadio) &&
                    (!filtroModeloRadio || (radioDetail?.modelo && radioDetail.modelo.toLowerCase().includes(filtroModeloRadio))));
            }));

        const correspondeDataInicio = !filtroDataInicio || (dataMovimentacaoDate && dataMovimentacaoDate >= new Date(filtroDataInicio));
        const correspondeDataFim = !filtroDataFim || (dataMovimentacaoDate && dataMovimentacaoDate <= new Date(filtroDataFim + 'T23:59:59'));

        return correspondeNfNumero && correspondeRadio && correspondeDataInicio && correspondeDataFim;
    });

    if (movimentacoesFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma movimentação encontrada com os filtros aplicados.</td></tr>';
        return;
    }

    movimentacoesFiltradas.forEach(mov => {
        const tr = document.createElement('tr');
        const dataMovimentacao = mov.dataSaida || mov.dataEntrada;
        const dataFormatada = dataMovimentacao
            ? new Date(dataMovimentacao).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }) : 'N/A';

        const tipoMovimentacao = mov.tipo || (mov.dataEntrada ? 'Retorno' : 'Saída');

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
    console.log('Adicionando evento aos botões de detalhes');
    document.querySelectorAll('.btn-ver-detalhes-mov').forEach(btn => {
        console.log('Botão encontrado:', btn);
        btn.addEventListener('click', function () {
            const nfNumero = this.dataset.nf;
            const detalhesRow = document.getElementById(`detalhes-mov-${nfNumero}`);
            console.log('Clicado:', nfNumero, detalhesRow);
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
            const nfNumero = this.dataset.id;
            imprimirMovimentacao(nfNumero);
        });
    });
}

async function renderDetalhesMovimentacao(nfNumero, tdElement) {
    tdElement.innerHTML = `<em>Carregando detalhes da NF ${nfNumero}...</em>`;
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/nf/${nfNumero}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Erro ao buscar detalhes da NF.' }));
            tdElement.innerHTML = `<span class="text-danger">Erro ao carregar detalhes: ${errorData.message}</span>`;
            return;
        }

        const detalhesNF = await res.json();
        const dataSaidaFormatada = detalhesNF.dataSaida ? new Date(detalhesNF.dataSaida).toLocaleString('pt-BR') : 'N/A';
        const dataEntradaFormatada = detalhesNF.dataEntrada ? new Date(detalhesNF.dataEntrada).toLocaleString('pt-BR') : 'N/A';
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
