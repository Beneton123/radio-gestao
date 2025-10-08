/**
 * Faz o logout do usuário, limpando o armazenamento local e redirecionando para a página de login.
 */
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario'); // Garante que o usuário antigo seja removido
    window.location.href = 'login.html';
}

function setupLogoutLink() {
    const logoutButton = document.getElementById('logout-link');

    if (logoutButton) {
        
        const newLogoutButton = logoutButton.cloneNode(true);
        logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);

        newLogoutButton.addEventListener('click', (e) => {
            e.preventDefault(); 

            
            if (confirm('Deseja realmente sair?')) {
                
                handleLogout();
            }
        });
    }
}

/**
 * Verifica a autenticação, controla o acesso à página e ajusta a visibilidade da barra lateral.
 * @param {string|null} requiredPermission - A permissão necessária para a página atual.
 */
function checkAuthentication(requiredPermission = null) {
    console.clear(); // Limpa o console para facilitar a leitura
    console.log("--- INICIANDO CHECKAUTHENTICATION ---");

    const token = localStorage.getItem('token');
    const usuarioJSON = localStorage.getItem('usuario');

    if (!token || !usuarioJSON) {
        handleLogout();
        throw new Error('Usuário não autenticado.');
    }

    let usuario;
    try {
        usuario = JSON.parse(usuarioJSON);
        if (!usuario || !Array.isArray(usuario.permissoes)) {
            throw new Error('Formato de permissões inválido nos dados do usuário.');
        }
    } catch (e) {
        console.error("Erro ao ler dados do usuário do localStorage:", e);
        handleLogout();
        throw new Error('Dados de usuário corrompidos.');
    }

    // --- INÍCIO DO DEBUG ---
    console.log("Permissão REQUERIDA para esta página:", requiredPermission);
    console.log("Permissões que o USUÁRIO POSSUI (do localStorage):", usuario.permissoes);

    const userPermissions = usuario.permissoes;
    const isAdmin = userPermissions.includes('admin');
    
    // Vamos testar a condição principal
    const temPermissao = userPermissions.includes(requiredPermission);
    console.log(`O usuário TEM a permissão '${requiredPermission}'?`, temPermissao);
    console.log("O usuário é Admin?", isAdmin);
    // --- FIM DO DEBUG ---

    // 1. VERIFICAÇÃO DE ACESSO À PÁGINA ATUAL
    if (requiredPermission && !temPermissao && !isAdmin) {
        console.error("ACESSO NEGADO! O usuário não tem a permissão necessária e não é admin.");
        document.body.innerHTML = `
            <div class="container mt-5">
                <div class="alert alert-danger text-center">
                    <h1>Acesso Negado</h1>
                    <p>Você não tem permissão para acessar esta página.</p>
                    <a href="index.html" class="btn btn-primary mt-3">Voltar para o Início</a>
                </div>
            </div>`;
        throw new Error('Acesso negado à página.');
    }

    console.log("ACESSO PERMITIDO!");

    // 2. CONTROLE DE VISIBILIDADE DA BARRA LATERAL (SIDEBAR)
    // ... (o resto da sua função continua exatamente igual)
    const sidebar = document.getElementById('sidebar');
     if (sidebar) {
         const permissionMap = {
             'admin.html': 'admin',
             'registrar.html': 'registrar',
             'excluir.html': 'excluir',
             'estoque.html': 'estoque',
             'solicitar_manutencao.html': 'solicitar_manutencao',
             'manutencao_dashboard.html': 'manutencao_dashboard',
             'saida.html': 'saida',
             'entrada.html': 'entrada',
             'extrato.html': 'extrato',
             'historico.html': 'historico',
             'gerenciar-nf.html': 'gerenciar_nf'
         };

         sidebar.querySelectorAll('a').forEach(link => {
             const href = link.getAttribute('href');
             const permissionNeeded = permissionMap[href];

             if (permissionNeeded) {
                 if (!isAdmin && !userPermissions.includes(permissionNeeded)) {
                     link.style.display = 'none';
                 } else {
                     link.style.display = '';
                 }
             }
         });
     }
    
    // 3. CONFIGURA O BOTÃO DE LOGOUT
    setupLogoutLink();
    console.log("--- FIM CHECKAUTHENTICATION ---");
}