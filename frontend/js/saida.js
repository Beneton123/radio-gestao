// frontend/js/saida.js

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Assume que checkAuthentication está definido em auth.js
        if (typeof checkAuthentication === 'function') {
            checkAuthentication('saida'); // Verifica permissão para 'saida' ou 'admin'
        } else {
            console.warn("checkAuthentication não está definida. Verifique se auth.js está carregado corretamente.");
            // Opcional: redirecionar ou mostrar alerta se a autenticação for crítica
            // window.location.href = 'login.html'; 
        }

        const formSaida = document.getElementById('formSaida');
        const btnAdicionarRadio = document.getElementById('btnAdicionarRadio');
        const btnConfirmarEnvioNF = document.getElementById('btnConfirmarEnvioNF');
        const dataSaidaInput = document.getElementById('dataSaida');

        if (formSaida) {
            formSaida.addEventListener('submit', handleFormSaidaSubmit);
            // Previne Enter de submeter o formulário nos inputs de texto
            formSaida.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.type !== 'submit' && e.target.type !== 'textarea') {
                    e.preventDefault();
                }
            });
            // Configura data de saída padrão para hoje
            if (dataSaidaInput) {
                dataSaidaInput.valueAsDate = new Date();
            }
        } else {
            console.error("Elemento '#formSaida' não encontrado. Verifique seu HTML.");
        }

        if (btnAdicionarRadio) {
            btnAdicionarRadio.addEventListener('click', adicionarRadioNaTabela);
        } else {
            console.error("Elemento '#btnAdicionarRadio' não encontrado. Verifique seu HTML.");
        }

        if (btnConfirmarEnvioNF) {
            btnConfirmarEnvioNF.addEventListener('click', submeterNFSaida);
        } else {
            console.error("Elemento '#btnConfirmarEnvioNF' não encontrado. Verifique seu HTML.");
        }

    } catch (error) {
        console.error("Erro na inicialização da página NF de Saída:", error.message, error.stack);
        // Garante que showAlert é chamado mesmo que haja um erro crítico na inicialização
        if (typeof showAlert === 'function') {
            showAlert('Erro de Inicialização', 'Ocorreu um erro ao carregar a página. Tente novamente mais tarde.', 'danger');
        } else {
            alert('Erro de Inicialização: Ocorreu um erro ao carregar a página. Tente novamente mais tarde.');
        }
    }
});

// Usar um Map para armazenar rádios para fácil busca e deleção, e para armazenar objetos completos
const radiosAdicionadosNF = new Map(); // Key: numeroSerie, Value: objeto completo do rádio
let dadosNFParaEnvio = null; // Para armazenar os dados da NF antes de confirmar

/**
 * Exibe um modal de alerta personalizado.
 * Esta função deve estar disponível globalmente ou no mesmo escopo.
 * Ela também pode estar no seu ui.js, se for usada em várias páginas.
 * @param {string} title - O título do alerta.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success' | 'warning' | 'danger' | 'info' | 'primary'} type - O tipo do alerta (para estilização).
 */
