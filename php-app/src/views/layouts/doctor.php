<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?? 'DR Screening' ?></title>
    <link rel="stylesheet" href="/diabetic-retinopathy/php-app/public/css/app.css">
    <?= $head ?? '' ?>
</head>
<body>
    <div class="app-layout">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="4"/>
                    </svg>
                    <h1>DR Screening</h1>
                </div>
            </div>
            
            <nav class="sidebar-nav">
                <a href="/diabetic-retinopathy/php-app/public/doctor/dashboard" 
                   class="nav-item <?= $active === 'dashboard' ? 'active' : '' ?>">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    <span>Tableau de bord</span>
                </a>
                
                <a href="/diabetic-retinopathy/php-app/public/doctor/alerts" 
                   class="nav-item <?= $active === 'alerts' ? 'active' : '' ?>">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <span>Alertes</span>
                    <span class="nav-badge" id="alertBadge" style="display: none;">0</span>
                </a>
            </nav>
            
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar">M</div>
                    <div class="user-details">
                        <div class="user-name" id="doctorName">Médecin</div>
                        <div class="user-role">Ophtalmologue</div>
                    </div>
                </div>
                <a href="#" class="nav-item mt-sm" data-logout>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span>Déconnexion</span>
                </a>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <header class="page-header">
                <div class="page-header-content">
                    <h1 class="page-title"><?= $pageTitle ?? 'Page' ?></h1>
                    <?= $headerActions ?? '' ?>
                </div>
            </header>
            
            <div class="page-body">
                <?= $content ?? '' ?>
            </div>
        </main>
    </div>

    <script src="/diabetic-retinopathy/php-app/public/js/app.js"></script>
    <?= $scripts ?? '' ?>
</body>
</html>
