// frontend/js/historico.js

document.addEventListener('DOMContentLoaded', () => {
    try {
        checkAuthentication('historico'); // Permissão para 'historico' ou 'admin'

        const btnBuscar = document.getElementById('btnBuscarHistorico');
        if (btnBuscar) {
            btnBuscar.addEventListener('click', buscarHistoricoRadio);
        }
        
        // Adiciona listener para a tecla Enter no campo de número de série
        const numeroSerieInput = document.getElementById('numeroSerieBusca');
        if (numeroSerieInput) {
            numeroSerieInput.addEventListener('keypress', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault(); // Impede o comportamento padrão do Enter (ex: submeter formulário se houver)
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
    resultadoDiv.innerHTML = '<p class="text-center">Buscando histórico...</p>';


    try {
        const token = localStorage.getItem('token');
        // Usando URL relativa. O backend usa /extrato/:numeroSerie para esta funcionalidade.
        const res = await fetch(`/extrato/${numeroSerie}`, {
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
            showAlert('Busca Concluída', errorMessage, res.status === 404 ? 'info' : 'warning'); // 'info' para "não encontrado"
            return;
        }

        const historico = await res.json();

        if (!Array.isArray(historico) || historico.length === 0) {
            resultadoDiv.innerHTML = ''; // Limpa o "Buscando..."
            showAlert('Sem Resultados', `Nenhum histórico de NF encontrado para o rádio com número de série: ${numeroSerie}.`, 'info');
            return;
        }

        let html = `
            <h4 class="mt-3 mb-3">Histórico para o Rádio: ${numeroSerie}</h4>
            <table class="table table-bordered table-hover">
                <thead> <tr>
                        <th>NF</th>
                        <th>Cliente</th>
                        <th>Data de Saída</th>
                        <th>Previsão de Retorno</th>
                        <th>Data de Retorno</th>
                    </tr>
                </thead>
                <tbody>
        `;

        historico.sort((a, b) => new Date(b.dataSaida || b.dataEntrada) - new Date(a.dataSaida || a.dataEntrada)); // Ordena pelo mais recente

        historico.forEach(nf => {
            const dataSaidaF = nf.dataSaida ? new Date(nf.dataSaida).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '-';
            const previsaoRetornoF = nf.previsaoRetorno ? new Date(nf.previsaoRetorno).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '-';
            const dataEntradaF = nf.dataEntrada ? new Date(nf.dataEntrada).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '-';
            
            html += `
                <tr>
                    <td>${nf.nfNumero || 'N/A'}</td>
                    <td>${nf.cliente || 'N/A'}</td>
                    <td>${dataSaidaF}</td>
                    <td>${previsaoRetornoF}</td>
                    <td>${dataEntradaF}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        resultadoDiv.innerHTML = html;

    } catch (err) {
        console.error('Erro ao buscar histórico:', err);
        resultadoDiv.innerHTML = ''; // Limpa o "Buscando..."
        showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor para buscar o histórico.', 'danger');
    } finally {
        if (btnBuscar) {
            btnBuscar.disabled = false;
            btnBuscar.textContent = 'Buscar Histórico';
        }
    }
}