// frontend/js/excluir.js

document.addEventListener('DOMContentLoaded', () => {
    // Definir o endereço base da API em um só lugar
    const API_BASE_URL = 'http://10.110.120.213:3000';

    const token = localStorage.getItem('token');
    const permissoesUsuario = JSON.parse(localStorage.getItem('permissoes') || '[]');
    const isAdmin = permissoesUsuario.includes('admin');

    if (!token || (!permissoesUsuario.includes('excluir') && !isAdmin)) {
        alert('Acesso negado. Faça login com uma conta autorizada.');
        window.location.href = 'index.html';
        return;
    }

    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('permissoes');
            localStorage.removeItem('usuarioNome');
            window.location.href = 'login.html';
        });
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
            
            // Limpar estado anterior
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
                // Usando a constante da API
                const resGet = await fetch(`${API_BASE_URL}/radios/${numeroSerie}`, {
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
                        <p><strong>Frequência:</strong> ${radio.frequencia || 'N/A'}</p>
                        <p><strong>Patrimônio:</strong> ${radio.patrimonio || 'N/A'}</p>
                        <p><strong>Número de Série:</strong> ${radio.numeroSerie || 'N/A'}</p>
                        <p><strong>Status Atual:</strong> <span class="fw-bold">${radio.status || 'N/A'}</span></p>
                    `;
                    detalhesRadioContainer.style.display = 'block';

                    const podeExcluir = isAdmin || radio.status === 'Disponível';

                    if (podeExcluir) {
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
                        mensagemDiv.innerHTML = `Este rádio (Série: ${radio.numeroSerie}, Status: <span class="fw-bold">${radio.status}</span>) não pode ser excluído. <br>Para exclusão, o status do rádio precisa ser 'Disponível' ou você precisa ser um administrador.`;
                        mensagemDiv.className = 'alert alert-warning mt-3';
                    }

                } else if (resGet.status === 404) {
                    const data = await resGet.json().catch(() => ({ message: 'Rádio não encontrado.' }));
                    mensagemDiv.textContent = data.message || 'Rádio não encontrado com o número de série informado.';
                    mensagemDiv.className = 'alert alert-danger mt-3';
                    detalhesRadioContainer.style.display = 'none';
                } else {
                    const errorData = await resGet.json().catch(() => ({ message: 'Erro ao buscar rádio.'}));
                    mensagemDiv.textContent = `Erro ao buscar rádio: ${errorData.message || resGet.statusText}`;
                    mensagemDiv.className = 'alert alert-danger mt-3';
                    detalhesRadioContainer.style.display = 'none';
                }

            } catch (err) {
                console.error('Erro na operação de busca do rádio:', err);
                mensagemDiv.textContent = 'Erro de conexão ao tentar buscar o rádio. Verifique o console.';
                mensagemDiv.className = 'alert alert-danger mt-3';
                detalhesRadioContainer.style.display = 'none';
            }
        });
    }

    async function prosseguirComExclusao(numeroSerie) {
        mensagemDiv.textContent = 'Excluindo rádio...';
        mensagemDiv.className = 'alert alert-info mt-3';
        confirmacaoAcoesDiv.innerHTML = ''; 

        try {
            // **CORREÇÃO APLICADA AQUI** - Usando a constante da API
            const resDelete = await fetch(`${API_BASE_URL}/radios/${numeroSerie}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const contentType = resDelete.headers.get("content-type");
            let dataDelete;

            if (contentType && contentType.indexOf("application/json") !== -1) {
                dataDelete = await resDelete.json();
            } else {
                const textResponse = await resDelete.text();
                dataDelete = { message: resDelete.ok ? (textResponse || `Rádio ${numeroSerie} excluído com sucesso.`) : `Erro ${resDelete.status}: ${textResponse || 'Resposta não JSON do servidor.'}` };
            }

            mensagemDiv.textContent = dataDelete.message;
            mensagemDiv.className = resDelete.ok ? 'alert alert-success mt-3' : 'alert alert-danger mt-3';

            if (resDelete.ok) {
                numeroSerieInput.value = '';
                detalhesRadioContainer.style.display = 'none';
                detalhesRadioConteudo.innerHTML = '';
            }

        } catch (err) {
            console.error('Erro na operação de exclusão do rádio:', err);
            mensagemDiv.textContent = 'Erro de conexão ao tentar excluir o rádio. Verifique o console.';
            mensagemDiv.className = 'alert alert-danger mt-3';
        }
    }
});