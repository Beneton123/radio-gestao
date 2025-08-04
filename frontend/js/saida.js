// frontend/js/saida.js

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('saida'); // Verifica permissão para 'saida' ou 'admin'

        const formSaida = document.getElementById('formSaida');
        const btnAdicionarRadio = document.getElementById('btnAdicionarRadio');
        const btnConfirmarEnvioNF = document.getElementById('btnConfirmarEnvioNF');

        if (formSaida) {
            formSaida.addEventListener('submit', handleFormSaidaSubmit);
            // Previne Enter de submeter o formulário nos inputs de texto
            formSaida.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.type !== 'submit' && e.target.type !== 'textarea') {
                    e.preventDefault();
                }
            });
            // Configura data de saída padrão para hoje
            const dataSaidaInput = document.getElementById('dataSaida');
            if (dataSaidaInput) {
                dataSaidaInput.valueAsDate = new Date();
            }
        }
        if (btnAdicionarRadio) {
            btnAdicionarRadio.addEventListener('click', adicionarRadioNaTabela);
        }
        if (btnConfirmarEnvioNF) {
            btnConfirmarEnvioNF.addEventListener('click', submeterNFSaida);
        }

    } catch (error) {
        console.error("Erro na inicialização da página NF de Saída:", error.message);
        showAlert('Erro de Inicialização', 'Ocorreu um erro ao carregar a página. Tente novamente mais tarde.', 'danger');
    }
});

const radiosAdicionadosNF = new Set(); // Usar um nome diferente para evitar conflito com outros scripts
let dadosNFParaEnvio = null; // Para armazenar os dados da NF antes de confirmar

/**
 * Exibe um modal de alerta personalizado.
 * @param {string} title - O título do alerta.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success' | 'warning' | 'danger' | 'info'} type - O tipo do alerta (para estilização).
 */
