document.addEventListener('DOMContentLoaded', () => {
    console.log("--- APP.JS V3 LOADED ---");

    // Elements
    const form = document.getElementById('registrationForm');
    const totalDisplay = document.getElementById('totalAmount');
    const regOptions = document.querySelectorAll('input[name="regType"]');

    // Unique ID for Payment Concept (Sequential from DB, starts at 0001)
    if (!window.paymentConceptId) {
        window.paymentConceptId = 1; // Default fallback
        // Fetch next sequential ID from backend
        fetch('php/api.php?action=get_next_concept_id')
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    window.paymentConceptId = data.next_id;
                    console.log("Sequential Concept ID assigned:", window.paymentConceptId);
                    if (typeof window.updatePaymentConcept === 'function') window.updatePaymentConcept();
                }
            })
            .catch(err => console.warn("Could not fetch concept ID, using fallback:", err));
    }

    // Select ALL add-on checkboxes (Workshops, Visits, Contests)
    let addOnCheckboxes = [];

    // --- Dynamic Data Loading ---
    async function renderDynamicOptions() {
        const workshopsContainer = document.getElementById('workshopsContainer');
        const visitsContainer = document.getElementById('visitsContainer');

        if (!workshopsContainer || !visitsContainer) return;

        const accountData = JSON.parse(localStorage.getItem('tempAccount') || '{}');
        const userEmail = accountData.email || '';

        let data = null;
        try {
            const response = await fetch(`php/api.php?action=get_initial_data&email=${encodeURIComponent(userEmail)}`);
            const result = await response.json();
            if (result.success) {
                data = result;
                // IDs de talleres/visitas que el usuario ya tiene de compras anteriores
                // (para no incluirlos de nuevo en el concepto de una compra adicional)
                window.purchasedItemIds = (result.purchased || []).map(String);
                if (result.accountId) {
                    window.paymentConceptId = result.accountId;
                    console.log("Sequential Concept ID assigned from accountId:", window.paymentConceptId);
                    if (typeof window.updatePaymentConcept === 'function') window.updatePaymentConcept();
                }
            } else {
                console.error("Error loading data from API:", result.error);
                return;
            }
        } catch (e) {
            console.error("Fetch error:", e);
            return;
        }

        // --- APPLY DYNAMIC PRICES ---
        if (data && data.prices) {
            const prices = data.prices;
            
            const rgGeneral = document.getElementById('radio_price_general');
            const txtGeneral = document.getElementById('text_price_general');
            if (rgGeneral) rgGeneral.setAttribute('data-price', prices.general);
            if (txtGeneral) txtGeneral.textContent = `$${parseFloat(prices.general).toFixed(2)} MXN`;

            const rgStudentExt = document.getElementById('radio_price_student_external');
            const txtStudentExt = document.getElementById('text_price_student_external');
            if (rgStudentExt) rgStudentExt.setAttribute('data-price', prices.student_external);
            if (txtStudentExt) txtStudentExt.textContent = `$${parseFloat(prices.student_external).toFixed(2)} MXN`;

            const rgStudentUady = document.getElementById('radio_price_student_uady');
            const txtStudentUady = document.getElementById('text_price_student_uady');
            if (rgStudentUady) rgStudentUady.setAttribute('data-price', prices.student_uady);
            if (txtStudentUady) txtStudentUady.textContent = `$${parseFloat(prices.student_uady).toFixed(2)} MXN`;
        }

        // --- PRE-FILL AND HIDE IF ALREADY REGISTERED ---
        if (data && data.userInfo) {
            console.log("[DEBUG] Usuario ya registrado detectado. Simplificando interfaz...");
            window.isReturningUser = true;
            const u = data.userInfo;

            // Llenar campos ocultos para que el registro siga siendo válido
            if(document.getElementById('firstName')) document.getElementById('firstName').value = u.nombre || '';
            if(document.getElementById('lastName')) document.getElementById('lastName').value = u.apellido || '';
            if(document.getElementById('organization')) document.getElementById('organization').value = u.institucion || '';
            if(document.getElementById('city')) document.getElementById('city').value = u.ciudad || '';
            if(document.getElementById('state')) document.getElementById('state').value = u.estado || '';
            if(document.getElementById('country')) document.getElementById('country').value = u.pais || '';

            const regRadio = document.querySelector(`input[name="regType"][value="${u.regType}"]`);
            if (regRadio) {
                regRadio.checked = true;
                regRadio.setAttribute('data-price', '0');
                if (typeof toggleStudentDetails === 'function') toggleStudentDetails();
                if (typeof window.updateSummary === 'function') window.updateSummary();
            }

            // Ocultar tipo de registro y políticas (no editables en actualización)
            const sectionsToHide = ['regTypeSection', 'policySection'];
            sectionsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                    el.querySelectorAll('input, select, textarea').forEach(inp => inp.removeAttribute('required'));
                }
            });

            // Datos personales: mostrar con aviso y botón dedicado de actualización
            const personalSection = document.getElementById('personalInfoSection');
            if (personalSection) {
                const updateNotice = document.createElement('div');
                updateNotice.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:18px;';
                updateNotice.innerHTML = `<p style="margin:0;color:#1e40af;font-size:0.9rem;font-weight:600;">
                    <i class="fa-solid fa-pen-to-square"></i> Actualiza tus datos personales si es necesario (el correo no puede modificarse).
                </p>`;
                personalSection.insertBefore(updateNotice, personalSection.firstChild);

                const saveBtn = document.createElement('div');
                saveBtn.style.cssText = 'margin-top:16px;';
                saveBtn.innerHTML = `<button type="button" id="savePersonalBtn" style="background:#1e3a8a;color:white;border:none;padding:9px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.9rem;">
                    Guardar datos personales
                </button>
                <span id="savePersonalStatus" style="margin-left:12px;font-size:0.85rem;color:#64748b;"></span>`;
                personalSection.querySelector('.card-body').appendChild(saveBtn);

                document.getElementById('savePersonalBtn').addEventListener('click', async () => {
                    const btn = document.getElementById('savePersonalBtn');
                    const status = document.getElementById('savePersonalStatus');
                    btn.disabled = true;
                    status.textContent = 'Guardando...';
                    try {
                        const res = await fetch('php/api.php?action=update_personal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: userEmail,
                                nombre: document.getElementById('firstName')?.value || '',
                                apellido: document.getElementById('lastName')?.value || '',
                                institucion: document.getElementById('organization')?.value || '',
                                ciudad: document.getElementById('city')?.value || '',
                                estado: document.getElementById('state')?.value || '',
                                pais: document.getElementById('country')?.value || ''
                            })
                        });
                        const result = await res.json();
                        status.textContent = result.success ? '✅ Datos actualizados.' : '❌ ' + (result.error || 'Error');
                    } catch (e) {
                        status.textContent = '❌ Error de conexión.';
                    } finally {
                        btn.disabled = false;
                    }
                });
            }

            // authorSection oculta para usuarios que regresan (se gestiona desde el panel "Mis Contribuciones")
            const authorSection = document.getElementById('authorSection');
            if (authorSection) {
                authorSection.style.display = 'none';
                authorSection.querySelectorAll('input, select, textarea').forEach(inp => inp.removeAttribute('required'));
            }

            const form = document.getElementById('registrationForm');

            // ── Panel de estado de documentos ───────────────────────────────────
            const DOC_SPECS_USER = [
                { key: 'comprobante',    label: 'Comprobantes de Pago',           icon: '🧾' },
                { key: 'identificacion', label: 'Identificación / Credencial',    icon: '🪪' },
                { key: 'constancia',     label: 'Constancia Fiscal (RFC)',        icon: '📄' },
            ];

            const statusCfg = {
                aceptado:  { label: 'Aceptado',    color: '#15803d', bg: '#dcfce7', border: '#86efac', icon: '✅' },
                rechazado: { label: 'Rechazado',   color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', icon: '❌' },
                rechazado_definitivo: { label: 'Rechazo Definitivo', color: '#7f1d1d', bg: '#fecaca', border: '#f87171', icon: '⛔' },
                pendiente: { label: 'En revisión', color: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: '⏳' },
            };

            const regStatusCfg = {
                aceptado:          { label: 'Registro Aceptado ✅',          bg: '#dcfce7', color: '#15803d', border: '#86efac' },
                revision_pendiente:{ label: 'Documentos en Revisión 🔍',     bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
                denegado:          { label: 'Registro Denegado ❌',           bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
                pendiente:         { label: 'Pendiente de Revisión ⏳',       bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
            };

            const formatFecha = (fecha) => {
                if (!fecha) return '';
                try {
                    return new Date(fecha.replace(' ', 'T')).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
                } catch (e) {
                    return fecha;
                }
            };

            // Ordinales en femenino (para "Primera/Segunda/... Subida")
            const ORDINALS_F = { 1: 'Primera', 2: 'Segunda', 3: 'Tercera', 4: 'Cuarta', 5: 'Quinta', 6: 'Sexta', 7: 'Séptima', 8: 'Octava', 9: 'Novena', 10: 'Décima' };
            const ordinalF = n => ORDINALS_F[n] || `${n}ª`;

            // Extrae el número de folio para ordenar las "subidas"/compras cronológicamente
            const folioNum = f => parseInt(String(f || '').replace(/\D/g, ''), 10) || 0;

            let activeUserTab = null;

            async function loadAndRenderDocPanel() {
                const res = await fetch(`php/api.php?action=get_user_doc_status&email=${encodeURIComponent(userEmail)}&t=${Date.now()}`);
                const docData = await res.json();
                if (!docData.success || !docData.hasRegistration) return;
                renderDocPanel(docData);
            }

            function renderDocPanel(docData) {
                const folio = docData.folio;
                const docs  = docData.documents || {};
                const regSt = docData.status || 'pendiente';
                const sc    = regStatusCfg[regSt] || regStatusCfg.pendiente;

                // Solo se piden los documentos que aplican según el tipo de registro:
                // - comprobante: solo si el total a pagar es mayor a $0 (registro gratuito no requiere comprobante)
                // - identificacion: solo estudiantes (externos o UADY)
                // - constancia: solo si solicitó factura (RFC)
                const regTotal = parseFloat(String(docData.total || '0').replace(/[^0-9.]/g, '')) || 0;
                const applicableTypes = [];
                if (regTotal > 0) applicableTypes.push('comprobante');
                if (docData.regType === 'student_external' || docData.regType === 'student_uady') applicableTypes.push('identificacion');
                if (docData.requiereFactura) applicableTypes.push('constancia');

                // Aplanar todos los documentos con su tipo, para agruparlos por folio/"subida"
                const allDocs = [];
                DOC_SPECS_USER.forEach(spec => (docs[spec.key] || []).forEach(d => allDocs.push(Object.assign({}, d, { _type: spec.key }))));

                // Las "subidas"/compras se numeran según el orden de sus folios de comprobante
                const comprobanteFolios = [...new Set(allDocs.filter(d => d._type === 'comprobante').map(d => d.folio))]
                    .sort((a, b) => folioNum(a) - folioNum(b));
                const purchaseNumByFolio = {};
                comprobanteFolios.forEach((f, idx) => { purchaseNumByFolio[f] = idx + 1; });
                if (purchaseNumByFolio[folio] === undefined && applicableTypes.includes('comprobante')) {
                    purchaseNumByFolio[folio] = comprobanteFolios.length + 1;
                }

                // Agrupar documentos por folio
                const docsByFolio = {};
                allDocs.forEach(d => (docsByFolio[d.folio] = docsByFolio[d.folio] || []).push(d));

                let purchaseFolios = [...new Set(allDocs.map(d => d.folio))];
                if (!purchaseFolios.includes(folio)) purchaseFolios.push(folio);
                purchaseFolios.sort((a, b) => folioNum(a) - folioNum(b));

                const purchases = purchaseFolios.map(f => ({ folio: f, num: purchaseNumByFolio[f] || null, docs: docsByFolio[f] || [] }));

                if (activeUserTab === null || activeUserTab < 1 || activeUserTab > purchases.length) {
                    activeUserTab = purchases.length;
                }
                const active = purchases[activeUserTab - 1];
                const isFirstPurchase = active.num === 1 || (active.num === null && purchases.length === 1);
                const isCurrentFolio = active.folio === folio;

                let existingPanel = document.getElementById('docStatusPanel');
                if (existingPanel) existingPanel.remove();

                const panel = document.createElement('div');
                panel.id = 'docStatusPanel';
                panel.style.cssText = 'background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.08);margin-bottom:28px;overflow:hidden;';

                // Header (incluye botón para cerrar sesión — obs. 6-ago, Cambio 5)
                panel.innerHTML = `
                    <div style="background:linear-gradient(135deg,#1e293b 0%,#0f4c75 100%);padding:20px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                        <div>
                            <p style="margin:0 0 4px;font-size:0.75rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">Mis Documentos</p>
                            <h3 style="margin:0;color:white;font-size:1.15rem;font-weight:700;">¡Hola de nuevo, ${u.nombre}!</h3>
                            <p style="margin:4px 0 0;font-size:0.8rem;color:rgba(255,255,255,0.6);">Folio: <strong style="color:#38bdf8;">${folio}</strong></p>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <div style="padding:8px 16px;border-radius:20px;background:${sc.bg};border:1px solid ${sc.border};">
                                <span style="font-weight:700;font-size:0.85rem;color:${sc.color};">${sc.label}</span>
                            </div>
                            <button type="button" id="userLogoutBtn" style="padding:8px 16px;border-radius:20px;background:rgba(239,68,68,0.15);border:1px solid rgba(252,165,165,0.5);color:#fca5a5;font-weight:700;font-size:0.85rem;cursor:pointer;">
                                <i class="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
                            </button>
                        </div>
                    </div>`;

                // Cerrar sesión: limpia la sesión local y regresa al login
                setTimeout(() => {
                    const lb = document.getElementById('userLogoutBtn');
                    if (lb) lb.addEventListener('click', () => {
                        try {
                            localStorage.removeItem('tempAccount');
                            localStorage.removeItem('registrationDraft');
                        } catch (e) {}
                        window.location.href = 'index.html';
                    });
                }, 0);

                // Pestañas (una por "subida"/compra), solo si hay más de una
                if (purchases.length > 1) {
                    const tabBar = document.createElement('div');
                    tabBar.style.cssText = 'display:flex;gap:6px;padding:14px 24px 0;border-bottom:1px solid #e2e8f0;flex-wrap:wrap;';
                    purchases.forEach((p, idx) => {
                        const tabNum = idx + 1;
                        const estados = p.docs.map(d => d.estado);
                        let dotColor = '#f59e0b';
                        if (estados.length > 0 && estados.every(e => e === 'aceptado')) dotColor = '#22c55e';
                        if (estados.includes('rechazado')) dotColor = '#ef4444';
                        const isActive = tabNum === activeUserTab;
                        const label = p.num ? `${ordinalF(p.num)} Subida` : 'Documentos del Registro';
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.style.cssText = `display:flex;align-items:center;gap:6px;padding:8px 14px;border:none;border-bottom:2px solid ${isActive ? '#0f4c75' : 'transparent'};background:transparent;color:${isActive ? '#0f4c75' : '#64748b'};font-weight:${isActive ? '700' : '600'};font-size:0.85rem;cursor:pointer;border-radius:0;`;
                        btn.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;"></span>${label}`;
                        btn.addEventListener('click', () => {
                            activeUserTab = tabNum;
                            renderDocPanel(docData);
                        });
                        tabBar.appendChild(btn);
                    });
                    panel.appendChild(tabBar);
                }

                const grid = document.createElement('div');
                grid.style.cssText = 'padding:20px 24px;display:flex;flex-direction:column;gap:18px;';

                // Concepto de pago con el que se generó esta subida, para que el usuario
                // sepa con qué concepto envió su comprobante y a cuál subida pertenece
                // (útil si fue rechazado y debe volver a depositar/corregir).
                const conceptoInfo = (docData.conceptosByFolio || {})[active.folio];
                if (conceptoInfo) {
                    const infoBar = document.createElement('div');
                    infoBar.style.cssText = 'padding:10px 14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;display:flex;gap:18px;flex-wrap:wrap;align-items:center;';
                    infoBar.innerHTML = `
                        <span style="font-size:0.82rem;color:#0c4a6e;"><strong>Concepto de pago:</strong> <span style="font-family:monospace;font-weight:700;">${conceptoInfo.concepto}</span></span>
                        ${conceptoInfo.total ? `<span style="font-size:0.82rem;color:#0c4a6e;"><strong>Monto:</strong> ${conceptoInfo.total}</span>` : ''}
                    `;
                    grid.appendChild(infoBar);
                }

                // Qué tipos de documento corresponden a la subida activa:
                // - identificación: solo en la primera subida (si aplica por tipo de registro)
                // - comprobante y constancia: en cualquier subida (constancia opcional si se activó RFC)
                const has = type => active.docs.some(d => d._type === type);
                const sectionKeys = [];
                if (has('identificacion') || (isFirstPurchase && isCurrentFolio && applicableTypes.includes('identificacion'))) sectionKeys.push('identificacion');
                if (has('comprobante') || (isCurrentFolio && applicableTypes.includes('comprobante'))) sectionKeys.push('comprobante');
                if (has('constancia') || (isCurrentFolio && applicableTypes.includes('constancia'))) sectionKeys.push('constancia');

                const sectionSpecs = DOC_SPECS_USER.filter(spec => sectionKeys.includes(spec.key));

                if (sectionSpecs.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'padding:12px 0;color:#64748b;font-style:italic;font-size:0.85rem;';
                    empty.textContent = 'No hay documentos para esta subida.';
                    grid.appendChild(empty);
                }

                // Todos los documentos del usuario (todas las pestañas), para poder
                // determinar si un documento rechazado ya tiene corrección subida.
                const everyDoc = [];
                DOC_SPECS_USER.forEach(s2 => (docs[s2.key] || []).forEach(d => everyDoc.push(d)));
                const rootOf = d => d.reemplaza_id || d.id;
                // Un doc rechazado se puede corregir si NINGÚN documento posterior
                // pertenece a su misma cadena (id raíz).
                const tieneCorreccion = d => everyDoc.some(o => o.id !== d.id && (o.reemplaza_id || 0) == rootOf(d) && new Date(o.fecha_subida) >= new Date(d.fecha_subida));

                sectionSpecs.forEach(spec => {
                    const entries = active.docs.filter(d => d._type === spec.key);
                    const inputId = `reupload_${active.folio}_${spec.key}`;

                    // El botón general del encabezado solo aplica para la PRIMERA
                    // subida de este tipo. Las correcciones de documentos rechazados
                    // tienen su propio botón en la fila de cada documento, anclado a
                    // ese pago específico (no se pierden al hacer otra compra).
                    const latest = entries[0];
                    const canUpload = !latest;
                    const uploadFolio = active.folio;

                    const group = document.createElement('div');
                    group.style.cssText = 'border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;';

                    let entriesHtml = '';
                    if (entries.length === 0) {
                        entriesHtml = `<div style="padding:12px 16px;color:#64748b;font-style:italic;font-size:0.85rem;">Aún no has subido ningún documento de este tipo.</div>`;
                    } else {
                        entriesHtml = entries.map(d => {
                            const st = statusCfg[d.estado] || statusCfg.pendiente;
                            const shortName = d.archivo.replace(/^\d+_[^_]+_/, '');
                            // Concepto de pago de la compra a la que pertenece este
                            // comprobante, para que el usuario identifique cada pago.
                            const conceptoDoc = spec.key === 'comprobante'
                                ? (d.concepto_pago || (docData.conceptosByFolio || {})[d.folio]?.concepto || '')
                                : '';
                            return `
                                <div style="padding:10px 16px;border-top:1px solid #f1f5f9;background:${st.bg};">
                                    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                                        <div style="flex-grow:1;min-width:0;">
                                            <p style="margin:0;font-size:0.85rem;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.archivo}">${shortName}</p>
                                            <p style="margin:2px 0 0;font-size:0.72rem;color:#94a3b8;">Subido: ${formatFecha(d.fecha_subida)}</p>
                                            ${conceptoDoc ? `<p style="margin:2px 0 0;font-size:0.72rem;color:#0c4a6e;"><strong>Concepto de Pago:</strong> <span style="font-family:monospace;font-weight:700;">${conceptoDoc}</span></p>` : ''}
                                        </div>
                                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                                            <span style="font-weight:700;font-size:0.78rem;color:${st.color};padding:3px 10px;border-radius:12px;background:white;border:1px solid ${st.border};">
                                                ${st.icon} ${st.label}
                                            </span>
                                            <a href="uploads/${d.archivo}" target="_blank" title="Ver documento"
                                               style="width:30px;height:30px;border-radius:6px;background:white;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;color:#475569;text-decoration:none;font-size:0.8rem;">
                                                👁
                                            </a>
                                            ${d.estado === 'rechazado' && !tieneCorreccion(d) ? `
                                            <label title="Subir la corrección de este documento" style="display:inline-flex;align-items:center;gap:5px;padding:6px 10px;background:#b91c1c;color:white;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.72rem;">
                                                📎 Subir corrección
                                                <input type="file" class="fix-doc-input" accept="image/*,application/pdf" style="display:none;"
                                                       data-folio="${d.folio}" data-tipo="${spec.key}" data-replaces="${rootOf(d)}" data-status-target="upload-status-${active.folio}_${spec.key}">
                                            </label>` : ''}
                                        </div>
                                    </div>
                                    ${d.comentario ? `<p style="margin:6px 0 0;font-size:0.78rem;color:${st.color};"><strong>Motivo:</strong> ${d.comentario}</p>` : ''}
                                </div>`;
                        }).join('');
                    }

                    const actionHtml = canUpload
                        ? `<label for="${inputId}" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:#0f4c75;color:white;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.8rem;">
                               📎 ${latest ? 'Subir corrección' : 'Subir documento'}
                               <input type="file" id="${inputId}" accept="image/*,application/pdf" style="display:none;"
                                      data-folio="${uploadFolio}" data-tipo="${spec.key}">
                           </label>`
                        : `<span style="font-size:0.78rem;color:#64748b;font-style:italic;">Solo lectura</span>`;

                    group.innerHTML = `
                        <div style="padding:12px 16px;background:#f8fafc;display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;">
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span style="font-size:1.3rem;">${spec.icon}</span>
                                <p style="margin:0;font-weight:700;color:#1e293b;font-size:0.92rem;">${spec.label}</p>
                                <span style="font-size:0.75rem;color:#64748b;background:#e2e8f0;padding:2px 8px;border-radius:10px;">${entries.length}</span>
                            </div>
                            ${actionHtml}
                        </div>
                        ${entriesHtml}
                        <p id="upload-status-${active.folio}_${spec.key}" style="margin:0;padding:0 16px;font-size:0.78rem;color:#64748b;"></p>`;

                    grid.appendChild(group);
                });

                panel.appendChild(grid);

                if (form) form.insertBefore(panel, form.firstChild);

                // Bind upload inputs de la subida activa (cada tipo permite agregar más documentos)
                sectionSpecs.forEach(spec => {
                    const input = document.getElementById(`reupload_${active.folio}_${spec.key}`);
                    if (!input) return;
                    input.addEventListener('change', async () => {
                        if (!input.files.length) return;
                        const statusEl = document.getElementById(`upload-status-${active.folio}_${spec.key}`);
                        statusEl.textContent = 'Subiendo...';
                        statusEl.style.padding = '8px 16px';

                        const fd = new FormData();
                        fd.append('folio', input.dataset.folio);
                        fd.append('tipo_doc', input.dataset.tipo);
                        fd.append('documento', input.files[0]);

                        try {
                            const r = await fetch('php/api.php?action=reupload_doc', { method: 'POST', body: fd });
                            const result = await r.json();
                            if (result.success) {
                                statusEl.textContent = '✅ Subido correctamente. Actualizando...';
                                setTimeout(() => loadAndRenderDocPanel(), 1200);
                            } else {
                                statusEl.textContent = '❌ Error: ' + result.error;
                            }
                        } catch (err) {
                            statusEl.textContent = '❌ Error de conexión.';
                        }
                    });
                });

                // Bind de los botones "Subir corrección" por documento rechazado.
                // La corrección queda anclada al documento (pago) que corrige.
                panel.querySelectorAll('.fix-doc-input').forEach(input => {
                    input.addEventListener('change', async () => {
                        if (!input.files.length) return;
                        const statusEl = document.getElementById(input.dataset.statusTarget);
                        if (statusEl) { statusEl.textContent = 'Subiendo corrección...'; statusEl.style.padding = '8px 16px'; }

                        const fd = new FormData();
                        fd.append('folio', input.dataset.folio);
                        fd.append('tipo_doc', input.dataset.tipo);
                        fd.append('reemplaza_id', input.dataset.replaces);
                        fd.append('documento', input.files[0]);

                        try {
                            const r = await fetch('php/api.php?action=reupload_doc', { method: 'POST', body: fd });
                            const result = await r.json();
                            if (result.success) {
                                if (statusEl) statusEl.textContent = '✅ Corrección subida. Actualizando...';
                                setTimeout(() => loadAndRenderDocPanel(), 1200);
                            } else if (statusEl) {
                                statusEl.textContent = '❌ Error: ' + result.error;
                            }
                        } catch (err) {
                            if (statusEl) statusEl.textContent = '❌ Error de conexión.';
                        }
                    });
                });
            }

            loadAndRenderDocPanel();
            // ── Fin panel documentos ────────────────────────────────────────────

            // ── Panel de gestión de contribuciones ──────────────────────────────
            const AREA_LABELS_MAP = {
                energias: 'Energías renovables', ambiental: 'Ingeniería ambiental',
                ia: 'Inteligencia artificial', salud: 'Alimentación y salud',
                estructuras: 'Ing. de estructuras y construcción', imagenes: 'Procesamiento de imágenes',
                robotica: 'Robótica y visión computacional', moleculas: 'Moléculas y materiales funcionales',
                fisica: 'Ingeniería física', cuantico: 'Cómputo científico/cuántico',
                ciencias_info: 'Ciencia y tecnología de la información', biotecnologia: 'Biotecnología y Bioprocesos',
                procesos: 'Ing. de procesos e innovación industrial', matematicas: 'Matemáticas básicas y aplicadas',
                software: 'Ingeniería de software', tecnologias_emer: 'Tecnologías emergentes en computación',
                educacion: 'Educación, sociedad y formación humanista'
            };
            const AREA_OPTIONS_HTML = Object.entries(AREA_LABELS_MAP).map(([v,l]) => `<option value="${v}">${l}</option>`).join('');

            async function loadAndRenderContribPanel() {
                try {
                    const res = await fetch(`php/api.php?action=get_my_contributions&email=${encodeURIComponent(userEmail)}&t=${Date.now()}`);
                    const result = await res.json();
                    renderContribPanel(result.contributions || []);
                } catch (e) {
                    console.error('Error cargando contribuciones:', e);
                }
            }

            function renderContribPanel(contributions) {
                const existing = document.getElementById('contribMgmtPanel');
                if (existing) existing.remove();

                const panel = document.createElement('div');
                panel.id = 'contribMgmtPanel';
                panel.style.cssText = 'background:white;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;overflow:hidden;';

                const esc = s => String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

                let itemsHtml = '';
                contributions.forEach(c => {
                    const areaLabel = AREA_LABELS_MAP[c.area] || c.area;
                    const areaOpts = Object.entries(AREA_LABELS_MAP).map(([v,l]) =>
                        `<option value="${v}" ${c.area===v?'selected':''}>${l}</option>`).join('');
                    itemsHtml += `
                    <div class="contrib-item" data-id="${c.id}" style="border-bottom:1px solid #f1f5f9;padding:14px 18px;">
                        <div class="contrib-view" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                            <div style="flex:1;min-width:0;">
                                <p style="margin:0 0 4px;font-weight:700;color:#1e3a8a;font-size:0.92rem;word-break:break-word;">${esc(c.titulo)}</p>
                                <p style="margin:0;font-size:0.78rem;color:#64748b;">${c.tipo==='ponencia'?'Ponencia':'Póster'} · ${areaLabel} · ${c.modalidad}</p>
                            </div>
                            <div style="display:flex;gap:6px;flex-shrink:0;">
                                <button type="button" class="contrib-edit-btn" data-id="${c.id}"
                                    style="padding:5px 12px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:7px;font-weight:600;cursor:pointer;font-size:0.8rem;">
                                    <i class="fa-solid fa-pen"></i> Editar
                                </button>
                                <button type="button" class="contrib-del-btn" data-id="${c.id}"
                                    style="padding:5px 10px;background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5;border-radius:7px;font-weight:600;cursor:pointer;font-size:0.8rem;">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <div class="contrib-edit-form" data-id="${c.id}" style="display:none;margin-top:12px;background:#f8fafc;border-radius:10px;padding:14px;border:1px solid #e2e8f0;">
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
                                <div>
                                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Tipo</label>
                                    <select class="edit-tipo" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:0.82rem;">
                                        <option value="ponencia" ${c.tipo==='ponencia'?'selected':''}>Ponencia</option>
                                        <option value="poster" ${c.tipo==='poster'?'selected':''}>Póster</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Área</label>
                                    <select class="edit-area" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:0.82rem;">${areaOpts}</select>
                                </div>
                                <div>
                                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Modalidad</label>
                                    <select class="edit-modalidad" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:0.82rem;">
                                        <option value="presencial" ${c.modalidad==='presencial'?'selected':''}>Presencial</option>
                                        <option value="virtual" ${c.modalidad==='virtual'?'selected':''}>Virtual</option>
                                        <option value="cualquiera" ${c.modalidad==='cualquiera'?'selected':''}>Cualquiera</option>
                                    </select>
                                </div>
                            </div>
                            <div style="margin-bottom:10px;">
                                <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Título</label>
                                <input type="text" class="edit-titulo" value="${esc(c.titulo)}"
                                    style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:0.88rem;box-sizing:border-box;">
                            </div>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <button type="button" class="contrib-save-btn" data-id="${c.id}"
                                    style="padding:7px 16px;background:#1e3a8a;color:white;border:none;border-radius:7px;font-weight:700;cursor:pointer;font-size:0.82rem;">Guardar cambios</button>
                                <button type="button" class="contrib-cancel-btn" data-id="${c.id}"
                                    style="padding:7px 14px;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;border-radius:7px;font-weight:600;cursor:pointer;font-size:0.82rem;">Cancelar</button>
                                <span class="contrib-save-status" style="font-size:0.78rem;color:#64748b;"></span>
                            </div>
                        </div>
                    </div>`;
                });

                const canAdd = contributions.length < 2;
                const emptyMsg = contributions.length === 0
                    ? '<p style="color:#64748b;font-style:italic;font-size:0.85rem;margin:0 0 12px 0;">No tienes contribuciones registradas aún.</p>' : '';

                panel.innerHTML = `
                    <div style="padding:12px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;">
                        <i class="fa-solid fa-pen-nib" style="color:#1e3a8a;"></i>
                        <span style="font-weight:700;color:#1e3a8a;font-size:0.93rem;">Mis Contribuciones</span>
                        <span style="font-size:0.78rem;color:#64748b;margin-left:auto;">${contributions.length}/2 registradas</span>
                    </div>
                    <div id="contribItemsList">${itemsHtml}</div>
                    <div id="contribAddSection" style="padding:14px 18px;">
                        ${emptyMsg}
                        ${canAdd ? `
                        <button type="button" id="showAddContribFormBtn"
                            style="display:flex;align-items:center;gap:6px;padding:8px 16px;background:#f0fdf4;color:#15803d;border:1px dashed #86efac;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem;">
                            <i class="fa-solid fa-plus"></i> Agregar contribución
                        </button>
                        <div id="addContribForm" style="display:none;margin-top:12px;background:#f8fafc;border-radius:10px;padding:14px;border:1px solid #e2e8f0;">
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
                                <div>
                                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Tipo</label>
                                    <select id="new-tipo" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:0.82rem;">
                                        <option value="ponencia">Ponencia</option>
                                        <option value="poster">Póster</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Área</label>
                                    <select id="new-area" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:0.82rem;">${AREA_OPTIONS_HTML}</select>
                                </div>
                                <div>
                                    <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Modalidad</label>
                                    <select id="new-modalidad" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;font-size:0.82rem;">
                                        <option value="presencial">Presencial</option>
                                        <option value="virtual">Virtual</option>
                                        <option value="cualquiera">Cualquiera</option>
                                    </select>
                                </div>
                            </div>
                            <div style="margin-bottom:10px;">
                                <label style="font-size:0.78rem;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Título</label>
                                <input type="text" id="new-titulo" placeholder="Título de tu trabajo"
                                    style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:0.88rem;box-sizing:border-box;">
                            </div>
                            <div style="display:flex;gap:8px;align-items:center;">
                                <button type="button" id="saveNewContrib"
                                    style="padding:7px 16px;background:#15803d;color:white;border:none;border-radius:7px;font-weight:700;cursor:pointer;font-size:0.82rem;">Guardar</button>
                                <button type="button" id="cancelNewContrib"
                                    style="padding:7px 14px;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;border-radius:7px;font-weight:600;cursor:pointer;font-size:0.82rem;">Cancelar</button>
                                <span id="newContribStatus" style="font-size:0.78rem;color:#64748b;"></span>
                            </div>
                        </div>` : '<p style="font-size:0.82rem;color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:8px;margin:0;">Límite de 2 contribuciones alcanzado.</p>'}
                    </div>`;

                if (form) form.insertBefore(panel, form.firstChild);

                // Editar
                panel.querySelectorAll('.contrib-edit-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.id;
                        const editForm = panel.querySelector(`.contrib-edit-form[data-id="${id}"]`);
                        const isOpen = editForm.style.display !== 'none';
                        editForm.style.display = isOpen ? 'none' : 'block';
                        btn.innerHTML = isOpen ? '<i class="fa-solid fa-pen"></i> Editar' : 'Cerrar';
                    });
                });

                // Cancelar edición
                panel.querySelectorAll('.contrib-cancel-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.id;
                        const editForm = panel.querySelector(`.contrib-edit-form[data-id="${id}"]`);
                        editForm.style.display = 'none';
                        const editBtn = panel.querySelector(`.contrib-edit-btn[data-id="${id}"]`);
                        if (editBtn) editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Editar';
                    });
                });

                // Guardar edición
                panel.querySelectorAll('.contrib-save-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.id;
                        const editForm = panel.querySelector(`.contrib-edit-form[data-id="${id}"]`);
                        const statusEl = editForm.querySelector('.contrib-save-status');
                        const titulo = editForm.querySelector('.edit-titulo').value.trim();
                        if (!titulo) { statusEl.textContent = '⚠️ El título es obligatorio.'; return; }
                        btn.disabled = true; statusEl.textContent = 'Guardando...';
                        try {
                            const res = await fetch('php/api.php?action=update_contribution', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: userEmail, id: parseInt(id), titulo,
                                    tipo: editForm.querySelector('.edit-tipo').value,
                                    area: editForm.querySelector('.edit-area').value,
                                    modalidad: editForm.querySelector('.edit-modalidad').value
                                })
                            });
                            const result = await res.json();
                            if (result.success) { loadAndRenderContribPanel(); }
                            else { statusEl.textContent = '❌ ' + (result.error || 'Error'); btn.disabled = false; }
                        } catch (e) { statusEl.textContent = '❌ Error de conexión.'; btn.disabled = false; }
                    });
                });

                // Eliminar
                panel.querySelectorAll('.contrib-del-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('¿Eliminar esta contribución?')) return;
                        btn.disabled = true;
                        try {
                            const res = await fetch('php/api.php?action=delete_contribution', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: userEmail, id: parseInt(btn.dataset.id) })
                            });
                            const result = await res.json();
                            if (result.success) loadAndRenderContribPanel();
                            else { alert('Error: ' + result.error); btn.disabled = false; }
                        } catch (e) { alert('Error de conexión.'); btn.disabled = false; }
                    });
                });

                // Lock modalidad a Presencial en formulario de edición si tipo=poster
                panel.querySelectorAll('.contrib-edit-form').forEach(editForm => {
                    const tipoSel = editForm.querySelector('.edit-tipo');
                    const modSel = editForm.querySelector('.edit-modalidad');
                    if (tipoSel && modSel) {
                        const lockPosterEdit = () => {
                            if (tipoSel.value === 'poster') {
                                modSel.value = 'presencial';
                                modSel.disabled = true;
                            } else {
                                modSel.disabled = false;
                            }
                        };
                        tipoSel.addEventListener('change', lockPosterEdit);
                        lockPosterEdit();
                    }
                });

                // Mostrar/ocultar form agregar
                const showAddBtn = panel.querySelector('#showAddContribFormBtn');
                const addFormDiv = panel.querySelector('#addContribForm');
                if (showAddBtn && addFormDiv) {
                    showAddBtn.addEventListener('click', () => {
                        addFormDiv.style.display = addFormDiv.style.display === 'none' ? 'block' : 'none';
                    });

                    // Lock modalidad a Presencial en formulario de agregar si tipo=poster
                    const newTipoSel = panel.querySelector('#new-tipo');
                    const newModSel = panel.querySelector('#new-modalidad');
                    if (newTipoSel && newModSel) {
                        newTipoSel.addEventListener('change', () => {
                            if (newTipoSel.value === 'poster') {
                                newModSel.value = 'presencial';
                                newModSel.disabled = true;
                            } else {
                                newModSel.disabled = false;
                            }
                        });
                    }
                    panel.querySelector('#cancelNewContrib')?.addEventListener('click', () => {
                        addFormDiv.style.display = 'none';
                    });
                    panel.querySelector('#saveNewContrib')?.addEventListener('click', async () => {
                        const titulo = panel.querySelector('#new-titulo').value.trim();
                        const statusEl = panel.querySelector('#newContribStatus');
                        if (!titulo) { statusEl.textContent = '⚠️ El título es obligatorio.'; return; }
                        const saveBtn = panel.querySelector('#saveNewContrib');
                        saveBtn.disabled = true; statusEl.textContent = 'Guardando...';
                        try {
                            const res = await fetch('php/api.php?action=add_contribution', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: userEmail, titulo,
                                    tipo: panel.querySelector('#new-tipo').value,
                                    area: panel.querySelector('#new-area').value,
                                    modalidad: panel.querySelector('#new-modalidad').value
                                })
                            });
                            const result = await res.json();
                            if (result.success) loadAndRenderContribPanel();
                            else { statusEl.textContent = '❌ ' + (result.error || 'Error'); saveBtn.disabled = false; }
                        } catch (e) { statusEl.textContent = '❌ Error de conexión.'; saveBtn.disabled = false; }
                    });
                }
            }

            loadAndRenderContribPanel();
            // ── Fin panel contribuciones ────────────────────────────────────────
        }

        // Helper to create HTML
        const createOptionHtml = (item, type) => {
            const isPurchased = data.purchased && data.purchased.includes(item.id.toString());
            // Ítem que el propio usuario tiene RESERVADO (seleccionado pero aún sin
            // pagar): para él debe verse seleccionado y disponible, NUNCA agotado por
            // su propio apartado. Para los demás usuarios sí cuenta como ocupado.
            const isReservedByMe = !isPurchased && data.reserved && data.reserved.includes(item.id.toString());
            const hoursMatch = item.hours ? item.hours.match(/\d{1,2}:\d{2}/) : null;
            const shortHours = hoursMatch ? hoursMatch[0] : (item.hours ? item.hours.split(' ')[0] : 'Pdt');
            const current = parseInt(item.cupo_actual) || 0;
            const max = parseInt(item.capacity) || 0;
            // Si el ítem es "mío" (reservado por mí) no lo considero agotado aunque el
            // conteo global lo esté, porque ese conteo me incluye a mí mismo.
            const isFull = (current >= max) && !isReservedByMe;

            return `
                <div class="addon-option-wrapper ${isFull ? 'option-full' : ''} ${isPurchased ? 'option-purchased' : ''}"
                     data-workshop-id="${item.id}"
                     data-capacity="${max}"
                     data-current="${current}"
                     data-purchased="${isPurchased}"
                     data-reserved="${isReservedByMe}"
                     data-price="${item.price}">
                    <label class="addon-option ${isFull ? 'disabled' : ''} ${isPurchased ? 'locked-purchased' : ''}">
                        <input type="checkbox" name="${type}[]" value="${item.id}"
                               data-price="${isPurchased ? '0' : item.price}"
                               ${isFull && !isPurchased ? 'disabled' : ''}
                               ${isPurchased ? 'checked disabled' : (isReservedByMe ? 'checked' : '')}>
                        ${isPurchased ? `<input type="hidden" name="${type}[]" value="${item.id}">` : ''}
                        <div class="addon-content">
                            <span style="display:inline-block;font-family:monospace;font-weight:800;font-size:0.72rem;color:#1e3a8a;background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:1px 7px;margin-bottom:4px;">${item.id}</span>
                            <div class="addon-header-premium">
                                <div class="custom-check-premium ${isPurchased ? 'check-locked' : ''}">
                                    ${isPurchased ? '<i class="fa-solid fa-lock"></i>' : ''}
                                </div>
                                <span class="addon-title-premium" title="${item.name}">${item.name}</span>
                                ${ (item.dependencia || item.dependency) ? `<small style="display:block; color: var(--primary-color); font-size: 0.75rem; margin-top: 2px;">${item.dependencia || item.dependency}</small>` : ''}
                            </div>
                            
                            <div class="addon-meta-compact">
                                <span><i class="fa-regular fa-clock"></i> ${shortHours}</span>
                                <span><i class="fa-solid fa-user-group"></i> ${current}/${max}</span>
                                <span><i class="fa-solid fa-laptop"></i> ${item.modality === 'Virtual' ? 'Virt' : 'Pres'}</span>
                            </div>

                            <div class="addon-footer-premium">
                                <button type="button" class="info-text-btn" onclick="event.preventDefault(); showWorkshopInfo('${item.id}', '${type}')">
                                    LEER ACERCA DE ESTE TALLER
                                </button>
                                <span class="addon-price-tag ${isFull ? 'full-tag' : ''} ${isPurchased ? 'purchased-tag' : ''}">
                                    ${isPurchased ? 'Historial' : (isFull ? 'AGOTADO' : `+$${item.price}`)}
                                </span>
                            </div>
                        </div>
                    </label>
                </div>
            `;
        };

        window.toggleWorkshopCard = function (id) {
            showWorkshopInfo(id, 'workshop');
        };

        // Los talleres/visitas desactivados por el admin no se muestran a los
        // usuarios, salvo que el usuario ya los haya comprado anteriormente
        // (para que conserve su historial de compra).
        const isVisibleToUser = item => String(item.activo) !== '0' || (data.purchased && data.purchased.includes(item.id.toString()));

        workshopsContainer.innerHTML = data.workshop.filter(isVisibleToUser).map(item => createOptionHtml(item, 'workshop')).join('');
        visitsContainer.innerHTML = data.visit.filter(isVisibleToUser).map(item => createOptionHtml(item, 'visit')).join('');

        // Modal Logic
        window.showWorkshopInfo = function (id, type) {
            const list = type === 'workshop' ? data.workshop : data.visit;
            const item = list.find(w => w.id === id);
            if (!item) return;

            document.getElementById('infoModalTitle').textContent = item.name;
            document.getElementById('infoModalDescription').textContent = item.description || 'Sin descripción disponible.';

            const metaContainer = document.getElementById('infoModalMeta');
            const current = item.cupo_actual || 0;
            const max = item.capacity || 30;

            // El lugar solo aplica a los presenciales; los virtuales no tienen salón.
            const modalidadItem = item.modalidad || item.modality || 'Presencial';
            const lugarItem = (item.lugar || '').trim();
            const lugarRow = (modalidadItem !== 'Virtual' && lugarItem)
                ? `<div class="meta-item"><span>Lugar</span><span>${lugarItem.replace(/\s*\|\s*/g, ' y ')}</span></div>`
                : '';

            metaContainer.innerHTML = `
                <div class="meta-item"><span>Horario</span><span>${item.horario || item.hours || 'Pendiente'}</span></div>
                <div class="meta-item"><span>Modalidad</span><span>${modalidadItem}</span></div>
                ${lugarRow}
                <div class="meta-item"><span>Instructor</span><span>${item.instructor || 'Pendiente'}</span></div>
                <div class="meta-item"><span>Dependencia</span><span>${item.dependencia || item.dependency || 'N/A'}</span></div>
                <div class="meta-item"><span>Disponibilidad</span><span style="color: ${current >= max ? '#ef4444' : '#16a34a'}; font-weight: bold;">${current}/${max} (Ocupados/Total)</span></div>
            `;

            document.getElementById('infoModal').classList.remove('hidden');
        };

        window.closeInfoModal = function () {
            document.getElementById('infoModal').classList.add('hidden');
        };

        // Close modal on escape or click outside
        window.onclick = function (event) {
            const modal = document.getElementById('infoModal');
            if (event.target == modal) {
                closeInfoModal();
            }
        };

        // Update the global reference to checkboxes after injection
        addOnCheckboxes = document.querySelectorAll('input[name="workshop[]"], input[name="visit[]"], input[name="contest[]"]');

        // Función auxiliar para forzar el cambio en la UX (Agotado/Disponible)
        const updateUXStatus = (id, current, max, name) => {
            const selectedReg = document.querySelector('input[name="regType"]:checked');
            const regType = selectedReg ? selectedReg.value : 'general';
            const cb = document.querySelectorAll(`input[value="${id}"]`);
            cb.forEach(input => {
                const wrapper = input.closest('.addon-option-wrapper');
                const label = input.closest('.addon-option');
                const isWorkshop = input.name.includes('workshop');
                const allowedLimit = (isWorkshop && regType === 'general') ? (parseInt(max) + 2) : parseInt(max);
                const isFull = parseInt(current) >= allowedLimit;
                
                // Actualizar contador visual (0/30)
                const counterEl = wrapper?.querySelector('.fa-user-group')?.parentElement;
                if (counterEl) {
                    const safeCurrent = current !== undefined ? parseInt(current) : 0;
                    const safeMax = max !== undefined ? parseInt(max) : 0;
                    
                    let counterHtml = `<i class="fa-solid fa-user-group"></i> ${safeCurrent}/${safeMax}`;
                    if (isWorkshop && safeCurrent >= safeMax && regType === 'general') {
                        const extra = Math.max(0, safeCurrent - safeMax);
                        counterHtml = `<i class="fa-solid fa-user-group"></i> Lleno (Gral: ${extra}/2)`;
                    }
                    counterEl.innerHTML = counterHtml;
                }

                if (isFull && !input.checked) {
                    // Forzar estado AGOTADO inmediatamente
                    wrapper?.classList.add('option-full');
                    if (label) {
                        label.classList.add('disabled');
                        input.disabled = true;
                        const priceTag = label.querySelector('.addon-price-tag');
                        if (priceTag) {
                            priceTag.textContent = 'AGOTADO';
                            priceTag.classList.add('full-tag');
                        }
                    }
                } else if (!isFull) {
                    // Restaurar si se liberó cupo
                    wrapper?.classList.remove('option-full');
                    if (label) {
                        label.classList.remove('disabled');
                        input.disabled = false;
                        const priceTag = label.querySelector('.addon-price-tag');
                        if (priceTag && priceTag.textContent === 'AGOTADO') {
                            const originalPrice = input.getAttribute('data-price');
                            priceTag.textContent = `+$${originalPrice}`;
                            priceTag.classList.remove('full-tag');
                        }
                    }
                }
            });
        };

        // Re-attach listeners con validación en tiempo real al cambiar
        addOnCheckboxes.forEach(cb => {
            cb.addEventListener('change', async () => {
                const type = cb.name.includes('workshop') ? 'workshop' : 'visit';
                const id = cb.value;
                const wrapper = cb.closest('.addon-option-wrapper');
                const isChecking = cb.checked;

                // 1. Obtener identidad
                const accountData = JSON.parse(localStorage.getItem('tempAccount') || '{}');
                const email = accountData.email || 'No proporcionado';

                try {
                    const selectedRegType = document.querySelector('input[name="regType"]:checked')?.value || 'general';
                    // 2. Si intenta marcar, validar capacidad primero
                    if (isChecking) {
                        const resp = await fetch(`php/api.php?action=check_capacity&id=${id}&type=${type}&regType=${selectedRegType}`);
                        const check = await resp.json();
                        
                        if (check.success && check.isFull) {
                            cb.checked = false; // Revertir inmediatamente
                            updateUXStatus(id, check.current, check.max, check.name);
                            if (wrapper) {
                                wrapper.classList.add('shake-active');
                                setTimeout(() => wrapper.classList.remove('shake-active'), 500);
                            }
                            alert(`¡Cupo Agotado! No se pudo seleccionar "${check.name}".`);
                            calculateTotal();
                            return;
                        }
                    }

                    // 3. Procesar reserva en BD si hay email
                    if (email !== 'No proporcionado') {
                        const purchasedIds = window.purchasedItemIds || [];
                        // Solo se reservan temporalmente los items NUEVOS; los ya comprados
                        // ya están contados en reg_evento_detalles y no deben volver a verificarse.
                        const selectedWorkshops = Array.from(document.querySelectorAll('input[name="workshop[]"]:checked')).map(c => c.value).filter(id => !purchasedIds.includes(id));
                        const selectedVisits = Array.from(document.querySelectorAll('input[name="visit[]"]:checked')).map(c => c.value).filter(id => !purchasedIds.includes(id));
                        
                        const resp = await fetch('php/reserve_spots.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, workshops: selectedWorkshops, visits: selectedVisits, regType: selectedRegType })
                        });
                        const res = await resp.json();

                        if (!res.success) {
                            cb.checked = !isChecking; // Revertir al estado anterior
                            updateUXStatus(id, res.current || 0, res.max || 0, res.name || "");
                            alert(res.error || "No se pudo actualizar la reserva.");
                        } else {
                            // Éxito: Sincronizar UI
                            const capResp = await fetch(`php/api.php?action=check_capacity&id=${id}&type=${type}&regType=${selectedRegType}`);
                            const capData = await capResp.json();
                            if (capData.success) {
                                updateUXStatus(id, capData.current, capData.max, capData.name);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error en flujo de selección:", err);
                }

                calculateTotal();

                // Si el panel de pago ya está visible, actualizar comprobante y botón
                const paymentSectionEl = document.getElementById('paymentRevealSection');
                if (paymentSectionEl && !paymentSectionEl.classList.contains('hidden')) {
                    const newTotal = parseFloat((totalDisplay?.textContent || '0').replace(/[^0-9.]/g, '')) || 0;
                    applyFreeRegistrationUI(paymentSectionEl, newTotal);
                    const submitBtnEl = document.getElementById('submitBtn');
                    if (submitBtnEl) {
                        submitBtnEl.innerHTML = newTotal > 0
                            ? '<i class="fa-solid fa-cloud-arrow-up"></i> Confirmar Pago y Finalizar Registro'
                            : '<i class="fa-solid fa-circle-check"></i> Finalizar Registro';
                    }
                }
            });
        });

        // --- NUEVO: Polling de Capacidad (Actualiza contadores cada 30s) ---
        setInterval(async () => {
            try {
                const response = await fetch('php/api.php?action=get_initial_data');
                const data = await response.json();
                if (data.success) {
                    const allItems = [...data.workshop, ...data.visit];
                    allItems.forEach(item => {
                        const cb = document.querySelector(`input[value="${item.id}"]`);
                        if (cb) {
                            const wrapper = cb.closest('.addon-option-wrapper');
                            const label = cb.closest('.addon-option');
                            const current = parseInt(item.cupo_actual) || 0;
                            const max = parseInt(item.capacity) || 0;
                            
                            const isWorkshop = cb.name.includes('workshop');
                            const selectedReg = document.querySelector('input[name="regType"]:checked');
                            const regType = selectedReg ? selectedReg.value : 'general';
                            const allowedLimit = (isWorkshop && regType === 'general') ? (max + 2) : max;
                            const isFull = current >= allowedLimit;

                            // Actualizar contador
                            const counterEl = wrapper.querySelector('.fa-user-group')?.parentElement;
                            if (counterEl) {
                                let counterHtml = `<i class="fa-solid fa-user-group"></i> ${current}/${max}`;
                                if (isWorkshop && current >= max && regType === 'general') {
                                    const extra = Math.max(0, current - max);
                                    counterHtml = `<i class="fa-solid fa-user-group"></i> Lleno (Gral: ${extra}/2)`;
                                }
                                counterEl.innerHTML = counterHtml;
                            }

                            // Si se llenó y NO lo tenemos seleccionado, bloquearlo
                            if (isFull && !cb.checked) {
                                wrapper.classList.add('option-full');
                                if (label) {
                                    label.classList.add('disabled');
                                    cb.disabled = true;
                                    const priceTag = label.querySelector('.addon-price-tag');
                                    if (priceTag) {
                                        priceTag.textContent = 'AGOTADO';
                                        priceTag.classList.add('full-tag');
                                    }
                                }
                            } else if (!isFull) {
                                // Si se liberó, desbloquear
                                wrapper.classList.remove('option-full');
                                if (label) {
                                    label.classList.remove('disabled');
                                    cb.disabled = false;
                                    const priceTag = label.querySelector('.addon-price-tag');
                                    if (priceTag && priceTag.textContent === 'AGOTADO') {
                                        priceTag.textContent = `+$${item.price}`;
                                        priceTag.classList.remove('full-tag');
                                    }
                                }
                            }
                        }
                    });
                }
            } catch (e) {
                console.error("Error en polling de capacidad:", e);
            }
        }, 30000); // Cada 30 segundos

        updateWorkshopCapacityStates();

        // Restaurar borrador AHORA que los checkboxes ya existen en el DOM
        restoreFormDraft();
    }

    const facturaRadios = document.querySelectorAll('input[name="factura"]');
    const billingForm = document.getElementById('billingForm');
    const authorSection = document.getElementById('authorSection');
    const benefitsContainer = document.getElementById('benefitsContainer');
    const benefitsList = document.getElementById('benefitsList');

    // Benefits Lists
    const generalBenefits = [
        "Acceso completo a todas las conferencias magistrales y sesiones técnicas.",
        "Constancia de participación",
        "Acceso a un taller o una visita industrial"
    ];

    const studentBenefits = [
        "Acceso completo a todas las conferencias magistrales y sesiones técnicas.",
        "Constancia de participación",
        "Acceso a un taller o una visita industrial"
    ];

    const uadyBenefits = [
        "Acceso completo a todas las conferencias magistrales y sesiones técnicas"
    ];

    // Billing Inputs to toggle 'required'
    const billingInputs = billingForm.querySelectorAll('input');

    // --- Pricing Logic ---

    function formatCurrency(amount) {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    }

    function calculateTotal() {
        // Defer to updateSummary which now handles all UI total updates
        if (typeof window.updateSummary === 'function') {
            window.updateSummary();
        }
    }

    function updateWorkshopCapacityStates() {
        const selectedReg = document.querySelector('input[name="regType"]:checked');
        const regType = selectedReg ? selectedReg.value : 'general';
        
        const wrappers = document.querySelectorAll('#workshopsContainer .addon-option-wrapper');
        wrappers.forEach(wrapper => {
            const isPurchased = wrapper.getAttribute('data-purchased') === 'true';
            if (isPurchased) return; // Do not touch already purchased ones
            const isReservedByMe = wrapper.getAttribute('data-reserved') === 'true';
            if (isReservedByMe) return; // Mi propia reserva no debe marcarse como agotada

            const current = parseInt(wrapper.getAttribute('data-current') || 0);
            const max = parseInt(wrapper.getAttribute('data-capacity') || 0);
            const price = wrapper.getAttribute('data-price');

            // General gets 2 extra spots
            const allowedLimit = (regType === 'general') ? (max + 2) : max;
            const isFull = current >= allowedLimit;
            
            const label = wrapper.querySelector('.addon-option');
            const checkbox = wrapper.querySelector('input[type="checkbox"]');
            const priceTag = wrapper.querySelector('.addon-price-tag');
            
            if (isFull) {
                wrapper.classList.add('option-full');
                if (label) label.classList.add('disabled');
                if (checkbox) {
                    checkbox.disabled = true;
                    if (checkbox.checked) {
                        checkbox.checked = false; // Uncheck if it was checked but now full
                    }
                }
                if (priceTag) {
                    priceTag.classList.add('full-tag');
                    priceTag.textContent = 'AGOTADO';
                }
            } else {
                wrapper.classList.remove('option-full');
                if (label) label.classList.remove('disabled');
                if (checkbox) {
                    checkbox.disabled = false;
                }
                if (priceTag) {
                    priceTag.classList.remove('full-tag');
                    priceTag.textContent = `+$${price}`;
                }
            }

            // DYNAMIC COUNTER UPDATE FOR GENERALS WHEN FULL
            const counterEl = wrapper.querySelector('.fa-user-group')?.parentElement;
            if (counterEl) {
                let counterHtml = `<i class="fa-solid fa-user-group"></i> ${current}/${max}`;
                if (regType === 'general' && current >= max) {
                    const extra = Math.max(0, current - max);
                    counterHtml = `<i class="fa-solid fa-user-group"></i> Lleno (Gral: ${extra}/2)`;
                }
                counterEl.innerHTML = counterHtml;
            }
        });
        
        // Recalculate total and update summary in case a checkbox was dynamically unchecked
        if (typeof window.updateSummary === 'function') {
            window.updateSummary();
        }
    }

    // --- Visibility Logic ---


    function toggleStudentDetails() {
        const selectedReg = document.querySelector('input[name="regType"]:checked');
        const studentDetails = document.getElementById('studentDetails');
        const fileInput = document.getElementById('uadyIdFile');
        const codeDetails = document.getElementById('codeDetails');
        const specialCode = document.getElementById('specialCode');

        // Check if registration type section is hidden (meaning user is already registered)
        const regTypeSection = document.getElementById('regTypeSection');
        const isHidden = regTypeSection && regTypeSection.style.display === 'none';

        if (!isHidden && selectedReg && (selectedReg.value === 'student_uady' || selectedReg.value === 'student_external')) {
            studentDetails.classList.remove('hidden');
            fileInput.setAttribute('required', 'true');
        } else {
            studentDetails.classList.add('hidden');
            fileInput.removeAttribute('required');
        }

        if (!isHidden && selectedReg && selectedReg.value === 'code_access') {
            codeDetails.classList.remove('hidden');
            specialCode.setAttribute('required', 'true');
        } else {
            codeDetails.classList.add('hidden');
            specialCode.removeAttribute('required');
        }
    }

    // --- Code Verification Logic ---
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const specialCodeField = document.getElementById('specialCode');
    const codeValidationMsg = document.getElementById('codeValidationMsg');
    window.isCodeVerified = false;

    if (verifyCodeBtn && specialCodeField) {
        verifyCodeBtn.addEventListener('click', async () => {
            const code = specialCodeField.value.trim();
            if (!code) {
                codeValidationMsg.textContent = "⚠ Por favor ingrese un código.";
                codeValidationMsg.style.color = "#ef4444";
                return;
            }

            console.log("[DEBUG] Click en Verificar Código:", code);
            verifyCodeBtn.disabled = true;
            verifyCodeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            codeValidationMsg.textContent = "";

            try {
                const response = await fetch(`php/api.php?action=verify_code&code=${encodeURIComponent(code)}`);
                const result = await response.json();
                console.log("[DEBUG] Respuesta Verificación:", result);

                if (result.success) {
                    console.log("[DEBUG] CÓDIGO VÁLIDO. Procediendo a INVALIDARLO de inmediato...");
                    
                    // --- NUEVO: INVALIDAR DE INMEDIATO SEGÚN SOLICITUD ---
                    const markRes = await fetch(`php/api.php?action=mark_code_used&code=${encodeURIComponent(code)}`);
                    const markData = await markRes.json();
                    console.log("[DEBUG] Resultado de invalidación inmediata:", markData);

                    if (markData.success) {
                        window.isCodeVerified = true;
                        codeValidationMsg.textContent = "✓ Código Validado y Bloqueado.";
                        codeValidationMsg.style.color = "#16a34a";
                        specialCodeField.style.borderColor = "#16a34a";
                        specialCodeField.readOnly = true;
                        verifyCodeBtn.innerHTML = '<i class="fa-solid fa-lock"></i>';
                        verifyCodeBtn.style.background = "#16a34a";
                        verifyCodeBtn.style.pointerEvents = "none";
                    } else {
                        throw new Error("No se pudo bloquear el código: " + markData.error);
                    }
                } else {
                    window.isCodeVerified = false;
                    codeValidationMsg.textContent = "✗ " + result.error;
                    codeValidationMsg.style.color = "#ef4444";
                    specialCodeField.style.borderColor = "#ef4444";
                    verifyCodeBtn.innerHTML = 'Verificar';
                }
            } catch (e) {
                console.error("[DEBUG] Error fatal en verificación:", e);
                codeValidationMsg.textContent = "Error de conexión.";
            } finally {
                verifyCodeBtn.disabled = window.isCodeVerified;
            }
        });

        specialCodeField.addEventListener('input', () => {
            if (typeof window.updateSummary === 'function') window.updateSummary();
        });
    }

    function updateAuthorStatusLabel() {
        const selectedReg = document.querySelector('input[name="regType"]:checked');
        const statusLabel = document.getElementById('authorStatusLabel');
        const authorInputs = authorSection.querySelectorAll('input, select');

        if (!selectedReg) return;

        // Visual Label Update
        statusLabel.textContent = "(Solo para autores)";
        statusLabel.style.color = "var(--primary-color)";
        statusLabel.style.fontWeight = "bold";

        // Validation Logic:
        authorInputs.forEach(input => {
            input.removeAttribute('required');
        });

        // Update info note for UADY modalitity
        const uadyNote = document.getElementById('uadyModalityNote');
        if (selectedReg.value === 'student_uady') {
            uadyNote.classList.remove('hidden');
        } else {
            uadyNote.classList.add('hidden');
        }

        // Update existing contribution rows modality
        updateContributionRowsModality();
    }

    function toggleBillingForm() {
        const isRequired = document.querySelector('input[name="factura"]:checked').value === 'required';
        const constanciaInput = document.getElementById('constanciaFile');

        if (isRequired) {
            billingForm.classList.remove('hidden');
            // Set fields to required
            billingInputs.forEach(input => input.setAttribute('required', 'true'));
            // Explicitly require constancia file (though billingInputs might cover it if queried dynamically)
            if (constanciaInput) constanciaInput.setAttribute('required', 'true');
        } else {
            billingForm.classList.add('hidden');
            // Remove required constraint
            billingInputs.forEach(input => input.removeAttribute('required'));
            if (constanciaInput) constanciaInput.removeAttribute('required');
        }
    }

    function updateBenefits() {
        const selectedReg = document.querySelector('input[name="regType"]:checked');
        let currentBenefits = [];

        if (selectedReg) {
            switch (selectedReg.value) {
                case 'general':
                case 'code_access':
                    currentBenefits = generalBenefits;
                    break;
                case 'student_external':
                    currentBenefits = studentBenefits;
                    break;
                case 'student_uady':
                    currentBenefits = uadyBenefits;
                    break;
                default:
                    currentBenefits = uadyBenefits;
            }
        }

        // Update List
        benefitsList.innerHTML = currentBenefits.map(text => `<li>${text}</li>`).join('');
    }

    // --- Event Listeners ---

    // Registration Type Changes
    regOptions.forEach(option => {
        option.addEventListener('change', () => {
            calculateTotal();
            toggleStudentDetails();
            updateAuthorStatusLabel();
            updateBenefits();
            updateWorkshopCapacityStates();
        });
    });


    // Add-on Changes (Workshops, Visits, Contests)
    addOnCheckboxes.forEach(cb => {
        cb.addEventListener('change', calculateTotal);
    });

    // Factura Changes
    facturaRadios.forEach(radio => {
        radio.addEventListener('change', toggleBillingForm);
    });

    // Razón Social Validation
    const razonSocialInput = document.getElementById('razonSocial');
    if (razonSocialInput) {
        razonSocialInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const invalidNames = [
                'universidad autonoma de yucatan',
                'universidad autónoma de yucatán',
                'uady',
                'universidad autónoma de yucatan',
                'universidad autonoma de yucatán'
            ];

            const isInvalid = invalidNames.some(invalid => val.includes(invalid));

            if (isInvalid) {
                alert('El ConCEI NO emite facturas a nombre de la Universidad Autónoma de Yucatán.');
                e.target.value = '';
            }
        });
    }

    // Si el total a pagar es $0 (p.ej. estudiante/profesor UADY o código de
    // acceso sin talleres/visitas adicionales), no tiene sentido pedir
    // comprobante de pago: se oculta la caja de transferencia bancaria y se
    // muestra un mensaje indicando que el registro es gratuito.
    function applyFreeRegistrationUI(paymentSection, totalValue) {
        const paymentBox = paymentSection.querySelector('.payment-box');
        const noPaymentMsg = document.getElementById('noPaymentMessage');
        const isFree = totalValue <= 0;
        if (paymentBox) paymentBox.classList.toggle('hidden', isFree);
        if (noPaymentMsg) noPaymentMsg.classList.toggle('hidden', !isFree);
    }

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedRegType = document.querySelector('input[name="regType"]:checked');
        const paymentSection = document.getElementById('paymentRevealSection');
        const isHidden = paymentSection.classList.contains('hidden');
        const submitBtn = document.getElementById('submitBtn');
        const totalValue = parseFloat((totalDisplay?.textContent || '0').replace(/[^0-9.]/g, '')) || 0;

        if (isHidden) {
            // Stage 1: Validation & Reveal
            if (!form.reportValidity()) return;

            // Extra checks (Reg Type)
            if (!selectedRegType) {
                alert("Por favor seleccione un tipo de registro.");
                return;
            }

            if (selectedRegType.value === 'code_access') {
                if (!window.isCodeVerified) {
                    alert("Debe verificar su código de acceso antes de continuar.");
                    const y = specialCodeField.getBoundingClientRect().top + window.pageYOffset - 100;
                    window.scrollTo({top: y, behavior: 'smooth'});
                    return;
                }

                // ES GRATIS (POR CÓDIGO), SALTAMOS LA REVELACIÓN DE PAGO
                paymentSection.classList.remove('hidden');
                paymentSection.classList.add('reveal-active');
                applyFreeRegistrationUI(paymentSection, totalValue);
                submitBtn.innerHTML = totalValue > 0
                    ? '<i class="fa-solid fa-cloud-arrow-up"></i> Confirmar Pago y Finalizar Registro'
                    : '<i class="fa-solid fa-circle-check"></i> Finalizar Registro';
                submitBtn.style.background = "#059669";
                setTimeout(() => {
                    paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
                return;
            } else {
                // --- NUEVO: RESERVAR CUPOS AL HACER CLIC EN EL PRIMER BOTÓN ---
                const accountData = JSON.parse(localStorage.getItem('tempAccount') || '{}');
                const email = accountData.email || 'No proporcionado';
                const purchasedIds = window.purchasedItemIds || [];
                // Solo cuentan como "seleccionados" los items NUEVOS; los ya
                // comprados aparecen marcados/bloqueados pero no deben
                // considerarse de nuevo.
                const selectedWorkshops = Array.from(document.querySelectorAll('input[name="workshop[]"]:checked')).map(cb => cb.value).filter(id => !purchasedIds.includes(id));
                const selectedVisits = Array.from(document.querySelectorAll('input[name="visit[]"]:checked')).map(cb => cb.value).filter(id => !purchasedIds.includes(id));

                // Un usuario que ya completó su registro (regType ya definido)
                // solo puede volver a "Finalizar" si está comprando talleres
                // y/o visitas adicionales NUEVOS. Si no selecciona nada nuevo,
                // no hay nada que procesar.
                if (window.isReturningUser && selectedWorkshops.length === 0 && selectedVisits.length === 0) {
                    alert("Selecciona al menos un taller o una visita para continuar.");
                    return;
                }

                // --- NUEVAS VALIDACIONES OBLIGATORIAS ---
                const selectedReg = document.querySelector('input[name="regType"]:checked');
                const uadyIdFile = document.getElementById('uadyIdFile');
                const facturaRequired = document.querySelector('input[name="factura"][value="required"]').checked;
                const constanciaFile = document.getElementById('constanciaFile');

                // 1. Validar Comprobante de Estudiante
                const regTypeSection = document.getElementById('regTypeSection');
                const isRegTypeHidden = regTypeSection && regTypeSection.style.display === 'none';

                if (!isRegTypeHidden && selectedReg && (selectedReg.value === 'student_external' || selectedReg.value === 'student_uady')) {
                    if (!uadyIdFile || !uadyIdFile.files || uadyIdFile.files.length === 0) {
                        alert("⚠️ Debes subir tu credencial o comprobante de estudiante para continuar.");
                        uadyIdFile.style.border = "2px solid #ef4444";
                        uadyIdFile.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        return;
                    }
                }

                // 2. Validar Constancia Fiscal si requiere factura
                if (facturaRequired) {
                    if (!constanciaFile || !constanciaFile.files || constanciaFile.files.length === 0) {
                        alert("⚠️ Has solicitado factura. Debes subir tu Constancia de Situación Fiscal.");
                        constanciaFile.style.border = "2px solid #ef4444";
                        constanciaFile.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        return;
                    }
                }

                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando disponibilidad...';
                submitBtn.disabled = true;

                try {
                    const reserveRes = await fetch('php/reserve_spots.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, workshops: selectedWorkshops, visits: selectedVisits, regType: selectedRegType ? selectedRegType.value : 'general' })
                    });
                    const reserveData = await reserveRes.json();

                    if (!reserveData.success) {
                        // Animación de error en el botón
                        submitBtn.classList.add('shake-active');
                        
                        // Si es un error de cupo, mostrar mensaje específico, si no, error general
                        const isFullError = !!reserveData.full_id;
                        submitBtn.innerHTML = isFullError ? '<i class="fa-solid fa-triangle-exclamation"></i> Cupo Agotado' : '<i class="fa-solid fa-circle-xmark"></i> Error de Reserva';
                        submitBtn.style.background = "#ef4444";

                        // Si tenemos el ID del taller lleno, lo resaltamos
                        if (reserveData.full_id) {
                            const fullItemEl = document.querySelector(`input[value="${reserveData.full_id}"]`)?.closest('.addon-option-wrapper');
                            if (fullItemEl) {
                                // Deslizamiento suave al taller con problemas
                                const yOffset = -150; 
                                const y = fullItemEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                window.scrollTo({top: y, behavior: 'smooth'});

                                // Aplicar animación de sacudida
                                fullItemEl.classList.add('shake-active');
                                
                                // Añadir mensaje flotante temporal sobre el elemento
                                const warningLabel = document.createElement('div');
                                warningLabel.className = 'temp-warning-label';
                                warningLabel.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ¡SE ACABA DE AGOTAR!';
                                fullItemEl.appendChild(warningLabel);

                                setTimeout(() => {
                                    fullItemEl.classList.remove('shake-active');
                                    warningLabel.remove();
                                }, 5000);
                            }
                        }

                        alert(reserveData.error);
                        
                        setTimeout(() => {
                            submitBtn.classList.remove('shake-active');
                            submitBtn.innerHTML = originalText;
                            submitBtn.style.background = "";
                            submitBtn.disabled = false;
                        }, 3000);

                        // Recargar opciones para mostrar el cupo actualizado
                        renderDynamicOptions();
                        return;
                    }

                    // Reveal Payment Section
                    console.log("REVEALING PAYMENT SECTION...");
                    paymentSection.classList.remove('hidden');
                    paymentSection.classList.add('reveal-active');
                    applyFreeRegistrationUI(paymentSection, totalValue);

                    // Trigger Concept Update
                    if (typeof window.updatePaymentConcept === 'function') {
                        window.updatePaymentConcept();
                    }

                    // Update Button Text for Stage 2
                    submitBtn.innerHTML = totalValue > 0
                        ? '<i class="fa-solid fa-cloud-arrow-up"></i> Confirmar Pago y Finalizar Registro'
                        : '<i class="fa-solid fa-circle-check"></i> Finalizar Registro';
                    submitBtn.style.background = "#059669"; // Success Green
                    submitBtn.disabled = false;

                    // Scroll to Payment
                    setTimeout(() => {
                        paymentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);

                } catch (err) {
                    console.error("Error en reserva:", err);
                    alert("Error al verificar disponibilidad. Intente de nuevo.");
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
                return;
            }
        }

        // Stage 2: Final Submit (after payproof)
        // --- BLOQUEO DE REGISTRO FANTASMA ($0 sin ítems nuevos) ---
        // Si un usuario que regresa reveló el pago con un taller/visita y luego
        // lo deseleccionó, "Finalizar Registro" no debe generar un movimiento
        // vacío. Se exige al menos un ítem NUEVO para continuar.
        if (window.isReturningUser) {
            const purchasedIds = window.purchasedItemIds || [];
            const nuevosWs = Array.from(document.querySelectorAll('input[name="workshop[]"]:checked')).map(cb => cb.value).filter(id => !purchasedIds.includes(id));
            const nuevasVi = Array.from(document.querySelectorAll('input[name="visit[]"]:checked')).map(cb => cb.value).filter(id => !purchasedIds.includes(id));
            if (nuevosWs.length === 0 && nuevasVi.length === 0) {
                // El botón aún no se ha deshabilitado en este punto, solo avisamos.
                alert("No has seleccionado ningún taller o visita nuevo. Selecciona al menos uno para finalizar, o cierra la ventana si no deseas agregar nada.");
                return;
            }
        }

        // --- VALIDACIÓN DE PAGO SI TOTAL > 0 ---
        const paymentProofInput = document.getElementById('paymentProof');

        if (totalValue > 0) {
            if (!paymentProofInput || !paymentProofInput.files || paymentProofInput.files.length === 0) {
                alert("⚠️ Debes subir tu comprobante de pago (transferencia) para finalizar el registro.");
                paymentProofInput.style.border = "2px solid #ef4444";
                paymentProofInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }

        // Usar la variable submitBtn ya declarada arriba
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando verificación...';
        submitBtn.disabled = true;

        // --- RECOLECCIÓN DE DATOS COMPLETA ---
        const formData = new FormData(form);
        console.log("[DEBUG] Iniciando Envío de Registro...");
        console.log("[DEBUG] Tipo Registro:", selectedRegType.value);
        if (selectedRegType.value === 'code_access') {
            console.log("[DEBUG] Código que se enviará:", specialCodeField.value);
        }
        
        // Add hidden fields for total and concept
        formData.append('total_hidden', totalDisplay ? totalDisplay.textContent : "$0.00");
        formData.append('concept_hidden', document.getElementById('paymentConceptDisplay')?.textContent || 'N/A');

        // Get email from localStorage if not in form
        const accountData = JSON.parse(localStorage.getItem('tempAccount') || '{}');
        const email = accountData.email || 'No proporcionado';
        formData.append('email', email);

        console.log("[DEBUG] Datos en FormData:");
        for (var pair of formData.entries()) {
            console.log(pair[0]+ ': ' + pair[1]); 
        }

        fetch('php/register.php', {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log("[DEBUG] Respuesta register.php:", data);
            if (data.success) {
                console.log("SUCCESS: Registro completado en BD.");
                
                // --- NUEVO: MARCAR CÓDIGO COMO USADO SI APLICA ---
                // --- NUEVO: RASTREO RIGUROSO ---
                const finalizeRegistration = async () => {
                    console.log("[DEBUG] Finalizando proceso de registro...");

                    // Valores por defecto seguros: si algo falla al recolectar
                    // los detalles "extra", el registro NO debe perderse ni
                    // dejar de mostrar el comprobante.
                    let purchaseItems = [];
                    let regTypeLabel = '';
                    let regTypePrice = 0;
                    let fullName = email;

                    try {
                        // Ya no necesitamos invalidar aquí porque se hace al verificar,
                        // pero dejamos el log por si acaso.
                        if (selectedRegType && selectedRegType.value === 'code_access') {
                            console.log("[DEBUG] Registro por código detectado. El código ya debería estar bloqueado.");
                        }

                        const selectedRegTypeEl = document.querySelector('input[name="regType"]:checked');
                        const regTypeLabels = {
                            'general': 'Público General / Profesional',
                            'student_external': 'Estudiante Externo',
                            'student_uady': 'Estudiante UADY',
                            'code_access': 'Acceso por Código / Convenio'
                        };
                        regTypeLabel = selectedRegTypeEl ? (regTypeLabels[selectedRegTypeEl.value] || selectedRegTypeEl.value) : '';
                        regTypePrice = selectedRegTypeEl ? parseFloat(selectedRegTypeEl.dataset.price || 0) : 0;

                        // El taller gratis aplica solo en la PRIMERA compra.
                        // Usuarios que regresan a agregar talleres pagan precio completo.
                        const qualifiesForFreeAddon = !window.isReturningUser && !!selectedRegTypeEl && (
                            selectedRegTypeEl.value === 'general' ||
                            selectedRegTypeEl.value === 'student_external' ||
                            (selectedRegTypeEl.value === 'code_access' && window.isCodeVerified)
                        );

                        // Recopilar talleres y visitas seleccionados para la confirmación
                        const addonItems = [];
                        document.querySelectorAll('input[name="workshop[]"]:checked').forEach(cb => {
                            const wrapper = cb.closest('.addon-option-wrapper');
                            const name = wrapper?.querySelector('[class*="name"], .addon-title')?.textContent?.trim()
                                      || wrapper?.innerText?.split('\n')[0]?.trim()
                                      || cb.value;
                            addonItems.push({ tipo: 'Taller', nombre: name, precio: parseFloat(cb.dataset.price || 0) });
                        });
                        document.querySelectorAll('input[name="visit[]"]:checked').forEach(cb => {
                            const wrapper = cb.closest('.addon-option-wrapper');
                            const name = wrapper?.querySelector('[class*="name"], .addon-title')?.textContent?.trim()
                                      || wrapper?.innerText?.split('\n')[0]?.trim()
                                      || cb.value;
                            addonItems.push({ tipo: 'Visita', nombre: name, precio: parseFloat(cb.dataset.price || 0) });
                        });

                        // El ítem gratuito es el de menor precio entre los seleccionados con costo
                        if (qualifiesForFreeAddon) {
                            const paidItems = addonItems.filter(item => item.precio > 0);
                            if (paidItems.length > 0) {
                                const cheapest = paidItems.reduce((min, item) => item.precio < min.precio ? item : min, paidItems[0]);
                                cheapest.nombre += ' (incluido sin costo)';
                                cheapest.precio = 0;
                            }
                        }

                        addonItems.forEach(item => {
                            if (item.precio > 0 || item.nombre.endsWith('(incluido sin costo)')) {
                                purchaseItems.push(item);
                            }
                        });

                        const firstNameVal = document.getElementById('firstName')?.value || '';
                        const lastNameVal = document.getElementById('lastName')?.value || '';
                        const combinedName = (firstNameVal + ' ' + lastNameVal).trim();
                        if (combinedName) fullName = combinedName;
                    } catch (collectErr) {
                        console.error("[DEBUG] Error recolectando detalles de confirmación (no crítico):", collectErr);
                    }

                    // Recopilar contribuciones del formulario para mostrar en confirmacion.html
                    let contributions = [];
                    try {
                        const contribRowsEls = document.querySelectorAll('.contribution-row');
                        contribRowsEls.forEach(row => {
                            const titulo = row.querySelector('input[name^="contribTitle_"]')?.value?.trim();
                            if (titulo) {
                                contributions.push({
                                    titulo,
                                    tipo: row.querySelector('select[name^="contribType_"]')?.value || '',
                                    area: row.querySelector('select[name^="contribArea_"]')?.value || '',
                                    modalidad: row.querySelector('select[name^="contribModality_"]')?.value || ''
                                });
                            }
                        });
                    } catch (contribErr) {
                        console.error("[DEBUG] Error recolectando contribuciones (no crítico):", contribErr);
                    }

                    // El registro YA quedó guardado en la BD (data.success === true).
                    // Esto debe ejecutarse SIEMPRE para que el comprobante aparezca,
                    // sin importar si falló la recolección de detalles opcionales arriba.
                    try {
                        localStorage.setItem('lastRegistration', JSON.stringify({
                            folio: data.folio,
                            fullName: fullName,
                            email: email,
                            total: totalDisplay ? totalDisplay.textContent : "$0.00",
                            date: new Date().toLocaleString(),
                            regTypeLabel,
                            regTypePrice,
                            purchaseItems,
                            contributions,
                            isReturning: !!window.isReturningUser
                        }));
                    } catch (storageErr) {
                        console.error("[DEBUG] Error guardando lastRegistration (no crítico):", storageErr);
                    }

                    // El registro se completó: el borrador ya no aplica
                    try { localStorage.removeItem('registrationDraft'); } catch (e) {}

                    // Cerrar la sesión en TODAS las demás ventanas/pestañas abiertas
                    // para evitar conflictos (dos ventanas con estados distintos).
                    // El evento 'storage' solo se dispara en las OTRAS pestañas.
                    try {
                        localStorage.removeItem('tempAccount');
                        localStorage.setItem('forceLogout', String(Date.now()));
                    } catch (e) {}

                    console.log("[DEBUG] Redireccionando a confirmacion.html en 1 segundo...");
                    setTimeout(() => {
                        window.location.href = 'confirmacion.html';
                    }, 1000);
                };

                finalizeRegistration().catch(finalizeErr => {
                    console.error("[DEBUG] Error inesperado en finalizeRegistration, redirigiendo de todas formas:", finalizeErr);
                    try {
                        localStorage.setItem('lastRegistration', JSON.stringify({
                            folio: data.folio,
                            fullName: email,
                            email: email,
                            total: totalDisplay ? totalDisplay.textContent : "$0.00",
                            date: new Date().toLocaleString(),
                            regTypeLabel: '',
                            regTypePrice: 0,
                            purchaseItems: [],
                            contributions: [],
                            isReturning: !!window.isReturningUser
                        }));
                    } catch (e) {}
                    try {
                        localStorage.removeItem('registrationDraft');
                        localStorage.removeItem('tempAccount');
                        localStorage.setItem('forceLogout', String(Date.now()));
                    } catch (e) {}
                    window.location.href = 'confirmacion.html';
                });
            } else {
                throw new Error(data.error || 'Error desconocido');
            }
        })
        .catch(error => {
            console.error("FAILED: No se pudo registrar.", error);
            alert("Error al procesar el registro: " + error.message);
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        });
    });

    // --- Dynamic Contributions Logic ---

    const contribContainer = document.getElementById('contributionsContainer');
    const addContribBtn = document.getElementById('addContributionBtn');
    let contribCount = 0;
    const MAX_CONTRIBS = 2;

    function createContributionRow(index) {
        const row = document.createElement('div');
        row.className = 'contribution-row';
        row.dataset.index = index;

        const selectedReg = document.querySelector('input[name="regType"]:checked');
        const isUady = selectedReg && selectedReg.value === 'student_uady';

        row.innerHTML = `
            <div class="form-group small">
                <label>Tipo</label>
                <select name="contribType_${index}">
                    <option value="ponencia">Ponencia</option>
                    <option value="poster">Poster</option>
                </select>
            </div>
            <div class="form-group small">
                <label>Área</label>
                <select name="contribArea_${index}">
                    <option value="energias">Energías renovables</option>
                    <option value="ambiental">Ingeniería ambiental</option>
                    <option value="ia">Inteligencia artificial</option>
                    <option value="salud">Alimentación y salud</option>
                    <option value="estructuras">Ingeniería de las estructuras y la construcción</option>
                    <option value="imagenes">Procesamiento de imágenes</option>
                    <option value="robotica">Robótica y visión computacional</option>
                    <option value="moleculas">Moléculas y materiales funcionales</option>
                    <option value="fisica">Ingeniería física</option>
                    <option value="cuantico">Cómputo científico/cuántico</option>
                    <option value="ciencias_info">Ciencia y tecnología de la información</option>
                    <option value="biotecnologia">Biotecnología y Bioprocesos</option>
                    <option value="procesos">Ingeniería de procesos e innovación industrial</option>
                    <option value="matematicas">Matemáticas básicas y aplicadas</option>
                    <option value="software">Ingeniería de software</option>
                    <option value="tecnologias_emer">Tecnologías emergentes en computación</option>
                    <option value="educacion">Educación, sociedad y formación humanista en ciencias</option>
                </select>
            </div>
            <div class="form-group small">
                <label>Modalidad</label>
                <div class="modality-container">
                    ${isUady ?
                `<div class="readonly-input">Presencial</div><input type="hidden" name="contribModality_${index}" value="presencial">` :
                `<select name="contribModality_${index}" class="modality-select">
                            <option value="presencial">Presencial</option>
                            <option value="virtual">Virtual</option>
                            <option value="cualquiera">Cualquiera</option>
                        </select>`
            }
                </div>
            </div>
            <div class="form-group large">
                <label>Título</label>
                <input type="text" name="contribTitle_${index}" placeholder="Título de su proyecto" required>
            </div>
            <button type="button" class="remove-btn" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        `;

        if (isUady) {
            const modSelect = row.querySelector('.modality-select');
            if (modSelect) modSelect.value = "presencial";
        }

        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.remove();
            reindexContributions();
            updateAuthorStatusLabel();
        });

        // Bloquear modalidad a Presencial cuando tipo = Poster
        const tipoSelect = row.querySelector('select[name^="contribType_"]');
        const applyPosterLock = () => {
            const container = row.querySelector('.modality-container');
            const idx = row.dataset.index;
            if (tipoSelect.value === 'poster') {
                container.innerHTML = `<div class="readonly-input">Presencial</div><input type="hidden" name="contribModality_${idx}" value="presencial">`;
            } else if (!isUady && !container.querySelector('select')) {
                container.innerHTML = `<select name="contribModality_${idx}" class="modality-select">
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                    <option value="cualquiera">Cualquiera</option>
                </select>`;
            }
        };
        if (tipoSelect) tipoSelect.addEventListener('change', applyPosterLock);

        return row;
    }

    function reindexContributions() {
        const rows = contribContainer.querySelectorAll('.contribution-row');
        contribCount = rows.length;

        rows.forEach((row, idx) => {
            const index = idx + 1; // 1-based index
            row.dataset.index = index;

            // Update names of inputs/selects inside the row
            const selectType = row.querySelector('select[name^="contribType_"]');
            if (selectType) selectType.name = `contribType_${index}`;

            const selectArea = row.querySelector('select[name^="contribArea_"]');
            if (selectArea) selectArea.name = `contribArea_${index}`;

            const selectMod = row.querySelector('[name^="contribModality_"]');
            if (selectMod) selectMod.name = `contribModality_${index}`;

            const inputTitle = row.querySelector('input[name^="contribTitle_"]');
            if (inputTitle) inputTitle.name = `contribTitle_${index}`;
        });

        updateAddButton();
    }

    function updateContributionRowsModality() {
        const selectedReg = document.querySelector('input[name="regType"]:checked');
        const isUady = selectedReg && selectedReg.value === 'student_uady';
        const rows = contribContainer.querySelectorAll('.contribution-row');

        rows.forEach(row => {
            const container = row.querySelector('.modality-container');
            const index = row.dataset.index;

            // Check current type to preserve if not UADY
            const currentSelect = container.querySelector('select');
            const currentVal = currentSelect ? currentSelect.value : 'presencial';

            if (isUady) {
                container.innerHTML = `<div class="readonly-input">Presencial</div><input type="hidden" name="contribModality_${index}" value="presencial">`;
            } else {
                // Only re-render if it's currently a readonly-input or we need the select back
                if (!currentSelect) {
                    container.innerHTML = `
                        <select name="contribModality_${index}" class="modality-select">
                            <option value="presencial" ${currentVal === 'presencial' ? 'selected' : ''}>Presencial</option>
                            <option value="virtual" ${currentVal === 'virtual' ? 'selected' : ''}>Virtual</option>
                            <option value="cualquiera" ${currentVal === 'cualquiera' ? 'selected' : ''}>Cualquiera</option>
                        </select>`;
                }
            }
        });
    }

    function addContribution() {
        if (contribCount >= MAX_CONTRIBS) return;

        // Add new row as contribCount + 1, then reindex to ensure correct numbering
        const newRow = createContributionRow(contribCount + 1);
        contribContainer.appendChild(newRow);

        reindexContributions();
        updateAuthorStatusLabel();
    }

    function updateAddButton() {
        if (contribCount >= MAX_CONTRIBS) {
            addContribBtn.style.display = 'none';
        } else {
            addContribBtn.style.display = 'flex';
        }
    }

    addContribBtn.addEventListener('click', addContribution);

    // --- Auto-Save (Draft) Logic ---
    // Email del usuario en sesión: el borrador se asocia a este correo para que
    // en equipos compartidos un usuario no herede el borrador de otro.
    function getDraftOwner() {
        try { return (JSON.parse(localStorage.getItem('tempAccount') || '{}').email || '').toLowerCase(); }
        catch (e) { return ''; }
    }

    function saveFormDraft() {
        const formData = new FormData(form);
        const draft = { _draftOwner: getDraftOwner() };

        formData.forEach((value, key) => {
            // No guardamos archivos ni contraseñas por seguridad/espacio
            if (value instanceof File || key === 'paymentProof' || key === 'uadyIdFile' || key === 'constanciaFile') return;

            // Manejo de valores múltiples (checkboxes)
            if (draft[key]) {
                if (Array.isArray(draft[key])) {
                    draft[key].push(value);
                } else {
                    draft[key] = [draft[key], value];
                }
            } else {
                draft[key] = value;
            }
        });

        localStorage.setItem('registrationDraft', JSON.stringify(draft));
    }

    function restoreFormDraft() {
        const draftStr = localStorage.getItem('registrationDraft');
        if (!draftStr) return;

        try {
            const draft = JSON.parse(draftStr);

            // El borrador pertenece a otro usuario (equipo compartido): descartarlo.
            const owner = draft._draftOwner || '';
            if (owner !== getDraftOwner()) {
                localStorage.removeItem('registrationDraft');
                return;
            }

            // Campos que un usuario recurrente recibe precargados desde el servidor;
            // el borrador NO debe pisarlos con datos viejos.
            const camposPrecargados = ['firstName', 'lastName', 'organization', 'city', 'state', 'country', 'regType'];

            Object.keys(draft).forEach(key => {
                if (key === '_draftOwner') return;
                if (window.isReturningUser && camposPrecargados.includes(key)) return;
                const elements = form.querySelectorAll(`[name="${key}"]`);
                const val = draft[key];

                elements.forEach(el => {
                    if (el.type === 'checkbox' || el.type === 'radio') {
                        // No re-marcar opciones deshabilitadas (talleres agotados/bloqueados)
                        if (el.disabled) return;
                        if (Array.isArray(val)) {
                            el.checked = val.includes(el.value);
                        } else {
                            el.checked = (el.value === val);
                        }
                    } else {
                        el.value = val;
                    }
                });
            });

            // Disparar eventos de cambio para actualizar UI (precios, visibilidad)
            calculateTotal();
            toggleStudentDetails();
            updateAuthorStatusLabel();
            updateBenefits();
            toggleBillingForm();
            if (typeof window.updateSummary === 'function') window.updateSummary();

        } catch (e) {
            console.error("Error al restaurar el borrador:", e);
        }
    }

    // Guardar cada vez que el usuario escriba o cambie algo
    form.addEventListener('input', saveFormDraft);
    form.addEventListener('change', saveFormDraft);

    // Initializations
    renderDynamicOptions(); // restoreFormDraft() se llama al final de renderDynamicOptions
    calculateTotal();
    toggleBillingForm();
    updateBenefits();
    updateAuthorStatusLabel();

    // --- Real-time Sync (Storage Event) ---
    window.addEventListener('storage', (e) => {
        if (e.key === 'adminData') {
            console.log("--- ADMIN DATA UPDATED, RELOADING OPTIONS ---");
            renderDynamicOptions();
            calculateTotal();
        }
        // Otra ventana completó el registro: cerrar sesión aquí para evitar
        // conflictos (dos ventanas con estados de compra distintos).
        if (e.key === 'forceLogout') {
            try { localStorage.removeItem('tempAccount'); } catch (err) {}
            alert('Tu registro se completó en otra ventana. Esta sesión se cerrará para evitar conflictos.');
            window.location.href = 'index.html';
        }
    });

});