function showAlert(title, message, type = 'info') {
    const modalElement = document.getElementById('customAlertModal');
    if (!modalElement) {
        console.error("Elemento modal '#customAlertModal' não encontrado. Verifique seu HTML.");
        alert(`${title}: ${message}`); // Fallback
        return;
    }

    const modalHeader = modalElement.querySelector('#customAlertModalHeader');
    const modalTitle = modalElement.querySelector('#customAlertModalLabel');
    const modalMessage = modalElement.querySelector('#customAlertMessage');
    const modalButton = modalElement.querySelector('.modal-footer .btn-secondary'); // Botão 'OK'

    // Remove classes de tipo anteriores
    modalHeader.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-primary');

    // Adiciona a classe de tipo apropriada e define o texto do botão 'OK'
    switch (type) {
        case 'success':
            modalHeader.classList.add('bg-success');
            modalButton.textContent = 'Fechar';
            break;
        case 'warning':
            modalHeader.classList.add('bg-warning');
            modalButton.textContent = 'Entendi';
            break;
        case 'danger':
            modalHeader.classList.add('bg-danger');
            modalButton.textContent = 'OK';
            break;
        case 'info':
            modalHeader.classList.add('bg-info');
            modalButton.textContent = 'Certo';
            break;
        case 'primary':
            modalHeader.classList.add('bg-primary');
            modalButton.textContent = 'Ok';
            break;
        default:
            modalHeader.classList.add('bg-secondary'); // Um tipo padrão neutro
            modalButton.textContent = 'Fechar';
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
        if (!token) {
            showAlert('Erro de Autenticação', 'Você não está logado. Por favor, faça login novamente.', 'danger');
            window.location.href = 'login.html'; // Redireciona para o login
            return;
        }

        const res = await fetch(`/radios/${numeroSerie}`, { // URL Relativa e busca por SÉRIE
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            if (res.status === 404) {
                showAlert('Não Encontrado', `Rádio com número de série "${numeroSerie}" não encontrado.`, 'danger');
            } else {
                const errorData = await res.json().catch(() => ({ message: res.statusText }));
                showAlert('Erro ao Buscar', `Falha ao buscar rádio: ${errorData.message}`, 'danger');
            }
            return;
        }

        const radio = await res.json();

        // Removi a condição `radio.status === 'Ocupado'` para não duplicar, já que `!Disponível` cobre isso
        if (radio.status !== 'Disponível') {
            showAlert('Rádio Indisponível', `O rádio "${numeroSerie}" não está disponível para locação (Status: ${radio.status}).`, 'warning');
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
        radiosAdicionadosNF.set(radio.numeroSerie, radio); // Adiciona o objeto rádio completo ao Map
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
    const data = new Date(isoDateString + "T00:00:00"); // Adiciona T00:00:00 para evitar problemas de fuso
    return !isNaN(data.getTime()) && data.toISOString().slice(0, 10) === isoDateString && data.getFullYear() > 1900;
}

function handleFormSaidaSubmit(e) {
    e.preventDefault();
    const btnSalvarNF = document.getElementById('btnSalvarNF');

    const nfNumero = document.getElementById('nfNumero').value.trim();
    const cliente = document.getElementById('cliente').value.trim();
    const dataSaida = document.getElementById('dataSaida').value; // Formato YYYY-MM-DD
    const previsaoRetorno = document.getElementById('previsaoRetorno').value; // Formato YYYY-MM-DD
    const tipoLocacao = document.getElementById('tipoLocacao').value; // NOVO: Captura o tipo de locação

    // Pega os números de série de todos os rádios na tabela
    const radiosParaSair = Array.from(document.querySelectorAll('#tabelaRadiosSaida tbody tr')).map(tr => tr.dataset.numeroSerie);

    if (!nfNumero || !cliente || !dataSaida || !tipoLocacao) {
        showAlert('Campos Obrigatórios', 'Número da NF, Cliente, Data de Saída e Tipo de Locação são obrigatórios.', 'warning');
        return;
    }

    // Valida se o tipoLocacao é um dos valores esperados, e não o "Selecione..." com value=""
    if (tipoLocacao === "") {
        showAlert('Campo Inválido', 'Por favor, selecione um Tipo de Locação válido (Mensal ou Anual).', 'warning');
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
    const dataSaidaObj = new Date(dataSaida + "T00:00:00");
    const hoje = new Date();
    hoje.setHours(0,0,0,0); // Normaliza 'hoje' para comparar somente datas

    // Regra: Data de Saída pode ser hoje ou no passado, mas não muito no futuro.
    // Exemplo: Permitir até 7 dias no futuro.
    const seteDiasNoFuturo = new Date();
    seteDiasNoFuturo.setDate(hoje.getDate() + 7);
    seteDiasNoFuturo.setHours(0,0,0,0);

    if (dataSaidaObj > seteDiasNoFuturo) {
        showAlert('Data Futura', 'A Data de Saída não pode ser mais de 7 dias no futuro.', 'warning');
        return;
    }

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
        dataSaida,
        previsaoRetorno: previsaoRetorno || null, // Envia null se vazio
        radios: radiosParaSair,
        tipoLocacao // INCLUÍDO NO PAYLOAD
        // observacoes: [] // Adicione observações se houver um campo para isso
    };

    const confirmarModal = new bootstrap.Modal(document.getElementById('confirmarSalvarNFModal'));
    confirmarModal.show();
}

async function submeterNFSaida() {
    if (!dadosNFParaEnvio) {
        showAlert('Erro Interno', 'Dados da NF não estão prontos para envio. Tente novamente.', 'danger');
        return;
    }
    const btnConfirmar = document.getElementById('btnConfirmarEnvioNF');
    const btnSalvarNF = document.getElementById('btnSalvarNF'); // Botão principal do formulário

    // Desabilita botões para evitar envios múltiplos
    if (btnConfirmar) btnConfirmar.disabled = true;
    if (btnSalvarNF) btnSalvarNF.disabled = true;

    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('Erro de Autenticação', 'Sua sessão expirou. Por favor, faça login novamente.', 'danger');
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch('/nf/saida', { // URL Relativa (assumindo que o frontend é servido do mesmo domínio do backend)
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dadosNFParaEnvio)
        });

        // Tenta parsear a resposta como JSON. Mesmo em erro, o servidor pode enviar JSON.
        const data = await res.json().catch(() => ({ message: `Erro desconhecido: Status ${res.status}` }));

        if (res.ok) {
            showAlert('Sucesso!', data.message || 'NF de Saída registrada com sucesso.', 'success');
            // Limpa o formulário e o estado local
            document.getElementById('formSaida').reset();
            document.querySelector('#tabelaRadiosSaida tbody').innerHTML = '';
            radiosAdicionadosNF.clear();
            dadosNFParaEnvio = null;
            // Reseta a data de saída para hoje após sucesso
            const dataSaidaInput = document.getElementById('dataSaida');
            if (dataSaidaInput) dataSaidaInput.valueAsDate = new Date();
        } else {
            // Se houver mensagem de erro do backend, use-a. Caso contrário, uma genérica.
            showAlert('Erro ao Salvar NF', data.message || 'Não foi possível registrar a NF de Saída.', 'danger');
        }
    } catch (erro) {
        console.error('Erro na requisição de saída de NF:', erro);
        showAlert('Erro de Conexão', 'Falha ao comunicar com o servidor para salvar a NF. Verifique sua rede.', 'danger');
    } finally {
        // Habilita os botões novamente e fecha o modal de confirmação
        if (btnConfirmar) btnConfirmar.disabled = false;
        if (btnSalvarNF) btnSalvarNF.disabled = false;
        const confirmarModalEl = document.getElementById('confirmarSalvarNFModal');
        if (confirmarModalEl) {
            const modalInstance = bootstrap.Modal.getInstance(confirmarModalEl);
            if (modalInstance) modalInstance.hide();
        }
    }
}

// **Função de Logout (geralmente em auth.js, mas incluída para completude)**
// Certifique-se que esta lógica está em auth.js e que auth.js é carregado ANTES de saida.js
document.addEventListener('DOMContentLoaded', () => {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('userPermissions');
            localStorage.removeItem('userName');
            window.location.href = 'login.html'; // Redireciona para a página de login
        });
    }
});