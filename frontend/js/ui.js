// frontend/js/ui.js

// Variável global para a instância do modal de alerta, criada apenas uma vez.
let customAlertModalInstance = null;

/**
 * Exibe um modal de alerta personalizado.
 * @param {string} title - O título do alerta.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success' | 'warning' | 'danger' | 'info' | 'primary'} type - O tipo do alerta (para estilização).
 */
function showAlert(title, message, type = 'info') {
    const modalElement = document.getElementById('customAlertModal');
    if (!modalElement) {
        console.error("Elemento modal '#customAlertModal' não encontrado. Verifique seu HTML.");
        alert(`${title}: ${message}`);
        return;
    }

    // Cria a instância do modal apenas se ela ainda não existir.
    // Isso resolve o problema de sobreposição de modais.
    if (!customAlertModalInstance) {
        customAlertModalInstance = new bootstrap.Modal(modalElement);
    }

    const modalHeader = document.getElementById('customAlertModalHeader');
    const modalTitle = document.getElementById('customAlertModalLabel');
    const modalMessage = document.getElementById('customAlertMessage');

    if (!modalHeader || !modalTitle || !modalMessage) {
        console.error("Elementos internos do modal de alerta não foram encontrados. Verifique os IDs #customAlertModalHeader, #customAlertModalLabel e #customAlertMessage no seu HTML.");
        alert(`${title}: ${message}`);
        return;
    }

    // Remove classes de cor anteriores do cabeçalho
    const bootstrapBgClasses = ['bg-success', 'bg-warning', 'bg-danger', 'bg-info', 'bg-primary', 'bg-secondary', 'bg-custom-danger'];
    modalHeader.classList.remove(...bootstrapBgClasses);

    // Adiciona a classe de cor apropriada
    // Usando 'bg-custom-danger' para 'danger' para manter a identidade visual do seu site.
    switch (type) {
        case 'success':
            modalHeader.classList.add('bg-success');
            break;
        case 'warning':
            modalHeader.classList.add('bg-warning');
            break;
        case 'danger':
            modalHeader.classList.add('bg-custom-danger'); // Usando sua classe personalizada
            break;
        case 'info':
            modalHeader.classList.add('bg-info');
            break;
        case 'primary':
            modalHeader.classList.add('bg-primary');
            break;
        default:
            modalHeader.classList.add('bg-secondary');
            break;
    }

    // Define o título e a mensagem usando os IDs corretos
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Mostra o modal usando a instância única
    customAlertModalInstance.show();
}

/**
 * Exibe uma confirmação antes de executar uma ação.
 * (Esta função usa o confirm nativo, mas seu `manutencao_dashboard.js` já tem uma versão melhor com modal Bootstrap)
 * @param {string} title - O título da confirmação.
 * @param {string} message - A pergunta de confirmação.
 * @param {function} onConfirm - A função a ser executada se o usuário clicar em "Confirmar".
 */
function showConfirmation(title, message, onConfirm) {
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

// Chama a função de logout quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', setupLogout);