// js/gerenciar-nf.js (VERSÃO COMPLETA E FORMATADA)

let todasAsNotasFiscais = [];
let detalhesNfModal = null;
let alterarNfModal = null;

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('gerenciar_nf');
        
        detalhesNfModal = new bootstrap.Modal(document.getElementById('modalDetalhesNf'));
        alterarNfModal = new bootstrap.Modal(document.getElementById('modalAlterarNf'));

        carregarNotasFiscais();

        document.getElementById('filtroNfTexto')?.addEventListener('input', aplicarFiltrosNf);
        document.getElementById('filtroNfStatus')?.addEventListener('change', aplicarFiltrosNf);
        document.getElementById('filtroNfDataInicio')?.addEventListener('change', aplicarFiltrosNf);
        document.getElementById('filtroNfDataFim')?.addEventListener('change', aplicarFiltrosNf);
        document.getElementById('btnLimparFiltrosNf')?.addEventListener('click', limparFiltrosNf);
        document.getElementById('formAlterarNf')?.addEventListener('submit', salvarAlteracoesNf);

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
                <h5><i class="bi bi-file-earmark-text text-muted"></i> Dados Gerais</h5>
                <dl class="row mt-3">
                    <dt class="col-sm-4">Número NF</dt><dd class="col-sm-8">${nf.nfNumero}</dd>
                    <dt class="col-sm-4">Tipo</dt><dd class="col-sm-8"><span class="badge ${nf.tipo === 'Saída' ? 'text-bg-primary' : 'text-bg-success'}">${nf.tipo}</span></dd>
                    <dt class="col-sm-4">Status</dt><dd class="col-sm-8"><span class="badge ${nf.statusNF === 'Aberta' ? 'text-bg-warning' : 'text-bg-secondary'}">${nf.statusNF}</span></dd>
                    <dt class="col-sm-4">Data de Emissão</dt><dd class="col-sm-8">${new Date(nf.createdAt).toLocaleDateString('pt-BR')}</dd>
                    <dt class="col-sm-4">Usuário</dt><dd class="col-sm-8">${nf.usuarioRegistro}</dd>
                </dl>
                <h5 class="mt-4"><i class="bi bi-person text-muted"></i> Cliente e Locação</h5>
                <dl class="row mt-3">
                    <dt class="col-sm-4">Cliente</dt><dd class="col-sm-8">${nf.cliente || 'N/A'}</dd>
                    <dt class="col-sm-4">Tipo de Locação</dt><dd class="col-sm-8">${nf.tipoLocacao || 'N/A'}</dd>
                    ${nf.nfNumeroReferencia ? `<dt class="col-sm-4">NF de Saída Ref.</dt><dd class="col-sm-8">${nf.nfNumeroReferencia}</dd>` : ''}
                </dl>
                <h5 class="mt-4"><i class="bi bi-chat-left-text text-muted"></i> Observações</h5>
                <p class="text-muted border-start border-2 ps-3 mt-3">${(nf.observacoes && nf.observacoes.length > 0) ? nf.observacoes.join('<br>') : 'Nenhuma observação.'}</p>
                <h5 class="mt-4"><i class="bi bi-router text-muted"></i> Rádios nesta NF (${nf.radios.length})</h5>
                <table class="table table-sm table-bordered mt-3">
                    <thead><tr><th>Nº de Série</th><th>Modelo</th><th>Patrimônio</th></tr></thead>
                    <tbody>
                        ${nf.radios.map(radio => `<tr><td>${radio.numeroSerie}</td><td>${radio.modelo}</td><td>${radio.patrimonio || 'N/A'}</td></tr>`).join('')}
                    </tbody>
                </table>
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
    printWindow.document.write(`<html><head><title>${titulo}</title><style>body{font-family:Arial,sans-serif;margin:20px}h5{color:#333;border-bottom:1px solid #ccc;padding-bottom:5px;margin-top:20px}dl{display:block}dt{font-weight:bold;float:left;width:150px;clear:left}dd{margin-left:160px;display:block;margin-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background-color:#f2f2f2}.badge{padding:4px 8px;border-radius:4px;font-weight:bold;color:white}.text-bg-primary{background-color:#0d6efd}.text-bg-success{background-color:#198754}.text-bg-warning{background-color:#ffc107;color:black!important}.text-bg-secondary{background-color:#6c757d}</style></head><body><h2>${titulo}</h2>${conteudoParaImprimir}</body></html>`);
    printWindow.document.close();
    printWindow.onload = function() {
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
    if (novoRadioNumeroSerie) {
        body.novoRadioNumeroSerie = novoRadioNumeroSerie;
    }
    if (novaObservacao) {
        body.novaObservacao = novaObservacao;
    }

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
        carregarNotasFiscais(); // Recarrega a tabela para mostrar os dados atualizados

    } catch (error) {
        showAlert('Erro ao Salvar', error.message, 'danger');
    }
}