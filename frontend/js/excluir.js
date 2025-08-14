// frontend/js/excluir.js

document.addEventListener('DOMContentLoaded', () => {
    // ALTERADO: URL base correta da API. O backend está na porta 5000 e usa o prefixo /api.
    const API_BASE_URL = 'http://10.110.120.237:5000/api';

    const token = localStorage.getItem('token');
    const permissoesUsuario = JSON.parse(localStorage.getItem('permissoes') || '[]');
    const isAdmin = permissoesUsuario.includes('admin');

    // A função checkAuthentication já deve estar disponível globalmente (vindo de auth.js)
    try {
        checkAuthentication('admin'); // A exclusão é geralmente uma tarefa de admin. Ajuste se necessário.
    } catch (error) {
        // Se checkAuthentication falhar, ele já redireciona ou bloqueia a página.
        console.error("Falha na autenticação:", error.message);
        return; 
    }
    
    const formExcluir = document.getElementById('formExcluir');
    const numeroSerieInput = document.getElementById('numeroSerie');
    const mensagemDiv = document.getElementById('mensagem');
    const detalhesRadioContainer = document.getElementById('detalhesRadioContainer');
    const detalhesRadioConteudo = document.getElementById('detalhesRadioConteudo');
    const confirmacaoAcoesDiv = document.getElementById('confirmacaoAcoes');

    if (formExcluir) {
        formExcluir.addEventListener('submit', async function (e) {
            e.preventDefault();
            const numeroSerie = numeroSerieInput.value.trim();
            
            mensagemDiv.innerHTML = '';
            mensagemDiv.className = '';
            detalhesRadioConteudo.innerHTML = '';
            confirmacaoAcoesDiv.innerHTML = '';
            detalhesRadioContainer.style.display = 'none';

            if (!numeroSerie) {
                mensagemDiv.textContent = 'Por favor, informe o número de série.';
                mensagemDiv.className = 'alert alert-warning mt-3';
                return;
            }

            mensagemDiv.textContent = 'Buscando rádio...';
            mensagemDiv.className = 'alert alert-info mt-3';

            try {
                // ALTERADO: Rota padronizada para buscar por número de série
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
                    
                    // Apenas admins podem excluir
                    if (isAdmin) {
                        if (radio.status === 'Disponível') {
                                confirmacaoAcoesDiv.innerHTML = `
                                <p class="mt-3"><strong>Tem certeza que deseja excluir este rádio?</strong></p>
                                <button id="btnConfirmarExclusao" class="btn btn-danger">Sim, Excluir Rádio</button>
                                <button id="btnCancelarExclusao" class="btn btn-secondary ms-2">Cancelar</button>
                            `;
                            document.getElementById('btnConfirmarExclusao').onclick = () => prosseguirComExclusao(radio.numeroSerie);
                            document.getElementById('btnCancelarExclusao').onclick = () => {
                                detalhesRadioContainer.style.display = 'none';
                                mensagemDiv.textContent = 'Exclusão cancelada.';
                                mensagemDiv.className = 'alert alert-info mt-3';
                            };
                            } else {
                                mensagemDiv.innerHTML = `Este rádio não pode ser excluído pois seu status é <span class="fw-bold">${radio.status}</span>. Apenas rádios "Disponíveis" podem ser excluídos.`;
                                mensagemDiv.className = 'alert alert-warning mt-3';
                            }
                    } else {
                        mensagemDiv.textContent = 'Você não tem permissão para excluir rádios.';
                        mensagemDiv.className = 'alert alert-danger mt-3';
                    }

                } else {
                    const errorData = await resGet.json().catch(() => ({ message: 'Erro ao buscar rádio.'}));
                    mensagemDiv.textContent = `Erro: ${errorData.message || resGet.statusText}`;
                    mensagemDiv.className = 'alert alert-danger mt-3';
                }

            } catch (err) {
                console.error('Erro na operação de busca do rádio:', err);
                mensagemDiv.textContent = 'Erro de conexão ao tentar buscar o rádio. Verifique se o servidor está rodando.';
                mensagemDiv.className = 'alert alert-danger mt-3';
            }
        });
    }

    async function prosseguirComExclusao(numeroSerie) {
        mensagemDiv.textContent = 'Excluindo rádio...';
        mensagemDiv.className = 'alert alert-info mt-3';
        confirmacaoAcoesDiv.innerHTML = ''; 

        try {
            // ALTERADO: Rota padronizada para excluir por número de série
            const resDelete = await fetch(`${API_BASE_URL}/radios/serial/${numeroSerie}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const dataDelete = await resDelete.json();
            mensagemDiv.textContent = dataDelete.message;
            mensagemDiv.className = resDelete.ok ? 'alert alert-success mt-3' : 'alert alert-danger mt-3';

            if (resDelete.ok) {
                numeroSerieInput.value = '';
                detalhesRadioContainer.style.display = 'none';
                detalhesRadioConteudo.innerHTML = '';
            }

        } catch (err) {
            console.error('Erro na operação de exclusão do rádio:', err);
            mensagemDiv.textContent = 'Erro de conexão ao tentar excluir o rádio.';
            mensagemDiv.className = 'alert alert-danger mt-3';
        }
    }
});