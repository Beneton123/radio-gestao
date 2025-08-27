const API_BASE_URL = 'http://10.110.120.27:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('historico'); // Permissão para 'historico' ou 'admin'

        const btnBuscar = document.getElementById('btnBuscarHistorico');
        if (btnBuscar) {
            btnBuscar.addEventListener('click', buscarHistoricoRadio);
        }

        const numeroSerieInput = document.getElementById('numeroSerieBusca');
        if (numeroSerieInput) {
            numeroSerieInput.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    buscarHistoricoRadio();
                }
            });
        }

    } catch (error) {
        console.error("Erro na inicialização da página de Histórico:", error.message);
    }
});


async function buscarHistoricoRadio() {
    const numeroSerieInput = document.getElementById('numeroSerieBusca');
    const numeroSerie = numeroSerieInput.value.trim().toUpperCase();
    const resultadoDiv = document.getElementById('resultadoHistorico');
    const btnBuscar = document.getElementById('btnBuscarHistorico');

    resultadoDiv.innerHTML = '';

    if (!numeroSerie) {
        showAlert('Campo Obrigatório', 'Por favor, informe um número de série.', 'warning');
        return;
    }

    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = 'Buscando...';
    }
    resultadoDiv.innerHTML = '<p class="text-center">Buscando informações do rádio...</p>';

    try {
        const token = localStorage.getItem('token');

        // ETAPA 1: Buscar os dados principais do rádio (funciona para ativos e inativos)
        const radioRes = await fetch(`${API_BASE_URL}/radios/serial/${numeroSerie}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!radioRes.ok) {
            const errorData = await radioRes.json().catch(() => ({}));
            const errorMessage = errorData.message || (radioRes.status === 404 ? `Nenhum rádio (ativo ou excluído) encontrado para a série: ${numeroSerie}.` : 'Erro ao buscar dados do rádio.');
            resultadoDiv.innerHTML = '';
            showAlert('Busca Falhou', errorMessage, 'warning');
            return;
        }

        const radio = await radioRes.json();

        // ETAPA 2: Buscar o histórico de eventos para esse rádio
        const historicoRes = await fetch(`${API_BASE_URL}/dashboard/radios/${numeroSerie}/historico-completo`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const dataHistorico = await historicoRes.json();
        const historico = dataHistorico.historico || [];

        // Monta o HTML com as informações do rádio (topo da lista)
        let html = `
            <h4 class="mt-4 mb-3">Detalhes do Rádio: ${radio.numeroSerie}</h4>
            <div class="card mb-4">
                <div class="card-body">
                    <p><strong>Modelo:</strong> ${radio.modelo}</p>
                    <p><strong>Patrimônio:</strong> ${radio.patrimonio || 'Não informado'}</p>
                    <p><strong>Frequência:</strong> ${radio.frequencia}</p>
                    <p><strong>Status Atual:</strong> ${radio.status}</p>
                    <p><strong>Cadastrado por:</strong> ${radio.cadastradoPor ? radio.cadastradoPor.email : 'N/A'}</p>
                    <p><strong>Cadastrado em:</strong> ${new Date(radio.createdAt).toLocaleDateString('pt-BR')}</p>
                    <p><strong>Status no Sistema:</strong> ${radio.ativo ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-danger">Excluído</span>'}</p>
                </div>
            </div>
        `;

        // Monta a tabela com o histórico de eventos
        if (historico.length > 0) {
            html += `
                <h4 class="mb-3">Histórico de Eventos</h4>
                <table class="table table-bordered table-hover table-sm">
                    <thead class="table-light">
                        <tr><th>Data</th><th>Tipo de Evento</th><th>Descrição</th><th>Detalhes</th></tr>
                    </thead>
                    <tbody>
            `;
            historico.forEach(evento => {
                const dataFormatada = new Date(evento.data).toLocaleString('pt-BR');
                const tipoFormatado = evento.tipo.replace(/_/g, ' ');
                const detalhes = evento.detalhes ? JSON.stringify(evento.detalhes, null, 2) : 'N/A';

                html += `
                    <tr>
                        <td>${dataFormatada}</td>
                        <td><span class="badge bg-secondary">${tipoFormatado}</span></td>
                        <td>${evento.descricao}</td>
                        <td><pre style="white-space: pre-wrap; word-break: break-all;">${detalhes}</pre></td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="text-center">Nenhum evento de movimentação encontrado para este rádio.</p>';
        }

        resultadoDiv.innerHTML = html;

    } catch (err) {
        console.error('Erro ao buscar histórico completo:', err);
        resultadoDiv.innerHTML = '';
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor.', 'danger');
    } finally {
        if (btnBuscar) {
            btnBuscar.disabled = false;
            btnBuscar.textContent = 'Buscar Histórico';
        }
    }
}

// A função getBadgeClassForEventType não é mais necessária, mas pode manter se quiser
function getBadgeClassForEventType(tipoEvento) {
    if (tipoEvento.includes('Saída')) return 'danger';
    if (tipoEvento.includes('Retorno')) return 'success';
    if (tipoEvento.includes('Solicitação')) return 'info text-dark';
    if (tipoEvento.includes('Início')) return 'primary';
    if (tipoEvento.includes('Fim')) return 'success';
    return 'secondary';
}