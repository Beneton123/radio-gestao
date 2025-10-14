// frontend/js/estoque.js

const API_BASE_URL = 'http://10.110.120.237:5000/api';

let todosRadios = []; // Armazena a lista COMPLETA de rádios para popular os filtros de select
let modalEditarPatrimonioInstance = null;
let modalInputNumeroSerieInstance = null;
let nfDetailsModalInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        checkAuthentication('estoque');

        // O debounce agora chama a nova função que busca na API
        document.getElementById('filtroSerie').addEventListener('input', debounce(aplicarFiltro, 300));
        
        // Os outros filtros apenas re-renderizam a tabela com os dados já carregados
        document.getElementById('tipoFiltro').addEventListener('change', aplicarFiltro);
        document.getElementById('subFiltro').addEventListener('change', aplicarFiltro);
        document.getElementById('chkDisponivel').addEventListener('change', aplicarFiltro);
        document.getElementById('chkOcupado').addEventListener('change', aplicarFiltro);
        document.getElementById('chkManutencao').addEventListener('change', aplicarFiltro);
        document.getElementById('chkLocacaoAnual').addEventListener('change', aplicarFiltro);
        document.getElementById('filtroTipoLocacao').addEventListener('change', aplicarFiltro);

        const modalEditarEl = document.getElementById('modalEditarPatrimonio');
        if (modalEditarEl) {
            modalEditarPatrimonioInstance = new bootstrap.Modal(modalEditarEl);
            document.getElementById('btnSalvarPatrimonio').addEventListener('click', salvarNovoPatrimonio);
            modalEditarEl.querySelector('.modal-header').classList.add('bg-primary', 'text-white');
            modalEditarEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');
        }

        const modalInputEl = document.getElementById('modalInputNumeroSerie');
        if (modalInputEl) {
            modalInputNumeroSerieInstance = new bootstrap.Modal(modalInputEl);
            document.getElementById('btnConfirmarInputNumeroSerie').addEventListener('click', handleInputNumeroSerie);
        }

        const nfDetailsModalEl = document.getElementById('nfDetailsModal');
        if (nfDetailsModalEl) {
            nfDetailsModalInstance = new bootstrap.Modal(nfDetailsModalEl);
        }

        document.getElementById('btnEditarPatrimonio').addEventListener('click', () => {
            if (modalInputNumeroSerieInstance) {
                document.getElementById('inputNumeroSerieParaEdicao').value = '';
                modalInputNumeroSerieInstance.show();
                document.getElementById('inputNumeroSerieParaEdicao').focus();
            }
        });
        
        // Carga inicial dos dados
        await carregarRadios();

    } catch (error) {
        console.error("Erro na inicialização da página de Estoque:", error.message);
        showAlert("Erro Crítico", "Não foi possível inicializar a página de estoque.", "danger");
    }
});

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// carregarRadios agora busca TODOS os rádios para popular os filtros uma única vez
async function carregarRadios() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/radios`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
            throw new Error('Falha ao carregar lista completa de rádios.');
        }
        todosRadios = await res.json(); // Salva a lista completa
        popularSubFiltro(); // Popula os selects com base na lista completa
        aplicarFiltro(); // Aplica os filtros (incluindo o de texto, que fará uma nova busca)
    } catch (erro) {
        console.error('Erro na carga inicial de rádios:', erro);
        showAlert('Erro de Conexão', 'Não foi possível carregar os dados iniciais do estoque.', 'danger');
    }
}


function popularSubFiltro() {
    const tipoFiltroValor = document.getElementById('tipoFiltro').value;
    const subFiltroSelect = document.getElementById('subFiltro');
    subFiltroSelect.innerHTML = '';
    subFiltroSelect.disabled = !tipoFiltroValor;
    if (!tipoFiltroValor) {
        subFiltroSelect.innerHTML = '<option value="">Selecione um tipo de filtro</option>';
        return;
    }
    const valoresUnicos = [...new Set(todosRadios.map(r => r[tipoFiltroValor]).filter(Boolean))].sort();
    let optionsHtml = '<option value="">Todos</option>';
    valoresUnicos.forEach(valor => {
        optionsHtml += `<option value="${valor}">${valor}</option>`;
    });
    subFiltroSelect.innerHTML = optionsHtml;
}

// 'aplicarFiltro' agora faz a busca no backend
async function aplicarFiltro() {
    const filtroTexto = document.getElementById('filtroSerie').value; // MANTÉM o '*'
    const tbody = document.getElementById('tabelaRadios');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Buscando...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const url = new URL(`${API_BASE_URL}/radios`);
        if (filtroTexto) {
            url.searchParams.append('search', filtroTexto);
        }

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Falha ao buscar dados no servidor.');
        
        let radiosDoBackend = await res.json();

        // Agora aplicamos os filtros locais (checkboxes, selects) sobre o resultado do backend
        const tipoFiltro = document.getElementById('tipoFiltro').value;
        const subFiltroValor = document.getElementById('subFiltro').value;
        const mostrarDisponivel = document.getElementById('chkDisponivel').checked;
        const mostrarOcupado = document.getElementById('chkOcupado').checked;
        const mostrarManutencao = document.getElementById('chkManutencao').checked;
        const mostrarLocacaoAnual = document.getElementById('chkLocacaoAnual').checked;
        const filtroTipoLocacao = document.getElementById('filtroTipoLocacao')?.value;

        const radiosFiltrados = radiosDoBackend.filter(r => {
            const correspondeSubfiltro = !tipoFiltro || !subFiltroValor || (r[tipoFiltro] === subFiltroValor);
            let correspondeStatus = false;
            if (mostrarDisponivel && r.status === 'Disponível') correspondeStatus = true;
            if (mostrarOcupado && r.status === 'Ocupado' && r.tipoLocacaoAtual !== 'Anual') correspondeStatus = true;
            if (mostrarManutencao && r.status === 'Manutenção') correspondeStatus = true;
            if (mostrarLocacaoAnual && r.status === 'Ocupado' && r.tipoLocacaoAtual === 'Anual') correspondeStatus = true;
            if (!mostrarDisponivel && !mostrarOcupado && !mostrarManutencao && !mostrarLocacaoAnual) correspondeStatus = true;
            const correspondeTipoLocacao = !filtroTipoLocacao || (r.tipoLocacaoAtual === filtroTipoLocacao);
            return correspondeSubfiltro && correspondeStatus && correspondeTipoLocacao;
        });

        renderizarTabela(radiosFiltrados);

    } catch (erro) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">${erro.message}</td></tr>`;
    }
}

