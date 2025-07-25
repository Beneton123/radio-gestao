// frontend/js/estoque.js

let todosRadios = []; // Armazena todos os rádios carregados para filtros
// let tiposUnicos = new Set(); // Variável não utilizada, pode ser removida
// let frequenciasUnicas = new Set(); // Variável não utilizada, pode ser removida
let modalEditarPatrimonioInstance = null; // Instância do modal de edição de patrimônio
let modalInputNumeroSerieInstance = null; // Nova instância do modal de input de série

document.addEventListener('DOMContentLoaded', async () => {
    try {
        checkAuthentication('estoque'); // Permissão para 'estoque' ou 'admin'

        // Inicializa os listeners de filtro
        document.getElementById('filtroSerie').addEventListener('input', aplicarFiltro);
        document.getElementById('tipoFiltro').addEventListener('change', () => {
            popularSubFiltro();
            aplicarFiltro();
        });
        document.getElementById('subFiltro').addEventListener('change', aplicarFiltro);
        document.getElementById('chkDisponivel').addEventListener('change', aplicarFiltro);
        document.getElementById('chkOcupado').addEventListener('change', aplicarFiltro);
        document.getElementById('chkManutencao').addEventListener('change', aplicarFiltro);

        // Inicializa o modal de editar patrimônio (já existia)
        const modalEditarEl = document.getElementById('modalEditarPatrimonio');
        if (modalEditarEl) {
            modalEditarPatrimonioInstance = new bootstrap.Modal(modalEditarEl);
            document.getElementById('btnSalvarPatrimonio').addEventListener('click', salvarNovoPatrimonio);
            // Certifica-se de que o cabeçalho do modal de edição de patrimônio tenha a cor correta
            // como a classe bg-primary não estava definida no modal, a adicionamos aqui para consistência.
            modalEditarEl.querySelector('.modal-header').classList.add('bg-primary', 'text-white');
            modalEditarEl.querySelector('.modal-header .btn-close').classList.add('btn-close-white');
        }

        // NOVO: Inicializa o modal de input de número de série
        const modalInputEl = document.getElementById('modalInputNumeroSerie');
        if (modalInputEl) {
            modalInputNumeroSerieInstance = new bootstrap.Modal(modalInputEl);
            document.getElementById('btnConfirmarInputNumeroSerie').addEventListener('click', handleInputNumeroSerie);
        }

        // Listener para o botão "Editar Patrimônio" (AGORA ABRE O NOVO MODAL DE INPUT)
        document.getElementById('btnEditarPatrimonio').addEventListener('click', () => {
            if (modalInputNumeroSerieInstance) {
                document.getElementById('inputNumeroSerieParaEdicao').value = ''; // Limpa o campo de input
                modalInputNumeroSerieInstance.show();
                document.getElementById('inputNumeroSerieParaEdicao').focus(); // Foca no campo de input
            } else {
                showAlert('Erro', 'Modal de entrada de número de série não inicializado corretamente.', 'danger');
            }
        });

        // Carrega os rádios ao carregar a página
        await carregarRadios();

    } catch (error) {
        console.error("Erro na inicialização da página de Estoque:", error.message);
        showAlert("Erro Crítico", "Não foi possível inicializar a página de estoque corretamente. Tente recarregar.", "danger");
    }
});

/**
 * Carrega todos os rádios do backend.
 */
async function carregarRadios() {
    const tabelaRadiosBody = document.querySelector('#tabelaRadios');
    if(tabelaRadiosBody) tabelaRadiosBody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando rádios...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/radios', { // URL Relativa
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Não foi possível obter detalhes do erro.' }));
            showAlert('Erro ao Carregar Estoque', `Falha ao carregar dados do estoque: ${errorData.message || res.statusText}`, 'danger');
            if(tabelaRadiosBody) tabelaRadiosBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Falha ao carregar dados.</td></tr>`;
            return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
            todosRadios = [];
            throw new Error("Formato de dados de rádios inválido.");
        }
        todosRadios = data;
        popularSubFiltro(); // Popula o subfiltro com base nos dados carregados
        aplicarFiltro();     // Aplica o filtro inicial (que pode ser nenhum filtro)

    } catch (erro) {
        console.error('Erro ao carregar rádios:', erro);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para carregar o estoque.', 'danger');
        if(tabelaRadiosBody) tabelaRadiosBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erro de conexão.</td></tr>`;
    }
}

