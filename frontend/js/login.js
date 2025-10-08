// frontend/js/login.js

// ALTERADO: Adicionada a URL base da API com o seu IP
const API_BASE_URL = 'http://10.110.120.237:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const btnLogin = document.getElementById('btnLogin');

    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = 'index.html';
        return;
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
                // ALTERADO: Rota padronizada para autenticação
                const res = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, senha })
                });

                const data = await res.json();

// ...
if (res.ok) {
   
    localStorage.setItem('token', data.token);

    const usuario = {
        nome: data.nomeUsuario,
        permissoes: data.permissoes
    };


    localStorage.setItem('usuario', JSON.stringify(usuario));

    window.location.href = 'index.html';

}else {
                    showAlert('Falha no Login', data.message || 'Credenciais inválidas.', 'danger');
                }
            } catch (error) {
                console.error('Erro na requisição de login:', error);
                showAlert('Erro de Conexão', 'Não foi possível conectar ao servidor.', 'danger');
            } finally {
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.textContent = 'Entrar';
                }
            }
        });
    }
});