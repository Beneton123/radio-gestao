// frontend/js/registrar.js

let modalAdicionarModeloInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Verifica se o usuário tem permissão para registrar rádios
        checkAuthentication('registrar_radio'); 

        // Inicializa a instância do modal de adicionar modelo
        const modalEl = document.getElementById('modalAdicionarModelo');
        if (modalEl) {
            modalAdicionarModeloInstance = new bootstrap.Modal(modalEl);
        }

        // Função que carrega os modelos e verifica as permissões de admin
        inicializarPaginaDeRegistro();

        // Adiciona os listeners (eventos de clique e envio) aos elementos da página
        const formCadastro = document.getElementById('formCadastroRadio');
        if (formCadastro) {
            formCadastro.addEventListener('submit', handleCadastroSubmit);
        }

        const btnAbrirModalModelo = document.getElementById('btnAbrirModalModelo');
        if (btnAbrirModalModelo) {
            btnAbrirModalModelo.addEventListener('click', () => modalAdicionarModeloInstance.show());
        }

        const btnSalvarNovoModelo = document.getElementById('btnSalvarNovoModelo');
        if (btnSalvarNovoModelo) {
            btnSalvarNovoModelo.addEventListener('click', handleSalvarNovoModelo);
        }

    } catch (error) {
        console.error("Erro na inicialização da página de Cadastro de Rádio:", error.message);
        showAlert("Erro Crítico", "Não foi possível carregar a página corretamente. Tente recarregar.", "danger");
    }
});

/**
 * Função principal que organiza a configuração da página.
 */
async function inicializarPaginaDeRegistro() {
    // Busca os modelos de rádio no backend e preenche a lista
    await carregarModelos();

    // Pega as permissões do usuário que foram salvas no login
    const permissoes = JSON.parse(localStorage.getItem('permissoes') || '[]');
    
    // Se o usuário tiver a permissão 'admin', mostra o botão "➕"
    if (permissoes.includes('admin')) {
        const btnAbrirModalModelo = document.getElementById('btnAbrirModalModelo');
        if (btnAbrirModalModelo) {
            btnAbrirModalModelo.style.display = 'block';
        }
    }
}

/**
 * Busca a lista de modelos da API e popula o <datalist>.
 */
async function carregarModelos() {
    const datalist = document.getElementById('datalistModelos');
    if (!datalist) return;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/modelos', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            throw new Error('Falha ao carregar modelos de rádio.');
        }

        const modelos = await res.json();
        datalist.innerHTML = ''; // Limpa opções antigas antes de adicionar as novas
        modelos.forEach(modelo => {
            const option = document.createElement('option');
            option.value = modelo.nome;
            datalist.appendChild(option);
        });

    } catch (error) {
        console.error('Erro de rede ao carregar modelos:', error);
        datalist.innerHTML = '<option value="Falha ao carregar modelos"></option>';
    }
}

/**
 * Lida com o clique no botão "Salvar Modelo" dentro do modal.
 */
async function handleSalvarNovoModelo() {
    const nomeModeloInput = document.getElementById('novoModeloNome');
    const novoNome = nomeModeloInput.value.trim();

    if (!novoNome) {
        showAlert('Campo Obrigatório', 'O nome do novo modelo não pode ser vazio.', 'warning');
        return;
    }

    const btnSalvar = document.getElementById('btnSalvarNovoModelo');
    const originalText = btnSalvar.innerHTML;
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...`;

    try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/modelos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nome: novoNome })
        });

        const data = await res.json();

        if (res.ok) {
            modalAdicionarModeloInstance.hide(); // Fecha o modal
            showAlert('Sucesso!', data.message, 'success');
            await carregarModelos(); // Recarrega a lista para incluir o novo modelo
            document.getElementById('modelo').value = data.modelo.nome; // Já seleciona o modelo que acabou de ser criado
            nomeModeloInput.value = ''; // Limpa o campo do modal
        } else {
            showAlert('Erro ao Salvar', data.message || 'Não foi possível salvar o novo modelo.', 'danger');
        }
    } catch (error) {
        console.error('Erro de rede ao salvar novo modelo:', error);
        showAlert('Erro de Conexão', 'Falha ao comunicar com o servidor.', 'danger');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = originalText;
    }
}

/**
 * Lida com o envio do formulário principal de cadastro de rádio.
 */
async function handleCadastroSubmit(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSalvarRadio');

    const modelo = document.getElementById('modelo').value.trim();
    const numeroSerie = document.getElementById('numeroSerie').value.trim();
    const patrimonio = document.getElementById('patrimonio').value.trim();
    const frequencia = document.getElementById('frequencia').value;

    if (!modelo || !numeroSerie || !frequencia) {
        showAlert("Campos Obrigatórios", "Modelo, Número de Série e Frequência são obrigatórios.", "warning");
        return;
    }

    const token = localStorage.getItem('token');
    
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Salvando...';

    try {
        const res = await fetch('/radios', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ modelo, numeroSerie, patrimonio, frequencia })
        });
        const data = await res.json();

        if (res.ok) {
            showAlert('Sucesso!', data.message || 'Rádio cadastrado com sucesso.', 'success');
            e.target.reset(); // Limpa o formulário
        } else {
            showAlert('Erro ao Cadastrar', data.message || 'Não foi possível cadastrar o rádio.', 'danger');
        }
    } catch (erro) {
        console.error('Erro na requisição de cadastro:', erro);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para cadastrar o rádio.', 'danger');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Salvar Rádio';
    }
}