function showAlert(title, message, type) {
    const modalElement = document.getElementById('customAlertModal');
    const modalHeader = document.getElementById('customAlertModalHeader');
    const modalTitle = document.getElementById('customAlertModalLabel');
    const modalMessage = document.getElementById('customAlertMessage');

    // Remove classes de tipo anteriores
    modalHeader.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info');

    // Adiciona a classe de tipo apropriada
    switch (type) {
        case 'success':
            modalHeader.classList.add('bg-success');
            break;
        case 'warning':
            modalHeader.classList.add('bg-warning');
            break;
        case 'danger':
            modalHeader.classList.add('bg-danger');
            break;
        case 'info':
            modalHeader.classList.add('bg-info');
            break;
        default:
            modalHeader.classList.add('bg-primary'); // Default se nenhum tipo for fornecido
            break;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    const customAlertModal = new bootstrap.Modal(modalElement);
    customAlertModal.show();
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
        // !!! MUDANÇA CRÍTICA DE PERFORMANCE: Buscar rádio específico !!!
        const res = await fetch(`/radios/${numeroSerie}`, { // URL Relativa e busca por SÉRIE
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 404) {
                showAlert('Não Encontrado', `Rádio com número de série "${numeroSerie}" não encontrado.`, 'danger');
            } else {
                const errorData = await res.json().catch(() => null);
                showAlert('Erro ao Buscar', `Falha ao buscar rádio: ${errorData ? errorData.message : res.statusText}`, 'danger');
            }
            return;
        }

        const radio = await res.json();

        if (radio.status === 'Ocupado') {
            showAlert('Rádio Ocupado', `O rádio "${numeroSerie}" já está ocupado na NF ${radio.nfAtual || ''}.`, 'warning');
            return;
        }
        if (radio.status !== 'Disponível') { // Exemplo, pode ter outros status como 'Manutenção'
            showAlert('Status Inválido', `O rádio "${numeroSerie}" não está disponível (Status: ${radio.status}).`, 'warning');
            return;
        }


        const tabelaBody = document.querySelector('#tabelaRadiosSaida tbody');
        const tr = document.createElement('tr');
        tr.dataset.numeroSerie = radio.numeroSerie; // Guardar o número de série na linha
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
        radiosAdicionadosNF.add(radio.numeroSerie);
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
    const data = new Date(isoDateString);
    // Checa se a data é válida e se o ano é razoável (ex: não é ano 0001)
    return !isNaN(data.getTime()) && data.toISOString().slice(0,10) === isoDateString && data.getFullYear() > 1900;
}

function handleFormSaidaSubmit(e) {
    e.preventDefault();
    const btnSalvarNF = document.getElementById('btnSalvarNF');

    const nfNumero = document.getElementById('nfNumero').value.trim();
    const cliente = document.getElementById('cliente').value.trim();
    const dataSaida = document.getElementById('dataSaida').value; // Formato YYYY-MM-DD
    const previsaoRetorno = document.getElementById('previsaoRetorno').value; // Formato YYYY-MM-DD

    const radiosParaSair = Array.from(document.querySelectorAll('#tabelaRadiosSaida tbody tr')).map(tr => tr.dataset.numeroSerie);

    if (!nfNumero || !cliente || !dataSaida) {
        showAlert('Campos Obrigatórios', 'Número da NF, Cliente e Data de Saída são obrigatórios.', 'warning');
        return;
    }
    if (radiosParaSair.length === 0) {
        showAlert('Nenhum Rádio', 'Adicione pelo menos um rádio à NF.', 'warning');
        return;
    }

    if (!dataEhValida(dataSaida)) {
        showAlert('Data Inválida', 'A Data de Saída é inválida.', 'warning');
        return;
    }
    const dataSaidaObj = new Date(dataSaida + "T00:00:00"); // Adiciona T00:00:00 para evitar problemas de fuso ao comparar somente data
    const hoje = new Date();
    hoje.setHours(0,0,0,0); // Normaliza 'hoje' para comparar somente datas

    // Permite data de saída no futuro próximo (ex: até 7 dias), mas não muito distante.
    // Ou pode remover essa checagem se quiser permitir datas futuras sem restrição.
    const umaSemanaAposHoje = new Date();
    umaSemanaAposHoje.setDate(hoje.getDate() + 7);

    if (dataSaidaObj > umaSemanaAposHoje) {
        showAlert('Data Futura', 'A Data de Saída não pode ser muito distante no futuro.', 'warning');
        return;
    }
    // A data de saída pode ser hoje ou no passado. A validação de "não pode ser no futuro" do seu código original foi flexibilizada.

    if (previsaoRetorno) {
        if (!dataEhValida(previsaoRetorno)) {
            showAlert('Data Inválida', 'A Data de Previsão de Retorno é inválida.', 'warning');
            return;
        }
        const dataPrevRetornoObj = new Date(previsaoRetorno + "T00:00:00");
        if (dataPrevRetornoObj < dataSaidaObj) {
            showAlert('Datas Inconsistentes', 'A Previsão de Retorno não pode ser anterior à Data de Saída.', 'warning');
            return;
        }
    }

    dadosNFParaEnvio = {
        nfNumero,
        cliente,
        dataSaida, // Envia como YYYY-MM-DD
        previsaoRetorno: previsaoRetorno || null, // Envia como YYYY-MM-DD ou null
        // dataHoraRegistro: new Date().toISOString(), // O backend deve cuidar disso
        radiosSaida: radiosParaSair
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
    const btnSalvarNF = document.getElementById('btnSalvarNF'); // Botão principal do formulário

    if (btnConfirmar) btnConfirmar.disabled = true;
    if (btnSalvarNF) btnSalvarNF.disabled = true; // Desabilita o botão principal também

    const token = localStorage.getItem('token');

    try {
        const res = await fetch('/nf/saida', { // URL Relativa
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dadosNFParaEnvio)
        });

        const data = await res.json(); // Tenta parsear como JSON

        if (res.ok) {
            showAlert('Sucesso!', data.message || 'NF de Saída registrada com sucesso.', 'success');
            document.getElementById('formSaida').reset();
            document.querySelector('#tabelaRadiosSaida tbody').innerHTML = '';
            radiosAdicionadosNF.clear();
            dadosNFParaEnvio = null;
             // Reseta a data de saída para hoje
            const dataSaidaInput = document.getElementById('dataSaida');
            if (dataSaidaInput) dataSaidaInput.valueAsDate = new Date();
        } else {
            showAlert('Erro ao Salvar NF', data.message || 'Não foi possível registrar a NF de Saída.', 'danger');
        }
    } catch (erro) {
        console.error('Erro ao submeter NF de saída:', erro);
        showAlert('Erro de Conexão', 'Falha ao comunicar com o servidor para salvar a NF.', 'danger');
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