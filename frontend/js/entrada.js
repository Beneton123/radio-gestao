// frontend/js/entrada.js

const API_BASE_URL = 'http://10.110.120.237:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('entrada');

        document.getElementById('btnBuscarNF').addEventListener('click', buscarNF);
        document.getElementById('formEntrada').addEventListener('submit', handleFormEntradaSubmit);
        
        const dataEntradaInput = document.getElementById('dataEntrada');
        if (dataEntradaInput) {
            dataEntradaInput.valueAsDate = new Date();
        }

    } catch (error) {
        console.error("Erro na inicialização da página de Entrada de Rádios:", error.message);
    }
});

async function buscarNF() {
    const nfNumeroInput = document.getElementById('nfEntrada');
    const nfNumero = nfNumeroInput.value.trim();
    const listaRadiosDiv = document.getElementById('listaRadiosParaRetorno');
    
    listaRadiosDiv.innerHTML = ''; // Limpa buscas anteriores

    if (!nfNumero) {
        showAlert('Campo Vazio', 'Informe o número da NF de Saída para buscar.', 'warning');
        return;
    }

    listaRadiosDiv.innerHTML = '<p class="text-center">Buscando rádios da NF...</p>';

    try {
        const token = localStorage.getItem('token');
         const res = await fetch(`${API_BASE_URL}/notasfiscais/numero/${nfNumero}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (!res.ok) {
            showAlert('Erro ao Buscar', data.message || `NF ${nfNumero} não encontrada.`, 'danger');
            listaRadiosDiv.innerHTML = '';
            return;
        }

        let infoHeader = `
            <hr>
            <h6 class="mb-3 fw-bold">Rádios da NF ${data.nfNumero}</h6>
            <p class="text-muted">
                <strong>Cliente:</strong> ${data.cliente} | 
                <strong>Data de Saída:</strong> ${new Date(data.dataSaida).toLocaleDateString('pt-BR')}
            </p>
        `;

        if (data.retornosParciais && data.retornosParciais.length > 0) {
            let retornosAnterioresHtml = data.retornosParciais.map(retorno => 
                `<li>${retorno.radios.length} rádio(s) retornado(s) em ${new Date(retorno.dataEntrada).toLocaleDateString('pt-BR')}</li>`
            ).join('');
            
            infoHeader += `
                <div class="alert alert-warning">
                    <strong>Atenção:</strong> Já existem devoluções parciais para esta NF.
                    <ul>${retornosAnterioresHtml}</ul>
                </div>
            `;
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
                <li class="list-group-item d-flex justify-content-between align-items-center" data-serie="${radio.numeroSerie}">
                    <div class="form-check">
                        <input class="form-check-input radio-retorno-checkbox" type="checkbox" id="check-${radio.numeroSerie}">
                        <label class="form-check-label" for="check-${radio.numeroSerie}">
                            <strong class="d-block">${radio.numeroSerie}</strong>
                            <small class="text-muted">${radio.modelo} - Patrimônio: ${radio.patrimonio || 'N/A'}</small>
                        </label>
                    </div>
                    <div style="width: 250px;">
                        <select class="form-select status-retorno-select">
                            <option value="Disponível" selected>Retornou OK (Disponível)</option>
                            <option value="Defeituoso">Defeito (Enviar p/ Manutenção)</option>
                        </select>
                    </div>
                </li>
            `;
        });
        radiosHtml += `</ul>`;
        
        listaRadiosDiv.innerHTML = infoHeader + radiosHtml;

    } catch (error) {
        console.error("Erro ao buscar NF:", error);
        showAlert('Erro de Conexão', 'Não foi possível buscar os detalhes da NF.', 'danger');
        listaRadiosDiv.innerHTML = '<p class="text-center text-danger">Falha na busca.</p>';
    }
}

async function handleFormEntradaSubmit(e) {
    e.preventDefault();
    
    const btnSubmit = document.getElementById('btnRegistrarEntrada');
    const nfNumeroSaida = document.getElementById('nfEntrada').value.trim(); // NF de referência
    const nfNumeroEntrada = document.getElementById('nfNumeroEntrada').value.trim(); // NOVO: Campo para o número da NF de Entrada
    const dataEntrada = document.getElementById('dataEntrada').value;
    const observacoes = document.getElementById('observacoes').value.trim().split('\n').filter(Boolean);

    const radios = []; // Nome do array alterado para 'radios' para consistência
    document.querySelectorAll('.radio-retorno-checkbox:checked').forEach(checkbox => {
        const container = checkbox.closest('.list-group-item');
        const numeroSerie = container.dataset.serie;
        
        // --- CORREÇÃO PRINCIPAL APLICADA AQUI ---
        const status = container.querySelector('.status-retorno-select').value;
        radios.push({ numeroSerie, status }); // Mudei de 'statusRetorno' para 'status'
    });

    if (!nfNumeroEntrada || !nfNumeroSaida || !dataEntrada) {
        showAlert('Campos Obrigatórios', 'N° da NF de Entrada, N° da NF de Saída e Data são obrigatórios.', 'warning');
        return;
    }

    if (radios.length === 0) {
        showAlert('Nenhum Rádio Selecionado', 'Você deve selecionar pelo menos um rádio que está retornando.', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Registrando...';

    // Objeto que será enviado para a API
    const corpoDaRequisicao = { 
        nfNumero: nfNumeroEntrada, 
        nfNumeroReferencia: nfNumeroSaida, 
        dataEntrada, 
        observacoes, 
        radios 
    };

    // ADICIONE ESTA LINHA ANTES DO FETCH PARA VER O QUE ESTÁ SENDO ENVIADO
    console.log("DADOS ENVIADOS PARA A API:", JSON.stringify(corpoDaRequisicao, null, 2));

    try {
        const res = await fetch(`${API_BASE_URL}/notasfiscais/entrada`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(corpoDaRequisicao)
        });

        const data = await res.json();

        if (res.ok) {
            showAlert('Sucesso!', data.message || 'Entrada registrada com sucesso.', 'success');
            document.getElementById('formEntrada').reset();
            document.getElementById('listaRadiosParaRetorno').innerHTML = '';
            document.getElementById('dataEntrada').valueAsDate = new Date();
        } else {
            showAlert('Erro ao Registrar', data.message || 'Erro desconhecido.', 'danger');
        }
    } catch (error) {
        console.error('Erro na requisição de entrada:', error);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor.', 'danger');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Registrar Entrada';
    }
}