// js/gerenciar-nf.js

let todasAsNotasFiscais = [];
let detalhesNfModal = null;
let alterarNfModal = null;
let historicoNfModal = null; // Variável para o modal de histórico
let movimentacoesAtuais = []; // Para guardar o histórico atual para filtragem

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('gerenciar_nf');
        
        detalhesNfModal = new bootstrap.Modal(document.getElementById('modalDetalhesNf'));
        alterarNfModal = new bootstrap.Modal(document.getElementById('modalAlterarNf'));
        historicoNfModal = new bootstrap.Modal(document.getElementById('modalHistoricoNf')); // Inicializa o novo modal

        carregarNotasFiscais();

        // Event Listeners para os filtros da página principal
        document.getElementById('filtroNfTexto')?.addEventListener('input', aplicarFiltrosNf);
        document.getElementById('filtroNfStatus')?.addEventListener('change', aplicarFiltrosNf);
        document.getElementById('filtroNfDataInicio')?.addEventListener('change', aplicarFiltrosNf);
        document.getElementById('filtroNfDataFim')?.addEventListener('change', aplicarFiltrosNf);
        document.getElementById('btnLimparFiltrosNf')?.addEventListener('click', limparFiltrosNf);
        
        // Listener para o formulário de alteração de NF
        document.getElementById('formAlterarNf')?.addEventListener('submit', salvarAlteracoesNf);

        // Listener para o filtro do novo modal de histórico
        document.getElementById('filtroHistoricoSerial')?.addEventListener('input', filtrarHistorico);
        
        // Listener para o botão de histórico no modal de detalhes
        document.getElementById('btnVerHistoricoNf')?.addEventListener('click', () => {
            const nfId = document.getElementById('historicoNfId').value; // Pega o ID guardado
            verHistoricoNf(nfId);
        });

    } catch (error) {
        console.error("Erro na inicialização da página 'Gerenciar NF':", error.message);
    }
});

