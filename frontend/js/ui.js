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

    const modalHeader = modalElement.querySelector('#customAlertModalHeader');
    const modalTitle = modalElement.querySelector('#customAlertModalLabel');
    const modalMessage = modalElement.querySelector('#customAlertMessage');
    const modalButton = modalElement.querySelector('.modal-footer .btn-secondary'); // Botão 'OK'

    // Remove classes de tipo anteriores de todos os cabeçalhos de modal, se existirem
    modalHeader.classList.remove('bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-primary');

    // Adiciona a classe de tipo apropriada e define o texto do botão 'OK'
    switch (type) {
        case 'success':
            modalHeader.classList.add('bg-success');
            modalButton.textContent = 'Fechar'; // Ou 'OK'
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