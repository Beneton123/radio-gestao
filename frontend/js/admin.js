// frontend/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Acesso restrito a administradores
        checkAuthentication('admin'); 
        
        // Adiciona o 'active' manualmente se o link de admin foi criado por auth.js
        const adminLinkSidebar = document.querySelector('.sidebar a[href="admin.html"]');
        if (adminLinkSidebar) {
            adminLinkSidebar.classList.add('active');
        }


        const formCadastroUsuario = document.getElementById('formCadastroUsuario');
        if (formCadastroUsuario) {
            formCadastroUsuario.addEventListener('submit', handleCadastroUsuarioSubmit);
        }

        carregarUsuarios(); // Carrega a lista de usuários ao iniciar
    } catch (error) {
        console.error("Erro na inicialização da página de Administração:", error.message);
        // Se checkAuthentication falhar, o corpo da página já foi alterado para 'Acesso Negado'.
    }
});

// Token é globalmente acessível via localStorage, headers são montados por função
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function carregarUsuarios() {
    const tbody = document.querySelector('#tabelaUsuarios tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando usuários...</td></tr>';

    try {
        const res = await fetch('/usuarios', { headers: getAuthHeaders() }); // URL Relativa
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({message: "Erro ao buscar usuários."}));
            showAlert('Erro ao Carregar', errorData.message, 'danger');
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${errorData.message}</td></tr>`;
            return;
        }
        const usuarios = await res.json();
        tbody.innerHTML = ''; // Limpa o 'Carregando...'

        if (usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum usuário cadastrado.</td></tr>';
            return;
        }

        usuarios.forEach(user => {
            const tr = document.createElement('tr');
            tr.id = `user-row-${user.email.replace(/[@.]/g, '-')}`; // ID para fácil remoção da UI

            const tdNome = document.createElement('td');
            tdNome.textContent = user.nome;
            tr.appendChild(tdNome);

            const tdEmail = document.createElement('td');
            tdEmail.textContent = user.email;
            tr.appendChild(tdEmail);

            const tdPermissoes = document.createElement('td');
            tdPermissoes.textContent = Array.isArray(user.permissoes) ? user.permissoes.join(', ') : 'N/A';
            tr.appendChild(tdPermissoes);

            const tdAcao = document.createElement('td');
            if (user.email !== 'admin@admin.com') { // Não permite excluir o admin padrão
                const btnExcluir = document.createElement('button');
                btnExcluir.className = 'btn btn-danger btn-sm';
                btnExcluir.textContent = 'Excluir';
                btnExcluir.addEventListener('click', () => excluirUsuario(user.email, user.nome));
                tdAcao.appendChild(btnExcluir);
            }
            tr.appendChild(tdAcao);
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        showAlert('Erro de Conexão', 'Não foi possível carregar a lista de usuários.', 'danger');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Falha ao carregar usuários.</td></tr>';
    }
}

async function excluirUsuario(email, nome) {
    showConfirmation(
        'Confirmar Exclusão', 
        `Tem certeza que deseja excluir o usuário "${nome}" (${email})? Esta ação não pode ser desfeita.`,
        async () => {
            const btnExcluirOriginal = document.querySelector(`#user-row-${email.replace(/[@.]/g, '-')} button`);
            let originalText = '';
            if (btnExcluirOriginal) {
                originalText = btnExcluirOriginal.textContent;
                btnExcluirOriginal.disabled = true;
                btnExcluirOriginal.textContent = 'Excluindo...';
            }

            try {
                const res = await fetch(`/usuarios/${email}`, { // URL Relativa
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });

                const resultado = await res.json();
                if (res.ok) {
                    showAlert('Sucesso!', resultado.message || 'Usuário excluído com sucesso.', 'success');
                    // Remove a linha da tabela em vez de recarregar tudo
                    const rowToRemove = document.getElementById(`user-row-${email.replace(/[@.]/g, '-')}`);
                    if (rowToRemove) rowToRemove.remove();
                    if (document.querySelector('#tabelaUsuarios tbody').children.length === 0) {
                        document.querySelector('#tabelaUsuarios tbody').innerHTML = '<tr><td colspan="4" class="text-center">Nenhum usuário cadastrado.</td></tr>';
                    }
                } else {
                    showAlert('Erro ao Excluir', resultado.message || 'Não foi possível excluir o usuário.', 'danger');
                    if (btnExcluirOriginal) {
                       btnExcluirOriginal.disabled = false;
                       btnExcluirOriginal.textContent = originalText;
                    }
                }
            } catch (error) {
                console.error("Erro ao excluir usuário:", error);
                showAlert('Erro de Conexão', 'Falha ao comunicar com o servidor para excluir o usuário.', 'danger');
                 if (btnExcluirOriginal) {
                    btnExcluirOriginal.disabled = false;
                    btnExcluirOriginal.textContent = originalText;
                }
            }
        }
    );
}

async function handleCadastroUsuarioSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btnSubmit = document.getElementById('btnCriarUsuario');

    const nome = form.nome.value.trim();
    const email = form.email.value.trim();
    const senha = form.senha.value; // Senha não deve ter trim() para não remover espaços intencionais

    const permissoesSelecionadas = Array.from(form.querySelectorAll('input[name="permissoes"]:checked'))
                                     .map(el => el.value);

    if (!nome || !email || !senha) {
        showAlert("Campos Obrigatórios", "Nome, email e senha são obrigatórios.", "warning");
        return;
    }
    if (permissoesSelecionadas.length === 0) {
        showAlert("Permissões", "Selecione ao menos uma permissão para o usuário.", "warning");
        return;
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Criando...';
    }

    try {
        const resposta = await fetch('/usuarios', { // URL Relativa
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ nome, email, senha, permissoes: permissoesSelecionadas })
        });

        const resultado = await resposta.json();
        if (resposta.ok) {
            showAlert('Sucesso!', resultado.message || "Usuário criado com sucesso.", 'success');
            form.reset();
            carregarUsuarios(); // Recarrega a lista para mostrar o novo usuário
        } else {
            showAlert('Erro ao Criar Usuário', resultado.message || "Não foi possível criar o usuário.", 'danger');
        }
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
        showAlert('Erro de Conexão', 'Falha ao comunicar com o servidor para criar o usuário.', 'danger');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Criar Usuário';
        }
    }
}