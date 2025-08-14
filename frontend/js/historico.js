// frontend/js/historico.js

const API_BASE_URL = 'http://10.110.120.237:5000/api';

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

function formatarTipoEvento(tipoEvento) {
    // Nenhuma alteração aqui
    switch (tipoEvento) {
        case 'NF_SAIDA': return 'Saída por NF';
        case 'NF_ENTRADA': return 'Entrada por NF';
        case 'MANUTENCAO_SOLICITADA': return 'Manutenção Solicitada';
        case 'MANUTENCAO_INICIADA': return 'Manutenção Iniciada';
        case 'MANUTENCAO_FINALIZADA': return 'Manutenção Finalizada';
        case 'MANUTENCAO_CANCELADA': return 'Manutenção Cancelada';
        default: return tipoEvento.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
}

async function buscarHistoricoRadio() {
    const numeroSerieInput = document.getElementById('numeroSerieBusca');
    const numeroSerie = numeroSerieInput.value.trim();
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
    resultadoDiv.innerHTML = '<p class="text-center">Buscando histórico completo...</p>';

    try {
        const token = localStorage.getItem('token');
        
        // ALTERADO: Rota padronizada para buscar o histórico completo via Dashboard
        const res = await fetch(`${API_BASE_URL}/dashboard/radios/${numeroSerie}/historico-completo`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const errorMessage = errorData.message || (res.status === 404 ? `Nenhum rádio encontrado para a série: ${numeroSerie}.` : 'Erro ao buscar histórico.');
            resultadoDiv.innerHTML = '';
            showAlert('Busca Concluída', errorMessage, res.status === 404 ? 'info' : 'warning');
            return;
        }

        const data = await res.json();
        const historico = data.historico; // A resposta agora é um objeto { radio, historico }

        if (!Array.isArray(historico) || historico.length === 0) {
            resultadoDiv.innerHTML = '';
            showAlert('Sem Resultados', `Nenhum evento no histórico para a série: ${numeroSerie}.`, 'info');
            return;
        }

        let html = `
            <h4 class="mt-3 mb-3">Histórico Completo para o Rádio: ${numeroSerie}</h4>
            <table class="table table-bordered table-hover table-sm">
                <thead class="table-light"> 
                    <tr><th>Data</th><th>Tipo de Evento</th><th>Descrição</th><th>Detalhes</th></tr>
                </thead>
                <tbody>
        `;
        // A lógica de renderização foi ajustada para o novo formato do histórico do backend
        historico.forEach(evento => {
            const dataFormatada = new Date(evento.data).toLocaleString('pt-BR');
            const tipoFormatado = evento.tipo.replace(/_/g, ' ');
            const detalhes = evento.detalhes ? JSON.stringify(evento.detalhes, null, 2) : 'N/A';
            
            html += `
                <tr>
                    <td>${dataFormatada}</td>
                    <td><span class="badge bg-${getBadgeClassForEventType(evento.tipo)}">${tipoFormatado}</span></td>
                    <td>${evento.descricao}</td>
                    <td><pre style="white-space: pre-wrap; word-break: break-all;">${detalhes}</pre></td>
                </tr>
            `;
        });

        html += '</tbody></table>';
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

function getBadgeClassForEventType(tipoEvento) {
    // Nenhuma alteração aqui
    if (tipoEvento.includes('Saída')) return 'danger';
    if (tipoEvento.includes('Retorno')) return 'success';
    if (tipoEvento.includes('Solicitação')) return 'info text-dark';
    if (tipoEvento.includes('Início')) return 'primary';
    if (tipoEvento.includes('Fim')) return 'success';
    return 'secondary';
}