<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title ?? 'Connexion') ?> - Dépistage Rétinopathie</title>
    <link rel="stylesheet" href="/diabetic-retinopathy/php-app/public/css/app.css">
</head>
<body class="login-page">
    <div class="login-container">
        <div class="login-card">
            <div class="login-header">
                <svg class="login-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="4"/>
                    <line x1="21.17" y1="8" x2="12" y2="8"/>
                    <line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
                    <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
                </svg>
                <h1 class="login-title">Dépistage Rétinopathie Diabétique</h1>
                <p class="login-subtitle">
                    <?php if (($role ?? '') === 'doctor'): ?>
                        Espace Médecin
                    <?php else: ?>
                        Espace Administration
                    <?php endif; ?>
                </p>
            </div>
            
            <div class="login-body">
                <div id="loginError" class="alert alert-danger hidden"></div>
                
                <form id="loginForm">
                    <div class="form-group">
                        <label for="email" class="form-label required">Adresse email</label>
                        <input 
                            type="email" 
                            id="email" 
                            name="email" 
                            class="form-control" 
                            placeholder="votre@email.fr"
                            data-validate="required|email"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="password" class="form-label required">Mot de passe</label>
                        <input 
                            type="password" 
                            id="password" 
                            name="password" 
                            class="form-control" 
                            placeholder="••••••••"
                            data-validate="required"
                            required
                        >
                    </div>
                    
                    <button type="submit" class="btn btn-primary btn-lg w-full" id="submitBtn">
                        <span id="btnText">Se connecter</span>
                        <span id="btnLoading" class="hidden">Connexion...</span>
                    </button>
                </form>
            </div>
            
            <div class="login-footer">
                <?php if (($role ?? '') === 'doctor'): ?>
                    <a href="/diabetic-retinopathy/php-app/public/login">Accès Administration</a>
                <?php else: ?>
                    <a href="/diabetic-retinopathy/php-app/public/doctor/login">Accès Médecin</a>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <script src="/diabetic-retinopathy/php-app/public/js/app.js"></script>
    <script>
        const loginForm = document.getElementById('loginForm');
        const loginError = document.getElementById('loginError');
        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const btnLoading = document.getElementById('btnLoading');
        const expectedRole = '<?= $role ?? "center_admin" ?>';

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validate form
            const { isValid, errors } = Validator.validate(loginForm);
            if (!isValid) {
                Validator.showErrors(loginForm, errors);
                return;
            }

            // Show loading
            submitBtn.disabled = true;
            btnText.classList.add('hidden');
            btnLoading.classList.remove('hidden');
            loginError.classList.add('hidden');

            try {
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;

                const user = await Auth.login(email, password);

                // Check role
                if (expectedRole === 'doctor' && user.role !== 'doctor') {
                    throw new Error('Accès réservé aux médecins');
                }
                if (expectedRole === 'center_admin' && user.role !== 'center_admin') {
                    throw new Error('Accès réservé aux administrateurs');
                }

                // Redirect based on role
                if (user.role === 'doctor') {
                    window.location.href = '/diabetic-retinopathy/php-app/public/doctor/dashboard';
                } else {
                    window.location.href = '/diabetic-retinopathy/php-app/public/center/patients';
                }

            } catch (error) {
                loginError.textContent = error.message || 'Échec de la connexion';
                loginError.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                btnText.classList.remove('hidden');
                btnLoading.classList.add('hidden');
            }
        });

        // Clear auth if on login page
        localStorage.removeItem('dr_auth_token');
        localStorage.removeItem('dr_user_data');
    </script>
</body>
</html>
