document.addEventListener('DOMContentLoaded', () => {
    // Garante que apenas administradores possam ver esta página
    try {
        checkAuthentication('admin');
    } catch (error) {
        console.error(error.message);
        // A função checkAuthentication já redireciona ou bloqueia a página, então podemos parar aqui.
        return;
    }

    // --- LIGAÇÃO DOS EVENTOS PRINCIPAIS ---
    
    // Botão para abrir o modal de novo usuário
    document.getElementById('btnAdicionarUsuario')?.addEventListener('click', () => openUserModal());

    // Formulário para salvar (criar ou editar) usuário
    document.getElementById('formUsuario')?.addEventListener('submit', saveUser);

    // Filtro da tabela de usuários
    document.getElementById('filtroUsuarios')?.addEventListener('input', filtrarUsuarios);


    // --- LÓGICA DAS ABAS ---
    const adminTabs = document.getElementById('adminTabs');
    if (adminTabs) {
        const handleTabChange = (tabId) => {
            if (tabId === 'usuarios-tab') loadUsers();
            if (tabId === 'baixados-tab') carregarRadiosBaixados();
            if (tabId === 'cadastrados-tab') carregarRadiosCadastrados();
            // Adicione outros 'if' para outras abas se necessário
        };
        
        // Adiciona o evento para quando uma nova aba é mostrada
        document.querySelectorAll('#adminTabs .nav-link').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (event) => handleTabChange(event.target.id));
        });
        
        // Carrega o conteúdo da aba que já está ativa quando a página abre
        const activeTabButton = document.querySelector('#adminTabs .nav-link.active');
        if (activeTabButton) {
            handleTabChange(activeTabButton.id);
        }
    }
});


// --- DEFINIÇÕES E VARIÁVEIS GLOBAIS ---

// Lista de todas as permissões disponíveis no sistema
const TODAS_PERMISSOES = [
    { value: 'admin', label: '⚙️ Administração' },
    { value: 'registrar', label: '➕ Cadastrar Rádio' },
    { value: 'excluir', label: '❌ Excluir Rádio' },
    { value: 'estoque', label: '📦 Estoque' },
    { value: 'solicitar_manutencao', label: '📤 Solicitar Manutenção' },
    { value: 'manutencao_dashboard', label: '🔧 Manutenção' },
    { value: 'saida', label: '📤 NF de Saída' },
    { value: 'entrada', label: '📥 Retorno de Locação' },
    { value: 'extrato', label: '📄 Extrato de NF' },
    { value: 'historico', label: '📚 Histórico de Rádio' },
    { value: 'gerenciar_nf', label: '🧾 Gerenciar Notas Fiscais' } 
];

let allUsers = []; 
let userModalInstance = null;
let confirmationCallback = null;
let isConfirmed = false;

// --- FUNÇÕES DE GERENCIAMENTO DE USUÁRIOS ---

async function loadUsers() {
    const tabela = document.getElementById('tabelaUsuarios');
    if (!tabela) return;
    tabela.innerHTML = '<tr><td colspan="4" class="text-center">Carregando usuários...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error((await response.json()).message || 'Falha ao carregar usuários.');
        allUsers = await response.json();
        renderUsers(allUsers);
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        tabela.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

function renderUsers(users) {
    const tabela = document.getElementById('tabelaUsuarios');
    tabela.innerHTML = '';

    if (!users || users.length === 0) {
        tabela.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum usuário encontrado.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.nome}</td>
            <td>${user.email}</td>
            <td>${user.permissoes.map(p => `<span class="badge bg-secondary me-1">${p}</span>`).join('') || 'Nenhuma'}</td>
            <td>
                <button class="btn btn-sm btn-primary btn-editar-usuario" data-id="${user._id}"><i class="bi bi-pencil-square"></i> Editar</button>
                <button class="btn btn-sm btn-danger btn-excluir-usuario" data-id="${user._id}" data-email="${user.email}"><i class="bi bi-trash"></i> Excluir</button>
            </td>
        `;
        tabela.appendChild(tr);
    });
    addEventListenersUsuarios();
}

function addEventListenersUsuarios() {
    document.querySelectorAll('.btn-editar-usuario').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.dataset.id;
            openUserModal(userId);
        });
    });
    document.querySelectorAll('.btn-excluir-usuario').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const userId = e.currentTarget.dataset.id;
            const userEmail = e.currentTarget.dataset.email;
            deleteUser(userId, userEmail);
        });
    });
}

function openUserModal(userId = null) {
    const form = document.getElementById('formUsuario');
    form.reset();

    const modalLabel = document.getElementById('modalUsuarioLabel');
    const senhaInput = document.getElementById('senhaUsuario');
    const emailInput = document.getElementById('emailUsuario');
    document.getElementById('usuarioId').value = userId || '';

    if (userId) {
        modalLabel.textContent = 'Editar Usuário';
        senhaInput.placeholder = 'Deixe em branco para não alterar';
        senhaInput.required = false;
        emailInput.disabled = true;

        const user = allUsers.find(u => u._id === userId);
        if (user) {
            document.getElementById('nomeUsuario').value = user.nome;
            emailInput.value = user.email;
            populatePermissions(user.permissoes);
        }
    } else {
        modalLabel.textContent = 'Adicionar Novo Usuário';
        senhaInput.placeholder = 'Senha (mínimo 6 caracteres)';
        senhaInput.required = true;
        emailInput.disabled = false;
        populatePermissions([]);
    }
    
    if (!userModalInstance) {
        userModalInstance = new bootstrap.Modal(document.getElementById('modalUsuario'));
    }
    userModalInstance.show();
}

function populatePermissions(userPermissions = []) {
    const container = document.getElementById('checkboxesPermissoes');
    container.innerHTML = '';
    TODAS_PERMISSOES.forEach(perm => {
        const isChecked = userPermissions.includes(perm.value);
        const div = document.createElement('div');
        div.className = 'col-md-4';
        div.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${perm.value}" id="perm-${perm.value}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label" for="perm-${perm.value}">${perm.label}</label>
            </div>
        `;
        container.appendChild(div);
    });
}

