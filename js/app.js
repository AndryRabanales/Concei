document.addEventListener('DOMContentLoaded', () => {
    console.log("--- APP.JS V3 LOADED ---");

    // Elements
    const form = document.getElementById('registrationForm');
    const totalDisplay = document.getElementById('totalAmount');
    const regOptions = document.querySelectorAll('input[name="regType"]');

    // Unique ID for Payment Concept (Persistent for session)
    if (!window.paymentConceptId) {
        window.paymentConceptId = Math.floor(1000 + Math.random() * 8999);
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
            const u = data.userInfo;
            
            // Llenar campos ocultos para que el registro siga siendo válido
            if(document.getElementById('firstName')) document.getElementById('firstName').value = u.nombre || '';
            if(document.getElementById('lastName')) document.getElementById('lastName').value = u.apellido || '';
            if(document.getElementById('organization')) document.getElementById('organization').value = u.institucion || '';
            if(document.getElementById('city')) document.getElementById('city').value = u.ciudad || '';
            if(document.getElementById('state')) document.getElementById('state').value = u.estado || '';
            if(document.getElementById('country')) document.getElementById('country').value = u.pais || '';
            
            // Seleccionar el tipo de registro original y PONER SU PRECIO EN 0
            const regRadio = document.querySelector(`input[name="regType"][value="${u.regType}"]`);
            if (regRadio) {
                regRadio.checked = true;
                regRadio.setAttribute('data-price', '0'); // Ya lo pagó
                // Forzar actualización de UI para el tipo de registro
                if (typeof toggleStudentDetails === 'function') toggleStudentDetails();
                if (typeof window.updateSummary === 'function') window.updateSummary();
            }

            // Ocultar secciones no necesarias
            const sectionsToHide = ['personalInfoSection', 'regTypeSection', 'authorSection', 'policySection'];
            sectionsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.display = 'none';
                }
            });

            // Mostrar un mensaje de bienvenida personalizado
            const welcomeMsg = document.createElement('div');
            welcomeMsg.className = 'card';
            welcomeMsg.style.background = 'linear-gradient(135deg, #0369a1 0%, #075985 100%)';
            welcomeMsg.style.color = 'white';
            welcomeMsg.style.padding = '20px';
            welcomeMsg.style.marginBottom = '25px';
            welcomeMsg.style.borderRadius = '12px';
            welcomeMsg.innerHTML = `
                <h2 style="margin:0; font-size: 1.25rem;"><i class="fa-solid fa-hand-wave"></i> ¡Hola de nuevo, ${u.nombre}!</h2>
                <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 0.95rem;">
                    Ya tienes un registro base. En esta pantalla puedes **agregar nuevos talleres o visitas** a tu participación actual.
                </p>
            `;
            const form = document.getElementById('registrationForm');
            if (form) form.insertBefore(welcomeMsg, form.firstChild);
        }

        // Helper to create HTML
        const createOptionHtml = (item, type) => {
            const isPurchased = data.purchased && data.purchased.includes(item.id.toString());
            const shortHours = item.hours ? item.hours.split(' ')[0] : 'Pdt';
            const current = parseInt(item.cupo_actual) || 0;
            const max = parseInt(item.capacity) || 0;
            const isFull = current >= max;

            return `
                <div class="addon-option-wrapper ${isFull ? 'option-full' : ''} ${isPurchased ? 'option-purchased' : ''}">
                    <label class="addon-option ${isFull ? 'disabled' : ''} ${isPurchased ? 'locked-purchased' : ''}">
                        <input type="checkbox" name="${type}[]" value="${item.id}" 
                               data-price="${isPurchased ? '0' : item.price}" 
                               ${isFull && !isPurchased ? 'disabled' : ''} 
                               ${isPurchased ? 'checked disabled' : ''}>
                        ${isPurchased ? `<input type="hidden" name="${type}[]" value="${item.id}">` : ''}
                        <div class="addon-content">
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

        workshopsContainer.innerHTML = data.workshop.map(item => createOptionHtml(item, 'workshop')).join('');
        visitsContainer.innerHTML = data.visit.map(item => createOptionHtml(item, 'visit')).join('');

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

            metaContainer.innerHTML = `
                <div class="meta-item"><span>Horario</span><span>${item.horario || item.hours || 'Pendiente'}</span></div>
                <div class="meta-item"><span>Modalidad</span><span>${item.modalidad || item.modality || 'Presencial'}</span></div>
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
            const cb = document.querySelectorAll(`input[value="${id}"]`);
            cb.forEach(input => {
                const wrapper = input.closest('.addon-option-wrapper');
                const label = input.closest('.addon-option');
                const isFull = parseInt(current) >= parseInt(max);
                
                // Actualizar contador visual (0/30)
                const counterEl = wrapper?.querySelector('.fa-user-group')?.parentElement;
                if (counterEl) {
                    const safeCurrent = current !== undefined ? current : '?';
                    const safeMax = max !== undefined ? max : '?';
                    counterEl.innerHTML = `<i class="fa-solid fa-user-group"></i> ${safeCurrent}/${safeMax}`;
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
                    // 2. Si intenta marcar, validar capacidad primero
                    if (isChecking) {
                        const resp = await fetch(`php/api.php?action=check_capacity&id=${id}&type=${type}`);
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
                        const selectedWorkshops = Array.from(document.querySelectorAll('input[name="workshop[]"]:checked')).map(c => c.value);
                        const selectedVisits = Array.from(document.querySelectorAll('input[name="visit[]"]:checked')).map(c => c.value);
                        
                        const resp = await fetch('php/reserve_spots.php', {
                            method: 'POST',
                            body: JSON.stringify({ email, workshops: selectedWorkshops, visits: selectedVisits })
                        });
                        const res = await resp.json();

                        if (!res.success) {
                            cb.checked = !isChecking; // Revertir al estado anterior
                            updateUXStatus(id, res.current || 0, res.max || 0, res.name || "");
                            alert(res.error || "No se pudo actualizar la reserva.");
                        } else {
                            // Éxito: Sincronizar UI
                            const capResp = await fetch(`php/api.php?action=check_capacity&id=${id}&type=${type}`);
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
                            const isFull = current >= max;

                            // Actualizar contador
                            const counterEl = wrapper.querySelector('.fa-user-group')?.parentElement;
                            if (counterEl) {
                                counterEl.innerHTML = `<i class="fa-solid fa-user-group"></i> ${current}/${max}`;
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

    // --- Visibility Logic ---


    function toggleStudentDetails() {
        const selectedReg = document.querySelector('input[name="regType"]:checked');
        const studentDetails = document.getElementById('studentDetails');
        const fileInput = document.getElementById('uadyIdFile');
        const codeDetails = document.getElementById('codeDetails');
        const specialCode = document.getElementById('specialCode');

        if (selectedReg && (selectedReg.value === 'student_uady' || selectedReg.value === 'student_external')) {
            studentDetails.classList.remove('hidden');
            fileInput.setAttribute('required', 'true');
        } else {
            studentDetails.classList.add('hidden');
            fileInput.removeAttribute('required');
        }

        if (selectedReg && selectedReg.value === 'code_access') {
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

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedRegType = document.querySelector('input[name="regType"]:checked');
        const paymentSection = document.getElementById('paymentRevealSection');
        const isHidden = paymentSection.classList.contains('hidden');
        const submitBtn = document.getElementById('submitBtn');

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
            } else {
                // --- NUEVO: RESERVAR CUPOS AL HACER CLIC EN EL PRIMER BOTÓN ---
                const accountData = JSON.parse(localStorage.getItem('tempAccount') || '{}');
                const email = accountData.email || 'No proporcionado';
                const selectedWorkshops = Array.from(document.querySelectorAll('input[name="workshop[]"]:checked')).map(cb => cb.value);
                const selectedVisits = Array.from(document.querySelectorAll('input[name="visit[]"]:checked')).map(cb => cb.value);

                // --- NUEVAS VALIDACIONES OBLIGATORIAS ---
                const selectedReg = document.querySelector('input[name="regType"]:checked');
                const uadyIdFile = document.getElementById('uadyIdFile');
                const facturaRequired = document.querySelector('input[name="factura"][value="required"]').checked;
                const constanciaFile = document.getElementById('constanciaFile');

                // 1. Validar Comprobante de Estudiante
                if (selectedReg && (selectedReg.value === 'student_external' || selectedReg.value === 'student_uady')) {
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
                        body: JSON.stringify({ email, workshops: selectedWorkshops, visits: selectedVisits })
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

                    // Trigger Concept Update
                    if (typeof window.updatePaymentConcept === 'function') {
                        window.updatePaymentConcept();
                    }

                    // Update Button Text for Stage 2
                    submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Confirmar Pago y Finalizar Registro';
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
        // --- VALIDACIÓN DE PAGO SI TOTAL > 0 ---
        const totalText = document.getElementById('totalAmount')?.textContent || "$0";
        const totalValue = parseFloat(totalText.replace(/[^0-9.]/g, '')) || 0;
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
                    
                    // Ya no necesitamos invalidar aquí porque se hace al verificar, 
                    // pero dejamos el log por si acaso.
                    if (selectedRegType && selectedRegType.value === 'code_access') {
                        console.log("[DEBUG] Registro por código detectado. El código ya debería estar bloqueado.");
                    }

                    localStorage.setItem('lastRegistration', JSON.stringify({
                        folio: data.folio,
                        fullName: (document.getElementById('firstName').value || '') + ' ' + (document.getElementById('lastName').value || ''),
                        email: email,
                        total: totalDisplay ? totalDisplay.textContent : "$0.00",
                        date: new Date().toLocaleString()
                    }));
                    
                    console.log("[DEBUG] Redireccionando a confirmacion.html en 1 segundo...");
                    setTimeout(() => {
                        window.location.href = 'confirmacion.html';
                    }, 1000);
                };

                finalizeRegistration();
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
    const MAX_CONTRIBS = 3;

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
                <input type="text" name="contribTitle_${index}" placeholder="Título de su proyecto">
            </div>
            <button type="button" class="remove-btn" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        `;

        if (isUady) {
            const modSelect = row.querySelector('.modality-select');
            if (modSelect) modSelect.value = "presencial";
        }

        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.remove();
            contribCount--;
            updateAddButton();
        });

        return row;
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

        contribCount++;
        const newRow = createContributionRow(contribCount);
        contribContainer.appendChild(newRow);

        updateAddButton();

        // Ensure new inputs align with current validation rules (strip required if needed)
        updateAuthorStatusLabel();
    }

    // Expose remove function to window so onclick works
    window.removeContribution = function (index) {
        const row = document.getElementById(`contrib_row_${index}`);
        if (row) row.remove();
        contribCount--;
        updateAddButton();
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
    function saveFormDraft() {
        const formData = new FormData(form);
        const draft = {};

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
            Object.keys(draft).forEach(key => {
                const elements = form.querySelectorAll(`[name="${key}"]`);
                const val = draft[key];

                elements.forEach(el => {
                    if (el.type === 'checkbox' || el.type === 'radio') {
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
    renderDynamicOptions();
    restoreFormDraft();
    addContribution(); // Add the first one by default if not restored
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
            qualifiesForFreeAddon = true;
        } else if (val === "student_external") {
            label = "Estudiante General";
            qualifiesForFreeAddon = true;
        } else if (val === "student_uady") {
            label = "Estudiante/Profesor UADY";
        } else if (val === "code_access") {
            const isValid = window.isCodeVerified;
            label = isValid ? "Registro por Código (Beca/VIP)" : "Código Sin Verificar";
            qualifiesForFreeAddon = isValid;
        }

        addItem(label, basePrice);
    }

    // 2. Add-ons (Workshops, Visits, Contests)
    const addOns = document.querySelectorAll('input[type="checkbox"]:checked');
    let freeAddonApplied = false;

    addOns.forEach(cb => {
        let price = parseFloat(cb.dataset.price || 0);
        const nameEl = cb.parentNode.querySelector('.addon-title-premium') || cb.parentNode.querySelector('.addon-title') || cb.parentNode.querySelector('.ws-name');
        let name = nameEl ? nameEl.textContent.trim() : "Adicional";
        let isDiscount = false;

        // Lógica de bonificación (1 taller/visita gratis si aplica)
        if (qualifiesForFreeAddon && !freeAddonApplied && (cb.name.includes('workshop') || cb.name.includes('visit'))) {
            price = 0;
            freeAddonApplied = true;
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

    // 1. One letter for registration type
    const typeMap = {
        'general': 'G', 'student_external': 'E', 'student_uady': 'U', 'code_access': 'G'
    };

    const typeCode = selectedType ? (typeMap[selectedType.value] || 'G') : 'G';

    // 2. Workshop and Visit Codes
    let codes = [];
    workshopsSelected.forEach(cb => {
        // Extract number from id like 'ws1'
        let wsNum = cb.value.replace(/\D/g, ''); 
        if(wsNum) codes.push('T' + wsNum.padStart(2, '0'));
    });

    visitsSelected.forEach(cb => {
        let vNum = cb.value.replace(/\D/g, '');
        if(vNum) codes.push('V' + vNum.padStart(2, '0'));
    });

    // 3. Final Format: [ID][TYPE][TXX][VXX]
    const idStr = (window.paymentConceptId || 1000).toString().padStart(4, '0');
    let concept = idStr + typeCode + codes.join('');

    console.log("NEW CONCEPT GENERATED:", concept);
    conceptDisplay.textContent = concept;
};

// Autofill for testing
document.getElementById('autofillTestBtn')?.addEventListener('click', () => {
    const names = ["PEDRO", "MARIA", "LUIS", "ANA", "CARLOS", "ELENA", "SOFIA", "DIEGO"];
    const surnames = ["GARCIA", "LOPEZ", "MARTINEZ", "RODRIGUEZ", "SANCHEZ", "PEREZ", "DIAZ", "RUIZ"];
    const types = ["general", "student_external", "student_uady"];

    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomSurname = surnames[Math.floor(Math.random() * surnames.length)];
    const randomType = types[Math.floor(Math.random() * types.length)];

    document.getElementById('firstName').value = randomName;
    document.getElementById('lastName').value = randomSurname;
    document.getElementById('organization').value = "INSTITUTO " + randomSurname;
    document.getElementById('city').value = "MERIDA";
    document.getElementById('country').value = "MEXICO";

    const regOption = document.querySelector(`input[name="regType"][value="${randomType}"]`);
    if (regOption) regOption.checked = true;

    // Randomly select 1 or 2 workshops
    const allWS = document.querySelectorAll('input[name="workshop"]');
    allWS.forEach(cb => cb.checked = false);
    if (allWS.length > 0) {
        allWS[0].checked = true;
        if (allWS.length > 1 && Math.random() > 0.5) allWS[1].checked = true;
    }

    // Trigger updates
    if (typeof window.updateSummary === 'function') window.updateSummary();
    if (typeof window.updatePaymentConcept === 'function') window.updatePaymentConcept();

    console.log(`AUTOFILL COMPLETE: ${randomName} ${randomSurname} (${randomType})`);
});

// Listeners for Concept Generation
document.getElementById('firstName')?.addEventListener('input', window.updatePaymentConcept);
document.getElementById('lastName')?.addEventListener('input', window.updatePaymentConcept);

// Hook into change events
document.addEventListener("change", function (e) {
    if (e.target.matches("input[type=checkbox], input[type=radio]")) {
        if (typeof window.updateSummary === 'function') {
            window.updateSummary();
        }
    }
});

// Initial call
if (typeof window.updateSummary === 'function') {
    window.updateSummary();
}