/**
 * Preenche o dropdown de subfiltro com base no tipo de filtro selecionado (Modelo ou Frequência).
 */
function popularSubFiltro() {
    const tipoFiltroValor = document.getElementById('tipoFiltro').value;
    const subFiltroSelect = document.getElementById('subFiltro');

    subFiltroSelect.innerHTML = ''; // Limpa opções antigas
    subFiltroSelect.disabled = !tipoFiltroValor;

    if (!tipoFiltroValor) {
        subFiltroSelect.innerHTML = '<option value="">Selecione um tipo de filtro</option>';
        return;
    }

    // Coleta valores únicos para o tipo de filtro selecionado
    const valoresUnicos = [...new Set(todosRadios.map(r => r[tipoFiltroValor]).filter(Boolean))].sort();

    let optionsHtml = '<option value="">Todos</option>';
    valoresUnicos.forEach(valor => {
        optionsHtml += `<option value="${valor}">${valor}</option>`;
    });
    subFiltroSelect.innerHTML = optionsHtml;
}

/**
 * Aplica todos os filtros selecionados e renderiza a tabela de rádios.
 */
function aplicarFiltro() {
    const filtroTexto = document.getElementById('filtroSerie').value.toLowerCase();
    const tipoFiltro = document.getElementById('tipoFiltro').value;
    const subFiltroValorSelecionado = document.getElementById('subFiltro').value;
    const mostrarDisponivel = document.getElementById('chkDisponivel').checked;
    const mostrarOcupado = document.getElementById('chkOcupado').checked;
    const mostrarManutencao = document.getElementById('chkManutencao').checked;
    const tbody = document.getElementById('tabelaRadios');

    if (!tbody) return;
    tbody.innerHTML = ''; // Limpa a tabela antes de popular

    if (todosRadios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum rádio no estoque de locação.</td></tr>';
        return;
    }

    const radiosFiltrados = todosRadios.filter(r => {
        const correspondeTexto = !filtroTexto ||
            (r.numeroSerie && r.numeroSerie.toLowerCase().includes(filtroTexto)) ||
            (r.modelo && r.modelo.toLowerCase().includes(filtroTexto)) ||
            (r.patrimonio && r.patrimonio.toLowerCase().includes(filtroTexto));

        const correspondeSubfiltro = !tipoFiltro || !subFiltroValorSelecionado || (r[tipoFiltro] && r[tipoFiltro] === subFiltroValorSelecionado);

        let correspondeStatus = false;
        if (mostrarDisponivel && r.status === 'Disponível') correspondeStatus = true;
        if (mostrarOcupado && r.status === 'Ocupado') correspondeStatus = true;
        if (mostrarManutencao && r.status === 'Manutenção') correspondeStatus = true;

        if (!mostrarDisponivel && !mostrarOcupado && !mostrarManutencao) {
            correspondeStatus = true;
        }

        return correspondeTexto && correspondeSubfiltro && correspondeStatus;
    });

    if (radiosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum rádio encontrado com os filtros aplicados.</td></tr>';
        return;
    }

    radiosFiltrados.forEach(r => {
        const tr = document.createElement('tr');

        const tdModelo = document.createElement('td');
        tdModelo.textContent = r.modelo || 'N/A';
        tr.appendChild(tdModelo);

        const tdSerie = document.createElement('td');
        tdSerie.textContent = r.numeroSerie || 'N/A';
        tr.appendChild(tdSerie);

        const tdPatrimonio = document.createElement('td');
        tdPatrimonio.textContent = r.patrimonio || 'N/A';
        tr.appendChild(tdPatrimonio);

        const tdFrequencia = document.createElement('td');
        tdFrequencia.textContent = r.frequencia || 'N/A';
        tr.appendChild(tdFrequencia);

        const tdStatus = document.createElement('td');
        const spanStatus = document.createElement('span');

        let statusBadgeClass = '';
        if (r.status === 'Disponível') {
            statusBadgeClass = 'bg-success';
        } else if (r.status === 'Ocupado') {
            statusBadgeClass = 'bg-danger';
        } else if (r.status === 'Manutenção') {
            statusBadgeClass = 'bg-warning text-dark';
        } else {
            statusBadgeClass = 'bg-secondary';
        }
        spanStatus.className = `badge ${statusBadgeClass}`;
        spanStatus.textContent = r.status || 'N/D';
        tdStatus.appendChild(spanStatus);
        tr.appendChild(tdStatus);

        const tdNfAtual = document.createElement('td');
        tdNfAtual.textContent = r.nfAtual || '-';
        tr.appendChild(tdNfAtual);

        tbody.appendChild(tr);
    });
}

