// frontend/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const btnLogin = document.getElementById('btnLogin');

    // Verifica se o usuário já está logado e redireciona para o index.html
    const token = localStorage.getItem('token');
    if (token) {
        // Opcional: verificar a validade do token antes de redirecionar.
        // Por simplicidade, vamos apenas redirecionar se o token existir.
        window.location.href = 'index.html';
        return; // Impede que o resto do script da página de login seja executado
    }


    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const senha = document.getElementById('senha').value;

            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.textContent = 'Entrando...';
            }

            try {
                // Usando URL relativa
                const res = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, senha })
                });

                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('permissoes', JSON.stringify(data.permissoes));
                    if (data.nome) { // Salva o nome do usuário se vier do backend
                        localStorage.setItem('nomeUsuario', data.nome);
                    }
                    window.location.href = 'index.html';
                } else {
                    // Usando o showAlert centralizado do ui.js
                    showAlert('Falha no Login', data.message || 'Credenciais inválidas ou erro no servidor.', 'danger');
                }
            } catch (error) {
                console.error('Erro na requisição de login:', error);
                showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor. Tente novamente.', 'danger');
            } finally {
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.textContent = 'Entrar';
                }
            }
        });
    }
});