/* --- Refactored Summary: Only Paid Items --- */
window.updateSummary = async function () {
    const summaryContainer = document.getElementById("registrationSummary");
    const totalDisplay = document.getElementById('totalAmount');
    if (!summaryContainer) return;

    // Solo mantenemos la lista de Detalles de Pago
    let paidHtml = `<h4 class="summary-title" style="border-bottom: 1px solid #bfdbfe; padding-bottom: 10px; margin-bottom: 15px;">Resumen de Pago</h4><h5 class="summary-subtitle" style="color: #1e40af; margin-bottom: 8px; font-weight: 600;"><i class="fa-solid fa-receipt"></i> Detalles de Pago</h5><ul class="summary-list">`;

    let total = 0;
    let hasPaid = false;

    // Helper to add item
    const addItem = (label, price, isDiscount = false) => {
        if (price > 0) {
            paidHtml += `<li class="summary-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding-left: 10px;"><span>${label}</span> <span class="summary-price">$${price.toFixed(2)}</span></li>`;
            total += price;
            hasPaid = true;
        }
        // Los items de $0 (historial o bonificados) ya no se muestran en el resumen final
    };

    // 1. Registration Type
    const selectedType = document.querySelector('input[name="regType"]:checked');
    let qualifiesForFreeAddon = false;

    if (selectedType) {
        const val = selectedType.value;
        let basePrice = parseFloat(selectedType.dataset.price || 0);
        let label = "Registro";

        if (val === "general") {
            label = "General";
            qualifiesForFreeAddon = !window.isReturningUser;
        } else if (val === "student_external") {
            label = "Estudiante General";
            qualifiesForFreeAddon = !window.isReturningUser;
        } else if (val === "student_uady") {
            label = "Estudiante/Profesor UADY";
        } else if (val === "code_access") {
            const isValid = window.isCodeVerified;
            label = isValid ? "Registro por Código (Beca/VIP)" : "Código Sin Verificar";
            qualifiesForFreeAddon = isValid && !window.isReturningUser;
        }

        addItem(label, basePrice);
    }

    // 2. Add-ons (Workshops, Visits, Contests)
    const addOns = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'));

    // El ítem gratuito es el de menor precio entre los talleres/visitas
    // con costo seleccionados (si aplica la bonificación). Los demás se cobran.
    let freeAddonCb = null;
    if (qualifiesForFreeAddon) {
        const eligible = addOns.filter(cb => (cb.name.includes('workshop') || cb.name.includes('visit')) && parseFloat(cb.dataset.price || 0) > 0);
        if (eligible.length > 0) {
            freeAddonCb = eligible.reduce((min, cb) => parseFloat(cb.dataset.price) < parseFloat(min.dataset.price) ? cb : min, eligible[0]);
        }
    }

    addOns.forEach(cb => {
        let price = parseFloat(cb.dataset.price || 0);
        const nameEl = cb.parentNode.querySelector('.addon-title-premium') || cb.parentNode.querySelector('.addon-title') || cb.parentNode.querySelector('.ws-name');
        let name = nameEl ? nameEl.textContent.trim() : "Adicional";
        let isDiscount = false;

        // Lógica de bonificación (1 taller/visita gratis si aplica): el más barato
        if (cb === freeAddonCb) {
            price = 0;
        }

        addItem(name, price, isDiscount);
    });

    // 3. Journal
    const journal = document.querySelector('input[name="journalPref"]:checked');
    if (journal && journal.value !== "none") {
        const titleEl = journal.parentNode.querySelector('.option-title');
        const journalName = titleEl ? titleEl.childNodes[0].textContent.trim() : "Revista";
        addItem(`Revista: ${journalName}`, 0);
    }

    // Finalizar HTML
    paidHtml += `</ul>`;

    let finalHtml = `<h4 class="summary-title" style="border-bottom: 1px solid #bfdbfe; padding-bottom: 10px; margin-bottom: 15px;">Resumen de Pago</h4>`;

    if (hasPaid) {
        finalHtml += paidHtml;
        // Fila de Total
        finalHtml += `<div class="summary-total-row" style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #bfdbfe; display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; color: #1e3a8a;"><span>Total a Pagar</span> <span>$${total.toFixed(2)}</span></div>`;
        
        summaryContainer.innerHTML = finalHtml;
        summaryContainer.classList.remove("hidden");
    } else {
        summaryContainer.innerHTML = "";
        summaryContainer.classList.add("hidden");
    }

    // Update main total display
    if (totalDisplay) {
        const newText = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(total);
        if (totalDisplay.textContent !== newText) {
            totalDisplay.textContent = newText;
            totalDisplay.style.transform = "scale(1.1)";
            setTimeout(() => totalDisplay.style.transform = "scale(1)", 200);
        }
    }

    // Dynamic Payment Concept Update
    updatePaymentConcept();
};