/**
 * Função para lidar com a entrada do número de série no modal de input.
 * Esta função substitui a lógica do prompt().
 */
async function handleInputNumeroSerie() {
    const numeroSerieInput = document.getElementById('inputNumeroSerieParaEdicao');
    const numeroSerie = numeroSerieInput.value.trim();

    if (!numeroSerie) {
        showAlert('Campo Vazio', 'Por favor, informe o número de série do rádio.', 'warning');
        numeroSerieInput.focus(); // Mantém o foco no campo
        return;
    }

    // Fecha o modal de input ANTES de tentar buscar o rádio
    if (modalInputNumeroSerieInstance) {
        modalInputNumeroSerieInstance.hide();
    }

    // Aqui você pode adicionar um spinner ou mensagem de "Buscando..." se a busca for demorada.

    const radioToEdit = todosRadios.find(r => r.numeroSerie === numeroSerie);

    if (!radioToEdit) {
        showAlert('Rádio Não Encontrado', `Rádio com número de série "${numeroSerie}" não encontrado no estoque.`, 'danger');
        return;
    }

    // Preenche e abre o modal de edição de patrimônio
    document.getElementById('editPatrimonioNumeroSerie').value = radioToEdit.numeroSerie;
    document.getElementById('editPatrimonioAtual').value = radioToEdit.patrimonio || 'N/A';
    document.getElementById('editNovoPatrimonio').value = radioToEdit.patrimonio || ''; // Preenche com o atual para facilitar edição

    if (modalEditarPatrimonioInstance) {
        modalEditarPatrimonioInstance.show();
        document.getElementById('editNovoPatrimonio').focus(); // Foca no campo de novo patrimônio
    } else {
        showAlert('Erro', 'Modal de edição de patrimônio não inicializado corretamente.', 'danger');
    }
}

/**
 * Envia a requisição para salvar o novo patrimônio no backend.
 */
async function salvarNovoPatrimonio() {
    const numeroSerie = document.getElementById('editPatrimonioNumeroSerie').value;
    const novoPatrimonio = document.getElementById('editNovoPatrimonio').value.trim();

    if (!novoPatrimonio) {
        showAlert('Campo Obrigatório', 'O novo número de patrimônio não pode ser vazio.', 'warning');
        return;
    }

    // Se o patrimônio atual for "N/A" (quando não tinha um) e o novo estiver vazio, também alerta.
    // ou se o novo for igual ao atual
    const patrimonioAtualExibido = document.getElementById('editPatrimonioAtual').value.trim();
    if (novoPatrimonio === patrimonioAtualExibido || (patrimonioAtualExibido === 'N/A' && novoPatrimonio === '')) {
        showAlert('Sem Alterações', 'O novo patrimônio é o mesmo que o atual ou não foi alterado de N/A.', 'info');
        modalEditarPatrimonioInstance.hide();
        return;
    }

    const btnSalvar = document.getElementById('btnSalvarPatrimonio');
    const originalBtnHtml = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/radios/${numeroSerie}/patrimonio`, {
            method: 'PUT', // Ou PATCH, dependendo da sua API RESTful
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ patrimonio: novoPatrimonio })
        });

        const data = await res.json();

        if (res.ok) {
            showAlert('Sucesso', `Patrimônio do rádio ${numeroSerie} atualizado para ${novoPatrimonio}.`, 'success');
            modalEditarPatrimonioInstance.hide();
            await carregarRadios(); // Recarrega os rádios para atualizar a tabela
        } else {
            showAlert('Erro ao Salvar', data.message || 'Não foi possível atualizar o patrimônio.', 'danger');
        }
    } catch (error) {
        console.error('Erro ao salvar novo patrimônio:', error);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para salvar o patrimônio.', 'danger');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = originalBtnHtml;
    }
}