// frontend/js/ui.js

/**
 * Exibe um modal de alerta personalizado.
 * @param {string} title - O título do alerta.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success' | 'warning' | 'danger' | 'info' | 'primary'} type - O tipo do alerta (para estilização).
 */
function showAlert(title, message, type = 'info') { // 'info' como padrão, pode ser 'danger' se preferir
    const modalElement = document.getElementById('customAlertModal');
    if (!modalElement) {
        console.error("Elemento modal '#customAlertModal' não encontrado. Verifique seu HTML.");
        // Fallback para alert() nativo se o modal não for encontrado,
        // mas o ideal é que o modal HTML esteja sempre presente.
        alert(`${title}: ${message}`);
        return;
    }

    // AQUI OCORREU UM PEQUENO PROBLEMA DE ESTRUTURA NO SEU HTML/MODAL
    // O modal que configurei anteriormente para o admin.html tem apenas `modal-header`, `modal-body` e `modal-footer`.
    // Não há um #customAlertModalHeader separado.
    // O ideal é que o 'bg-success', 'bg-warning' etc., sejam aplicados no .modal-header diretamente.
    // E a mensagem principal no .modal-body, não num #customAlertMessage.

    const modalHeader = modalElement.querySelector('.modal-header'); // Seleciona o modal-header padrão
    const modalTitle = modalElement.querySelector('#customAlertModalLabel'); // Onde vai o título
    const modalBody = modalElement.querySelector('.modal-body'); // Onde vai a mensagem principal
    const modalButton = modalElement.querySelector('.modal-footer .btn-secondary'); // Botão 'OK'

    if (!modalHeader || !modalTitle || !modalBody || !modalButton) {
        console.error("Elementos internos do modal de alerta não encontrados. Verifique a estrutura do #customAlertModal no seu HTML.");
        alert(`${title}: ${message}`);
        return;
    }

    // Remove classes de tipo anteriores de todos os cabeçalhos de modal, se existirem
    // Itere sobre as classes existentes do Bootstrap para remover
    const bootstrapBgClasses = ['bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-primary', 'bg-secondary'];
    modalHeader.classList.remove(...bootstrapBgClasses);

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
    // Aqui, a mensagem vai diretamente no corpo do modal
    modalBody.innerHTML = `<div class="alert alert-${type} m-0" role="alert">${message}</div>`;

    const customAlertModal = new bootstrap.Modal(modalElement);
    customAlertModal.show();
}

/**
 * Exibe uma confirmação antes de executar uma ação.
 * @param {string} title - O título da confirmação.
 * @param {string} message - A pergunta de confirmação.
 * @param {function} onConfirm - A função a ser executada se o usuário clicar em "Confirmar".
 */
function showConfirmation(title, message, onConfirm) {
    // Para usar um modal Bootstrap para confirmação, você precisaria de outro modal HTML
    // (ex: #customConfirmationModal) e lógica similar a showAlert.
    // Por enquanto, manteremos o confirm() nativo para esta função, mas saiba que pode ser melhorado.
    if (confirm(title + "\n" + message)) {
        if (typeof onConfirm === 'function') {
            onConfirm();
        }
    }
}

/**
 * Configura o comportamento de logout para o link de saída.
 */
function setupLogout() {
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            // Redireciona para a página de login
            window.location.href = 'login.html'; 
        });
    } else {
        console.warn("Elemento com ID 'logout-link' não encontrado para configurar o logout.");
    }
}

// Opcional: Se quiser que setupLogout seja chamado automaticamente ao carregar ui.js
// document.addEventListener('DOMContentLoaded', setupLogout);