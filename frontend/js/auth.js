// frontend/js/auth.js

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('permissoes');
    localStorage.removeItem('nomeUsuario'); // Se você estiver guardando o nome do usuário
    window.location.href = 'login.html';
}

/**
 * Verifica se o usuário está logado e se tem a permissão necessária para ver a página.
 * @param {string|null} requiredPermission - A permissão exigida (ex: 'admin', 'saida').
 */
function checkAuthentication(requiredPermission = null) {
    const token = localStorage.getItem('token');
    const permissoesRaw = localStorage.getItem('permissoes');

    if (!token) { // Se não tiver token, nem verifica permissoesRaw
        window.location.href = 'login.html';
        throw new Error('Usuário não autenticado. Redirecionando para login.');
    }

    let permissoes = [];
    if (permissoesRaw) {
        try {
            permissoes = JSON.parse(permissoesRaw);
        } catch (e) {
            console.error("Erro ao parsear permissões:", e);
            handleLogout();
            throw new Error('Permissões inválidas. Redirecionando para login.');
        }
    }

    if (requiredPermission && !permissoes.includes(requiredPermission) && !permissoes.includes('admin')) {
        showAlert('Acesso Negado', 'Você não tem permissão para acessar esta página.', 'danger');
        document.body.innerHTML = `<div class="container mt-5"><div class="alert alert-danger"><h1>Acesso Negado</h1><p>Você não tem permissão para acessar esta página. <a href="index.html">Voltar para o início</a>.</p></div></div>`;
        throw new Error('Acesso negado à página.');
    }

    const sidebar = document.getElementById('sidebar');
    const logoutLink = document.getElementById('logout-link');

    // Adiciona link de Admin se o usuário for admin
    if (permissoes.includes('admin')) {
        if (sidebar && logoutLink && !sidebar.querySelector('a[href="admin.html"]')) {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin.html';
            adminLink.innerHTML = '⚙️ Administração';
            sidebar.insertBefore(adminLink, logoutLink);
        }
    }

    // Adiciona link de Manutenção se o usuário tiver a permissão 'gerenciar_manutencao' ou for 'admin'
    if (permissoes.includes('gerenciar_manutencao') || permissoes.includes('admin')) {
        if (sidebar && logoutLink && !sidebar.querySelector('a[href="manutencao_dashboard.html"]')) {
            const manutencaoLink = document.createElement('a');
            manutencaoLink.href = 'manutencao_dashboard.html';
            manutencaoLink.innerHTML = '🔧 Manutenção';

            // --- INÍCIO DA CORREÇÃO: Lógica para inserir o link ---
            const adminLinkElement = sidebar.querySelector('a[href="admin.html"]');
            if (adminLinkElement && adminLinkElement.nextSibling) {
                // Insere depois do link de admin, se ele existir
                sidebar.insertBefore(manutencaoLink, adminLinkElement.nextSibling);
            } else {
                // Caso contrário, insere antes do link de logout
                sidebar.insertBefore(manutencaoLink, logoutLink);
            }
            // --- FIM DA CORREÇÃO ---
        }
    }

    const logoutButton = document.getElementById('logout-link');
    if (logoutButton) {
        const newLogoutButton = logoutButton.cloneNode(true);
        logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);
        
        newLogoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            showConfirmation('Sair do Sistema', 'Deseja realmente sair?', () => {
                handleLogout();
            });
        });
    }
}