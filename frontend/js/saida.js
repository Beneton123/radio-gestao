// frontend/js/saida.js

// ALTERADO: Adicionada a URL base da API com o seu IP
const API_BASE_URL = 'http://10.110.120.237:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('saida');

        const formSaida = document.getElementById('formSaida');
        const btnAdicionarRadio = document.getElementById('btnAdicionarRadio');
        const btnConfirmarEnvioNF = document.getElementById('btnConfirmarEnvioNF');
        const dataSaidaInput = document.getElementById('dataSaida');

        if (formSaida) {
            formSaida.addEventListener('submit', handleFormSaidaSubmit);
            formSaida.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.type !== 'submit' && e.target.type !== 'textarea') {
                    e.preventDefault();
                }
            });
            if (dataSaidaInput) dataSaidaInput.valueAsDate = new Date();
        }

        if (btnAdicionarRadio) btnAdicionarRadio.addEventListener('click', adicionarRadioNaTabela);
        if (btnConfirmarEnvioNF) btnConfirmarEnvioNF.addEventListener('click', submeterNFSaida);

    } catch (error) {
        console.error("Erro na inicialização da página NF de Saída:", error.message);
        showAlert('Erro de Inicialização', 'Ocorreu um erro ao carregar a página.', 'danger');
    }
});

const radiosAdicionadosNF = new Map();
let dadosNFParaEnvio = null;

function showAlert(title, message, type = 'info') {
    // ... (função showAlert mantida como no original)
}