window.updatePaymentConcept = function () {
    const selectedType = document.querySelector('input[name="regType"]:checked');
    const conceptDisplay = document.getElementById('paymentConceptDisplay');
    const workshopsSelected = document.querySelectorAll('input[name="workshop[]"]:checked');
    const visitsSelected = document.querySelectorAll('input[name="visit[]"]:checked');

    if (!conceptDisplay) return;

    const idStr = (window.paymentConceptId || 1000).toString().padStart(4, '0');

    // --- Si es usuario recurrente: concepto SOLO con ID + nuevos talleres/visitas ---
    if (window.isReturningUser) {
        let newCodes = [];
        const purchasedIds = window.purchasedItemIds || [];

        // Solo incluir talleres NUEVOS (no los de compras anteriores, que vienen disabled)
        workshopsSelected.forEach(cb => {
            if (!cb.disabled && !purchasedIds.includes(cb.value)) {
                let wsNum = cb.value.replace(/\D/g, '');
                if (wsNum) newCodes.push('T' + wsNum.padStart(2, '0'));
            }
        });

        visitsSelected.forEach(cb => {
            if (!cb.disabled && !purchasedIds.includes(cb.value)) {
                let vNum = cb.value.replace(/\D/g, '');
                if (vNum) newCodes.push('V' + vNum.padStart(2, '0'));
            }
        });

        let concept = idStr + (newCodes.length > 0 ? newCodes.join('') : '');
        console.log("RETURNING USER CONCEPT:", concept);
        conceptDisplay.textContent = concept;
        return;
    }

    // --- Primer registro: concepto con ID + Tipo de registro + Talleres/Visitas ---
    const typeMap = {
        'general': 'G', 'student_external': 'E', 'student_uady': 'U', 'code_access': 'G'
    };

    const typeCode = selectedType ? (typeMap[selectedType.value] || 'G') : 'G';

    let codes = [];
    workshopsSelected.forEach(cb => {
        let wsNum = cb.value.replace(/\D/g, '');
        if(wsNum) codes.push('T' + wsNum.padStart(2, '0'));
    });

    visitsSelected.forEach(cb => {
        let vNum = cb.value.replace(/\D/g, '');
        if(vNum) codes.push('V' + vNum.padStart(2, '0'));
    });

    let concept = idStr + typeCode + codes.join('');
    console.log("NEW REGISTRATION CONCEPT:", concept);
    conceptDisplay.textContent = concept;
};

