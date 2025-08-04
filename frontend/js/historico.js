// frontend/js/historico.js

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
        // Se checkAuthentication lançar erro, o corpo da página já foi alterado pela função.
    }
});

/**
 * Formata o tipo de evento para exibição amigável.
 * @param {string} tipoEvento - O tipo de evento do backend.
 * @returns {string} O tipo de evento formatado.
 */
function formatarTipoEvento(tipoEvento) {
    switch (tipoEvento) {
        case 'NF_SAIDA': return 'Saída por NF';
        case 'NF_ENTRADA': return 'Entrada por NF';
        case 'MANUTENCAO_SOLICITADA': return 'Manutenção Solicitada';
        case 'MANUTENCAO_INICIADA': return 'Manutenção Iniciada';
        case 'MANUTENCAO_FINALIZADA': return 'Manutenção Finalizada';
        case 'MANUTENCAO_CANCELADA': return 'Manutenção Cancelada';
        default: return tipoEvento.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Fallback
    }
}

async function buscarHistoricoRadio() {
    const numeroSerieInput = document.getElementById('numeroSerieBusca');
    const numeroSerie = numeroSerieInput.value.trim();
    const resultadoDiv = document.getElementById('resultadoHistorico');
    const btnBuscar = document.getElementById('btnBuscarHistorico');

    resultadoDiv.innerHTML = ''; // Limpa resultados anteriores

    if (!numeroSerie) {
        showAlert('Campo Obrigatório', 'Por favor, informe um número de série para a busca.', 'warning');
        return;
    }

    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = 'Buscando...';
    }
    resultadoDiv.innerHTML = '<p class="text-center">Buscando histórico completo...</p>';

    try {
        const token = localStorage.getItem('token');
        // CHAMA A NOVA ROTA DO BACKEND
        const res = await fetch(`/api/radios/${numeroSerie}/historico-completo`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            let errorMessage = 'Histórico não encontrado ou acesso negado.';
            if (res.status === 404) {
                errorMessage = `Nenhum histórico encontrado para o número de série: ${numeroSerie}.`;
            } else {
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) { /* Mantém a mensagem padrão se não conseguir parsear JSON */ }
            }
            resultadoDiv.innerHTML = ''; // Limpa o "Buscando..."
            showAlert('Busca Concluída', errorMessage, res.status === 404 ? 'info' : 'warning');
            return;
        }

        const historicoCombinado = await res.json();

        if (!Array.isArray(historicoCombinado) || historicoCombinado.length === 0) {
            resultadoDiv.innerHTML = ''; // Limpa o "Buscando..."
            showAlert('Sem Resultados', `Nenhum evento no histórico encontrado para o rádio com número de série: ${numeroSerie}.`, 'info');
            return;
        }

        // Constrói a nova tabela com os dados combinados
        let html = `
            <h4 class="mt-3 mb-3">Histórico Completo para o Rádio: ${numeroSerie}</h4>
            <table class="table table-bordered table-hover table-sm">
                <thead class="table-light"> 
                    <tr>
                        <th>Data</th>
                        <th>Tipo de Evento</th>
                        <th>Documento / Referência</th>
                        <th>Detalhes</th>
                    </tr>
                </thead>
                <tbody>
        `;

        historicoCombinado.forEach(evento => {
            const dataEventoFormatada = evento.dataEvento ? 
                new Date(evento.dataEvento).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit' 
                }) : 'N/A';
            
            const tipoEventoFormatado = formatarTipoEvento(evento.tipoEvento);
            
            html += `
                <tr>
                    <td>${dataEventoFormatada}</td>
                    <td><span class="badge bg-${getBadgeClassForEventType(evento.tipoEvento)}">${tipoEventoFormatado}</span></td>
                    <td>${evento.documento || 'N/A'}</td>
                    <td>${evento.detalhes || 'N/A'}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        resultadoDiv.innerHTML = html;

    } catch (err) {
        console.error('Erro ao buscar histórico completo:', err);
        resultadoDiv.innerHTML = ''; // Limpa o "Buscando..."
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para buscar o histórico.', 'danger');
    } finally {
        if (btnBuscar) {
            btnBuscar.disabled = false;
            btnBuscar.textContent = 'Buscar Histórico';
        }
    }
}

/**
 * Retorna uma classe de badge Bootstrap com base no tipo de evento.
 * @param {string} tipoEvento - O tipo do evento.
 * @returns {string} A classe CSS do badge.
 */
function getBadgeClassForEventType(tipoEvento) {
    if (tipoEvento.includes('NF_SAIDA')) return 'danger';
    if (tipoEvento.includes('NF_ENTRADA')) return 'success';
    if (tipoEvento.includes('MANUTENCAO_SOLICITADA')) return 'info text-dark';
    if (tipoEvento.includes('MANUTENCAO_INICIADA')) return 'primary';
    if (tipoEvento.includes('MANUTENCAO_FINALIZADA')) return 'success';
    if (tipoEvento.includes('MANUTENCAO_CANCELADA')) return 'secondary';
    return 'light text-dark'; // Default
}