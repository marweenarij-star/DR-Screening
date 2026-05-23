<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Page Non Trouvée</title>
    <link rel="stylesheet" href="/diabetic-retinopathy/php-app/public/css/app.css">
</head>
<body>
    <div class="error-page">
        <div class="error-content">
            <div class="error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            </div>
            <h1 class="error-code">404</h1>
            <h2 class="error-title">Page Non Trouvée</h2>
            <p class="error-message">
                La page que vous recherchez n'existe pas ou a été déplacée.
            </p>
            <div class="error-actions">
                <a href="javascript:history.back()" class="btn btn-secondary">
                    ← Retour
                </a>
                <a href="/diabetic-retinopathy/php-app/public/" class="btn btn-primary">
                    Accueil
                </a>
            </div>
        </div>
    </div>

    <style>
        .error-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
            padding: var(--spacing-lg);
        }

        .error-content {
            text-align: center;
            max-width: 500px;
        }

        .error-icon {
            width: 120px;
            height: 120px;
            margin: 0 auto var(--spacing-lg);
            color: var(--gray-400);
        }

        .error-icon svg {
            width: 100%;
            height: 100%;
        }

        .error-code {
            font-size: 6rem;
            font-weight: 700;
            color: var(--primary);
            margin: 0;
            line-height: 1;
        }

        .error-title {
            font-size: 1.5rem;
            color: var(--gray-900);
            margin: var(--spacing-md) 0;
        }

        .error-message {
            color: var(--gray-600);
            margin-bottom: var(--spacing-xl);
        }

        .error-actions {
            display: flex;
            gap: var(--spacing-md);
            justify-content: center;
        }
    </style>
</body>
</html>