// Listeners for Concept Generation
document.getElementById('firstName')?.addEventListener('input', window.updatePaymentConcept);
document.getElementById('lastName')?.addEventListener('input', window.updatePaymentConcept);

// Listener for UADY RFC warning
document.getElementById('rfc')?.addEventListener('input', function (e) {
    const val = e.target.value.trim().toUpperCase();
    const warningEl = document.getElementById('rfcUadyWarning');
    if (warningEl) {
        if (val === 'UAY8409012S1') {
            warningEl.classList.remove('hidden');
        } else {
            warningEl.classList.add('hidden');
        }
    }
});

// Hook into change events
document.addEventListener("change", function (e) {
    if (e.target.matches("input[type=checkbox], input[type=radio]")) {
        // Límite por compra: máximo 3 talleres y 3 visitas NUEVOS (los ya
        // comprados no cuentan). Si excede, se desmarca y se avisa.
        if (e.target.checked && (e.target.name === 'workshop[]' || e.target.name === 'visit[]')) {
            const purchased = window.purchasedItemIds || [];
            const nuevos = Array.from(document.querySelectorAll(`input[name="${e.target.name}"]:checked`))
                .filter(cb => !cb.disabled && !purchased.includes(cb.value));
            if (nuevos.length > 3) {
                e.target.checked = false;
                const tipo = e.target.name === 'workshop[]' ? 'talleres' : 'visitas';
                alert(`Máximo 3 ${tipo} por compra. Finaliza esta compra y sube tu comprobante; después podrás adquirir más en una nueva compra.`);
            }
        }
        if (typeof window.updateSummary === 'function') {
            window.updateSummary();
        }
    }
});

// Initial call
if (typeof window.updateSummary === 'function') {
    window.updateSummary();
}