async function saveUser(event) {
    event.preventDefault();
    const token = localStorage.getItem('token');
    
    const id = document.getElementById('usuarioId').value;
    const nome = document.getElementById('nomeUsuario').value;
    const email = document.getElementById('emailUsuario').value;
    const senha = document.getElementById('senhaUsuario').value;
    const selectedPermissions = Array.from(document.querySelectorAll('#checkboxesPermissoes input:checked')).map(cb => cb.value);

    const isEdit = !!id;
    const url = isEdit ? `/api/users/${id}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    const body = { nome, email, permissoes: selectedPermissions };

    if (!isEdit) {
        if (!senha || senha.length < 6) {
            return showAlert('Erro', 'Para novos usuários, a senha deve ter no mínimo 6 caracteres.', 'danger');
        }
        body.senha = senha;
    } else if (senha) {
        if (senha.length < 6) {
            return showAlert('Erro', 'A nova senha deve ter no mínimo 6 caracteres.', 'danger');
        }
        body.senha = senha;
    }

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Falha ao salvar usuário.');
        
        showAlert('Sucesso!', data.message, 'success');
        userModalInstance.hide();

        // --- INÍCIO DA MELHORIA ---
        // Pega o usuário que está logado no momento do localStorage
        const currentUserString = localStorage.getItem('usuario');
        if (currentUserString) {
            const currentUser = JSON.parse(currentUserString);
            const editedUserEmail = document.getElementById('emailUsuario').value;

            // Verifica se o usuário que foi editado é o mesmo que está logado, comparando os emails
            if (currentUser.email === editedUserEmail) {
                console.log('Permissões do próprio usuário foram atualizadas. Atualizando localStorage...');
                
                // Atualiza o objeto do usuário com as novas permissões
                currentUser.permissoes = selectedPermissions;
                
                // Salva o objeto atualizado de volta no localStorage
                localStorage.setItem('usuario', JSON.stringify(currentUser));
            }
        }
        // --- FIM DA MELHORIA ---

        loadUsers(); // Recarrega a lista de usuários na tabela
    } catch (error) {
        showAlert('Erro', error.message, 'danger');
    }
}


function deleteUser(userId, userEmail) {
    if (userEmail === 'admin@admin.com') {
        return showAlert('Ação Proibida', 'O usuário administrador não pode ser excluído.', 'warning');
    }
    showBootstrapConfirmation('Confirmar Exclusão', `Tem certeza que deseja excluir o usuário ${userEmail}?`, async (confirmed) => {
        if (!confirmed) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Falha ao excluir usuário.');
            showAlert('Sucesso!', data.message, 'success');
            loadUsers();
        } catch (error) {
            showAlert('Erro', error.message, 'danger');
        }
    });
}

function filtrarUsuarios() {
    const termo = document.getElementById('filtroUsuarios').value.toLowerCase();
    const filtrados = allUsers.filter(user => 
        user.nome.toLowerCase().includes(termo) ||
        user.email.toLowerCase().includes(termo) ||
        user.permissoes.join(' ').toLowerCase().includes(termo)
    );
    renderUsers(filtrados);
}

// --- FUNÇÕES DAS OUTRAS ABAS (SEU CÓDIGO ORIGINAL) ---

function formatarDataHora(dataString) {
    if (!dataString) return 'N/A';
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Date(dataString).toLocaleString('pt-BR', options);
}

function formatarData(dataString) {
    if (!dataString) return 'N/A';
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(dataString).toLocaleDateString('pt-BR', options);
}

function aplicarFiltro(inputId, tableBodyId) {
    const input = document.getElementById(inputId);
    const tbody = document.getElementById(tableBodyId);
    if (!input || !tbody) return;

    input.addEventListener('keyup', () => {
        const filter = input.value.toUpperCase();
        const rows = tbody.querySelectorAll('tr:not(.detalhes-condenacao-row)');
        
        rows.forEach(row => {
            let found = false;
            row.querySelectorAll('td').forEach(cell => {
                if (cell.textContent.toUpperCase().indexOf(filter) > -1) {
                    found = true;
                }
            });
            row.style.display = found ? '' : 'none';
            const detalhesRow = row.nextElementSibling;
            if (detalhesRow && detalhesRow.classList.contains('detalhes-condenacao-row')) {
                detalhesRow.style.display = 'none';
            }
        });
    });
}

async function carregarRadiosCadastrados() {
    const tabela = document.getElementById('tabelaRadiosCadastrados');
    if (!tabela) return;
    tabela.innerHTML = '<tr><td colspan="5" class="text-center">Carregando...</td></tr>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/radios/cadastrados`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar o histórico de rádios.');
        const radios = await response.json();
        
        if (radios.length === 0) {
            tabela.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum rádio cadastrado.</td></tr>';
            return;
        }
        
        tabela.innerHTML = radios.map(radio => `
            <tr>
                <td>${radio.modelo}</td>
                <td>${radio.numeroSerie}</td>
                <td>${radio.frequencia}</td>
                <td>${formatarDataHora(radio.createdAt)}</td>
                <td>${radio.cadastradoPor ? radio.cadastradoPor.email : 'N/A'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro:', error);
        tabela.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

async function carregarRadiosBaixados() {
    const tabela = document.getElementById('tabelaRadiosBaixados');
    if (!tabela) return;
    tabela.innerHTML = '<tr><td colspan="7" class="text-center">Carregando...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/radios/condenados`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Falha ao carregar rádios condenados.');
        const radiosCondenados = await response.json();
        
        if (radiosCondenados.length === 0) {
            tabela.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum rádio condenado encontrado.</td></tr>';
            return;
        }
        
        let content = '';
        radiosCondenados.forEach(radio => {
            const dataCondenacaoFormatada = formatarData(radio.dataCondenacao);
            const osCondenacaoId = radio.osCondenacao ? radio.osCondenacao.idPedido : 'N/A';
            
            content += `
                <tr class="linha-radio-condenado">
                    <td>${radio.modelo}</td>
                    <td>${radio.numeroSerie}</td>
                    <td>${radio.patrimonio || 'N/A'}</td>
                    <td><span class="badge status-condenado">Condenado</span></td>
                    <td>${dataCondenacaoFormatada}</td>
                    <td>${osCondenacaoId}</td>
                    <td>
                        <button class="btn btn-sm btn-info btn-ver-detalhes-condenacao" data-bs-toggle="collapse" data-bs-target="#detalhes-condenacao-${radio._id}">
                            <i class="bi bi-eye"></i> Ver Detalhes
                        </button>
                    </td>
                </tr>
            `;
            
            const tecnico = radio.tecnicoCondenacao ? `${radio.tecnicoCondenacao.nome} (${radio.tecnicoCondenacao.email})` : 'Não informado';
            content += `
                <tr class="detalhes-condenacao-row collapse" id="detalhes-condenacao-${radio._id}">
                    <td colspan="7">
                        <div class="detalhes-condenacao-content">
                            <p><strong>Motivo da Condenação:</strong> ${radio.motivoCondenacao || 'Não especificado.'}</p>
                            <p><strong>Técnico Responsável:</strong> ${tecnico}</p>
                            <p><strong>Data e Hora Exata:</strong> ${formatarDataHora(radio.dataCondenacao)}</p>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tabela.innerHTML = content;
    } catch (error) {
        console.error('Erro:', error);
        tabela.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${error.message}</td></tr>`;
    }
}