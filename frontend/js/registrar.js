// frontend/js/registrar.js

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Permissão para acessar a página de registrar rádio.
        // Se não houver permissão específica no backend para 'registrar', pode ser null.
        // Assumindo que a permissão 'registrar' existe ou é coberta por 'admin'.
        checkAuthentication('registrar'); 

        const formCadastro = document.getElementById('formCadastroRadio');
        if (formCadastro) {
            formCadastro.addEventListener('submit', handleCadastroSubmit);
        }
    } catch (error) {
        console.error("Erro na inicialização da página de Cadastro de Rádio:", error.message);
        // Se checkAuthentication lançar erro, o corpo da página já foi alterado.
        // Caso contrário, um erro inesperado pode ser mostrado:
        // showAlert("Erro Crítico", "Não foi possível carregar a página corretamente.", "danger");
    }
});

async function handleCadastroSubmit(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSalvarRadio');

    const modelo = document.getElementById('modelo').value.trim();
    const numeroSerie = document.getElementById('numeroSerie').value.trim();
    const patrimonio = document.getElementById('patrimonio').value.trim();
    const frequencia = document.getElementById('frequencia').value;

    if (!modelo || !numeroSerie || !patrimonio || !frequencia) {
        showAlert("Campos Obrigatórios", "Todos os campos (Modelo, Número de Série, Patrimônio, Frequência) são obrigatórios.", "warning");
        return;
    }

    const token = localStorage.getItem('token');
    
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Salvando...';
    }

    try {
        // Usando URL relativa e o endpoint POST /radios do seu backend
        const res = await fetch('/radios', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ modelo, numeroSerie, patrimonio, frequencia })
            // O backend já define o status como "Disponível" por padrão
        });

        const data = await res.json(); // Tenta parsear como JSON em ambos os casos

        if (res.ok) {
            showAlert('Sucesso!', data.message || 'Rádio cadastrado com sucesso.', 'success');
            e.target.reset(); // Limpa o formulário
        } else {
            showAlert('Erro ao Cadastrar', data.message || 'Não foi possível cadastrar o rádio. Verifique os dados ou se o número de série já existe.', 'danger');
        }
    } catch (erro) {
        console.error('Erro na requisição de cadastro:', erro);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para cadastrar o rádio.', 'danger');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Salvar Rádio';
        }
    }
}