async function carregarNotasFiscais() {
    const tabela = document.getElementById('tabelaNotasFiscais');
    tabela.innerHTML = '<tr><td colspan="7" class="text-center">Carregando notas fiscais...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/notasfiscais', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Falha ao carregar: ${response.statusText}`);
        }
        todasAsNotasFiscais = await response.json();
        renderizarTabelaNf(todasAsNotasFiscais);
    } catch (error) {
        tabela.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

function renderizarTabelaNf(notas) {
    const tabela = document.getElementById('tabelaNotasFiscais');
    tabela.innerHTML = '';
    if (notas.length === 0) {
        tabela.innerHTML = '<tr><td colspan="7" class="text-center">Nenhuma nota fiscal encontrada.</td></tr>';
        return;
    }
    notas.forEach(nf => {
        const tr = document.createElement('tr');
        tr.className = nf.statusNF === 'Finalizada' ? 'nf-finalizada' : '';
        const dataFormatada = new Date(nf.createdAt).toLocaleDateString('pt-BR');
        const tipoBadge = nf.tipo === 'Saída' ? 'text-bg-primary' : 'text-bg-success';
        const statusBadge = nf.statusNF === 'Aberta' ? 'text-bg-warning' : 'text-bg-secondary';
        tr.innerHTML = `
            <td>${nf.nfNumero}</td>
            <td><span class="badge ${tipoBadge}">${nf.tipo}</span></td>
            <td>${nf.cliente || 'N/A'}</td>
            <td>${dataFormatada}</td>
            <td><span class="badge ${statusBadge}">${nf.statusNF}</span></td>
            <td>${nf.radios.length}</td>
            <td>
                <button class="btn btn-sm btn-outline-info" onclick="verDetalhesNf('${nf._id}')" title="Ver Detalhes"><i class="bi bi-eye"></i></button>
                <button class="btn btn-sm btn-outline-primary" onclick="alterarNf('${nf._id}')" title="Alterar NF"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-outline-warning" onclick="verHistoricoNf('${nf._id}')" title="Ver Histórico"><i class="bi bi-clock-history"></i></button>
            </td>
        `;
        tabela.appendChild(tr);
    });
}

async function verDetalhesNf(id) {
    const modalBody = document.getElementById('detalhesNfBody');
    const modalLabel = document.getElementById('detalhesNfLabel');
    modalLabel.textContent = 'Carregando...';
    modalBody.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-danger" role="status"></div></div>';
    
    // Guarda o ID da NF para o botão de histórico usar
    document.getElementById('historicoNfId').value = id;

    detalhesNfModal.show();
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/notasfiscais/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "Não foi possível carregar os detalhes.");
        }
        const nf = await response.json();
        modalLabel.textContent = `Detalhes da NF ${nf.nfNumero}`;
        
        let detalhesHtml = `
            <div class="p-2">
                <ul class="list-group list-group-flush">
                    <li class="list-group-item"><div class="row"><div class="col-md-4"><small class="text-muted">Cliente</small><p class="fw-bold mb-0">${nf.cliente || 'N/A'}</p></div><div class="col-md-3"><small class="text-muted">Status da NF</small><p class="mb-0"><span class="badge ${nf.statusNF === 'Aberta' ? 'text-bg-warning' : 'text-bg-secondary'}">${nf.statusNF}</span></p></div><div class="col-md-3"><small class="text-muted">Data de Emissão</small><p class="mb-0">${new Date(nf.createdAt).toLocaleDateString('pt-BR')}</p></div><div class="col-md-2"><small class="text-muted">Emitido por</small><p class="mb-0">${nf.usuarioRegistro}</p></div></div></li>
                    <li class="list-group-item"><small class="text-muted">Observações</small><p class="mb-0 fst-italic">${(nf.observacoes && nf.observacoes.length > 0) ? nf.observacoes.join('<br>') : 'Nenhuma observação.'}</p></li>
                </ul>
                <h5 class="mt-4 px-2"><i class="bi bi-router text-muted"></i> Rádios nesta NF (${nf.radios.length})</h5>
                <ul class="list-group mt-3">
                    ${nf.radios.map(radio => {
                        let infoExtra = '';
                        if (radio.foiRetornado) {
                            if (radio.status === 'Manutenção') {
                                infoExtra = `Na OS: <strong>${radio.osAtual || 'Não definida'}</strong>`;
                            } else if (radio.retornoInfo) {
                                infoExtra = `Retornou na NF <strong>${radio.retornoInfo.nfNumero}</strong> em ${radio.retornoInfo.data}`;
                            } else {
                                infoExtra = `Status: ${radio.status}`;
                            }
                        }
                        return `
                        <li class="list-group-item ${radio.foiRetornado ? 'radio-retornado' : ''}">
                            <div class="d-flex w-100 justify-content-between">
                                <div><h6 class="mb-1">${radio.numeroSerie} - ${radio.modelo}</h6><small class="text-muted">Patrimônio: ${radio.patrimonio || 'N/A'}</small></div>
                                <div class="text-end"><small>${radio.foiRetornado ? `<span class="badge text-bg-dark">${radio.status}</span>` : `<span class="badge text-bg-primary">Ocupado</span>`}</small><small class="d-block mt-1">${infoExtra}</small></div>
                            </div>
                        </li>`;
                    }).join('')}
                </ul>
            </div>`;
        
        modalBody.innerHTML = detalhesHtml;
    } catch (error) {
        modalBody.innerHTML = `<p class="text-center text-danger p-4">${error.message}</p>`;
    }
}

function imprimirDetalhesNf() {
    const conteudoParaImprimir = document.getElementById('detalhesNfBody').innerHTML;
    const titulo = document.getElementById('detalhesNfLabel').textContent;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<html><head><title>${titulo}</title><style>body{font-family:Arial,sans-serif;margin:20px}h5{color:#333;border-bottom:1px solid #ccc;padding-bottom:5px;margin-top:20px}ul{padding-left:0;list-style:none}li{margin-bottom:10px}.d-flex{display:flex}.w-100{width:100%}.justify-content-between{justify-content:space-between}.mb-1{margin-bottom:.25rem!important}.text-muted{color:#6c757d!important}.text-end{text-align:right!important}.d-block{display:block!important}.mt-1{margin-top:.25rem!important}.badge{display:inline-block;padding:.35em .65em;font-size:.75em;font-weight:700;line-height:1;color:#fff;text-align:center;white-space:nowrap;vertical-align:baseline;border-radius:.25rem}.text-bg-dark{background-color:#212529!important}.text-bg-primary{background-color:#0d6efd!important}</style></head><body><h2>${titulo}</h2>${conteudoParaImprimir}</body></html>`);
    printWindow.document.close();
    printWindow.onload = function () {
        printWindow.focus();
        printWindow.print();
    };
}

