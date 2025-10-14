// frontend/js/entrada.js

// Trava para evitar duplo clique no formulário
let isSubmittingEntrada = false;

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('entrada');
        document.getElementById('btnBuscarNF').addEventListener('click', buscarNF);
        document.getElementById('formEntrada').addEventListener('submit', handleFormEntradaSubmit);
        document.getElementById('dataEntrada').valueAsDate = new Date();

        // --- NOVA LÓGICA PARA O CHECKBOX ---
        const checkAutomatica = document.getElementById('checkNfEntradaAutomatica');
        const campoManual = document.getElementById('campoNfManual');
        const inputNfEntrada = document.getElementById('nfNumeroEntrada');

        checkAutomatica?.addEventListener('change', () => {
            if (checkAutomatica.checked) {
                campoManual.style.display = 'none';
                inputNfEntrada.required = false;
            } else {
                campoManual.style.display = 'block';
                inputNfEntrada.required = true;
            }
        });
        // --- FIM DA NOVA LÓGICA ---

    } catch (error) {
        console.error("Erro na inicialização da página de Entrada de Rádios:", error.message);
    }
});

async function buscarNF() {
    const nfNumero = document.getElementById('nfEntrada').value.trim();
    const listaRadiosDiv = document.getElementById('listaRadiosParaRetorno');
    listaRadiosDiv.innerHTML = '';

    if (!nfNumero) {
        return showAlert('Campo Vazio', 'Informe o número da NF de Saída para buscar.', 'warning');
    }
    listaRadiosDiv.innerHTML = '<p class="text-center">Buscando rádios da NF...</p>';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/notasfiscais/numero/${nfNumero}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            listaRadiosDiv.innerHTML = '';
            return showAlert('Erro ao Buscar', data.message || `NF ${nfNumero} não encontrada.`, 'danger');
        }

        const radiosPendentes = data.radios.filter(radio => !(data.radiosRetornados || []).includes(radio.numeroSerie));

        let radiosHtml = '<p>Selecione os rádios que estão retornando e o status de cada um:</p><ul class="list-group">';
        if (radiosPendentes.length === 0) {
            radiosHtml += '<li class="list-group-item text-success"><i class="bi bi-check-all"></i> Todos os rádios desta NF já foram retornados.</li>';
            document.getElementById('btnRegistrarEntrada').disabled = true;
        } else {
            document.getElementById('btnRegistrarEntrada').disabled = false;
        }

        radiosPendentes.forEach(radio => {
            radiosHtml += `
                <li class="list-group-item" data-serie="${radio.numeroSerie}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="form-check">
                            <input class="form-check-input radio-retorno-checkbox" type="checkbox" id="check-${radio.numeroSerie}">
                            <label class="form-check-label" for="check-${radio.numeroSerie}">
                                <strong class="d-block">${radio.numeroSerie}</strong>
                                <small class="text-muted">${radio.modelo} - Patrimônio: ${radio.patrimonio || 'N/A'}</small>
                            </label>
                        </div>
                        <div style="width: 250px;">
                            <select class="form-select status-retorno-select">
                                <option value="Disponível" selected>Retornou OK</option>
                                <option value="Defeituoso">Com Defeito</option>
                            </select>
                        </div>
                    </div>
                    <div class="mt-2" id="defeito-div-${radio.numeroSerie}" style="display: none;">
                        <input type="text" class="form-control form-control-sm defeito-descricao-input" placeholder="Descreva o defeito aqui...">
                    </div>
                </li>
            `;
        });
        radiosHtml += `</ul>`;
        listaRadiosDiv.innerHTML = radiosHtml;

        // Adiciona o "ouvinte" de evento para cada select de status
        document.querySelectorAll('.status-retorno-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const li = e.target.closest('.list-group-item');
                const numeroSerie = li.dataset.serie;
                const defeitoDiv = document.getElementById(`defeito-div-${numeroSerie}`);
                if (e.target.value === 'Defeituoso') {
                    defeitoDiv.style.display = 'block';
                } else {
                    defeitoDiv.style.display = 'none';
                }
            });
        });

    } catch (error) {
        console.error("Erro ao buscar NF:", error);
        showAlert('Erro de Conexão', 'Não foi possível buscar os detalhes da NF.', 'danger');
        listaRadiosDiv.innerHTML = '<p class="text-center text-danger">Falha na busca.</p>';
    }
}