async function adicionarRadioNaTabela() {
    const numeroSerieInput = document.getElementById('radioSerie');
    const numeroSerie = numeroSerieInput.value.trim();
    const btnAdicionar = document.getElementById('btnAdicionarRadio');

    if (!numeroSerie) {
        showAlert('Campo Vazio', 'Por favor, informe o número de série do rádio.', 'warning');
        return;
    }

    if (radiosAdicionadosNF.has(numeroSerie)) {
        showAlert('Rádio Duplicado', 'Este rádio já foi adicionado à lista.', 'warning');
        numeroSerieInput.value = '';
        return;
    }

    if (btnAdicionar) {
        btnAdicionar.disabled = true;
        btnAdicionar.textContent = 'Buscando...';
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showAlert('Erro de Autenticação', 'Sua sessão expirou. Faça login.', 'danger');
            window.location.href = 'login.html';
            return;
        }

        // ALTERADO: Rota padronizada para buscar rádio por número de série
        const res = await fetch(`${API_BASE_URL}/radios/serial/${numeroSerie}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: res.statusText }));
            showAlert(res.status === 404 ? 'Não Encontrado' : 'Erro ao Buscar', errorData.message, 'danger');
            return;
        }

        const radio = await res.json();

        if (radio.status !== 'Disponível') {
            showAlert('Rádio Indisponível', `O rádio "${numeroSerie}" não está disponível (Status: ${radio.status}).`, 'warning');
            return;
        }

        const tabelaBody = document.querySelector('#tabelaRadiosSaida tbody');
        const tr = document.createElement('tr');
        tr.dataset.numeroSerie = radio.numeroSerie;
        tr.innerHTML = `
            <td>${radio.modelo || 'N/A'}</td>
            <td>${radio.numeroSerie}</td>
            <td>${radio.patrimonio || 'N/A'}</td>
            <td>${radio.frequencia || 'N/A'}</td>
            <td><button type="button" class="btn btn-sm btn-outline-danger btn-remover-radio">Remover</button></td>
        `;

        tr.querySelector('.btn-remover-radio').addEventListener('click', function() {
            radiosAdicionadosNF.delete(radio.numeroSerie);
            this.closest('tr').remove();
        });

        tabelaBody.appendChild(tr);
        radiosAdicionadosNF.set(radio.numeroSerie, radio);
        numeroSerieInput.value = '';
        numeroSerieInput.focus();

    } catch (err) {
        console.error('Erro ao adicionar rádio:', err);
        showAlert('Erro Inesperado', 'Ocorreu um erro ao tentar adicionar o rádio.', 'danger');
    } finally {
        if (btnAdicionar) {
            btnAdicionar.disabled = false;
            btnAdicionar.textContent = 'Adicionar Rádio';
        }
    }
}

function dataEhValida(isoDateString) {
    if (!isoDateString) return false;
    const data = new Date(isoDateString + "T00:00:00");
    return !isNaN(data.getTime());
}

function handleFormSaidaSubmit(e) {
    e.preventDefault();
    const nfNumero = document.getElementById('nfNumero').value.trim();
    const cliente = document.getElementById('cliente').value.trim();
    const dataSaida = document.getElementById('dataSaida').value;
    const previsaoRetorno = document.getElementById('previsaoRetorno').value;
    const tipoLocacao = document.getElementById('tipoLocacao').value;
    const radiosParaSair = Array.from(radiosAdicionadosNF.keys());

    if (!nfNumero || !cliente || !dataSaida || !tipoLocacao) {
        showAlert('Campos Obrigatórios', 'Número da NF, Cliente, Data de Saída e Tipo de Locação são obrigatórios.', 'warning');
        return;
    }
    if (radiosParaSair.length === 0) {
        showAlert('Nenhum Rádio', 'Adicione pelo menos um rádio à NF.', 'warning');
        return;
    }
    // ... (resto da lógica de validação mantida como no original)

    dadosNFParaEnvio = {
        nfNumero, cliente, dataSaida,
        previsaoRetorno: previsaoRetorno || null,
        radios: radiosParaSair,
        tipoLocacao
    };

    const confirmarModal = new bootstrap.Modal(document.getElementById('confirmarSalvarNFModal'));
    confirmarModal.show();
}

async function submeterNFSaida() {
    if (!dadosNFParaEnvio) {
        showAlert('Erro Interno', 'Dados da NF não estão prontos para envio.', 'danger');
        return;
    }
    const btnConfirmar = document.getElementById('btnConfirmarEnvioNF');
    const btnSalvarNF = document.getElementById('btnSalvarNF');
    if (btnConfirmar) btnConfirmar.disabled = true;
    if (btnSalvarNF) btnSalvarNF.disabled = true;

    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('Erro de Autenticação', 'Sua sessão expirou. Faça login novamente.', 'danger');
        window.location.href = 'login.html';
        return;
    }

    try {
        // ALTERADO: Rota padronizada para registrar a saída da NF
        const res = await fetch(`${API_BASE_URL}/notasfiscais/saida`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dadosNFParaEnvio)
        });

        const data = await res.json();

        if (res.ok) {
            showAlert('Sucesso!', data.message || 'NF de Saída registrada com sucesso.', 'success');
            document.getElementById('formSaida').reset();
            document.querySelector('#tabelaRadiosSaida tbody').innerHTML = '';
            radiosAdicionadosNF.clear();
            dadosNFParaEnvio = null;
            const dataSaidaInput = document.getElementById('dataSaida');
            if (dataSaidaInput) dataSaidaInput.valueAsDate = new Date();
        } else {
            showAlert('Erro ao Salvar NF', data.message || 'Não foi possível registrar a NF de Saída.', 'danger');
        }
    } catch (erro) {
        console.error('Erro na requisição de saída de NF:', erro);
        showAlert('Erro de Conexão', 'Falha ao comunicar com o servidor.', 'danger');
    } finally {
        if (btnConfirmar) btnConfirmar.disabled = false;
        if (btnSalvarNF) btnSalvarNF.disabled = false;
        const confirmarModalEl = document.getElementById('confirmarSalvarNFModal');
        if (confirmarModalEl) {
            const modalInstance = bootstrap.Modal.getInstance(confirmarModalEl);
            if (modalInstance) modalInstance.hide();
        }
    }
}