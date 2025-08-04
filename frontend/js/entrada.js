// frontend/js/entrada.js

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('entrada'); // Permissão para 'entrada' ou 'admin'

        const formEntrada = document.getElementById('formEntrada');
        if (formEntrada) {
            formEntrada.addEventListener('submit', handleFormEntradaSubmit);
        }
        
        // Configura a data de entrada padrão para hoje
        const dataEntradaInput = document.getElementById('dataEntrada');
        if (dataEntradaInput) {
            dataEntradaInput.valueAsDate = new Date();
        }

    } catch (error) {
        console.error("Erro na inicialização da página de Entrada de Rádios:", error.message);
    }
});

async function handleFormEntradaSubmit(e) {
    e.preventDefault();
    
    const btnSubmit = document.getElementById('btnRegistrarEntrada');
    const nfNumeroInput = document.getElementById('nfEntrada');
    const dataEntradaInput = document.getElementById('dataEntrada');
    const observacoesInput = document.getElementById('observacoes');

    const nfNumero = nfNumeroInput.value.trim();
    const dataEntrada = dataEntradaInput.value;
    const observacoes = observacoesInput.value
        .split('\n')
        .map(obs => obs.trim())
        .filter(obs => obs !== '');

    if (!nfNumero || !dataEntrada) {
        showAlert('Campos Obrigatórios', 'Por favor, preencha o N° da NF de Saída e a Data da Entrada.', 'warning');
        return;
    }
    
    const token = localStorage.getItem('token');

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Registrando...';
    }

    try {
        const res = await fetch('/nf/entrada', { // URL Relativa
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ nfNumero, dataEntrada, observacoes })
        });

        const data = await res.json();

        if (res.ok) {
            showAlert('Sucesso!', data.message || 'Entrada registrada com sucesso.', 'success');
            document.getElementById('formEntrada').reset();
            if (dataEntradaInput) { // Reseta a data para hoje
                dataEntradaInput.valueAsDate = new Date();
            }
        } else {
            showAlert('Erro ao Registrar', data.message || 'Erro desconhecido ao registrar entrada. Verifique o número da NF.', 'danger');
        }
    } catch (error) {
        console.error('Erro na requisição de entrada:', error);
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para registrar a entrada.', 'danger');
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Registrar Entrada';
        }
    }
}