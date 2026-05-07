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
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = passwordInput.value;

            // MOCK CREDENTIALS FOR TESTING
            if (email === 'admin@dranabel.com' && password === 'DranabelAdmin2026!') {
                sessionStorage.setItem('isAdminLoggedIn', 'true');
                window.location.href = 'admin-dashboard.html?v=6';
            } else {
                errorMessage.style.display = 'block';
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 3000);
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
    }

    // --- DASHBOARD LOGIC ---
    if (isDashboard) {
        const itemsList = document.getElementById('itemsList');

        // --- Global Event Delegation (Moved to Top for Priority) ---
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.action-btn');
            if (!btn) return;

            e.preventDefault();

            const action = btn.dataset.action;
            const id = btn.dataset.id;
            const type = btn.dataset.type;
            const status = btn.dataset.status;

            console.log(`Global Click Captured: ${action} | ID: ${id}`);

            if (action === 'deleteItem') {
                window.deleteItem(id, type);
            } else if (action === 'editItem') {
                window.editItem(id, type);
            } else if (action === 'deleteReg') {
                window.deleteReg(id);
            } else if (action === 'updateRegStatus') {
                window.updateRegStatus(id, status);
            }
        });
        const menuItems = document.querySelectorAll('.menu-item');
        const pageTitle = document.getElementById('pageTitle');
        const pageDescription = document.getElementById('pageDescription');
        const modal = document.getElementById('itemModal');
        const codeModal = document.getElementById('codeModal');
        const openModalBtn = document.getElementById('openModalBtn');
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

        let currentType = 'workshop'; // default
        let editingId = null;
        let highlightId = null; // Para resaltar nuevos elementos

        // Datos cargados desde la base de datos


        async function getData() {
            const response = await fetch(`php/api.php?action=get_initial_data&t=${Date.now()}`);
            return await response.json();
        }

        async function renderItems() {
            const data = await getData();
            let items = [];

            if (currentType === 'registrations') {
                const regResponse = await fetch(`php/api.php?action=get_registrations&t=${Date.now()}`);
                const regData = await regResponse.json();
                items = regData.registrations || [];
            } else if (currentType !== 'settings') {
                items = data[currentType] || [];
            }

            if (!itemsList) return;
            itemsList.innerHTML = '';

            const thead = document.querySelector('.data-table thead tr');
            if (currentType === 'settings') {
                // Configuración Render
                openModalBtn.style.display = 'none';
                document.querySelector('.data-table').style.display = 'none';
                itemsList.innerHTML = '';

                const prices = data.prices || { general: 1000, student_external: 800, student_uady: 0 };

                const settingsHtml = `
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <h3 style="margin-bottom: 20px; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">
                            <i class="fa-solid fa-money-bill-wave" style="color: var(--primary-color);"></i> Configuración de Cuotas de Inscripción
                        </h3>
                        <p style="margin-bottom: 25px; color: #64748b; font-size: 0.95rem;">
                            Modifica los precios de inscripción. Estos valores se actualizarán en tiempo real en la página de registro.
                        </p>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #334155;">Profesores y Público en General (MXN)</label>
                            <input type="number" id="price_general" class="form-input" value="${prices.general}" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;">
                        </div>
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #334155;">Estudiantes en General (MXN)</label>
                            <input type="number" id="price_student_external" class="form-input" value="${prices.student_external}" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;">
                        </div>
                        <div class="form-group" style="margin-bottom: 30px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #334155;">Estudiantes y Profesores UADY (MXN)</label>
                            <input type="number" id="price_student_uady" class="form-input" value="${prices.student_uady}" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px;">
                        </div>
                        <button onclick="saveSettings()" style="background: var(--primary-color); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; width: 100%; cursor: pointer; transition: 0.2s;">
                            <i class="fa-solid fa-save"></i> Guardar Precios
                        </button>
                    </div>
                `;

                const container = document.createElement('div');
                container.innerHTML = settingsHtml;
                itemsList.parentNode.insertBefore(container, itemsList.nextSibling);
                container.id = 'settingsContainer';

                return; // Terminar renderización
            } else {
                document.querySelector('.data-table').style.display = 'table';
                const existingSettings = document.getElementById('settingsContainer');
                if (existingSettings) existingSettings.remove();
            }

            if (currentType === 'code') {
                thead.innerHTML = `<th>Código</th><th>Estado</th><th>Fecha de Creación</th><th>Acciones</th>`;
                openModalBtn.style.display = 'flex';
            } else if (currentType === 'registrations') {
                thead.innerHTML = `<th>Nombre</th><th>Email</th><th>Documentos</th><th>Concepto</th><th>Monto</th><th>Estatus</th><th>Acciones</th>`;
                openModalBtn.style.display = 'none';
            } else {
                thead.innerHTML = `<th>Nombre</th><th>Detalles</th><th>Horario / Modalidad</th><th>Precio / Cupo</th><th>ID</th><th>Acciones</th>`;
                openModalBtn.style.display = 'flex';
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
                            <span style="font-size: 0.85rem; padding: 4px 8px; border-radius: 4px; background: ${item.used ? '#fee2e2' : '#dcfce7'}; color: ${item.used ? '#ef4444' : '#16a34a'}; font-weight: bold;">
                                ${item.used ? '<i class="fa-solid fa-xmark"></i> Ya Utilizado' : '<i class="fa-solid fa-check"></i> Disponible'}
                            </span>
                        </td>
                        <td><span style="color: #64748b; font-size: 0.9rem;"><i class="fa-regular fa-calendar"></i> ${item.date || 'Reciente'}</span></td>
                        <td class="actions">
                            <button class="btn-icon btn-delete action-btn" data-action="deleteItem" data-id="${item.id}" data-type="code"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                } else if (currentType === 'registrations') {
                    const statusClass = item.status === 'aceptado' ? 'status-pill-success' : (item.status === 'denegado' ? 'status-pill-danger' : 'status-pill-warning');
                    const statusText = item.status ? item.status.toUpperCase() : 'PENDIENTE';

                    tr.innerHTML = `
                        <td style="font-weight: 600;">${item.fullName || 'N/A'}</td>
                        <td>${item.email || 'N/A'}</td>
                        <td class="actions">
                            ${item.comprobante ? `<a href="uploads/${item.comprobante}" target="_blank" class="btn-icon btn-edit" title="Ver Comprobante de Pago" style="background: #e0f2fe; color: #0369a1;"><i class="fa-solid fa-file-invoice-dollar"></i></a>` : ''}
                            ${item.identificacion ? `<a href="uploads/${item.identificacion}" target="_blank" class="btn-icon btn-edit" title="Ver ID Estudiante" style="background: #fdf2f8; color: #be185d;"><i class="fa-solid fa-id-card"></i></a>` : ''}
                            ${item.constancia ? `<a href="uploads/${item.constancia}" target="_blank" class="btn-icon btn-edit" title="Ver Constancia RFC" style="background: #f0fdf4; color: #15803d;"><i class="fa-solid fa-file-contract"></i></a>` : ''}
                        </td>
                        <td><code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px;">${item.concept || 'N/A'}</code></td>
                        <td style="font-weight: 500;">${item.total || '$0.00'}</td>
                        <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                        <td class="actions">
                            <button class="btn-icon btn-edit action-btn" style="background: #dcfce7; color: #15803d;" data-action="updateRegStatus" data-id="${item.folio}" data-status="aceptado" title="Aceptar Pago"><i class="fa-solid fa-check"></i></button>
                            <button class="btn-icon btn-delete action-btn" data-action="updateRegStatus" data-id="${item.folio}" data-status="denegado" title="Denegar Pago"><i class="fa-solid fa-xmark"></i></button>
                            <button class="btn-icon btn-delete action-btn" style="background: #fca5a5; color: #7f1d1d;" data-action="deleteReg" data-id="${item.folio}" title="Eliminar Registro Permanente"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    `;
                } else if (currentType === 'workshop' || currentType === 'visit') {
                    tr.innerHTML = `
                        <td>
                            <strong style="display:block; margin-bottom: 4px; color: #1e293b;">${item.name}${newBadge}</strong>
                            <small style="color: var(--primary-color); display:block;"><strong>Instructor:</strong> ${item.instructor || 'Por definir'}</small>
                            <small style="color: #64748b; display:block;"><strong>Dependencia:</strong> ${item.dependency || 'N/A'}</small>
                        </td>
                        <td style="max-width: 250px;">
                            <small style="color: #6b7280; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
                                ${item.description || 'Sin descripción'}
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
                            <small style="color: ${(item.cupo_actual || 0) >= (item.capacity || 0) ? '#ef4444' : '#475569'}; font-weight: ${(item.cupo_actual || 0) >= (item.capacity || 0) ? 'bold' : 'normal'};">
                                <i class="fa-solid fa-user-group"></i> ${item.cupo_actual || 0} / ${item.capacity || 0}
                            </small>
                        </td>
                        <td><code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-weight: bold;">${item.id}</code></td>
                        <td class="actions">
                            <button class="btn-icon btn-edit action-btn" data-action="editItem" data-id="${item.id}" data-type="${currentType}"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-icon btn-delete action-btn" data-action="deleteItem" data-id="${item.id}" data-type="${currentType}"><i class="fa-solid fa-trash"></i></button>
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
                    pageDescription.textContent = 'Gestiona los registros, valida pagos y actualiza el estatus de los asistentes.';
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
            itemForm.reset();
            document.getElementById('itemId').value = '';
            document.getElementById('itemId').disabled = false;

            // Limpiar contador de cupo actual al agregar nuevo
            const currentVal = document.getElementById('itemCurrentValue');
            if (currentVal) currentVal.value = '0';
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
        };

        // CRUD Functions
        window.saveSettings = async () => {
            const prices = {
                general: parseFloat(document.getElementById('price_general').value) || 0,
                student_external: parseFloat(document.getElementById('price_student_external').value) || 0,
                student_uady: parseFloat(document.getElementById('price_student_uady').value) || 0
            };

            const response = await fetch('php/api.php?action=update_settings', {
                method: 'POST',
                body: JSON.stringify(prices)
            });
            const result = await response.json();
            if (result.success) {
                alert('¡Precios actualizados correctamente!');
            } else {
                alert('Error al guardar: ' + result.error);
            }
        };

        window.editItem = async (id, type) => {
            const data = await getData();
            const actualType = type || currentType;
            const item = data[actualType].find(i => i.id === id);
            if (item) {
                editingId = id;
                document.getElementById('itemId').value = item.id;
                document.getElementById('itemId').disabled = true; // No permitir cambiar ID en edición para evitar duplicados
                document.getElementById('itemName').value = item.name;
                document.getElementById('itemDescription').value = item.description || '';
                document.getElementById('itemHours').value = item.hours || '';
                document.getElementById('itemPrice').value = item.price;
                document.getElementById('itemInstructor').value = item.instructor || '';
                document.getElementById('itemDependency').value = item.dependency || '';
                document.getElementById('itemModality').value = item.modality || 'Presencial';
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
            if (confirm(`¿Estás seguro de que deseas eliminar este elemento?`)) {
                const response = await fetch(`php/api.php?action=delete_item&id=${id}&type=${actualType}&t=${Date.now()}`);
                const result = await response.json();
                if (result.success) {
                    renderItems();
                } else {
                    console.error("API Error Details:", result);
                    alert(`Error al eliminar: ${result.error}\nDebug: ${JSON.stringify(result.debug || {})}`);
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
                capacity: parseInt(document.getElementById('itemCapacity').value) || 0,
                cupo_actual: parseInt(document.getElementById('itemCurrentValue')?.value) || 0
            };

            if (!itemData.name || isNaN(itemData.price)) {
                alert('Por favor completa los campos requeridos.');
                return;
            }

            const response = await fetch(`php/api.php?action=save_item&type=${currentType}`, {
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

                const response = await fetch('php/api.php?action=generate_codes', {
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
            sessionStorage.removeItem('isAdminLoggedIn');
            window.location.href = 'admin-login.html';
        };

        window.updateRegStatus = async (folio, newStatus) => {
            const response = await fetch('php/api.php?action=update_reg_status', {
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
            if (confirm('¿Estás seguro de que deseas eliminar este registro por completo?')) {
                const response = await fetch(`php/api.php?action=delete_reg&folio=${folio}&t=${Date.now()}`);
                const result = await response.json();
                if (result.success) {
                    renderItems();
                } else {
                    alert('Error al eliminar registro: ' + result.error);
                }
            }
        };

        // delegation listener moved to top

        // Initial Render
        renderItems();
    }
});