async function handleFormEntradaSubmit(e) {
    e.preventDefault();
    if (isSubmittingEntrada) return;
    isSubmittingEntrada = true;

    const btnSubmit = document.getElementById('btnRegistrarEntrada');
    const nfNumeroSaida = document.getElementById('nfEntrada').value.trim();
    const dataEntrada = document.getElementById('dataEntrada').value;
    const observacoes = document.getElementById('observacoes').value.trim().split('\n').filter(Boolean);
    
    // Nova lógica para pegar os dados da NF de Entrada
    const isAutomatica = document.getElementById('checkNfEntradaAutomatica').checked;
    const nfNumeroEntradaManual = document.getElementById('nfNumeroEntrada').value.trim();

    const corpoDaRequisicao = {
        tipoNumero: isAutomatica ? 'automatica' : 'manual',
        nfNumero: isAutomatica ? null : nfNumeroEntradaManual, // Envia null se for automático
        nfNumeroReferencia: nfNumeroSaida,
        dataEntrada,
        observacoes,
        radios: []
    };

    let hasError = false;
    document.querySelectorAll('.radio-retorno-checkbox:checked').forEach(checkbox => {
        const container = checkbox.closest('.list-group-item');
        const numeroSerie = container.dataset.serie;
        const status = container.querySelector('.status-retorno-select').value;
        let descricaoProblema = null;
        if (status === 'Defeituoso') {
            descricaoProblema = container.querySelector('.defeito-descricao-input').value.trim();
            if (!descricaoProblema) {
                showAlert('Campo Obrigatório', `Por favor, descreva o defeito do rádio ${numeroSerie}.`, 'warning');
                hasError = true;
            }
        }
        corpoDaRequisicao.radios.push({ numeroSerie, status, descricaoProblema });
    });

    if (hasError) {
        isSubmittingEntrada = false;
        return;
    }
    
    if (!isAutomatica && !nfNumeroEntradaManual) {
        isSubmittingEntrada = false;
        return showAlert('Campo Obrigatório', 'O N° da Sua NF de Entrada é obrigatório no modo manual.', 'warning');
    }

    if (corpoDaRequisicao.radios.length === 0) {
        isSubmittingEntrada = false;
        return showAlert('Nenhum Rádio Selecionado', 'Você deve selecionar pelo menos um rádio que está retornando.', 'warning');
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Registrando...';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/notasfiscais/entrada`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(corpoDaRequisicao)
        });
        const data = await res.json();
        if (res.ok) {
            showAlert('Sucesso!', data.message || 'Entrada registrada com sucesso.', 'success');
            
            corpoDaRequisicao.radios.forEach(radioRetornado => {
                const li = document.querySelector(`li[data-serie="${radioRetornado.numeroSerie}"]`);
                if (li) {
                    li.classList.add('bg-light', 'text-muted');
                    li.querySelector('.form-check-input').disabled = true;
                    li.querySelector('.form-select').disabled = true;
                }
            });

            document.getElementById('nfNumeroEntrada').value = '';
            document.getElementById('checkNfEntradaAutomatica').checked = false;
            document.getElementById('campoNfManual').style.display = 'block';
            document.getElementById('nfNumeroEntrada').required = true;

        } else {
            throw new Error(data.message || 'Erro desconhecido.');
        }
    } catch (error) {
        console.error('Erro na requisição de entrada:', error);
        showAlert('Erro ao Registrar', error.message, 'danger');
    } finally {
        isSubmittingEntrada = false;
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Registrar Entrada';
    }
}