function aplicarFiltrosNf() {
    const filtroTexto = document.getElementById('filtroNfTexto').value.toLowerCase();
    const filtroStatus = document.getElementById('filtroNfStatus').value;
    const filtroDataInicio = document.getElementById('filtroNfDataInicio').value;
    const filtroDataFim = document.getElementById('filtroNfDataFim').value;
    let notasFiltradas = todasAsNotasFiscais;
    if (filtroTexto) {
        notasFiltradas = notasFiltradas.filter(nf =>
            nf.nfNumero.toLowerCase().includes(filtroTexto) ||
            (nf.cliente && nf.cliente.toLowerCase().includes(filtroTexto))
        );
    }
    if (filtroStatus !== 'Todos') {
        notasFiltradas = notasFiltradas.filter(nf => nf.statusNF === filtroStatus);
    }
    if (filtroDataInicio) {
        const dataInicio = new Date(filtroDataInicio + 'T00:00:00');
        notasFiltradas = notasFiltradas.filter(nf => new Date(nf.createdAt) >= dataInicio);
    }
    if (filtroDataFim) {
        const dataFim = new Date(filtroDataFim + 'T23:59:59');
        notasFiltradas = notasFiltradas.filter(nf => new Date(nf.createdAt) <= dataFim);
    }
    renderizarTabelaNf(notasFiltradas);
}

function limparFiltrosNf() {
    document.getElementById('filtroNfTexto').value = '';
    document.getElementById('filtroNfStatus').value = 'Todos';
    document.getElementById('filtroNfDataInicio').value = '';
    document.getElementById('filtroNfDataFim').value = '';
    renderizarTabelaNf(todasAsNotasFiscais);
}

function alterarNf(id) {
    document.getElementById('novoRadioInput').value = '';
    document.getElementById('novaObservacaoInput').value = '';
    document.getElementById('alterarNfId').value = id;
    alterarNfModal.show();
}

async function salvarAlteracoesNf(event) {
    event.preventDefault();
    const id = document.getElementById('alterarNfId').value;
    const novoRadioNumeroSerie = document.getElementById('novoRadioInput').value.trim();
    const novaObservacao = document.getElementById('novaObservacaoInput').value.trim();
    if (!id || (!novoRadioNumeroSerie && !novaObservacao)) {
        return showAlert('Atenção', 'Preencha pelo menos um campo para salvar.', 'warning');
    }
    const body = {};
    if (novoRadioNumeroSerie) body.novoRadioNumeroSerie = novoRadioNumeroSerie;
    if (novaObservacao) body.novaObservacao = novaObservacao;
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/notasfiscais/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message);
        }
        showAlert('Sucesso!', 'Nota Fiscal atualizada com sucesso!', 'success');
        alterarNfModal.hide();
        carregarNotasFiscais();
    } catch (error) {
        showAlert('Erro ao Salvar', error.message, 'danger');
    }
}

// --- NOVAS FUNÇÕES PARA O HISTÓRICO ---

async function verHistoricoNf(nfId) {
    const listaHistorico = document.getElementById('listaHistoricoMovimentacoes');
    const nf = todasAsNotasFiscais.find(n => n._id === nfId);

    document.getElementById('historicoNfLabel').textContent = `Histórico da NF ${nf.nfNumero}`;
    document.getElementById('historicoNfId').value = nfId;
    document.getElementById('filtroHistoricoSerial').value = '';
    listaHistorico.innerHTML = '<li class="list-group-item text-center">Carregando histórico...</li>';
    historicoNfModal.show();

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/notasfiscais/${nfId}/movimentacoes`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message);
        }
        movimentacoesAtuais = await response.json();
        renderizarHistorico(movimentacoesAtuais);

    } catch (error) {
        listaHistorico.innerHTML = `<li class="list-group-item text-center text-danger">${error.message}</li>`;
    }
}

function renderizarHistorico(movimentacoes) {
    const listaHistorico = document.getElementById('listaHistoricoMovimentacoes');
    listaHistorico.innerHTML = '';
    if (movimentacoes.length === 0) {
        listaHistorico.innerHTML = '<li class="list-group-item text-center">Nenhuma movimentação registrada para esta NF.</li>';
        return;
    }

    movimentacoes.forEach(mov => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        const dataFormatada = new Date(mov.data).toLocaleString('pt-BR');
        li.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <p class="mb-1">${mov.descricao}</p>
                <small class="text-muted">${dataFormatada}</small>
            </div>
            <small class="text-muted">Usuário: ${mov.usuarioNome}</small>
        `;
        listaHistorico.appendChild(li);
    });
}

function filtrarHistorico() {
    const termo = document.getElementById('filtroHistoricoSerial').value.toLowerCase();
    if (!termo) {
        renderizarHistorico(movimentacoesAtuais);
        return;
    }
    const filtrado = movimentacoesAtuais.filter(mov => 
        mov.radioNumeroSerie.toLowerCase().includes(termo)
    );
    renderizarHistorico(filtrado);
}