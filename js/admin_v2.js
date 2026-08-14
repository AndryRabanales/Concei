document.addEventListener('DOMContentLoaded', () => {
    // --- AUTHENTICATION ---
    const loginForm = document.getElementById('adminLoginForm');
    const errorMessage = document.getElementById('errorMessage');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }

    if (loginForm) {
        let isSetupMode = false;

        // Verificar si existen administradores en el sistema
        (async () => {
            try {
                const response = await fetch('php/api.php?action=get_admins');
                const result = await response.json();
                if (result.success && (!result.admins || result.admins.length === 0)) {
                    isSetupMode = true;
                    // Mostrar banner de modo setup
                    errorMessage.style.display = 'block';
                    errorMessage.style.background = '#e0f2fe';
                    errorMessage.style.color = '#0369a1';
                    errorMessage.style.borderColor = '#bae6fd';
                    errorMessage.innerHTML = '<i class="fa-solid fa-circle-info"></i> <strong>Modo Configuración Activo:</strong> No hay cuentas registradas. Haz clic en <strong>Ingresar al Panel</strong> directamente para crear el primer Super Administrador.';
                    
                    // Hacer campos opcionales
                    document.getElementById('email').removeAttribute('required');
                    document.getElementById('password').removeAttribute('required');
                }
            } catch (err) {
                console.error('Error al verificar administradores:', err);
            }
        })();

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = passwordInput.value;

            if (isSetupMode) {
                // Bypass login check since database is empty
                sessionStorage.setItem('isAdminLoggedIn', 'true');
                sessionStorage.setItem('adminUsername', 'Configuración Inicial');
                sessionStorage.setItem('adminRol', 'superadmin');
                sessionStorage.setItem('adminSetupMode', 'true');
                window.location.href = 'admin-dashboard.html?v=7';
                return;
            }

            try {
                const response = await fetch('php/api.php?action=admin_login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: email, password: password })
                });
                const result = await response.json();

                if (result.success) {
                    sessionStorage.setItem('isAdminLoggedIn', 'true');
                    sessionStorage.setItem('adminUsername', result.admin.username);
                    sessionStorage.setItem('adminRol', result.admin.rol);
                    sessionStorage.setItem('adminToken', result.token);
                    window.location.href = 'admin-dashboard.html?v=7';
                } else if (response.status === 429) {
                    errorMessage.style.display = 'block';
                    errorMessage.style.background = '#fee2e2';
                    errorMessage.style.color = '#b91c1c';
                    errorMessage.style.borderColor = '#fecaca';
                    errorMessage.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + (result.error || 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.');
                    setTimeout(() => {
                        errorMessage.style.display = 'none';
                    }, 5000);
                } else {
                    errorMessage.style.display = 'block';
                    errorMessage.style.background = '#fee2e2';
                    errorMessage.style.color = '#b91c1c';
                    errorMessage.style.borderColor = '#fecaca';
                    errorMessage.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Usuario o contraseña incorrectos.';
                    setTimeout(() => {
                        errorMessage.style.display = 'none';
                    }, 3000);
                }
            } catch (err) {
                console.error('Error de login:', err);
                errorMessage.style.display = 'block';
                errorMessage.style.background = '#fee2e2';
                errorMessage.style.color = '#b91c1c';
                errorMessage.style.borderColor = '#fecaca';
                errorMessage.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Error al conectar con el servidor.';
                setTimeout(() => { errorMessage.style.display = 'none'; }, 3000);
            }
        });
    }

    // --- CHECK SESSION ON DASHBOARD ---
    const isDashboard = window.location.pathname.includes('admin-dashboard.html');
    if (isDashboard) {
        if (sessionStorage.getItem('isAdminLoggedIn') !== 'true') {
            window.location.href = 'admin-login.html';
            return;
        }

        // Restringir área de administradores solo para Superadmin
        const adminRol = sessionStorage.getItem('adminRol');
        if (adminRol !== 'superadmin') {
            const adminsMenuItem = document.querySelector('.menu-item[data-type="admins"]');
            if (adminsMenuItem) {
                adminsMenuItem.style.display = 'none';
            }
        }
    }

    // --- DASHBOARD LOGIC ---
    if (isDashboard) {
        // Escape de HTML para datos controlados por usuarios (nombres, correos,
        // títulos, etc.). Evita XSS almacenado en el panel de administración.
        const esc = (s) => String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        // --- Global Event Delegation ---
        document.addEventListener('click', function(e) {
            let target = e.target;
            let btn = null;

            while (target && target !== document) {
                if (target.classList && target.classList.contains('action-btn')) {
                    btn = target;
                    break;
                }
                target = target.parentNode;
            }

            if (!btn) return;
            e.preventDefault();
            
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            const status = btn.dataset.status;
            const name = btn.dataset.name || '';

            if (action === 'deleteItem') {
                window.deleteItem(id, type);
            } else if (action === 'editItem') {
                window.editItem(id, type);
            } else if (action === 'deleteReg') {
                window.deleteReg(id);
            } else if (action === 'updateRegStatus') {
                window.updateRegStatus(id, status);
            } else if (action === 'viewUserDetail') {
                window.viewUserDetail(id);
            } else if (action === 'openDocReview') {
                window.openDocReview(id, name);
            }
        });
        const menuItems = document.querySelectorAll('.menu-item');
        const pageTitle = document.getElementById('pageTitle');
        const pageDescription = document.getElementById('pageDescription');
        const modal = document.getElementById('itemModal');
        const codeModal = document.getElementById('codeModal');
        const openModalBtn = document.getElementById('openModalBtn');
        const downloadSvgBtn = document.getElementById('downloadSvgBtn');
        const downloadRosterBtn = document.getElementById('downloadRosterBtn');
        const toggleActiveBtn = document.getElementById('toggleActiveBtn');
        const closeModalBtns = [
            document.getElementById('closeModalBtn'),
            document.querySelector('.close'),
            document.getElementById('closeCodeModalBtn'),
            document.getElementById('cancelCodeBtn')
        ];
        const itemForm = document.getElementById('itemForm');
        const saveItemBtn = document.getElementById('saveItemBtn');
        const generateCodesBtn = document.getElementById('generateCodesBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        // --- Sesión de administrador: token, cierre por inactividad y fetch autenticado ---
        const ADMIN_INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutos, igual que ADMIN_SESSION_TIMEOUT_MINUTES en api.php

        function clearAdminSession() {
            sessionStorage.removeItem('isAdminLoggedIn');
            sessionStorage.removeItem('adminUsername');
            sessionStorage.removeItem('adminRol');
            sessionStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminSetupMode');
        }

        function performLogout(expired) {
            const token = sessionStorage.getItem('adminToken');
            if (token) {
                fetch('php/api.php?action=admin_logout', { headers: { 'X-Admin-Token': token } }).catch(() => {});
            }
            clearAdminSession();
            if (expired) alert('Tu sesión ha expirado por inactividad. Por favor inicia sesión de nuevo.');
            window.location.href = 'admin-login.html';
        }

        // Wrapper de fetch que agrega el token de admin y maneja sesiones expiradas (401)
        let redirecting401 = false;
        async function adminFetch(url, options = {}) {
            const token = sessionStorage.getItem('adminToken');
            const headers = Object.assign({}, options.headers || {});
            if (token) headers['X-Admin-Token'] = token;
            const response = await fetch(url, Object.assign({}, options, { headers }));
            if (response.status === 401) {
                clearAdminSession();
                if (!redirecting401) {
                    redirecting401 = true;
                    setTimeout(() => { window.location.href = 'admin-login.html'; }, 1500);
                }
                // Cortar el flujo del llamador: la sesión expiró, no hay datos válidos
                throw new Error('Sesión expirada');
            }
            return response;
        }

        // Cierre de sesión automático por inactividad
        let lastActivityTime = Date.now();
        ['click', 'keydown', 'mousemove', 'scroll'].forEach(evt => {
            document.addEventListener(evt, () => { lastActivityTime = Date.now(); }, { passive: true });
        });
        setInterval(() => {
            if (Date.now() - lastActivityTime > ADMIN_INACTIVITY_LIMIT_MS) {
                performLogout(true);
            }
        }, 60 * 1000);

        let currentType = (sessionStorage.getItem('adminSetupMode') === 'true') ? 'admins' : 'registrations';
        let editingId = null;
        let editingActivo = 1;
        let highlightId = null; // Para resaltar nuevos elementos

        let editingAdminId = null;

        async function checkRecoveryEmailWarning() {
            try {
                const res = await adminFetch(`php/api.php?action=get_admins&t=${Date.now()}`);
                const data = await res.json();
                if (!data.success) return;
                const myUsername = sessionStorage.getItem('adminUsername');
                const me = (data.admins || []).find(a => a.username === myUsername);
                if (!me || me.recovery_email) return;

                if (document.getElementById('recoveryWarningBanner')) return;

                const banner = document.createElement('div');
                banner.id = 'recoveryWarningBanner';
                banner.style.cssText = 'background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px;';
                banner.innerHTML = `
                    <i class="fa-solid fa-triangle-exclamation" style="color:#dc2626;font-size:1.3rem;margin-top:2px;flex-shrink:0;"></i>
                    <div style="flex:1;">
                        <p style="margin:0 0 6px;font-weight:700;color:#dc2626;font-size:0.95rem;">Sin correo de recuperación registrado</p>
                        <p style="margin:0 0 10px;color:#7f1d1d;font-size:0.85rem;">Registra un correo Gmail de recuperación para poder restablecer tu contraseña si la olvidas. Sin este correo, necesitarás que un Super Administrador restablezca tu cuenta manualmente.</p>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                            <input type="email" id="recoveryEmailInput" placeholder="tucorreo@gmail.com"
                                style="padding:8px 12px;border:1px solid #fca5a5;border-radius:7px;font-size:0.88rem;flex:1;min-width:200px;max-width:320px;box-sizing:border-box;outline:none;">
                            <button type="button" id="saveRecoveryEmailBtn" style="background:#dc2626;color:white;border:none;padding:8px 16px;border-radius:7px;font-weight:700;cursor:pointer;font-size:0.85rem;white-space:nowrap;">
                                <i class="fa-solid fa-floppy-disk"></i> Guardar correo
                            </button>
                            <button type="button" id="dismissRecoveryWarning" style="background:transparent;color:#9ca3af;border:none;padding:8px;cursor:pointer;font-size:0.8rem;">
                                Recordar luego
                            </button>
                        </div>
                        <p id="recoveryEmailMsg" style="margin:6px 0 0;font-size:0.82rem;color:#dc2626;min-height:16px;"></p>
                    </div>
                `;

                const mainContent = document.querySelector('.main-content');
                const dashHeader = mainContent.querySelector('.dashboard-header');
                mainContent.insertBefore(banner, dashHeader);

                document.getElementById('saveRecoveryEmailBtn').addEventListener('click', async () => {
                    const email = document.getElementById('recoveryEmailInput').value.trim();
                    const msg = document.getElementById('recoveryEmailMsg');
                    if (!email) { msg.textContent = 'Ingresa un correo.'; return; }
                    const btn = document.getElementById('saveRecoveryEmailBtn');
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    try {
                        const r = await adminFetch('php/api.php?action=set_recovery_email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: myUsername, recovery_email: email })
                        });
                        const d = await r.json();
                        if (d.success) {
                            banner.style.cssText = 'background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px;';
                            banner.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#15803d;font-size:1.2rem;"></i><span style="color:#15803d;font-weight:700;">Correo de recuperación guardado correctamente.</span>';
                            setTimeout(() => banner.remove(), 3000);
                        } else {
                            msg.textContent = d.error || 'Error al guardar.';
                            btn.disabled = false;
                            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar correo';
                        }
                    } catch(e) {
                        msg.textContent = 'Error de conexión.';
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar correo';
                    }
                });

                document.getElementById('dismissRecoveryWarning').addEventListener('click', () => {
                    banner.remove();
                });
            } catch(e) {
                console.error('Error checking recovery email:', e);
            }
        }

        checkRecoveryEmailWarning();

        function renderAdminDashboard(container, admins) {
            container.innerHTML = `
                <div class="data-card" style="margin-bottom: 0;">
                    <h3 id="adminFormTitle" style="margin-bottom: 10px; font-size: 1.2rem; display: flex; align-items: center; gap: 8px; color: var(--admin-sidebar);">
                        <i class="fa-solid fa-user-plus" style="color: var(--primary-color);"></i> 
                        ${editingAdminId ? 'Editar Administrador' : 'Crear Administrador'}
                    </h3>
                    <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 20px;">
                        ${editingAdminId ? 'Modifica los datos del administrador y guarda los cambios.' : 'Crea una nueva cuenta de administrador ingresando su correo y contraseña.'}
                    </p>
                    <form id="adminForm" onsubmit="event.preventDefault();">
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="adminEmail" style="font-weight: 600; display: block; margin-bottom: 6px; font-size: 0.9rem; color: #475569;">Correo Electrónico</label>
                            <input type="email" id="adminEmail" required placeholder="ejemplo@dranabel.com" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; box-sizing: border-box;">
                        </div>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="adminPassword" style="font-weight: 600; display: block; margin-bottom: 6px; font-size: 0.9rem; color: #475569;">Contraseña</label>
                            <input type="password" id="adminPassword" placeholder="${editingAdminId ? 'Nueva contraseña (vacía para conservar)' : 'Mínimo 8 caracteres'}" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; box-sizing: border-box;">
                        </div>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="adminRecoveryEmail" style="font-weight: 600; display: block; margin-bottom: 6px; font-size: 0.9rem; color: #475569;">
                                Correo de recuperación <span style="color:#dc2626;font-size:0.8rem;font-weight:400;">(Gmail recomendado)</span>
                            </label>
                            <input type="email" id="adminRecoveryEmail" placeholder="correo@gmail.com (opcional)" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; box-sizing: border-box;">
                            <p style="font-size:0.78rem;color:#64748b;margin-top:4px;">Este correo recibirá el código para restablecer la contraseña si se olvida.</p>
                        </div>
                        <div class="form-group" style="margin-bottom: 25px;">
                            <label for="adminRole" style="font-weight: 600; display: block; margin-bottom: 6px; font-size: 0.9rem; color: #475569;">Rol</label>
                            <select id="adminRole" ${admins.length === 0 ? 'disabled' : ''} style="width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; background: ${admins.length === 0 ? '#f1f5f9' : 'white'};">
                                ${admins.length === 0 ? '<option value="superadmin" selected>Super Administrador (Obligatorio para el primer usuario)</option>' : `
                                <option value="admin">Administrador</option>
                                <option value="superadmin">Super Administrador</option>
                                `}
                            </select>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button type="button" class="btn-save" id="btnSubmitAdmin" style="flex-grow: 1; padding: 12px; font-weight: 600; justify-content: center; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <i class="fa-solid fa-check"></i> ${editingAdminId ? 'Guardar Cambios' : 'Crear Admin'}
                            </button>
                            ${editingAdminId ? `
                                <button type="button" class="btn-cancel" id="btnCancelAdminEdit" style="padding: 12px; font-weight: 600; cursor: pointer;">
                                    Cancelar
                                </button>
                            ` : ''}
                        </div>
                    </form>
                </div>
                
                <div class="data-card" style="margin-bottom: 0;">
                    <h3 style="margin-bottom: 10px; font-size: 1.2rem; display: flex; align-items: center; gap: 8px; color: var(--admin-sidebar);">
                        <i class="fa-solid fa-users-gear" style="color: var(--primary-color);"></i> 
                        Administradores Activos
                    </h3>
                    <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 20px;">
                        Lista de usuarios con acceso al panel de administración.
                    </p>
                    <div style="overflow-x: auto;">
                        <table class="data-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th style="text-align: left; padding: 12px 15px;">Correo</th>
                                    <th style="text-align: left; padding: 12px 15px;">Rol</th>
                                    <th style="text-align: left; padding: 12px 15px;">Correo recuperación</th>
                                    <th style="text-align: right; padding: 12px 15px;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${admins.map(adm => {
                                    const isSelf = adm.username === sessionStorage.getItem('adminUsername');
                                    const roleLabel = adm.rol === 'superadmin' ? 'Super Admin' : 'Admin';
                                    const roleClass = adm.rol === 'superadmin' ? 'status-pill-success' : 'status-pill-warning';
                                    const recoveryBadge = adm.recovery_email
                                        ? `<span style="font-size:0.8rem;color:#15803d;"><i class="fa-solid fa-circle-check"></i> ${esc(adm.recovery_email)}</span>`
                                        : `<span style="font-size:0.8rem;color:#dc2626;font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Sin registrar</span>`;
                                    return `
                                        <tr>
                                            <td style="padding: 12px 15px; border-bottom: 1px solid var(--border-color);">
                                                <strong style="color: #1e293b;">${esc(adm.username)}</strong>
                                                ${isSelf ? '<span style="font-size:0.75rem; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius:4px; font-weight:bold; margin-left: 6px;">Tú</span>' : ''}
                                            </td>
                                            <td style="padding: 12px 15px; border-bottom: 1px solid var(--border-color);">
                                                <span class="status-pill ${roleClass}">${roleLabel}</span>
                                            </td>
                                            <td style="padding: 12px 15px; border-bottom: 1px solid var(--border-color);">
                                                ${recoveryBadge}
                                            </td>
                                            <td style="padding: 12px 15px; text-align: right; border-bottom: 1px solid var(--border-color);" class="actions">
                                                <button class="btn-icon btn-edit" onclick="window.editAdmin(${parseInt(adm.id, 10)})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                                                <button class="btn-icon btn-delete" onclick="window.deleteAdmin(${adm.id}, ${isSelf})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Zona de peligro: reseteo total de usuarios (obs. 6-ago, Cambio 2) -->
                    <div style="margin-top: 22px; padding: 16px 18px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;">
                        <p style="margin: 0 0 6px; font-weight: 700; color: #b91c1c; font-size: 0.95rem;"><i class="fa-solid fa-triangle-exclamation"></i> Zona de peligro</p>
                        <p style="margin: 0 0 12px; color: #7f1d1d; font-size: 0.83rem;">Elimina a TODOS los usuarios registrados, libera talleres/visitas y reinicia el contador de ID a 0001. Útil para poner el sistema en cero después de las pruebas.</p>
                        <button type="button" id="btnResetUsuarios" style="background: #b91c1c; color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer;">
                            <i class="fa-solid fa-radiation"></i> Reseteo de Usuarios
                        </button>
                    </div>
                </div>
            `;

            // ── Reseteo total de usuarios: doble confirmación (textos de la observación) ──
            const btnReset = document.getElementById('btnResetUsuarios');
            if (btnReset) {
                btnReset.onclick = async () => {
                    const c1 = window.confirm(
                        "Esta acción eliminará a TODOS los usuarios registrados actualmente y reiniciará el contador de identificador de usuario al 0001. " +
                        "¿Está seguro de querer eliminar a TODOS los usuarios registrados actualmente?"
                    );
                    if (!c1) return;
                    const c2 = window.confirm("Una vez ejecutada esta acción, no se podrán recuperar los usuarios registrados.");
                    if (!c2) return;
                    btnReset.disabled = true;
                    btnReset.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reseteando...';
                    try {
                        const res = await adminFetch('php/api.php?action=reset_users', { method: 'POST' });
                        const result = await res.json();
                        if (result.success) {
                            alert('✅ Reseteo completado: todos los usuarios fueron eliminados, los cupos liberados y el contador de ID reiniciado a 0001.');
                        } else {
                            alert('Error: ' + (result.error || 'No se pudo completar el reseteo.'));
                        }
                    } catch (err) {
                        alert('Error al conectar con el servidor: ' + err.message);
                    } finally {
                        btnReset.disabled = false;
                        btnReset.innerHTML = '<i class="fa-solid fa-radiation"></i> Reseteo de Usuarios';
                    }
                };
            }

            // If we are editing, populate the fields
            if (editingAdminId) {
                const targetAdmin = admins.find(a => a.id === editingAdminId);
                if (targetAdmin) {
                    document.getElementById('adminEmail').value = targetAdmin.username;
                    document.getElementById('adminRole').value = targetAdmin.rol;
                    document.getElementById('adminRecoveryEmail').value = targetAdmin.recovery_email || '';
                }
            }

            // Bind events
            const btnSubmit = document.getElementById('btnSubmitAdmin');
            if (btnSubmit) {
                btnSubmit.onclick = async () => {
                    const email = document.getElementById('adminEmail').value.trim();
                    const password = document.getElementById('adminPassword').value;
                    const role = admins.length === 0 ? 'superadmin' : document.getElementById('adminRole').value;
                    const recoveryEmailVal = document.getElementById('adminRecoveryEmail').value.trim();

                    if (!email) {
                        alert('Por favor, ingresa el correo electrónico.');
                        return;
                    }
                    if (!editingAdminId && !password) {
                        alert('Por favor, ingresa la contraseña para el nuevo administrador.');
                        return;
                    }
                    if (password && password.length < 8) {
                        alert('La contraseña debe tener al menos 8 caracteres.');
                        return;
                    }

                    // Save
                    const wasBootstrap = admins.length === 0 && !editingAdminId;
                    try {
                        const response = await adminFetch('php/api.php?action=save_admin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                id: editingAdminId,
                                username: email,
                                password: password,
                                rol: role
                            })
                        });
                        const result = await response.json();
                        if (result.success) {
                            // Save recovery email if provided
                            if (recoveryEmailVal) {
                                try {
                                    await adminFetch('php/api.php?action=set_recovery_email', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ username: email, recovery_email: recoveryEmailVal })
                                    });
                                } catch(e) {}
                            }

                            alert(result.message || 'Operación realizada con éxito.');

                            // If current admin updated their own username, update session storage
                            if (editingAdminId) {
                                const originalUsername = admins.find(a => a.id === editingAdminId)?.username;
                                if (originalUsername === sessionStorage.getItem('adminUsername')) {
                                    sessionStorage.setItem('adminUsername', email);
                                }
                            }

                            // Si se creó el primer administrador (modo configuración), obtener
                            // un token de sesión real iniciando sesión con esas credenciales.
                            if (wasBootstrap) {
                                try {
                                    const loginResponse = await fetch('php/api.php?action=admin_login', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ username: email, password: password })
                                    });
                                    const loginResult = await loginResponse.json();
                                    if (loginResult.success) {
                                        sessionStorage.setItem('adminUsername', loginResult.admin.username);
                                        sessionStorage.setItem('adminRol', loginResult.admin.rol);
                                        sessionStorage.setItem('adminToken', loginResult.token);
                                        sessionStorage.removeItem('adminSetupMode');
                                    }
                                } catch (err) {
                                    console.error('Error al iniciar sesión tras crear el primer administrador:', err);
                                }
                            }

                            editingAdminId = null;
                            renderItems();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (err) {
                        console.error('Error al guardar admin:', err);
                        alert('Error al conectar con el servidor.');
                    }
                };
            }

            const btnCancel = document.getElementById('btnCancelAdminEdit');
            if (btnCancel) {
                btnCancel.onclick = () => {
                    editingAdminId = null;
                    renderItems();
                };
            }
        }

        window.editAdmin = (id, username, rol) => {
            editingAdminId = id;
            renderItems();
        };

        window.deleteAdmin = async (id, isSelf) => {
            let msg = '¿Estás seguro de que deseas eliminar a este administrador? Perderá el acceso de inmediato.';
            if (isSelf) {
                msg = '⚠️ ¡ATENCIÓN! Estás a punto de eliminar TU PROPIA CUENTA. Si la eliminas, tu sesión se cerrará de inmediato y la base de datos quedará vacía (activando el Modo Configuración). ¿Deseas continuar?';
            }
            const confirmed = await showConfirm(msg);
            if (confirmed) {
                try {
                    const response = await adminFetch(`php/api.php?action=delete_admin&id=${id}&t=${Date.now()}`);
                    const result = await response.json();
                    if (result.success) {
                        if (isSelf) {
                            alert('Tu cuenta ha sido eliminada. La base de datos está vacía. Serás redirigido al panel de inicio de sesión.');
                            clearAdminSession();
                            window.location.href = 'admin-login.html';
                        } else {
                            renderItems();
                        }
                    } else {
                        alert('Error al eliminar: ' + result.error);
                    }
                } catch (err) {
                    console.error('Error al eliminar admin:', err);
                    alert('Error al conectar con el servidor.');
                }
            }
        };


        async function getData() {
            const response = await fetch(`php/api.php?action=get_initial_data&t=${Date.now()}`);
            return await response.json();
        }

        async function renderItems() {
            const data = await getData();
            let items = [];
            const adminSec = document.getElementById('adminSectionContainer');

            if (currentType === 'registrations') {
                const regResponse = await adminFetch(`php/api.php?action=get_registrations&t=${Date.now()}`);
                const regData = await regResponse.json();
                items = regData.registrations || [];
            } else if (currentType === 'admins') {
                const response = await adminFetch(`php/api.php?action=get_admins&t=${Date.now()}`);
                const result = await response.json();
                items = result.admins || [];
            } else if (currentType === 'code') {
                // Endpoint admin dedicado: incluye quién usó cada código (dato
                // sensible que NO se expone en el get_initial_data público).
                const response = await adminFetch(`php/api.php?action=get_codes&t=${Date.now()}`);
                const result = await response.json();
                items = result.codes || [];
            } else {
                items = data[currentType] || [];
            }

            if (!itemsList) return;
            itemsList.innerHTML = '';

            const thead = document.querySelector('.data-table thead tr');

            if (currentType === 'admins') {
                document.querySelector('.data-card').style.display = 'none';
                openModalBtn.style.display = 'none';
                
                let adminSec = document.getElementById('adminSectionContainer');
                if (!adminSec) {
                    adminSec = document.createElement('div');
                    adminSec.id = 'adminSectionContainer';
                    adminSec.style.cssText = 'display: grid; grid-template-columns: 1fr 1.5fr; gap: 30px; margin-top: 20px;';
                    
                    const mediaQuery = window.matchMedia('(max-width: 900px)');
                    const handleMedia = (e) => {
                        if (e.matches) {
                            adminSec.style.gridTemplateColumns = '1fr';
                        } else {
                            adminSec.style.gridTemplateColumns = '1fr 1.5fr';
                        }
                    };
                    mediaQuery.addListener(handleMedia);
                    handleMedia(mediaQuery);
                    
                    document.querySelector('.data-card').parentNode.appendChild(adminSec);
                }
                adminSec.style.display = 'grid';
                renderAdminDashboard(adminSec, items);
                return;
            } else {
                document.querySelector('.data-card').style.display = 'block';
                if (adminSec) adminSec.style.display = 'none';
                document.querySelector('.data-table').style.display = 'table';
            }


            if (currentType === 'code') {
                thead.innerHTML = `<th>Código</th><th>Estado</th><th>Usado por</th><th>Fecha de Creación</th><th>Acciones</th>`;
                openModalBtn.style.display = 'flex';
                toggleActiveBtn.style.display = 'none';
            } else if (currentType === 'registrations') {
                thead.innerHTML = `<th>Nombre</th><th>Email</th><th>Documentos</th><th>Concepto</th><th>Monto</th><th>Acciones</th>`;
                openModalBtn.style.display = 'none';
                toggleActiveBtn.style.display = 'none';
            } else if (currentType === 'workshop' || currentType === 'visit') {
                thead.innerHTML = `<th>ID</th><th>Nombre</th><th>Detalles</th><th>Horario / Modalidad</th><th>Precio / Cupo</th><th>Acciones</th>`;
                openModalBtn.style.display = 'flex';

                // El botón refleja la acción a realizar: si TODOS los items
                // están activos, se ofrece desactivar todos; si alguno está
                // inactivo, se ofrece activar todos.
                const allActive = items.length > 0 && items.every(item => String(item.activo) !== '0');
                toggleActiveBtn.style.display = 'flex';
                toggleActiveBtn.dataset.targetActive = allActive ? '0' : '1';
                toggleActiveBtn.innerHTML = allActive
                    ? '<i class="fa-solid fa-power-off"></i> Desactivar Todos'
                    : '<i class="fa-solid fa-power-off"></i> Activar Todos';
            } else {
                thead.innerHTML = `<th>ID</th><th>Nombre</th><th>Detalles</th><th>Horario / Modalidad</th><th>Precio / Cupo</th><th>Acciones</th>`;
                openModalBtn.style.display = 'flex';
                toggleActiveBtn.style.display = 'none';
            }
 
            items.forEach(item => {
                const tr = document.createElement('tr');
                
                // Resaltar si es el elemento recién guardado o editado
                const isHighlighted = highlightId && (item.id === highlightId || item.folio === highlightId);
                if (isHighlighted) {
                    tr.classList.add('blink-new');
                }

                // Etiqueta temporal de "NUEVO"
                const newBadge = isHighlighted ? `<span class="badge-new-item">¡NUEVO TALLER! <i class="fa-solid fa-triangle-exclamation"></i></span>` : '';

                if (currentType === 'code') {
                    tr.innerHTML = `
                        <td><strong style="font-size: 1.1rem; letter-spacing: 1px;">${item.id}</strong></td>
                        <td>
                            <span style="font-size: 0.85rem; padding: 4px 8px; border-radius: 4px; background: ${item.usado == 1 ? '#fee2e2' : '#dcfce7'}; color: ${item.usado == 1 ? '#ef4444' : '#16a34a'}; font-weight: bold;">
                                ${item.usado == 1 ? '<i class="fa-solid fa-xmark"></i> Ya Utilizado' : '<i class="fa-solid fa-check"></i> Disponible'}
                            </span>
                        </td>
                        <td>
                            ${item.usado_por
                                ? `<div style="font-size:0.85rem;"><strong style="color:#1e293b;">${esc(item.usado_por)}</strong>${item.usado_por_id ? `<br><span style="color:#64748b;font-size:0.78rem;">ID usuario: ${esc(item.usado_por_id)}</span>` : ''}${item.fecha_uso ? `<br><span style="color:#94a3b8;font-size:0.75rem;">${esc(item.fecha_uso)}</span>` : ''}</div>`
                                : '<span style="color:#94a3b8;font-size:0.85rem;">—</span>'}
                        </td>
                        <td><span style="color: #64748b; font-size: 0.9rem;"><i class="fa-regular fa-calendar"></i> ${item.date || 'Reciente'}</span></td>
                        <td class="actions">
                            <button class="btn-icon btn-delete action-btn" data-action="deleteItem" data-id="${item.id}" data-type="code"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                } else if (currentType === 'registrations') {
                    let conceptId = 'N/A';
                    if (item.concept && item.concept !== 'N/A') {
                        const match = item.concept.match(/^\d+/);
                        if (match) conceptId = match[0].padStart(4, '0');
                    }

                    // Bolitas de documentos: una bolita por cada archivo subido.
                    // Se agrupan por TIPO de documento, cada tipo en su propia línea
                    // con una mini-etiqueta, para que con muchas compras no se
                    // amontonen ni desborden la celda (observación 23-jul).
                    const DOC_DOTS = [
                        { label: 'Comprobante de Pago',          short: 'Pago', docsKey: 'docs_comprobante' },
                        { label: 'Identificación / Credencial',  short: 'ID',   docsKey: 'docs_identificacion' },
                        { label: 'Constancia Fiscal (RFC)',      short: 'RFC',  docsKey: 'docs_constancia' },
                    ];

                    const dotFor = (label, st) => {
                        const bg = st === 'aceptado' ? '#10b981' : st === 'rechazado' ? '#ef4444' : '#94a3b8';
                        return `<span title="${label}: ${st.toUpperCase()}" style="display:inline-block;width:13px;height:13px;border-radius:50%;background:${bg};border:2px solid ${bg};flex-shrink:0;"></span>`;
                    };

                    const dotRows = DOC_DOTS
                        .map(d => {
                            const estados = (item[d.docsKey] || '').split(',').filter(Boolean);
                            if (estados.length === 0) return '';
                            const dots = estados.map(st => dotFor(d.label, st)).join('');
                            return `<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px;">
                                        <span style="font-size:0.68rem;color:#94a3b8;font-weight:600;width:34px;flex-shrink:0;">${d.short}</span>
                                        ${dots}
                                    </div>`;
                        })
                        .filter(Boolean)
                        .join('');

                    const dotsWrapper = dotRows
                        ? `<div style="display:flex;flex-direction:column;gap:1px;">${dotRows}</div>`
                        : `<span style="color:#94a3b8;font-size:0.8rem;">Sin docs</span>`;

                    // Historial de conceptos generados: uno por cada compra/registro realizado
                    const conceptosArr = (item.conceptos_historial || '').split('||').filter(Boolean);
                    const totalesArr   = (item.totales_historial || '').split('||').filter(Boolean);

                    let conceptHtml, totalHtml;
                    if (conceptosArr.length > 0) {
                        conceptHtml = conceptosArr.map(c =>
                            `<code style="display:block;background: #f1f5f9; padding: 2px 5px; border-radius: 4px; margin-bottom:4px; font-size:0.8rem;">${c}</code>`
                        ).join('');
                        totalHtml = totalesArr.map(t =>
                            `<span style="display:block; font-weight:500; margin-bottom:4px;">${t}</span>`
                        ).join('');
                    } else {
                        conceptHtml = `<code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px;">${item.concept || 'N/A'}</code>`;
                        totalHtml = item.total || '$0.00';
                    }

                    tr.innerHTML = `
                        <td style="font-weight: 600;">
                            <span style="color: var(--primary-color); font-weight: 700; background: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 6px; border-radius: 6px; font-size: 0.78rem; font-family: monospace; margin-right: 8px; display: inline-block; vertical-align: middle;">ID ${conceptId}</span>
                            <span style="vertical-align: middle;">${esc(item.fullName) || 'N/A'}</span>
                        </td>
                        <td>${esc(item.email) || 'N/A'}</td>
                        <td>${dotsWrapper}</td>
                        <td>${conceptHtml}</td>
                        <td>${totalHtml}</td>
                        <td>
                            <div class="actions">
                                <button class="btn-icon btn-edit action-btn" style="background: #e0f2fe; color: #0369a1;" data-action="viewUserDetail" data-id="${item.folio}" title="Ver Detalle Completo"><i class="fa-solid fa-eye"></i></button>
                                <button class="btn-icon btn-edit action-btn" style="background: #dcfce7; color: #15803d;" data-action="openDocReview" data-id="${item.folio}" data-name="${esc(item.fullName)}" title="Revisar Documentos"><i class="fa-solid fa-check"></i></button>
                                <button class="btn-icon btn-delete action-btn" data-action="deleteReg" data-id="${item.folio}" title="Eliminar Registro Permanente"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    `;
                } else if (currentType === 'workshop' || currentType === 'visit') {
                    const isActive = String(item.activo) !== '0';
                    const statusBadge = isActive
                        ? `<span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: #dcfce7; color: #15803d; font-weight: 600; display: inline-block; margin-bottom: 4px;"><i class="fa-solid fa-circle-check"></i> Activo</span>`
                        : `<span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: #fee2e2; color: #b91c1c; font-weight: 600; display: inline-block; margin-bottom: 4px;"><i class="fa-solid fa-circle-xmark"></i> Inactivo</span>`;
                    tr.innerHTML = `
                        <td><code style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">${item.id}</code></td>
                        <td>
                            ${statusBadge}
                            <strong style="display:block; margin-bottom: 4px; color: #1e293b;">${esc(item.name)}${newBadge}</strong>
                            <small style="color: var(--primary-color); display:block;"><strong>Instructor:</strong> ${esc(item.instructor) || 'Por definir'}</small>
                            ${item.lugar ? `<small style="color: #64748b; display:block;"><strong>Lugar:</strong> ${esc(item.lugar)}</small>` : ''}
                            <small style="color: #64748b; display:block;"><strong>Dependencia:</strong> ${esc(item.dependency) || 'N/A'}</small>
                        </td>
                        <td style="max-width: 250px;">
                            <small style="color: #6b7280; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
                                ${esc(item.description) || 'Sin descripción'}
                            </small>
                        </td>
                        <td>
                            <span style="font-weight: 500; display:block; margin-bottom: 4px;">${item.hours || 'N/A'}</span>
                            <span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: ${item.modality === 'Virtual' ? '#dbeafe' : '#fce7f3'}; color: ${item.modality === 'Virtual' ? '#1e40af' : '#be185d'}; font-weight: 600;">
                                <i class="fa-solid fa-${item.modality === 'Virtual' ? 'laptop' : 'users'}"></i> ${item.modality || 'Presencial'}
                            </span>
                        </td>
                        <td>
                            <span style="font-weight: 600; display:block;">$${parseFloat(item.price).toFixed(2)}</span>
                            <small style="color: ${ (item.cupo_actual || 0) >= (item.capacity || 0) ? '#ef4444' : '#475569' }; font-weight: ${ (item.cupo_actual || 0) >= (item.capacity || 0) ? 'bold' : 'normal' };">
                                <i class="fa-solid fa-user-group"></i> ${item.cupo_actual || 0} / ${item.capacity || 0}
                            </small>
                        </td>
                        <td>
                            <div class="actions">
                                <button class="btn-icon btn-edit action-btn" data-action="editItem" data-id="${item.id}" data-type="${currentType}"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn-icon btn-delete action-btn" data-action="deleteItem" data-id="${item.id}" data-type="${currentType}"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    `;
                }
                itemsList.appendChild(tr);
            });
        }

        // Sidebar Navigation
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                menuItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                currentType = item.dataset.type;

                downloadSvgBtn.style.display = 'none';
                if (downloadRosterBtn) downloadRosterBtn.style.display = 'none';
                document.getElementById('searchBarWrapper').style.display = 'none';
                document.getElementById('regSearchInput').value = '';

                if (currentType === 'workshop') {
                    pageTitle.textContent = 'Gestión de Talleres';
                    pageDescription.textContent = 'Administra los talleres disponibles del Congreso.';
                    openModalBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar Taller';
                } else if (currentType === 'visit') {
                    pageTitle.textContent = 'Gestión de Visitas Industriales';
                    pageDescription.textContent = 'Administra las visitas industriales disponibles para el congreso';
                    openModalBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar Visita';
                } else if (currentType === 'registrations') {
                    pageTitle.textContent = 'Usuarios Registrados';
                    pageDescription.textContent = 'Gestiona los registros, valida pagos y actualiza el estatus de los usuarios.';
                    openModalBtn.style.display = 'none';
                    downloadSvgBtn.style.display = 'flex';
                    if (downloadRosterBtn) downloadRosterBtn.style.display = 'flex';
                    document.getElementById('searchBarWrapper').style.display = 'block';
                } else if (currentType === 'admins') {
                    pageTitle.textContent = 'Gestión de Administradores';
                    pageDescription.textContent = 'Administra las cuentas de administrador y sus permisos de acceso.';
                    openModalBtn.style.display = 'none';
                } else {
                    pageTitle.textContent = 'Códigos de Registro';
                    pageDescription.textContent = 'Administra códigos únicos para registro gratuito con beneficios generales.';
                    openModalBtn.innerHTML = '<i class="fa-solid fa-gears"></i> Generar Códigos';
                }
                renderItems();
            });
        });

        // Modal Logic
        openModalBtn.onclick = () => {
            if (currentType === 'code') {
                document.getElementById('codePrefix').value = '';
                document.getElementById('codeQuantity').value = '10';
                codeModal.style.display = 'block';
                return;
            }

            editingId = null;
            editingActivo = 1;
            itemForm.reset();
            // El ID nunca es editable por el admin: en alta lo asigna el servidor
            // de forma secuencial (T01, T02...) y sin reutilizar números.
            document.getElementById('itemId').disabled = false;
            document.getElementById('itemId').readOnly = true;

            // Vista previa del ID que asignará el servidor (T01, T02... / V01...)
            if (currentType === 'workshop' || currentType === 'visit') {
                document.getElementById('itemId').placeholder = "Se asignará automáticamente";
                getData().then(data => {
                    const list = data[currentType] || [];
                    const prefix = currentType === 'workshop' ? 'T' : 'V';
                    let maxNum = 0;
                    
                    list.forEach(item => {
                        const match = item.id.match(new RegExp(`^${prefix}(\\d+)`, 'i'));
                        if (match) {
                            const num = parseInt(match[1], 10);
                            if (num > maxNum) {
                                maxNum = num;
                            }
                        }
                    });
                    
                    const nextNum = maxNum + 1;
                    const nextId = `${prefix}${nextNum.toString().padStart(2, '0')}`;
                    document.getElementById('itemId').value = nextId;
                }).catch(err => {
                    console.error("Error al generar ID automático:", err);
                    document.getElementById('itemId').value = '';
                });
            } else {
                document.getElementById('itemId').value = '';
            }

            // Limpiar contador de cupo actual y lugar al agregar nuevo
            const currentVal = document.getElementById('itemCurrentValue');
            if (currentVal) currentVal.value = '0';
            const lugarInput = document.getElementById('itemLugar');
            if (lugarInput) lugarInput.value = '';
            const typeLabel = currentType === 'workshop' ? 'Taller' : 'Visita';
            document.getElementById('modalTitle').textContent = `Agregar ${typeLabel}`;
            document.querySelector('label[for="itemName"]').textContent = `Nombre de la ${typeLabel}`;
            document.getElementById('itemName').placeholder = `Ej: ${currentType === 'workshop' ? 'Taller de Ciberseguridad' : 'Visita a Google México'}`;
            modal.style.display = 'block';
        };

        closeModalBtns.forEach(btn => {
            if (btn) {
                btn.onclick = () => {
                    modal.style.display = 'none';
                    if (codeModal) codeModal.style.display = 'none';
                };
            }
        });

        window.onclick = (e) => {
            if (e.target == modal) modal.style.display = 'none';
            if (e.target == codeModal) codeModal.style.display = 'none';
            if (e.target == document.getElementById('confirmModal')) document.getElementById('confirmModal').style.display = 'none';
        };

        // Helper para confirmación personalizada
        function showConfirm(message) {
            return new Promise((resolve) => {
                const cModal = document.getElementById('confirmModal');
                const msgEl = document.getElementById('confirmMessage');
                const yesBtn = document.getElementById('executeConfirmBtn');
                const noBtn = document.getElementById('cancelConfirmBtn');
                
                if (message) msgEl.textContent = message;
                cModal.style.display = 'block';
                
                const handleYes = () => {
                    cModal.style.display = 'none';
                    yesBtn.removeEventListener('click', handleYes);
                    noBtn.removeEventListener('click', handleNo);
                    resolve(true);
                };
                
                const handleNo = () => {
                    cModal.style.display = 'none';
                    yesBtn.removeEventListener('click', handleYes);
                    noBtn.removeEventListener('click', handleNo);
                    resolve(false);
                }
                
                yesBtn.addEventListener('click', handleYes);
                noBtn.addEventListener('click', handleNo);
            });
        }

        // CRUD Functions
        window.editItem = async (id, type) => {
            const data = await getData();
            const actualType = type || currentType;
            const item = data[actualType].find(i => i.id === id);
            if (item) {
                editingId = id;
                editingActivo = (item.activo === undefined || item.activo === null) ? 1 : parseInt(item.activo);
                document.getElementById('itemId').value = item.id;
                document.getElementById('itemId').disabled = true; // No permitir cambiar ID en edición para evitar duplicados
                document.getElementById('itemName').value = item.name;
                document.getElementById('itemDescription').value = item.description || '';
                document.getElementById('itemHours').value = item.hours || '';
                document.getElementById('itemPrice').value = item.price;
                document.getElementById('itemInstructor').value = item.instructor || '';
                document.getElementById('itemDependency').value = item.dependency || '';
                document.getElementById('itemModality').value = item.modality || 'Presencial';
                document.getElementById('itemLugar').value = item.lugar || '';
                document.getElementById('itemCapacity').value = item.capacity || 0;
                
                // Nuevo: Mostrar cupo actual (solo lectura en modal)
                const capacityGroup = document.getElementById('itemCapacity').parentElement;
                let currentGroup = document.getElementById('itemCurrentGroup');
                if (!currentGroup) {
                    currentGroup = document.createElement('div');
                    currentGroup.id = 'itemCurrentGroup';
                    currentGroup.className = 'form-group';
                    currentGroup.innerHTML = `<label>Ocupados Actualmente</label><input type="text" id="itemCurrentValue" disabled style="background:#f1f5f9">`;
                    capacityGroup.after(currentGroup);
                }
                document.getElementById('itemCurrentValue').value = item.cupo_actual || 0;

                const typeLabel = currentType === 'workshop' ? 'Taller' : 'Visita';
                document.getElementById('modalTitle').textContent = `Editar ${typeLabel}`;
                document.querySelector('label[for="itemName"]').textContent = `Nombre de la ${typeLabel}`;
                document.getElementById('itemName').placeholder = `Ej: ${currentType === 'workshop' ? 'Taller de Ciberseguridad' : 'Visita a Google México'}`;
                modal.style.display = 'block';
            }
        };

        window.deleteItem = async (id, type) => {
            const actualType = type || currentType;
            const confirmed = await showConfirm(`¿Estás seguro de que deseas eliminar este elemento?`);
            
            if (confirmed) {
                const url = `php/api.php?action=delete_item&id=${encodeURIComponent(id)}&type=${encodeURIComponent(actualType)}&t=${Date.now()}`;
                try {
                    const response = await adminFetch(url);
                    const result = await response.json();
                    if (result.success) {
                        renderItems();
                    } else {
                        alert(`Error al eliminar: ${result.error}`);
                    }
                } catch (err) {
                    console.error("Error en el borrado:", err);
                }
            }
        };

        saveItemBtn.onclick = async () => {
            const itemData = {
                id: document.getElementById('itemId').value.trim() || `${currentType === 'workshop' ? 'ws' : 'visit'}_${Date.now()}`,
                name: document.getElementById('itemName').value,
                description: document.getElementById('itemDescription').value,
                hours: document.getElementById('itemHours').value,
                price: parseFloat(document.getElementById('itemPrice').value),
                instructor: document.getElementById('itemInstructor').value,
                dependency: document.getElementById('itemDependency').value,
                modality: document.getElementById('itemModality').value,
                lugar: document.getElementById('itemLugar').value.trim(),
                capacity: parseInt(document.getElementById('itemCapacity').value) || 0,
                cupo_actual: parseInt(document.getElementById('itemCurrentValue')?.value) || 0,
                activo: editingActivo
            };

            if (!itemData.name || isNaN(itemData.price)) {
                alert('Por favor completa los campos requeridos.');
                return;
            }

            const response = await adminFetch(`php/api.php?action=save_item&type=${currentType}`, {
                method: 'POST',
                body: JSON.stringify(itemData)
            });
            const result = await response.json();
            if (result.success) {
                modal.style.display = 'none';
                highlightId = itemData.id; // Guardar ID para resaltar
                renderItems();
                
                // Limpiar el resaltado después de 6 segundos
                setTimeout(() => {
                    highlightId = null;
                    renderItems(); // Re-renderizar para quitar la etiqueta y el parpadeo
                }, 6000);
            } else {
                alert('Error al guardar: ' + result.error);
            }
        };

        // Bulk Code Generation Logic
        if (generateCodesBtn) {
            generateCodesBtn.onclick = async () => {
                const prefixInput = document.getElementById('codePrefix');
                const quantityInput = document.getElementById('codeQuantity');
                const prefix = prefixInput.value.trim().toUpperCase() || 'VIP';
                const quantity = parseInt(quantityInput.value) || 1;

                if (quantity < 1 || quantity > 500) {
                    alert("Cantidad no válida (1-500).");
                    return;
                }

                const newCodes = [];
                for (let i = 0; i < quantity; i++) {
                    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
                    newCodes.push({ id: `${prefix}-${randomSuffix}` });
                }

                const response = await adminFetch('php/api.php?action=generate_codes', {
                    method: 'POST',
                    body: JSON.stringify({ codes: newCodes })
                });
                const result = await response.json();
                if (result.success) {
                    codeModal.style.display = 'none';
                    renderItems();
                    alert(`¡Se han generado ${quantity} códigos correctamente!`);
                } else {
                    alert('Error al generar códigos: ' + result.error);
                }
            };
        }

        logoutBtn.onclick = (e) => {
            e.preventDefault();
            performLogout(false);
        };

        window.updateRegStatus = async (folio, newStatus) => {
            const response = await adminFetch('php/api.php?action=update_reg_status', {
                method: 'POST',
                body: JSON.stringify({ folio, status: newStatus })
            });
            const result = await response.json();
            if (result.success) {
                highlightId = folio;
                renderItems();
                setTimeout(() => {
                    highlightId = null;
                    renderItems();
                }, 6000);
            } else {
                alert('Error al actualizar estatus: ' + result.error);
            }
        };

        window.deleteReg = async (folio) => {
            const confirmed = await showConfirm('¿Estás seguro de que deseas eliminar este registro por completo?');
            if (confirmed) {
                const response = await adminFetch(`php/api.php?action=delete_reg&folio=${folio}&t=${Date.now()}`);
                const result = await response.json();
                if (result.success) {
                    renderItems();
                } else {
                    alert('Error al eliminar registro: ' + result.error);
                }
            }
        };

        // --- TABS CONTROL FOR DETAIL MODAL ---
        window.switchDetailTab = (tabName) => {
            window.__activeDetailTab = tabName; // recordar pestaña activa (para refrescos)
            // Hide all tab contents
            document.querySelectorAll('.detail-tab-content').forEach(el => {
                el.style.display = 'none';
            });
            // Remove active class from all tab buttons
            document.querySelectorAll('.detail-tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Show selected tab content
            const targetTab = document.getElementById('tab-' + tabName);
            if (targetTab) {
                targetTab.style.display = 'block';
            }
            // Add active class to clicked button
            const btns = document.querySelectorAll('.detail-tab-btn');
            btns.forEach(btn => {
                if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
                    btn.classList.add('active');
                }
            });
        };

        window.closeUserDetailModal = () => {
            const modal = document.getElementById('userDetailModal');
            if (modal) modal.style.display = 'none';
        };

        window.viewUserDetail = async (folio) => {
            const detailModal = document.getElementById('userDetailModal');
            if (!detailModal) return;

            // Reset to first tab
            window.switchDetailTab('personal');

            try {
                const response = await adminFetch(`php/api.php?action=get_registration_detail&folio=${encodeURIComponent(folio)}&t=${Date.now()}`);
                const result = await response.json();

                if (!result.success) {
                    alert('Error al cargar detalles: ' + result.error);
                    return;
                }

                const data = result.main;
                const billing = result.billing;
                const workshops = result.workshops;
                const visits = result.visits;
                const contributions = result.contributions;

                // Folio and Name in header
                document.getElementById('detailUserFolio').textContent = data.folio;
                document.getElementById('detailUserName').textContent = (data.nombre || '') + ' ' + (data.apellido || '');

                // Tab 1: Datos Personales
                document.getElementById('det-fullname').textContent = (data.nombre || 'N/A') + ' ' + (data.apellido || 'N/A');
                document.getElementById('det-email').textContent = data.email || 'N/A';
                document.getElementById('det-phone').textContent = data.telefono || 'N/A';
                document.getElementById('det-institution').textContent = data.institucion || 'N/A';
                document.getElementById('det-city').textContent = data.ciudad || 'N/A';
                document.getElementById('det-location').textContent = (data.estado ? data.estado + ', ' : '') + (data.pais || 'N/A');

                // Tab 2: Pago y Documentos
                const regTypeNames = {
                    'general': 'Público General / Profesional',
                    'student_external': 'Estudiante Externo',
                    'student_uady': 'Estudiante/Profesor UADY',
                    'code_access': 'Acceso Especial por Código / Convenio'
                };
                document.getElementById('det-regtype').textContent = regTypeNames[data.regType] || data.regType || 'N/A';

                // Historial de conceptos generados (todas las compras/registros del usuario)
                const conceptosHistorial = result.conceptos_historial || [];
                const historialContainer = document.getElementById('det-conceptos-historial');
                if (conceptosHistorial.length > 0) {
                    historialContainer.innerHTML = conceptosHistorial.map(c => `
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:white;border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;">
                            <code style="font-weight:600;font-size:0.95rem;color:#0f172a;background:#f1f5f9;padding:4px 8px;border-radius:4px;">${c.concepto}</code>
                            <span style="font-weight:700;color:#16a34a;">${c.total || '$0.00'}</span>
                            <span style="color:#94a3b8;font-size:0.8rem;margin-left:auto;">${c.fecha_generado || ''}</span>
                        </div>
                    `).join('');
                } else {
                    historialContainer.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem;margin:0;">Sin conceptos registrados.</p>';
                }

                // Render Documents (historial completo, agrupado por tipo)
                const docsContainer = document.getElementById('det-documents-container');
                docsContainer.innerHTML = '';

                const docTypeInfo = {
                    comprobante:    { title: 'Comprobante de Pago',         bg: '#e0f2fe', color: '#0369a1', icon: 'fa-file-invoice-dollar' },
                    identificacion: { title: 'Identificación / Credencial', bg: '#fdf2f8', color: '#be185d', icon: 'fa-id-card' },
                    constancia:     { title: 'Constancia Fiscal (RFC)',     bg: '#f0fdf4', color: '#15803d', icon: 'fa-file-contract' },
                };
                const docStatusLabel = {
                    aceptado:  { label: 'ACEPTADO',  cls: 'status-pill-success' },
                    rechazado: { label: 'RECHAZADO', cls: 'status-pill-danger' },
                    rechazado_definitivo: { label: 'RECHAZO DEFINITIVO', cls: 'status-pill-danger' },
                    pendiente: { label: 'PENDIENTE', cls: 'status-pill-warning' },
                };

                const allDocs = result.documents || [];
                if (allDocs.length === 0) {
                    docsContainer.innerHTML = `
                        <div style="grid-column: span 2; padding: 20px; text-align: center; color: #64748b; font-style: italic;">
                            <i class="fa-solid fa-folder-open" style="font-size: 2rem; display:block; margin-bottom: 8px; opacity: 0.5;"></i>
                            No se cargó ningún documento para este usuario.
                        </div>
                    `;
                } else {
                    // Agrupamos por folio ("subida"/compra) para mostrar el historial
                    // completo (rechazados y nuevos) en orden cronológico, con la misma
                    // numeración (Primera/Segunda Subida...) que el modal de revisión.
                    const purchaseNumByFolio = buildPurchaseNumByFolio(allDocs);
                    const docOrder = { identificacion: 0, comprobante: 1, constancia: 2 };
                    const docsByFolio = {};
                    allDocs.forEach(doc => (docsByFolio[doc.folio] = docsByFolio[doc.folio] || []).push(doc));


                    const folios = [...new Set(allDocs.map(d => d.folio))].sort((a, b) => folioNum(a) - folioNum(b));

                    folios.forEach(folio => {
                        const num = purchaseNumByFolio[folio] || null;
                        const header = document.createElement('div');
                        header.style.cssText = 'grid-column: span 2; margin-top: 4px; font-weight: 700; color: #475569; font-size: 0.85rem; display:flex; align-items:center; gap:8px;';
                        header.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${num ? `${ordinalEs(num, 'f')} Subida` : 'Documentos del Registro'} <span style="font-weight:400; color:#94a3b8;">(${folio})</span>`;
                        docsContainer.appendChild(header);

                        const docs = docsByFolio[folio].slice().sort((a, b) => {
                            if (a.tipo_doc !== b.tipo_doc) return docOrder[a.tipo_doc] - docOrder[b.tipo_doc];
                            return new Date(a.fecha_subida) - new Date(b.fecha_subida);
                        });

                        docs.forEach(doc => {
                            const info = docTypeInfo[doc.tipo_doc] || docTypeInfo.comprobante;
                            const st = docStatusLabel[doc.estado] || docStatusLabel.pendiente;

                            let title = info.title;
                            // Sin ordinal ("Primer/Segundo..."): tras unificar el folio
                            // por cuenta (E2) el número siempre daba 1 ("Primer"). Ahora
                            // el concepto de pago es lo que distingue cada comprobante.
                            if (doc.tipo_doc === 'comprobante') title = 'Comprobante de Pago';
                            else if (doc.tipo_doc === 'constancia') title = 'RFC / Constancia Fiscal';
                            // Concepto de pago de la compra a la que pertenece el comprobante
                            if (doc.tipo_doc === 'comprobante' && doc.concepto_pago) {
                                title += ` - ${doc.concepto_pago}`;
                            }

                            const docEl = document.createElement('a');
                            docEl.href = `uploads/${doc.archivo}`;
                            docEl.target = '_blank';
                            docEl.style.cssText = `
                                display: flex;
                                align-items: center;
                                gap: 12px;
                                padding: 12px 15px;
                                border-radius: 8px;
                                background: ${info.bg};
                                color: ${info.color};
                                text-decoration: none;
                                font-weight: 600;
                                font-size: 0.9rem;
                                border: 1px solid rgba(0,0,0,0.05);
                                transition: transform 0.2s, box-shadow 0.2s;
                            `;
                            docEl.onmouseover = () => {
                                docEl.style.transform = 'translateY(-2px)';
                                docEl.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            };
                            docEl.onmouseout = () => {
                                docEl.style.transform = 'translateY(0)';
                                docEl.style.boxShadow = 'none';
                            };
                            const shortName = doc.archivo.substring(doc.archivo.indexOf('_') + 1);
                            docEl.innerHTML = `
                                <div style="font-size: 1.5rem;"><i class="fa-solid ${info.icon}"></i></div>
                                <div style="flex-grow: 1; text-align: left; min-width:0;">
                                    <span style="display:block; font-size: 0.85rem; font-weight: 600; opacity: 0.95;">${title}</span>
                                    <span style="display:block; font-size: 0.75rem; opacity: 0.7; word-break: break-all;">${shortName}</span>
                                    <span style="display:block; font-size: 0.7rem; opacity: 0.6; margin-top:2px;">${doc.fecha_subida}</span>
                                </div>
                                <span class="status-pill ${st.cls}" style="flex-shrink:0;font-size:0.7rem;">${st.label}</span>
                                <div><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
                            `;
                            docsContainer.appendChild(docEl);
                        });
                    });
                }

                // Tab 3: Talleres y Visitas
                const workshopsList = document.getElementById('det-workshops-list');
                workshopsList.innerHTML = '';
                if (workshops && workshops.length > 0) {
                    workshops.forEach(w => {
                        const el = document.createElement('div');
                        el.style.cssText = 'background: white; padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
                        el.innerHTML = `
                            <div>
                                <strong style="color: #1e293b; display:block;">${esc(w.nombre)}</strong>
                                <small style="color: #64748b;"><i class="fa-solid fa-clock"></i> ${esc(w.horario) || 'N/A'} | <i class="fa-solid fa-user"></i> ${esc(w.instructor) || 'Instructor por definir'} | <i class="fa-solid fa-laptop"></i> ${esc(w.modalidad) || 'Presencial'}</small>
                            </div>
                            <span style="font-weight: 700; color: var(--primary-color);">$${parseFloat(w.precio).toFixed(2)}</span>
                        `;
                        workshopsList.appendChild(el);
                    });
                } else {
                    workshopsList.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 10px;">Ningún taller seleccionado.</div>';
                }

                const visitsList = document.getElementById('det-visits-list');
                visitsList.innerHTML = '';
                if (visits && visits.length > 0) {
                    visits.forEach(v => {
                        const el = document.createElement('div');
                        el.style.cssText = 'background: white; padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
                        el.innerHTML = `
                            <div>
                                <strong style="color: #1e293b; display:block;">${esc(v.nombre)}</strong>
                                <small style="color: #64748b;"><i class="fa-solid fa-clock"></i> ${esc(v.horario) || 'N/A'} | <i class="fa-solid fa-user"></i> ${esc(v.instructor) || 'N/A'} | <i class="fa-solid fa-building"></i> ${esc(v.modalidad) || 'Presencial'}</small>
                            </div>
                            <span style="font-weight: 700; color: var(--primary-color);">$${parseFloat(v.precio).toFixed(2)}</span>
                        `;
                        visitsList.appendChild(el);
                    });
                } else {
                    visitsList.innerHTML = '<div style="color: #64748b; font-style: italic; padding: 10px;">Ninguna visita seleccionada.</div>';
                }

                // Tab 4: Facturación y Artículos
                const billSection = document.getElementById('det-billing-section');
                if (billing) {
                    billSection.style.display = 'block';
                    document.getElementById('det-bill-razon').textContent = billing.razon || 'N/A';
                    document.getElementById('det-bill-rfc').textContent = billing.rfc || 'N/A';
                    document.getElementById('det-bill-dir').textContent = billing.direccion || 'N/A';
                    document.getElementById('det-bill-cp-ciudad').textContent = `C.P. ${billing.cp || 'N/A'}, ${billing.ciudad || 'N/A'}, ${billing.estado || 'N/A'}`;
                    document.getElementById('det-bill-email').textContent = billing.correo || 'N/A';
                } else {
                    billSection.style.display = 'none';
                }

                const contribsList = document.getElementById('det-contribs-list');
                contribsList.innerHTML = '';
                if (contributions && contributions.length > 0) {
                    document.getElementById('det-contribs-section').style.display = 'block';
                    contributions.forEach(c => {
                        const el = document.createElement('div');
                        el.style.cssText = 'background: white; padding: 15px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 10px;';
                        el.innerHTML = `
                            <span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-weight: 700; text-transform: uppercase;">${esc(c.tipo) || 'N/A'}</span>
                            <strong style="color: #1e293b; display:block; margin: 6px 0;">${esc(c.titulo) || 'Sin título'}</strong>
                            <small style="color: #64748b; display:block;"><i class="fa-solid fa-graduation-cap"></i> <strong>Área:</strong> ${esc(c.area) || 'N/A'} | <i class="fa-solid fa-book"></i> <strong>Revista / Memorias:</strong> ${esc(c.revista) || 'N/A'} | <i class="fa-solid fa-laptop"></i> <strong>Modalidad:</strong> ${esc(c.modalidad) || 'N/A'}</small>
                        `;
                        contribsList.appendChild(el);
                    });
                } else {
                    document.getElementById('det-contribs-section').style.display = 'none';
                }

                let fallbackEl = document.getElementById('det-tab4-fallback');
                if (!fallbackEl) {
                    fallbackEl = document.createElement('div');
                    fallbackEl.id = 'det-tab4-fallback';
                    fallbackEl.style.cssText = 'padding: 30px; text-align: center; color: #64748b; font-style: italic;';
                    fallbackEl.innerHTML = '<i class="fa-solid fa-folder-open" style="font-size: 2rem; display:block; margin-bottom: 8px; opacity: 0.5;"></i> Este usuario no solicitó facturación ni registró trabajos.';
                    document.getElementById('tab-billing').appendChild(fallbackEl);
                }

                if (!billing && (!contributions || contributions.length === 0)) {
                    fallbackEl.style.display = 'block';
                } else {
                    fallbackEl.style.display = 'none';
                }

                // Footer Estatus Pill and buttons
                const statusLabel = document.getElementById('detailRegStatusLabel');
                statusLabel.innerHTML = '';
                const statusClass = data.status === 'aceptado' ? 'status-pill-success' : (data.status === 'denegado' ? 'status-pill-danger' : 'status-pill-warning');
                const statusText = data.status ? data.status.toUpperCase() : 'PENDIENTE';
                statusLabel.innerHTML = `<span style="color: #64748b; font-weight:600; font-size: 0.95rem; margin-right: 8px;">Estado actual:</span> <span class="status-pill ${statusClass}" style="font-size: 0.85rem; padding: 6px 12px;">${statusText}</span>`;

                // Action Button — opens document review modal
                const btnAccept = document.getElementById('btnDetailAccept');
                btnAccept.onclick = () => window.openDocReview(data.folio, (data.nombre || '') + ' ' + (data.apellido || ''));

                detailModal.style.display = 'block';

            } catch (err) {
                console.error("Error al obtener detalle del usuario:", err);
                alert("No se pudo cargar la información completa de este usuario.");
            }
        };

        // ─── DOCUMENT REVIEW MODAL ───────────────────────────────────────────────

        const DOC_SPECS = [
            { key: 'comprobante',    label: 'Comprobante de Pago',         icon: 'fa-file-invoice-dollar', color: '#0369a1', bg: '#e0f2fe' },
            { key: 'identificacion', label: 'Identificación / Credencial', icon: 'fa-id-card',             color: '#be185d', bg: '#fdf2f8' },
            { key: 'constancia',     label: 'Constancia Fiscal (RFC)',     icon: 'fa-file-contract',       color: '#15803d', bg: '#f0fdf4' },
        ];

        let reviewFolio = null;
        let reviewDocsData = null;
        let activeReviewTab = 1;

        window.openDocReview = async (folio, userName) => {
            reviewFolio = folio;
            activeReviewTab = 1;
            document.getElementById('docReviewTitle').textContent = userName.trim() || folio;
            document.getElementById('docReviewBody').innerHTML =
                '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i><p style="margin-top:12px;">Cargando documentos...</p></div>';
            document.getElementById('docReviewModal').style.display = 'block';

            try {
                const res = await adminFetch(`php/api.php?action=get_doc_revisions&folio=${encodeURIComponent(folio)}&t=${Date.now()}`);
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                reviewDocsData = data.documents || {};
                renderDocReview();
            } catch (err) {
                document.getElementById('docReviewBody').innerHTML =
                    `<div style="text-align:center;padding:40px;color:#ef4444;"><i class="fa-solid fa-circle-exclamation" style="font-size:2rem;"></i><p>Error: ${err.message}</p></div>`;
            }
        };

        const DOC_STATUS_MAP = {
            aceptado:  { label: 'ACEPTADO',  cls: 'status-pill-success', icon: 'fa-circle-check' },
            rechazado: { label: 'RECHAZADO', cls: 'status-pill-danger',  icon: 'fa-circle-xmark' },
            rechazado_definitivo: { label: 'RECHAZO DEFINITIVO', cls: 'status-pill-danger', icon: 'fa-ban' },
            pendiente: { label: 'PENDIENTE', cls: 'status-pill-warning', icon: 'fa-clock' },
        };

        // Ordinales en español, con concordancia de género
        const ORDINALS_M = {1:'Primer',2:'Segundo',3:'Tercer',4:'Cuarto',5:'Quinto',6:'Sexto',7:'Séptimo',8:'Octavo',9:'Noveno',10:'Décimo'};
        const ORDINALS_F = {1:'Primera',2:'Segunda',3:'Tercera',4:'Cuarta',5:'Quinta',6:'Sexta',7:'Séptima',8:'Octava',9:'Novena',10:'Décima'};
        const ordinalEs = (n, gender) => (gender === 'f' ? ORDINALS_F : ORDINALS_M)[n] || `${n}°`;

        // Extrae el número de folio para ordenar las "subidas"/compras cronológicamente
        const folioNum = f => parseInt(String(f || '').replace(/\D/g, ''), 10) || 0;

        // Dado un arreglo de documentos (con folio y tipo_doc), calcula a qué número
        // de "compra" pertenece cada folio según el orden de sus comprobantes.
        function buildPurchaseNumByFolio(docs) {
            const comprobanteFolios = [...new Set(docs.filter(d => d.tipo_doc === 'comprobante').map(d => d.folio))]
                .sort((a, b) => folioNum(a) - folioNum(b));
            const map = {};
            comprobanteFolios.forEach((folio, idx) => { map[folio] = idx + 1; });
            return map;
        }

        function renderDocReview() {
            const body = document.getElementById('docReviewBody');
            body.innerHTML = '';

            // Aplanar todos los documentos de todos los tipos en una sola lista
            const allDocs = [];
            DOC_SPECS.forEach(spec => {
                (reviewDocsData[spec.key] || []).forEach(doc => allDocs.push(Object.assign({}, doc, { _spec: spec })));
            });

            if (allDocs.length === 0) {
                body.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;"><i class="fa-solid fa-folder-open" style="font-size:2.5rem;opacity:0.4;"></i><p style="margin-top:12px;">Este usuario no ha subido ningún documento.</p></div>';
                updateReviewProgress(0, 0);
                return;
            }

            // Cada compra (registro inicial o "comprar más talleres/visitas") genera un
            // folio nuevo y sube su propio comprobante (y, opcionalmente, su propio RFC,
            // y en la primera compra también identificación si aplica). Agrupamos por
            // folio para que cada "subida"/compra tenga su propia pestaña, en orden
            // cronológico (1ra Subida, 2da Subida, ...).
            const purchaseNumByFolio = buildPurchaseNumByFolio(allDocs);

            const docsByFolio = {};
            allDocs.forEach(doc => (docsByFolio[doc.folio] = docsByFolio[doc.folio] || []).push(doc));

            const purchases = [...new Set(allDocs.map(d => d.folio))]
                .sort((a, b) => folioNum(a) - folioNum(b))
                .map(folio => ({ folio, num: purchaseNumByFolio[folio] || null, docs: docsByFolio[folio] }));

            if (activeReviewTab < 1 || activeReviewTab > purchases.length) activeReviewTab = 1;

            // ── Barra de pestañas: una por cada subida/compra ──────────────────
            const tabBar = document.createElement('div');
            tabBar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #e2e8f0;';
            purchases.forEach((p, idx) => {
                const tabNum = idx + 1;
                const estados = p.docs.map(d => d.estado);
                let dotColor = '#15803d', dotTitle = 'Todo aceptado';
                if (estados.includes('rechazado')) { dotColor = '#b91c1c'; dotTitle = 'Tiene rechazos pendientes'; }
                else if (estados.some(e => e !== 'aceptado')) { dotColor = '#92400e'; dotTitle = 'En revisión'; }

                const label = p.num ? `${ordinalEs(p.num, 'f')} Subida` : 'Documentos del Registro';
                const isActive = tabNum === activeReviewTab;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.onclick = () => { activeReviewTab = tabNum; renderDocReview(); };
                btn.style.cssText = `padding:8px 16px;border-radius:8px;border:1px solid ${isActive ? '#0f4c75' : '#e2e8f0'};background:${isActive ? '#0f4c75' : 'white'};color:${isActive ? 'white' : '#1e293b'};font-weight:700;font-size:0.85rem;cursor:pointer;display:inline-flex;align-items:center;gap:8px;`;
                btn.innerHTML = `${label} <span title="${dotTitle}" style="width:9px;height:9px;border-radius:50%;background:${dotColor};display:inline-block;flex-shrink:0;"></span>`;
                tabBar.appendChild(btn);
            });
            body.appendChild(tabBar);

            // ── Contenido de la pestaña activa ──────────────────────────────────
            const active = purchases[activeReviewTab - 1];
            const order = { identificacion: 0, comprobante: 1, constancia: 2 };
            const sortedDocs = (active ? active.docs : []).slice().sort((a, b) => {
                if (a._spec.key !== b._spec.key) return order[a._spec.key] - order[b._spec.key];
                return new Date(a.fecha_subida) - new Date(b.fecha_subida);
            });

            const content = document.createElement('div');
            content.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

            // Agrupación de versiones (original + correcciones) en una tarjeta:
            // 1) Si el documento tiene vínculo explícito (reemplaza_id), se agrupa
            //    por su cadena: cada PAGO conserva su propio hilo, aunque haya
            //    compras posteriores (los comprobantes de pagos distintos ya no
            //    se mezclan entre sí).
            // 2) Documentos sin vínculo (datos previos a este cambio): se agrupan
            //    consecutivos del mismo tipo SOLO cuando la versión anterior está
            //    rechazada (rechazo → corrección). Comprobantes de compras
            //    distintas quedan en tarjetas separadas.
            const chainRootsSet = new Set(sortedDocs.filter(d => d.reemplaza_id).map(d => Number(d.reemplaza_id)));
            const groups = [];
            const chainGroupByRoot = {};
            sortedDocs.forEach(doc => {
                const isLinked = !!doc.reemplaza_id || chainRootsSet.has(Number(doc.id));
                if (isLinked) {
                    const root = doc.reemplaza_id ? Number(doc.reemplaza_id) : Number(doc.id);
                    if (!chainGroupByRoot[root]) { chainGroupByRoot[root] = []; groups.push(chainGroupByRoot[root]); }
                    chainGroupByRoot[root].push(doc);
                    return;
                }
                const lastGroup = groups[groups.length - 1];
                const lastIsLoose = lastGroup && !lastGroup.some(d => d.reemplaza_id || chainRootsSet.has(Number(d.id)));
                if (lastGroup && lastIsLoose && lastGroup[0]._spec.key === doc._spec.key && lastGroup[lastGroup.length - 1].estado === 'rechazado') {
                    lastGroup.push(doc);
                } else {
                    groups.push([doc]);
                }
            });

            groups.forEach(group => {
                const total = group.length;
                const wrapper = total > 1 ? document.createElement('div') : null;
                if (wrapper) wrapper.style.cssText = 'background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;';

                group.forEach((doc, idx) => {
                    let label = doc._spec.label;
                    // Sin ordinal: el concepto de pago (abajo) identifica cada comprobante.
                    if (doc._spec.key === 'comprobante') label = 'Comprobante de Pago';
                    else if (doc._spec.key === 'constancia') label = 'RFC / Constancia Fiscal';
                    // Concepto de pago de la compra a la que pertenece este comprobante
                    // (calculado por documento en el servidor, según su fecha de subida)
                    if (doc._spec.key === 'comprobante' && doc.concepto_pago) {
                        label += ` - <span style="font-family:monospace;">${esc(doc.concepto_pago)}</span>`;
                    }

                    const isLast = idx === total - 1;
                    if (total > 1 && !isLast && doc.estado === 'rechazado') {
                        label += ` <span style="font-size:0.7rem;font-weight:700;color:#94a3b8;background:#f1f5f9;padding:2px 8px;border-radius:10px;margin-left:6px;vertical-align:middle;">Versión anterior rechazada</span>`;
                    }

                    // Bloqueo en cadena: una versión anterior no puede modificarse mientras
                    // su reemplazo (la siguiente versión) ya tenga una decisión tomada
                    // (aceptado o rechazado). Primero hay que devolver esa siguiente
                    // versión a "Pendiente" para poder editar esta.
                    const lockedByNext = total > 1 && !isLast && group[idx + 1].estado !== 'pendiente';

                    const card = buildDocCard(label, doc._spec, doc, Object.assign(
                        total > 1 ? { grouped: true, dividerTop: idx > 0 } : {},
                        { locked: lockedByNext }
                    ));
                    if (wrapper) wrapper.appendChild(card); else content.appendChild(card);
                });

                if (wrapper) content.appendChild(wrapper);
            });
            body.appendChild(content);

            // El progreso (X/Y) y el botón "Confirmar Aceptación Total" cuentan por
            // HILOS de documento (la versión vigente de cada documento/pago), no por
            // archivos históricos: una versión rechazada que ya fue corregida y
            // aceptada no bloquea la aceptación total.
            const units = buildReviewUnits(allDocs);
            const accepted = units.filter(d => d.estado === 'aceptado').length;
            updateReviewProgress(accepted, units.length);
        }

        // Devuelve la versión VIGENTE (más reciente) de cada hilo de documento:
        // - Con vínculo (reemplaza_id): un hilo por cadena original+correcciones.
        // - Sin vínculo: cada documento es su propio hilo, salvo el patrón legado
        //   rechazado→corrección consecutiva del mismo tipo, que se une.
        function buildReviewUnits(docs) {
            const order = { identificacion: 0, comprobante: 1, constancia: 2 };
            const sorted = docs.slice().sort((a, b) => {
                if (a._spec.key !== b._spec.key) return order[a._spec.key] - order[b._spec.key];
                return new Date(a.fecha_subida) - new Date(b.fecha_subida);
            });
            const chainRootsSet = new Set(sorted.filter(d => d.reemplaza_id).map(d => Number(d.reemplaza_id)));
            const groups = [];
            const byRoot = {};
            sorted.forEach(doc => {
                const linked = !!doc.reemplaza_id || chainRootsSet.has(Number(doc.id));
                if (linked) {
                    const root = doc.reemplaza_id ? Number(doc.reemplaza_id) : Number(doc.id);
                    if (!byRoot[root]) { byRoot[root] = []; groups.push(byRoot[root]); }
                    byRoot[root].push(doc);
                    return;
                }
                const last = groups[groups.length - 1];
                const lastLoose = last && !last.some(d => d.reemplaza_id || chainRootsSet.has(Number(d.id)));
                if (last && lastLoose && last[0]._spec.key === doc._spec.key && last[last.length - 1].estado === 'rechazado') {
                    last.push(doc);
                } else {
                    groups.push([doc]);
                }
            });
            return groups.map(g => g[g.length - 1]);
        }

        // Genera la barra de acciones (Aceptar / Rechazar / Pendiente) para UN archivo
        // específico. Cada archivo subido, sin importar su estado actual o si es el
        // más reciente, puede editarse libremente a cualquier otro estado, salvo que
        // esté bloqueado por estar conectado a una versión posterior ya evaluada.
        function renderDocActionBar(doc, locked) {
            const key = `doc-${doc.id}`;
            const isAceptado  = doc.estado === 'aceptado';
            const isRechazado = doc.estado === 'rechazado';
            const isDefinitivo = doc.estado === 'rechazado_definitivo';
            const isPendiente = !isAceptado && !isRechazado && !isDefinitivo;

            // Un documento con RECHAZO DEFINITIVO es irreversible: sin botones.
            if (isDefinitivo) {
                return `
                    <div style="font-size:0.85rem;color:#7f1d1d;background:#fecaca;padding:10px 14px;border-radius:8px;font-weight:700;">
                        ⛔ Rechazado definitivamente. Las reservas de este pago fueron anuladas y el usuario no puede subir correcciones. Esta acción es irreversible.
                    </div>
                    ${doc.comentario ? `<div style="margin-top:6px;font-size:0.8rem;color:#7f1d1d;"><i class="fa-solid fa-comment-dots"></i> <strong>Motivo:</strong> ${esc(doc.comentario)}</div>` : ''}`;
            }

            const btn = (label, icon, active, activeColor, activeBg, onclick, extraAttrs) => `
                <button onclick="${locked ? '' : onclick}" ${locked ? 'disabled' : ''} ${extraAttrs || ''}
                    style="padding:6px 12px;border:1px solid ${active ? activeColor : '#e2e8f0'};border-radius:6px;background:${active ? activeBg : 'white'};color:${active ? activeColor : '#64748b'};font-weight:700;cursor:${locked ? 'not-allowed' : 'pointer'};display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;white-space:nowrap;${locked ? 'opacity:0.5;' : ''}">
                    <i class="fa-solid ${icon}"></i> ${label}
                </button>`;

            // Nombre corto del archivo para las ventanas de confirmación (los nombres
            // se sanean en el servidor, no contienen comillas)
            const fname = (doc.archivo || '').replace(/^\d+_[^_]+_/, '');

            // El rechazo definitivo solo aplica a comprobantes de pago
            const esComprobante = doc._spec && doc._spec.key === 'comprobante';

            return `
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                    ${btn('Aceptar', 'fa-check', isAceptado, '#15803d', '#dcfce7', `window.confirmDocReview(${doc.id},'aceptado','${fname}','${doc.estado}')`)}
                    ${btn('Rechazar', 'fa-xmark', isRechazado, '#b91c1c', '#fee2e2', `window.toggleRejectForm('${key}')`, `id="btn-rechazar-${key}"`)}
                    ${btn('Pendiente', 'fa-clock', isPendiente, '#92400e', '#fef9c3', `window.confirmDocReview(${doc.id},'pendiente','${fname}','${doc.estado}')`)}
                    ${esComprobante ? btn('Rechazar Definitivo', 'fa-ban', false, '#7f1d1d', '#fecaca', `window.toggleRejectDefForm('${key}')`) : ''}
                </div>
                ${locked ? `<div style="margin-top:6px;font-size:0.8rem;color:#92400e;background:#fef9c3;padding:6px 10px;border-radius:6px;"><i class="fa-solid fa-lock"></i> Este documento ya tiene una versión más reciente que ya fue revisada. Si necesitas modificar esta versión anterior, primero regresa la versión más reciente a "Pendiente".</div>` : ''}
                ${isRechazado ? `<div style="margin-top:6px;font-size:0.8rem;color:#b91c1c;"><i class="fa-solid fa-comment-dots"></i> <strong>Motivo:</strong> ${esc(doc.comentario) || 'Sin motivo especificado'}</div>` : ''}
                <div id="reject-form-${key}" style="display:none;margin-top:8px;">
                    <textarea id="reject-comment-${key}" placeholder="Motivo del rechazo (opcional)..."
                        style="width:100%;padding:8px;border:1px solid #fca5a5;border-radius:8px;font-size:0.85rem;resize:vertical;min-height:60px;box-sizing:border-box;font-family:inherit;display:block;">${esc(doc.comentario || '')}</textarea>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
                        <button onclick="window.toggleRejectForm('${key}')"
                            style="padding:6px 12px;border:1px solid #e2e8f0;border-radius:8px;background:white;color:#64748b;font-weight:600;cursor:pointer;font-size:0.8rem;">
                            Cancelar
                        </button>
                        <button onclick="window.submitDocReview(${doc.id},'rechazado', document.getElementById('reject-comment-${key}').value)"
                            style="padding:6px 14px;border:none;border-radius:8px;background:#ef4444;color:white;font-weight:700;cursor:pointer;font-size:0.8rem;">
                            Confirmar Rechazo
                        </button>
                    </div>
                </div>
                <div id="reject-def-form-${key}" style="display:none;margin-top:8px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px;">
                    <p style="margin:0 0 6px;font-size:0.8rem;color:#7f1d1d;font-weight:700;">⛔ Rechazo DEFINITIVO: anula las reservas de este pago y bloquea nuevas subidas. Irreversible.</p>
                    <textarea id="reject-def-comment-${key}" placeholder="Motivo del rechazo definitivo..."
                        style="width:100%;padding:8px;border:1px solid #f87171;border-radius:8px;font-size:0.85rem;resize:vertical;min-height:60px;box-sizing:border-box;font-family:inherit;display:block;"></textarea>
                    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
                        <button onclick="window.toggleRejectDefForm('${key}')"
                            style="padding:6px 12px;border:1px solid #e2e8f0;border-radius:8px;background:white;color:#64748b;font-weight:600;cursor:pointer;font-size:0.8rem;">
                            Cancelar
                        </button>
                        <button onclick="window.confirmRechazoDefinitivo(${doc.id},'${key}')"
                            style="padding:6px 14px;border:none;border-radius:8px;background:#7f1d1d;color:white;font-weight:700;cursor:pointer;font-size:0.8rem;">
                            Enviar Rechazo Definitivo
                        </button>
                    </div>
                </div>`;
        }

        // Alternar el formulario de rechazo definitivo
        window.toggleRejectDefForm = (key) => {
            const form = document.getElementById(`reject-def-form-${key}`);
            if (!form) return;
            const isHidden = form.style.display === 'none';
            form.style.display = isHidden ? 'block' : 'none';
            if (isHidden) document.getElementById(`reject-def-comment-${key}`)?.focus();
        };

        // Confirmación (texto exacto de la observación 6-ago) y envío
        window.confirmRechazoDefinitivo = (docId, key) => {
            const comentario = document.getElementById(`reject-def-comment-${key}`)?.value || '';
            const ok = window.confirm(
                "Esta opción anulará todas las reservas del usuario relacionadas con el pago (talleres, visitas y/o registros de participación). " +
                "¿Está seguro de querer rechazar definitivamente este comprobante de pago? La acción es irreversible."
            );
            if (!ok) return;
            window.submitDocReview(docId, 'rechazado_definitivo', comentario);
        };

        // Construye una tarjeta completa (con imagen visible) para UN solo
        // documento subido. Cada compra/RFC/identificación tiene su propia
        // tarjeta — ya no existe un "historial" colapsado.
        // Si `opts.grouped` es true, la tarjeta no dibuja su propio borde/esquinas
        // (el contenedor del grupo los provee) para que varias versiones del mismo
        // tipo de documento se vean unidas como una sola tarjeta.
        function buildDocCard(label, spec, doc, opts = {}) {
            const card = document.createElement('div');
            card.id = `doc-card-${doc.id}`;

            const st = DOC_STATUS_MAP[doc.estado] || DOC_STATUS_MAP.pendiente;
            const isPdf = doc.archivo.toLowerCase().endsWith('.pdf');
            const shortName = doc.archivo.replace(/^\d+_[^_]+_/, '');
            const ext = doc.archivo.split('.').pop().toLowerCase();
            const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);

            card.style.cssText = opts.grouped
                ? `background:white;${opts.dividerTop ? 'border-top:1px solid #e2e8f0;' : ''}`
                : 'background:white;border-radius:12px;border:1px solid #e2e8f0;';
            card.innerHTML = `
                <div style="padding:16px 18px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:12px;background:${spec.bg}20;">
                    <div style="width:38px;height:38px;border-radius:8px;background:${spec.bg};display:flex;align-items:center;justify-content:center;color:${spec.color};font-size:1.1rem;flex-shrink:0;">
                        <i class="fa-solid ${spec.icon}"></i>
                    </div>
                    <div style="flex-grow:1;min-width:0;">
                        <p style="margin:0;font-weight:700;color:#1e293b;font-size:0.95rem;">${label}</p>
                        <p style="margin:0;font-size:0.78rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${doc.archivo}">${shortName} · ${doc.fecha_subida}</p>
                    </div>
                    <span class="status-pill ${st.cls}" style="flex-shrink:0;font-size:0.75rem;padding:4px 10px;">
                        <i class="fa-solid ${st.icon}"></i> ${st.label}
                    </span>
                </div>

                ${isImage ? `
                <div style="padding:12px 18px;background:#fafafa;border-bottom:1px solid #f1f5f9;text-align:center;">
                    <a href="uploads/${doc.archivo}" target="_blank">
                        <img src="uploads/${doc.archivo}" alt="${spec.label}"
                             style="max-height:180px;max-width:100%;border-radius:6px;object-fit:contain;box-shadow:0 2px 8px rgba(0,0,0,0.08);"
                             onerror="this.parentElement.innerHTML='<a href=\\'uploads/${doc.archivo}\\' target=\\'_blank\\' style=\\'color:${spec.color};font-weight:600;\\' ><i class=\\'fa-solid fa-file\\'></i> Ver archivo</a>'">
                    </a>
                </div>` : `
                <div style="padding:12px 18px;background:#fafafa;border-bottom:1px solid #f1f5f9;">
                    <a href="uploads/${doc.archivo}" target="_blank"
                       style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:${spec.bg};color:${spec.color};border-radius:8px;font-weight:600;font-size:0.88rem;text-decoration:none;">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir ${isPdf ? 'PDF' : 'Archivo'}
                    </a>
                </div>`}

                <div style="padding:14px 18px;">
                    ${renderDocActionBar(doc, opts.locked)}
                </div>`;

            return card;
        }

        function updateReviewProgress(accepted, total) {
            document.getElementById('docReviewCount').textContent = `${accepted}/${total}`;
            const btn = document.getElementById('btnFinalizarRevision');
            if (total > 0 && accepted === total) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.title = 'Marca el registro completo como Aceptado.';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                // Explicación de por qué está deshabilitado (J6)
                btn.title = `Se habilita cuando la versión vigente de TODOS los documentos está aceptada (van ${accepted} de ${total}).`;
            }
        }

        window.toggleRejectForm = (key) => {
            const form = document.getElementById(`reject-form-${key}`);
            const isHidden = form.style.display === 'none';
            form.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                const ta = document.getElementById(`reject-comment-${key}`);
                if (ta) ta.focus();
            }
        };

        // Confirmación antes de Aceptar / Pendiente (J1). Si el documento estaba
        // previamente RECHAZADO, la confirmación es reforzada (J2) para evitar
        // aceptaciones por equivocación de botón.
        window.confirmDocReview = (id, estado, archivo, prevEstado) => {
            let msg;
            if (estado === 'aceptado') {
                msg = prevEstado === 'rechazado'
                    ? `⚠️ ATENCIÓN: este documento fue RECHAZADO previamente.\n\n¿Está seguro de que desea ACEPTAR el documento "${archivo}"?`
                    : `¿Está seguro de que desea aceptar el documento "${archivo}"?`;
            } else if (estado === 'pendiente') {
                msg = prevEstado === 'rechazado'
                    ? `Este documento está RECHAZADO.\n\n¿Está seguro de que desea regresarlo a Pendiente? (El motivo de rechazo se conservará)`
                    : `¿Está seguro de que desea marcar como Pendiente el documento "${archivo}"?`;
            }
            if (msg && !window.confirm(msg)) return;
            // Aceptar/Pendiente no envían comentario: el motivo de rechazo previo
            // se CONSERVA en el servidor (por si hay que volver a rechazar).
            window.submitDocReview(id, estado, null);
        };

        window.submitDocReview = async (id, estado, comentario) => {
            const adminUser = sessionStorage.getItem('adminUsername') || 'admin';
            try {
                const res = await adminFetch('php/api.php?action=review_doc', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, estado, comentario: comentario || null, revisado_por: adminUser })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);

                // Refresh document data from server
                const res2 = await adminFetch(`php/api.php?action=get_doc_revisions&folio=${encodeURIComponent(reviewFolio)}&t=${Date.now()}`);
                const data2 = await res2.json();
                reviewDocsData = data2.documents || {};
                renderDocReview();
                renderItems(); // refresh main table status

                // Si la ventana "Documentos y Pago" (detalle/ojito) está abierta,
                // refrescarla de inmediato para que el estatus del documento se
                // actualice sin tener que cerrarla y reabrirla.
                const detailModal = document.getElementById('userDetailModal');
                if (detailModal && detailModal.style.display && detailModal.style.display !== 'none') {
                    const keepTab = window.__activeDetailTab || 'personal';
                    await window.viewUserDetail(reviewFolio);
                    window.switchDetailTab(keepTab);
                }
            } catch (err) {
                alert('Error al guardar revisión: ' + err.message);
            }
        };


        window.closeDocReviewModal = () => {
            document.getElementById('docReviewModal').style.display = 'none';
        };

        document.getElementById('btnFinalizarRevision').addEventListener('click', async () => {
            try {
                const res = await adminFetch('php/api.php?action=update_reg_status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folio: reviewFolio, status: 'aceptado' })
                });
                const data = await res.json();
                if (data.success) {
                    window.closeDocReviewModal();
                    window.closeUserDetailModal();
                    renderItems();
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });

        // ─── END DOCUMENT REVIEW ─────────────────────────────────────────────────

        // Activar/Desactivar todos los talleres o visitas a la vez
        toggleActiveBtn.addEventListener('click', async () => {
            const targetActive = toggleActiveBtn.dataset.targetActive || '0';
            const typeLabel = currentType === 'workshop' ? 'los talleres' : 'las visitas';
            const actionLabel = targetActive === '1' ? 'activar' : 'desactivar';

            if (!confirm(`¿Seguro que deseas ${actionLabel} TODOS ${typeLabel}? Esto afectará a todos los elementos existentes.`)) {
                return;
            }

            try {
                const response = await adminFetch(`php/api.php?action=toggle_category_active&type=${currentType}&active=${targetActive}`);
                const result = await response.json();
                if (result.success) {
                    renderItems();
                } else {
                    alert('Error: ' + (result.error || 'No se pudo actualizar el estado.'));
                }
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });

        // Initial Render — registrations is default, show download button and search
        if (currentType === 'admins') {
            menuItems.forEach(i => i.classList.remove('active'));
            const adminsMenu = document.querySelector('.menu-item[data-type="admins"]');
            if (adminsMenu) adminsMenu.classList.add('active');
            pageTitle.textContent = 'Gestión de Administradores';
            pageDescription.textContent = 'Administra las cuentas de administrador y sus permisos de acceso.';
            openModalBtn.style.display = 'none';
            downloadSvgBtn.style.display = 'none';
            if (downloadRosterBtn) downloadRosterBtn.style.display = 'none';
            document.getElementById('searchBarWrapper').style.display = 'none';
        } else {
            downloadSvgBtn.style.display = 'flex';
            if (downloadRosterBtn) downloadRosterBtn.style.display = 'flex';
            document.getElementById('searchBarWrapper').style.display = 'block';
        }
        renderItems();

        // --- BUSCADOR ---
        document.getElementById('regSearchInput').addEventListener('input', function () {
            const q = this.value.trim().toLowerCase();
            const rows = document.querySelectorAll('#itemsList tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = !q || text.includes(q) ? '' : 'none';
            });
        });

        // --- CSV DOWNLOAD ---
        downloadSvgBtn.addEventListener('click', async () => {
            downloadSvgBtn.disabled = true;
            downloadSvgBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

            try {
                const res = await adminFetch(`php/api.php?action=get_full_registrations&t=${Date.now()}`);
                const data = await res.json();
                if (!data.success) throw new Error(data.error || 'Error del servidor');
                const regs = data.registrations || [];

                const esc = val => {
                    const str = String(val ?? '');
                    return (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r'))
                        ? `"${str.replace(/"/g, '""')}"` : str;
                };

                const headers = [
                    'Folio', 'Concepto de Pago', 'Estatus', 'Fecha de Registro',
                    'Nombre', 'Apellido', 'Correo', 'Teléfono',
                    'Institución', 'Ciudad', 'Estado', 'País',
                    'Tipo de Registro', 'Monto Total',
                    'RFC', 'Razón Social', 'Domicilio Fiscal', 'CP Fiscal', 'Ciudad Fiscal', 'Estado Fiscal', 'Correo Facturación',
                    'Talleres (nombre, horario, precio)', 'Visitas Industriales (nombre, horario, precio)',
                    // Contribución 1 (5 columnas)
                    'Título 1', 'Tipo 1', 'Área 1', 'Modalidad 1', 'Revista 1',
                    // Contribución 2 (5 columnas, aunque esté vacía)
                    'Título 2', 'Tipo 2', 'Área 2', 'Modalidad 2', 'Revista 2',
                    'Comprobantes de Pago', 'Identificaciones', 'Constancias Fiscales'
                ];

                // Monto total acumulado (suma de todos los pagos). Si el backend no
                // lo trae, se cae al total del folio actual.
                const montoTotal = (item) => {
                    if (item.total_acumulado !== null && item.total_acumulado !== undefined && item.total_acumulado !== '') {
                        return '$' + parseFloat(item.total_acumulado).toFixed(2);
                    }
                    return item.total || '$0.00';
                };

                const rows = regs.map(item => {
                    let conceptId = item.concept || 'N/A';
                    const m = (item.concept || '').match(/^\d+/);
                    if (m) conceptId = m[0].padStart(4, '0');

                    return [
                        item.folio || '',
                        conceptId,
                        item.status || 'pendiente',
                        item.date_registered || '',
                        item.nombre || '',
                        item.apellido || '',
                        item.email || '',
                        item.telefono || '',
                        item.institucion || '',
                        item.ciudad || '',
                        item.estado || '',
                        item.pais || '',
                        item.regType || '',
                        montoTotal(item),
                        item.rfc || '',
                        item.razon_social || '',
                        item.domicilio_fiscal || '',
                        item.cp || '',
                        item.ciudad_fiscal || '',
                        item.estado_fiscal || '',
                        item.correo_facturacion || '',
                        item.talleres || '',
                        item.visitas || '',
                        item.contrib_titulo1 || '', item.contrib_tipo1 || '', item.contrib_area1 || '', item.contrib_modalidad1 || '', item.contrib_revista1 || '',
                        item.contrib_titulo2 || '', item.contrib_tipo2 || '', item.contrib_area2 || '', item.contrib_modalidad2 || '', item.contrib_revista2 || '',
                        item.comprobante || '',
                        item.identificacion || '',
                        item.constancia || ''
                    ].map(esc).join(',');
                });

                const csv = '﻿' + [headers.map(esc).join(','), ...rows].join('\r\n');

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `concei2026_usuarios_${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('Error al generar el CSV: ' + err.message);
            } finally {
                downloadSvgBtn.disabled = false;
                downloadSvgBtn.innerHTML = '<i class="fa-solid fa-file-csv"></i> Descargar CSV';
            }
        });

        // --- DESCARGA: ALUMNOS POR TALLER / VISITA ---
        if (downloadRosterBtn) {
            downloadRosterBtn.addEventListener('click', async () => {
                downloadRosterBtn.disabled = true;
                downloadRosterBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
                try {
                    const res = await adminFetch(`php/api.php?action=get_workshop_roster&t=${Date.now()}`);
                    const data = await res.json();
                    if (!data.success) throw new Error(data.error || 'Error del servidor');
                    const roster = data.roster || [];

                    const esc = val => {
                        const str = String(val ?? '');
                        return (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r'))
                            ? `"${str.replace(/"/g, '""')}"` : str;
                    };

                    const tipoLabel = t => (t === 'taller' ? 'Taller' : 'Visita Industrial');

                    // Agrupar por ítem para poder poner un subtotal de alumnos
                    const grupos = {};
                    roster.forEach(r => {
                        const k = r.tipo_item + '|' + r.item_id;
                        (grupos[k] = grupos[k] || { info: r, alumnos: [] }).alumnos.push(r);
                    });

                    const headers = ['Tipo', 'ID', 'Taller/Visita', 'Horario', 'Modalidad', 'Cupo', 'Inscritos', 'No.', 'Alumno', 'Correo', 'Teléfono', 'Institución', 'Pago', 'Folio'];
                    const lines = [headers.map(esc).join(',')];

                    Object.values(grupos).forEach(g => {
                        const i = g.info;
                        g.alumnos.forEach((a, idx) => {
                            lines.push([
                                tipoLabel(i.tipo_item), i.item_id, i.item_nombre, i.horario || '', i.modalidad || '',
                                i.cupo || '', g.alumnos.length, idx + 1,
                                ((a.nombre || '') + ' ' + (a.apellido || '')).trim(), a.email || '', a.telefono || '',
                                a.institucion || '', a.pago || '', a.folio || ''
                            ].map(esc).join(','));
                        });
                    });

                    if (lines.length === 1) lines.push(['(Sin alumnos inscritos aún)'].map(esc).join(','));

                    const csv = '﻿' + lines.join('\r\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `concei_alumnos_por_taller_${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                } catch (err) {
                    alert('Error al generar el reporte: ' + err.message);
                } finally {
                    downloadRosterBtn.disabled = false;
                    downloadRosterBtn.innerHTML = '<i class="fa-solid fa-users-viewfinder"></i> Alumnos por Taller';
                }
            });
        }
    }
});