// Função de renderização separada
function renderizarTabela(radios) {
    const tbody = document.getElementById('tabelaRadios');
    tbody.innerHTML = '';
    if (radios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum rádio encontrado com os filtros aplicados.</td></tr>';
        return;
    }

    radios.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.modelo || 'N/A'}</td>
            <td>${r.numeroSerie || 'N/A'}</td>
            <td>${r.patrimonio || 'N/A'}</td>
            <td>${r.frequencia || 'N/A'}</td>
            <td></td> 
            <td>${r.nfAtual || '-'}</td>
            <td>${r.tipoLocacaoAtual || 'N/A'}</td>
            <td></td>
        `;

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        let statusBadgeClass = 'bg-secondary';
        let statusText = r.status || 'N/D';
        if (r.status === 'Disponível') statusBadgeClass = 'bg-success';
        else if (r.status === 'Manutenção') statusBadgeClass = 'bg-info';
        else if (r.status === 'Ocupado') {
            if (r.tipoLocacaoAtual === 'Anual') {
                statusBadgeClass = 'bg-warning text-dark';
                statusText = 'Locação Anual';
            } else {
                statusBadgeClass = 'bg-danger';
                statusText = 'Locação Mensal';
            }
        }
        statusBadge.className = `badge ${statusBadgeClass}`;
        statusBadge.textContent = statusText;
        statusCell.appendChild(statusBadge);

        const actionsCell = document.createElement('td');
        if (r.nfAtual) {
            const btnDetalhes = document.createElement('button');
            btnDetalhes.className = 'btn btn-sm btn-danger btn-details-nf';
            btnDetalhes.textContent = 'Detalhes NF';
            btnDetalhes.addEventListener('click', () => fetchNfDetails(r.nfAtual));
            actionsCell.appendChild(btnDetalhes);
        } else {
            actionsCell.textContent = '-';
        }

        tr.children[4].replaceWith(statusCell);
        tr.children[7].replaceWith(actionsCell);
        tbody.appendChild(tr);
    });
}


async function handleInputNumeroSerie() {
    const numeroSerieInput = document.getElementById('inputNumeroSerieParaEdicao');
    const numeroSerie = numeroSerieInput.value.trim();
    if (!numeroSerie) {
        showAlert('Campo Vazio', 'Por favor, informe o número de série do rádio.', 'warning');
        numeroSerieInput.focus();
        return;
    }
    if (modalInputNumeroSerieInstance) modalInputNumeroSerieInstance.hide();
    const radioToEdit = todosRadios.find(r => r.numeroSerie === numeroSerie);
    if (!radioToEdit) {
        showAlert('Rádio Não Encontrado', `Rádio "${numeroSerie}" não encontrado.`, 'danger');
        return;
    }
    document.getElementById('editPatrimonioNumeroSerie').value = radioToEdit.numeroSerie;
    document.getElementById('editPatrimonioAtual').value = radioToEdit.patrimonio || 'N/A';
    document.getElementById('editNovoPatrimonio').value = radioToEdit.patrimonio || '';
    if (modalEditarPatrimonioInstance) {
        modalEditarPatrimonioInstance.show();
        document.getElementById('editNovoPatrimonio').focus();
    }
}

async function salvarNovoPatrimonio() {
    const numeroSerie = document.getElementById('editPatrimonioNumeroSerie').value;
    const novoPatrimonio = document.getElementById('editNovoPatrimonio').value.trim();
    if (!novoPatrimonio) {
        showAlert('Campo Obrigatório', 'O novo patrimônio não pode ser vazio.', 'warning');
        return;
    }
    const btnSalvar = document.getElementById('btnSalvarPatrimonio');
    const originalBtnHtml = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/radios/serial/${numeroSerie}/patrimonio`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ novoPatrimonio })
        });
        const data = await res.json();
        if (res.ok) {
            showAlert('Sucesso', `Patrimônio do rádio ${numeroSerie} atualizado.`, 'success');
            modalEditarPatrimonioInstance.hide();
            await carregarRadios();
        } else {
            showAlert('Erro ao Salvar', data.message || 'Não foi possível atualizar.', 'danger');
        }
    } catch (error) {
        console.error('Erro ao salvar novo patrimônio:', error);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor.', 'danger');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = originalBtnHtml;
    }
}

