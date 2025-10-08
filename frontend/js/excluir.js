// frontend/js/excluir.js

document.addEventListener('DOMContentLoaded', async () => {
    // URL base correta da API.
    const API_BASE_URL = 'http://10.110.120.237:5000/api';

    const token = localStorage.getItem('token');
    const permissoesUsuario = JSON.parse(localStorage.getItem('permissoes') || '[]');
    const isAdmin = permissoesUsuario.includes('admin');

    // Assume que checkAuthentication e showAlert estão disponíveis globalmente (vindo de auth.js/ui.js)
    if (typeof checkAuthentication === 'function') {
        // Redireciona ou bloqueia se não autenticado/autorizado.
        checkAuthentication('excluir'); 
    } else {
        console.warn("Função 'checkAuthentication' não encontrada. Verifique se 'auth.js' está carregado.");
    }
    // A função showAlert é assumida do ui.js

    const formExcluir = document.getElementById('formExcluir');
    const numeroSerieInput = document.getElementById('numeroSerie');
    const mensagemDiv = document.getElementById('mensagem');
    const detalhesRadioContainer = document.getElementById('detalhesRadioContainer');
    const detalhesRadioConteudo = document.getElementById('detalhesRadioConteudo');
    const motivoExclusaoInput = document.getElementById('motivoExclusao'); // Campo de motivo
    const confirmacaoAcoesDiv = document.getElementById('confirmacaoAcoes');

    // Estado inicial dos elementos: esconde o container de detalhes e o campo de motivo
    detalhesRadioContainer.style.display = 'none';
    if (motivoExclusaoInput) motivoExclusaoInput.style.display = 'none'; // Garante que começa escondido

    if (formExcluir) {
        formExcluir.addEventListener('submit', async function (e) {
            e.preventDefault(); // Impede o envio padrão do formulário
            
            const numeroSerie = numeroSerieInput.value.trim();
            
            // Limpa mensagens e esconde seções antes de uma nova busca
            mensagemDiv.innerHTML = '';
            mensagemDiv.className = '';
            detalhesRadioConteudo.innerHTML = '';
            confirmacaoAcoesDiv.innerHTML = '';
            detalhesRadioContainer.style.display = 'none'; 
            if (motivoExclusaoInput) {
                motivoExclusaoInput.value = ''; // Limpa o campo motivo
                motivoExclusaoInput.style.display = 'none'; // Esconde o campo motivo
            }

            if (!numeroSerie) {
                showAlert('Erro de Entrada', 'Por favor, informe o número de série.', 'warning');
                return;
            }

            mensagemDiv.textContent = 'Buscando rádio...';
            mensagemDiv.className = 'alert alert-info mt-3';

            try {
                const resGet = await fetch(`${API_BASE_URL}/radios/serial/${numeroSerie}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (resGet.ok) {
                    const radio = await resGet.json();
                    
                    mensagemDiv.innerHTML = ''; 
                    mensagemDiv.className = '';

                    detalhesRadioConteudo.innerHTML = `
                        <p><strong>Modelo:</strong> ${radio.modelo || 'N/A'}</p>
                        <p><strong>Número de Série:</strong> ${radio.numeroSerie || 'N/A'}</p>
                        <p><strong>Patrimônio:</strong> ${radio.patrimonio || 'N/A'}</p>
                        <p><strong>Status Atual:</strong> <span class="fw-bold">${radio.status || 'N/A'}</span></p>
                    `;
                    detalhesRadioContainer.style.display = 'block';
                    
                    if (isAdmin) {
                        if (radio.status === 'Disponível') {
                            // Mostra o campo motivo
                            if (motivoExclusaoInput) motivoExclusaoInput.style.display = 'block'; 
                            confirmacaoAcoesDiv.innerHTML = `
                                <p class="mt-3"><strong>Tem certeza que deseja excluir este rádio?</strong></p>
                                <button id="btnConfirmarExclusao" class="btn btn-danger">Sim, Excluir Rádio</button>
                                <button id="btnCancelarExclusao" class="btn btn-secondary ms-2">Cancelar</button>
                            `;
                            // Adiciona listeners aos botões
                            document.getElementById('btnConfirmarExclusao').onclick = () => prosseguirComExclusao(radio.numeroSerie);
                            document.getElementById('btnCancelarExclusao').onclick = () => {
                                detalhesRadioContainer.style.display = 'none';
                                mensagemDiv.textContent = 'Exclusão cancelada.';
                                mensagemDiv.className = 'alert alert-info mt-3';
                                if (motivoExclusaoInput) motivoExclusaoInput.style.display = 'none'; // Esconde o campo motivo
                            };
                        } else {
                            showAlert('Rádio Indisponível', `Este rádio não pode ser excluído pois seu status é "${radio.status}". Apenas rádios "Disponíveis" podem ser excluídos.`, 'warning');
                            mensagemDiv.innerHTML = ''; // Limpa a mensagem anterior se o alerta for usado
                            mensagemDiv.className = '';
                            if (motivoExclusaoInput) motivoExclusaoInput.style.display = 'none'; // Esconde o campo motivo
                        }
                    } else {
                        showAlert('Permissão Negada', 'Você não tem permissão para excluir rádios.', 'danger');
                        mensagemDiv.innerHTML = ''; // Limpa a mensagem anterior se o alerta for usado
                        mensagemDiv.className = '';
                        if (motivoExclusaoInput) motivoExclusaoInput.style.display = 'none'; // Esconde o campo motivo
                    }

                } else {
                    const errorData = await resGet.json().catch(() => ({ message: 'Erro ao buscar rádio.'}));
                    showAlert('Erro ao Buscar', `Erro: ${errorData.message || resGet.statusText}`, 'danger');
                    detalhesRadioContainer.style.display = 'none'; // Esconde o container em caso de erro na busca
                    if (motivoExclusaoInput) motivoExclusaoInput.style.display = 'none'; // Esconde o campo motivo
                }

            } catch (err) {
                console.error('Erro na operação de busca do rádio:', err);
                showAlert('Erro de Conexão', 'Erro de conexão ao tentar buscar o rádio. Verifique se o servidor está rodando.', 'danger');
                detalhesRadioContainer.style.display = 'none'; // Esconde o container em caso de erro de conexão
                if (motivoExclusaoInput) motivoExclusaoInput.style.display = 'none'; // Esconde o campo motivo
            }
        });
    } else {
        console.warn("Formulário/botão de exclusão (ID 'formExcluir') não encontrado.");
    }

    async function prosseguirComExclusao(numeroSerie) {
        const motivo = motivoExclusaoInput ? motivoExclusaoInput.value.trim() : ''; // Captura o motivo

        if (!motivo) {
            showAlert('Campo Obrigatório', 'Por favor, informe o motivo da exclusão.', 'warning');
            return;
        }

        mensagemDiv.textContent = 'Excluindo rádio...';
        mensagemDiv.className = 'alert alert-info mt-3';
        confirmacaoAcoesDiv.innerHTML = ''; 

        try {
            const resDelete = await fetch(`${API_BASE_URL}/radios/serial/${numeroSerie}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json', // Importante para enviar JSON no body
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ motivo }) // Envia o motivo no corpo da requisição
            });
            
            const dataDelete = await resDelete.json();

            if (resDelete.ok) {
                showAlert('Sucesso', dataDelete.message, 'success');
                numeroSerieInput.value = '';
                detalhesRadioContainer.style.display = 'none';
                detalhesRadioConteudo.innerHTML = '';
                if (motivoExclusaoInput) motivoExclusaoInput.value = ''; // Limpa o campo motivo
                if (motivoExclusaoInput) motivoExclusaoInput.style.display = 'none'; // Esconde o campo motivo
            } else {
                showAlert('Erro ao Excluir', dataDelete.message || 'Erro desconhecido ao excluir o rádio.', 'danger');
            }

        } catch (err) {
            console.error('Erro na operação de exclusão do rádio:', err);
            showAlert('Erro de Conexão', 'Erro de conexão ao tentar excluir o rádio.', 'danger');
        }
    }

    // Inicializa o logout, assumindo que setupLogout está no ui.js
    if (typeof setupLogout === 'function') {
        setupLogout();
    } else {
        console.warn("Função 'setupLogout' não encontrada. Verifique se 'ui.js' está carregado e define essa função globalmente.");
    }
});