async function fetchNfDetails(nfNumero) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/notasfiscais/numero/${nfNumero}`, { // Rota correta
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const nf = await response.json();
            displayNfDetailsModal(nf);
        } else {
            const errorData = await response.json();
            showAlert('Erro', errorData.message || `Erro ao carregar detalhes da NF.`, 'danger');
        }
    } catch (error) {
        console.error('Erro de rede ao carregar detalhes da NF:', error);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor.', 'danger');
    }
}

function displayNfDetailsModal(nf) {
    if (!nfDetailsModalInstance) return;
    document.getElementById('modalNfNumero').textContent = nf.nfNumero || 'N/A';
    document.getElementById('modalNfCliente').textContent = nf.cliente || 'N/A';
    document.getElementById('modalNfTipoLocacao').textContent = nf.tipoLocacao || 'N/A';
    document.getElementById('modalNfDataSaida').textContent = nf.dataSaida ? new Date(nf.dataSaida).toLocaleDateString('pt-BR') : 'N/A';
    document.getElementById('modalNfPrevisaoRetorno').textContent = nf.previsaoRetorno ? new Date(nf.previsaoRetorno).toLocaleDateString('pt-BR') : 'N/A';
    document.getElementById('modalNfUsuarioRegistro').textContent = nf.usuarioRegistro || 'N/A';
    document.getElementById('modalNfObservacoes').textContent = (nf.observacoes && nf.observacoes.length > 0) ? nf.observacoes.join(', ') : 'N/A';
    const radiosList = document.getElementById('modalNfRadiosList');
    radiosList.innerHTML = '';
    if (nf.radios && nf.radios.length > 0) {
        nf.radios.forEach(radio => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = `Série: ${radio.numeroSerie} | Modelo: ${radio.modelo || 'N/A'} | Patrimônio: ${radio.patrimonio || 'N/A'}`;
            radiosList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.className = 'list-group-item text-muted';
        li.textContent = 'Nenhum rádio associado.';
        radiosList.appendChild(li);
    }
    nfDetailsModalInstance.show();
}