let currentUser = null;
let currentView = 'dashboard';


// --- INITIALIZATION ---
function initApp() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', login);
    }
    
    // Bind Sidebar Menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            if (tab) switchView(tab);
        });
    });
    
    // Bind Logout
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    checkSyncStatus();
    
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
        currentUser = JSON.parse(saved);
        document.getElementById('login-overlay').style.display = 'none';
        updateUIForUser();
        switchView('dashboard');
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
    
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const url = document.getElementById('settings-sheet-url').value;
            const token = document.getElementById('settings-telegram-token').value;
            const chat = document.getElementById('settings-telegram-chatid').value;
            
            AppDB.saveSettings({
                googleSheetUrl: url,
                telegramBotToken: token,
                telegramChatId: chat
            });
            
            showToast('บันทึกการตั้งค่าสำเร็จ', 'success');
            checkSyncStatus();
        });
    }

    const btnSync = document.getElementById('btn-sync-sheets');
    if (btnSync) {
        btnSync.addEventListener('click', async function() {
            try {
                btnSync.disabled = true;
                btnSync.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังซิงก์ข้อมูล...';
                
                await AppDB.syncGoogleSheets((msg) => {
                    showToast(msg, 'info');
                });
                
                showToast('ซิงก์ข้อมูลสำเร็จ!', 'success');
                setTimeout(() => location.reload(), 1500); // Reload to show new data
            } catch (err) {
                showToast(err.message, 'error');
                alert('เกิดข้อผิดพลาด: ' + err.message);
            } finally {
                btnSync.disabled = false;
                btnSync.innerHTML = '<i class="fas fa-sync"></i> ทำการซิงก์กับ Google Sheets ตอนนี้';
            }
        });
    }

    populateLoginUsers();
}

function populateLoginUsers() {
    const users = AppDB.getUsers().filter(u => u.status === 'active');
    const select = document.getElementById('login-user-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- เลือกพนักงาน --</option>';
    users.forEach(u => {
        select.innerHTML += `<option value="${u.username}">${u.name}</option>`;
    });
}

// --- AUTHENTICATION ---
function login(event) {
    event.preventDefault();
    const username = document.getElementById('login-user-select').value;
    const pass = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error-msg');
    
    if (!username) {
        errorMsg.textContent = 'กรุณาเลือกผู้ใช้งาน';
        errorMsg.style.display = 'block';
        return;
    }
    
    const user = AppDB.getUsers().find(u => u.username === username);
    if (user && user.password.toString() === pass.toString()) {
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        document.getElementById('login-overlay').style.display = 'none';
        errorMsg.style.display = 'none';
        document.getElementById('login-password').value = '';
        updateUIForUser();
        switchView('dashboard');
        showToast('เข้าสู่ระบบสำเร็จ', 'success');
        // Request mic permission once right after login (inside user-gesture = no repeated prompts)
        if (typeof requestMicPermission === 'function') requestMicPermission();
    } else {
        errorMsg.textContent = 'รหัสผ่านไม่ถูกต้อง';
        errorMsg.style.display = 'block';
    }
}

function logout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('login-password').value = '';
    showToast('ออกจากระบบเรียบร้อย');
}

function updateUIForUser() {
    if (!currentUser) return;
    document.getElementById('user-display-name').textContent = currentUser.name.split(' ')[0];
    document.getElementById('user-display-role').textContent = '(' + getRoleName(currentUser.role) + ')';
    
    // Role-based access control for menu
    const role = currentUser.role;
    document.getElementById('nav-users').style.display = (role === 'manager') ? 'flex' : 'none';
    document.getElementById('nav-projects').style.display = (role === 'manager' || role === 'stock_keeper') ? 'flex' : 'none';
    document.getElementById('nav-warehouses').style.display = (role === 'manager') ? 'flex' : 'none';
    document.getElementById('nav-settings').style.display = (role === 'manager') ? 'flex' : 'none';
    document.getElementById('nav-approvals').style.display = (role === 'manager') ? 'flex' : 'none';
    
    if (typeof window.updateApprovalBadge === 'function') {
        window.updateApprovalBadge();
    }
}

window.updateApprovalBadge = function() {
    const badge = document.getElementById('approval-badge');
    if (!badge) return;
    try {
        const count = AppDB.getApprovals().length;
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch(e) {
        badge.style.display = 'none';
    }
};

function getRoleName(role) {
    if (role === 'manager') return 'ผู้จัดการ';
    if (role === 'foreman') return 'โฟร์แมน';
    if (role === 'stock_keeper') return 'ผู้ดูแลสต็อก';
    return role;
}

// --- NAVIGATION ---
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view-panel').forEach(el => el.classList.remove('active'));
    // Show target view
    const target = document.getElementById('view-' + viewId);
    if (target) target.classList.add('active');
    
    // Update active menu
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const menu = document.querySelector(`.menu-item[data-tab="${viewId}"]`);
    if (menu) menu.classList.add('active');
    
    currentView = viewId;
    
    // Update Title
    const titles = {
        'dashboard': 'แดชบอร์ดภาพรวม',
        'materials': 'คลังวัสดุ-สินค้า',
        'tools': 'ระบบเครื่องมือช่าง',
        'logs': 'ประวัติทำรายการ',
        'users': 'จัดการพนักงาน',
        'projects': 'จัดการโครงการ',
        'warehouses': 'จัดการคลังย่อย',
        'approvals': 'รายการรออนุมัติ',
        'settings': 'ตั้งค่าระบบ'
    };
    document.getElementById('main-page-title').textContent = titles[viewId] || 'Probuild App';
    
    if (typeof window.updateApprovalBadge === 'function') {
        window.updateApprovalBadge();
    }
    
    // Render view data
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'materials') renderMaterials();
    if (viewId === 'tools') renderTools();
    if (viewId === 'logs') renderLogs();
    if (viewId === 'users' && typeof renderUsers === 'function') renderUsers();
    if (viewId === 'projects' && typeof renderProjects === 'function') renderProjects();
        if (viewId === 'warehouses' && typeof renderWarehouses === 'function') renderWarehouses();
    if (viewId === 'approvals' && typeof renderApprovals === 'function') renderApprovals();
    if (viewId === 'settings') renderSettings();
}

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        if (sidebar.style.transform === 'translateX(0px)') {
            sidebar.style.transform = 'translateX(-100%)';
        } else {
            sidebar.style.transform = 'translateX(0px)';
        }
    }
}

// --- UI HELPERS ---
function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
        if (m._closeTimer) clearTimeout(m._closeTimer);
        m.style.display = 'flex';
        m.style.opacity = '1';
        m.style.pointerEvents = 'auto';
        m.classList.add('open');
    }
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
        if (m._closeTimer) clearTimeout(m._closeTimer);
        m.style.opacity = '0';
        m.style.pointerEvents = 'none';
        m.classList.remove('open');
        m._closeTimer = setTimeout(() => { m.style.display = 'none'; }, 250);
    }
}

function showToast(msg, type='info') {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- DASHBOARD ---
function renderDashboard() {
    const materials = AppDB.getMaterials();
    const tools = AppDB.getTools();
    
    let totalValue = 0;
    let lowStockCount = 0;
    let lowStockHtml = '';
    let projectsCost = {};
    
    materials.forEach(m => {
        let totalQty = (m.stock_a_qty || 0) + (m.stock_b_qty || 0) + (m.stock_c_qty || 0);
        totalValue += totalQty * (m.price_per_unit || 0);
        if (totalQty <= m.min_stock) {
            lowStockCount++;
            lowStockHtml += `
                <div style="padding:10px; border:1px solid #fee2e2; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:600; font-size:13px; color:var(--text-color);">${m.name}</div>
                        <div style="font-size:11px; color:var(--text-muted);">คงเหลือ: ${totalQty} ${m.unit} (ขั้นต่ำ: ${m.min_stock})</div>
                    </div>
                    <div style="font-size:12px; font-weight:bold; color:#ef4444;">ขาดสต็อก</div>
                </div>
            `;
        }
        
        // Mock project costs logic for demonstration (allocating randomly or based on name)
        let prj = 'โครงการ วิลล่า A (แม่น้ำ)';
        if (m.name.includes('PVC')) prj = 'โครงการ วิลล่า B (บ่อผุด)';
        if (!projectsCost[prj]) projectsCost[prj] = 0;
        projectsCost[prj] += (totalQty * (m.price_per_unit || 0) * 0.4); // Mock usage
    });
    
    let activeTools = 0;
    let inRepair = 0;
    let warrantyExpiring = 0;
    const now = new Date();
    
    let repairHtml = '';
    let warrantyHtml = '';
    
    tools.forEach(t => {
        if (t.status === 'usable') activeTools++;
        if (t.status === 'damaged') {
            inRepair++;
            repairHtml += `
                <div style="padding:10px; border:1px solid #fef3c7; border-radius:8px; margin-bottom:8px;">
                    <div style="font-weight:600; font-size:13px; color:var(--text-color);">${t.name}</div>
                    <div style="font-size:11px; color:var(--text-muted);">S/N: ${t.serial_number || '-'}</div>
                    <div style="font-size:11px; color:#b45309; margin-top:4px;">ส่งซ่อมเมื่อ 5 มิ.ย. 69 (ร้านสมุยเซอร์วิส)</div>
                </div>
            `;
        }
        
        if (t.warranty_expiry) {
            const exp = new Date(t.warranty_expiry);
            const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) {
                if (diffDays > 0) warrantyExpiring++; // Only count expiring soon, not expired
                let color = diffDays > 0 ? '#b45309' : '#ef4444';
                let bg = diffDays > 0 ? '#fef3c7' : '#fee2e2';
                let text = diffDays > 0 ? `ในประกัน (อีก ${diffDays} วัน)` : `หมดประกันแล้ว (${Math.abs(diffDays)} วัน)`;
                
                warrantyHtml += `
                    <div style="padding:10px; border:1px solid ${bg}; border-radius:8px; margin-bottom:8px;">
                        <div style="font-weight:600; font-size:13px; color:var(--text-color);">${t.name}</div>
                        <div style="font-size:11px; color:var(--text-muted);">หมดอายุ: ${t.warranty_expiry.split('T')[0]}</div>
                        <div style="font-size:11px; font-weight:bold; color:${color}; margin-top:4px; display:inline-block; background:${bg}; padding:2px 6px; border-radius:4px;">${text}</div>
                    </div>
                `;
            }
        }
    });
    
    // Top Metrics
    if(document.getElementById('dash-total-value')) document.getElementById('dash-total-value').textContent = totalValue.toLocaleString() + ' ฿';
    if(document.getElementById('dash-active-tools')) document.getElementById('dash-active-tools').textContent = activeTools + ' ชิ้น';
    if(document.getElementById('dash-low-stock')) document.getElementById('dash-low-stock').textContent = lowStockCount + ' รายการ';
    if(document.getElementById('dash-in-repair')) document.getElementById('dash-in-repair').textContent = inRepair + ' รายการ';
    if(document.getElementById('dash-warranty-exp')) document.getElementById('dash-warranty-exp').textContent = warrantyExpiring + ' เครื่องมือ';

    // Lists
    if(document.getElementById('dash-low-stock-list')) document.getElementById('dash-low-stock-list').innerHTML = lowStockHtml || '<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:20px;">ไม่มีรายการของขาดคลัง</div>';
    if(document.getElementById('dash-repair-list')) document.getElementById('dash-repair-list').innerHTML = repairHtml || '<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:20px;">ไม่มีรายการส่งซ่อม</div>';
    if(document.getElementById('dash-warranty-list')) document.getElementById('dash-warranty-list').innerHTML = warrantyHtml || '<div style="font-size:13px; color:var(--text-muted); text-align:center; padding:20px;">ไม่มีเครื่องมือใกล้หมดประกัน</div>';
    
    // Top Used (Mock)
    if(document.getElementById('dash-top-used-list')) {
        document.getElementById('dash-top-used-list').innerHTML = `
            <div style="padding:10px; border:1px solid var(--border-color); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:600; font-size:13px; color:var(--text-color);">เหล็กเส้นกลม SR24 ขนาด 9 มม. (ยาว 10 ม.)</div>
                    <div style="font-size:11px; color:var(--text-muted);">หมวดหมู่: วัสดุสินค้า</div>
                </div>
                <div style="font-size:11px; font-weight:bold; color:#10b981; background:#dcfce7; padding:4px 8px; border-radius:12px;">เบิกใช้ 15 ชิ้น</div>
            </div>
        `;
    }
    
    // Project Costs
    let maxCost = Math.max(...Object.values(projectsCost));
    let costHtml = '';
    for (const [prj, cost] of Object.entries(projectsCost)) {
        let pct = maxCost > 0 ? (cost / maxCost) * 100 : 0;
        costHtml += `
            <div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:600;">
                    <span>${prj}</span>
                    <span style="color:var(--primary-color);">${cost.toLocaleString()} บาท</span>
                </div>
                <div style="height:6px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${pct}%; background:var(--primary-color); border-radius:4px;"></div>
                </div>
            </div>
        `;
    }
    if(document.getElementById('dash-project-costs')) document.getElementById('dash-project-costs').innerHTML = costHtml;
}

// --- MATERIALS ---
function renderMaterials() {
    const tbody = document.getElementById('materials-table-body');
    if (!tbody) return;
    
    // Read filter values
    const catFilter = (document.getElementById('mat-cat-filter') && document.getElementById('mat-cat-filter').value) || '';
    const searchText = (document.getElementById('mat-search') && document.getElementById('mat-search').value.trim().toLowerCase()) || '';
    
    let materials = AppDB.getMaterials();
    
    // Apply category filter
    if (catFilter) {
        materials = materials.filter(m => m.category === catFilter);
    }
    
    // Apply text search filter
    if (searchText) {
        materials = materials.filter(m => 
            (m.name && m.name.toLowerCase().includes(searchText)) ||
            (m.category && m.category.toLowerCase().includes(searchText)) ||
            (m.code && m.code.toLowerCase().includes(searchText))
        );
    }
    
    tbody.innerHTML = '';
    
    if (materials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-box-open" style="font-size:32px; margin-bottom:12px; display:block; opacity:0.3;"></i>ไม่พบรายการวัสดุ</td></tr>';
        return;
    }
    
    materials.forEach(m => {
        let totalQty = (m.stock_a_qty || 0) + (m.stock_b_qty || 0) + (m.stock_c_qty || 0);
        let statusHtml = '';
        if (totalQty === 0) {
            statusHtml = '<span class="status-badge status-damaged">หมด</span>';
        } else if (totalQty <= m.min_stock) {
            statusHtml = '<span class="status-badge status-warning">ใกล้หมด</span>';
        } else {
            statusHtml = '<span class="status-badge status-usable">ปกติ</span>';
        }
        
        let stockClass = (qty) => qty > 0 ? 'text-success' : 'text-danger';
        
        const tr = document.createElement('tr');
        const matImg = (m.images && m.images[0]) ? m.images[0] : (AppDB.MOCK_IMAGES?.material || '');
        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${matImg}" style="width:120px; height:120px; border-radius:8px; object-fit:contain; background:#f1f5f9; padding:4px; cursor:pointer;" onclick="if(window.openImagePreviewModal) window.openImagePreviewModal(this.src)" onerror="this.src='${AppDB.MOCK_IMAGES?.material || ''}'">
                    <div>
                        <div style="font-weight:600; color:var(--text-color);">${m.name}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${m.category}</div>
                    </div>
                </div>
            </td>
            <td class="text-center"><strong class="${stockClass(m.stock_a_qty)}">${m.stock_a_qty || 0}</strong></td>
            <td class="text-center"><strong class="${stockClass(m.stock_b_qty)}">${m.stock_b_qty || 0}</strong></td>
            <td class="text-center"><strong class="${stockClass(m.stock_c_qty)}">${m.stock_c_qty || 0}</strong></td>
            <td class="text-center"><strong>${totalQty}</strong> <span style="font-size:12px; color:var(--text-muted);">${m.unit}</span></td>
            <td class="text-center">${m.price_per_unit ? m.price_per_unit.toLocaleString() + ' \u0e3f' : '-'}</td>
            <td class="text-center" style="color:var(--primary-color); font-weight:bold;">${(totalQty * (m.price_per_unit || 0)).toLocaleString()} \u0e3f</td>
            <td class="text-center">
                <div style="display:flex; align-items:center; justify-content:center; gap:12px;">
                </div>
            </td>
        `;
        // Build action buttons via DOM (avoids inline onclick scope issues)
        const btnWrap = tr.querySelector('td:last-child div');

        const btnPlus = document.createElement('button');
        btnPlus.type = 'button';
        btnPlus.innerHTML = '<i class="fas fa-plus"></i>';
        btnPlus.style.cssText = 'min-width:38px;min-height:38px;padding:8px 12px;font-size:15px;color:#10b981;border:1px solid #d1fae5;background:#ecfdf5;border-radius:8px;cursor:pointer;';
        btnPlus.title = 'รับเข้าวัสดุ';
        btnPlus.setAttribute('onclick', `window.openReceiveMaterialModal('${m.id}')`);

        const btnMinus = document.createElement('button');
        btnMinus.type = 'button';
        btnMinus.innerHTML = '<i class="fas fa-minus"></i>';
        btnMinus.style.cssText = 'min-width:38px;min-height:38px;padding:8px 12px;font-size:15px;color:#ef4444;border:1px solid #fee2e2;background:#fef2f2;border-radius:8px;cursor:pointer;';
        btnMinus.title = 'เบิกสินค้า';
        btnMinus.setAttribute('onclick', `window.openWithdrawMaterialModal('${m.id}')`);

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        btnEdit.style.cssText = 'min-width:38px;min-height:38px;padding:8px 12px;font-size:15px;color:#dc2626;border:1px solid #fdba74;background:#ffedd5;border-radius:8px;cursor:pointer;';
        btnEdit.title = 'แก้ไข';
        btnEdit.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.forceEditMaterial === 'function') {
                try {
                    window.forceEditMaterial(m.id);
                } catch(err) {
                    alert('Error: ' + err.message);
                }
            } else {
                alert('Missing forceEditMaterial');
            }
        });

        btnWrap.appendChild(btnPlus);
        btnWrap.appendChild(btnMinus);
        btnWrap.appendChild(btnEdit);

        tbody.appendChild(tr);
    });
}



function openReceiveMaterialModal(matId = '') {
    const nameInput = document.getElementById('receive-mat-name');
    if (matId && nameInput) {
        const m = AppDB.getMaterials().find(x => x.id === matId);
        if (m) nameInput.value = m.name;
    } else if (nameInput) {
        nameInput.value = '';
    }
    openModal('receive-material-modal');
}

function openWithdrawMaterialModal(matId = '') {
    const nameInput = document.getElementById('withdraw-mat-name');
    if (matId && nameInput) {
        const m = AppDB.getMaterials().find(x => x.id === matId);
        if (m) nameInput.value = m.name;
    } else if (nameInput) {
        nameInput.value = '';
    }
    openModal('withdraw-material-modal');
}

window.forceEditMaterial = function(id) {
    if (typeof window.resetMaterialModalUI === 'function') window.resetMaterialModalUI();
    try {
        var mats = AppDB.getMaterials();
        var m = mats.find(function(x) { return x.id == id; });
        if (!m) { alert('Not found: ' + id); return; }

        var setVal = function(eid, val) { var e = document.getElementById(eid); if(e) e.value = val||''; };
        setVal('mat-form-id', m.id);
        setVal('mat-name', m.name);
        setVal('mat-code', m.code);
        setVal('mat-unit', m.unit);
        setVal('mat-min-stock', m.min_stock);
        setVal('mat-price', m.price_per_unit);
        setVal('mat-image-url', '');

        var cat = document.getElementById('mat-category');
        if (cat && m.category) {
            var found = false;
            for(var i=0; i<cat.options.length; i++) {
                if(cat.options[i].value === m.category) { cat.selectedIndex = i; found = true; break; }
            }
            if (!found) {
                var o = document.createElement('option'); o.value = m.category; o.text = m.category;
                cat.appendChild(o); cat.value = m.category;
            }
        }

        window._matEditImages = (m.images && Array.isArray(m.images)) ? m.images.slice() : [];
        if (typeof window.renderMatEditImagePreview === 'function') window.renderMatEditImagePreview();
        else if (typeof window.fixRenderPreview === 'function') window.fixRenderPreview();

        var t = document.getElementById('material-modal-title');
        if (t) t.textContent = '\u0e41\u0e01\u0e49\u0e44\u0e02\u0e27\u0e31\u0e2a\u0e14\u0e38: ' + m.name;

        var modalEl = document.getElementById('material-edit-modal');
        if (modalEl) {
            document.body.appendChild(modalEl); // ESCAPE CSS TRAPS
            if (modalEl._closeTimer) clearTimeout(modalEl._closeTimer);
            modalEl.style.setProperty('display', 'flex', 'important');
            modalEl.style.setProperty('opacity', '1', 'important');
            modalEl.style.setProperty('visibility', 'visible', 'important');
            modalEl.style.setProperty('pointer-events', 'auto', 'important');
            modalEl.style.setProperty('z-index', '2147483647', 'important');
            modalEl.classList.add('open');
        } else {
            alert('CRITICAL: material-edit-modal not found in document!');
        }

    } catch(err) {
        alert('CRITICAL ERROR in forceEditMaterial: ' + err.message);
    }
};

//  2. Navigation Control 
function editMaterial(id) {
    const mats = AppDB.getMaterials();
    const m = mats.find(x => x.id === id);
    if (!m) { alert('ไม่พบวัสดุ: ' + id); return; }

    const sv = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = (val != null) ? val : ''; };
    sv('mat-form-id',   m.id);
    sv('mat-name',      m.name || '');
    sv('mat-code',      m.code || '');
    sv('mat-unit',      m.unit || '');
    sv('mat-min-stock', m.min_stock || 0);
    sv('mat-price',     m.price_per_unit || 0);
    sv('mat-image-url', '');

    const catEl = document.getElementById('mat-category');
    if (catEl && m.category) {
        let found = false;
        for (let i = 0; i < catEl.options.length; i++) {
            if (catEl.options[i].value === m.category) { catEl.selectedIndex = i; found = true; break; }
        }
        if (!found) {
            const o = document.createElement('option');
            o.value = m.category; o.text = m.category;
            catEl.appendChild(o); catEl.value = m.category;
        }
    }

    window._matEditImages = (Array.isArray(m.images) ? m.images.filter(Boolean) : []).slice();
    if (typeof window.renderMatEditImagePreview === 'function') window.renderMatEditImagePreview();

    const titleEl = document.getElementById('material-modal-title');
    if (titleEl) titleEl.textContent = 'แก้ไขวัสดุ: ' + m.name;

    openModal('material-edit-modal');
}
window.editMaterial = editMaterial;


function quickAction(action) {
    if (action === 'receive') openReceiveMaterialModal();
    if (action === 'withdraw') openWithdrawMaterialModal();
    if (action === 'borrow') openToolBorrowModal();
    if (action === 'return') openToolReturnModal();
}

// --- TOOLS ---
function renderTools() {
    const container = document.getElementById('tools-list-container');
    if (!container) return;
    
    const tools = AppDB.getTools();
    container.innerHTML = '';
    
    tools.forEach(t => {
        let statusHtml = '';
        if (t.status === 'usable') statusHtml = '<span class="status-badge status-usable">พร้อมใช้งาน</span>';
        else if (t.status === 'damaged') statusHtml = '<span class="status-badge status-damaged">ชำรุด</span>';
        else if (t.status === 'retired') statusHtml = '<span class="status-badge status-warning">ยุติการใช้งาน</span>';
        else statusHtml = `<span class="status-badge">${t.status}</span>`;

        let imgUrl = AppDB.MOCK_IMAGES?.drill || '';
        if (t.name && t.name.includes('เชื่อม')) imgUrl = AppDB.MOCK_IMAGES?.welder || '';
        if (t.name && t.name.includes('เจียร')) imgUrl = AppDB.MOCK_IMAGES?.grinder || '';
        
        let extraBadge = '';
        if (t.warranty_expiry) {
            const exp = new Date(t.warranty_expiry);
            const now = new Date();
            const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
            if (diff > 0) {
                extraBadge = `<span class="status-badge" style="background:#dcfce7; color:#16a34a; border:1px solid #bbf7d0;">ในประกัน (อีก ${diff} วัน)</span>`;
            } else {
                extraBadge = `<span class="status-badge" style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca;">หมดประกันแล้ว (${Math.abs(diff)} วัน)</span>`;
            }
        }
        
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '20px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '12px';

        let isAtBase = (t.current_project === 'คลังสินค้ากลาง');
        let btnBorrowHtml = isAtBase ? 
            `<button class="btn btn-primary" style="flex:1; font-size:13px;" onclick="openToolBorrowModal('${t.id}')"><i class="fas fa-sign-out-alt"></i> ยืมเครื่องมือ</button>` :
            `<button class="btn btn-outline" style="flex:1; font-size:13px; opacity:0.5; cursor:not-allowed;"><i class="fas fa-sign-out-alt"></i> ยืมเครื่องมือ</button>`;
        
        let btnReturnHtml = !isAtBase ? 
            `<button class="btn btn-danger" style="flex:1; font-size:13px;" onclick="openToolReturnModal('${t.id}')"><i class="fas fa-sign-in-alt" style="transform: scaleX(-1);"></i> คืนเครื่องมือ</button>` :
            `<button class="btn btn-outline" style="flex:1; font-size:13px; opacity:0.5; cursor:not-allowed;"><i class="fas fa-sign-in-alt" style="transform: scaleX(-1);"></i> คืนเครื่องมือ</button>`;

        let imgOpacity = t.status === 'retired' ? 'opacity: 0.4;' : '';
        let retiredOverlay = t.status === 'retired' ? `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) rotate(-15deg); color:#dc2626; font-weight:bold; font-size:20px; border:3px solid #dc2626; padding:2px 6px; border-radius:4px; z-index:10; white-space:nowrap; background:rgba(255,255,255,0.8);">ยุติการใช้งาน</div>` : '';

        card.innerHTML = `
            <div style="position:relative; text-align:center; height:100px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; cursor:pointer;" onclick="viewToolDetails('${t.id}')" title="คลิกเพื่อดูรายละเอียดเครื่องมือช่าง">
                ${retiredOverlay}
                <img src="${t.images?.[0] || imgUrl}" style="max-height:80px; max-width:80%; object-fit:contain; ${imgOpacity}">
            </div>
            <div>
                <h4 style="font-size:15px; margin:0 0 4px 0; color:var(--text-color); font-weight:700;">${t.name}</h4>
                <div style="font-size:12px; color:var(--text-muted);">${t.category}</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${statusHtml}
                ${extraBadge}
            </div>
            ${t.status === 'damaged' ? '<div style="font-size:11px; color:#b45309; background:#fef3c7; padding:6px; border-radius:4px;"><i class="fas fa-exclamation-circle"></i> อาการ: ไฟไม่เข้า สวิตช์พัง ส่งไปที่ร้านสมุยเซอร์วิส (ส่งร้านแล้ว) เมื่อ 5 มิ.ย. 69</div>' : ''}
            <div style="font-size:12px; color:var(--text-muted); margin-top:8px;">
                <div>หมายเลขซีเรียล: <strong style="color:var(--primary-color);">${t.serial_number || '-'}</strong></div>
                <div>โครงการปัจจุบัน: <strong style="color:var(--primary-color);">${t.current_project || 'ไม่ระบุ'}</strong></div>
                ${t.current_borrower ? `<div>ผู้เบิกใช้งานล่าสุด: <strong style="color:#d97706;">${t.current_borrower}</strong></div>` : ''}
            </div>
            <div style="margin-top:auto; padding-top:16px; border-top:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:700; font-size:15px;">${t.price ? t.price.toLocaleString() + ' ฿' : '-'}</div>
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-outline btn-sm" style="padding:4px 8px; color:#3b82f6; border-color:#dbeafe; background:#eff6ff;" title="ดูข้อมูล" onclick="viewToolDetails('${t.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-outline btn-sm" style="padding:4px 8px; color:#f59e0b; border-color:#fef3c7; background:#fffbeb;" title="โยกย้าย" onclick="openToolTransferModal('${t.id}')"><i class="fas fa-exchange-alt"></i></button>
                    <button class="btn btn-outline btn-sm" style="padding:4px 8px; color:#0ea5e9; border-color:#e0f2fe; background:#f0f9ff;" title="ส่งซ่อม" onclick="openToolRepairModal('${t.id}')"><i class="fas fa-wrench"></i></button>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:12px;">
                ${btnReturnHtml}
                ${btnBorrowHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

function openToolBorrowModal(toolId = '') {
    if (window.logicOpenToolBorrowModal) window.logicOpenToolBorrowModal(toolId);
}

function openToolReturnModal(toolId = '') {
    if (window.logicOpenToolReturnModal) window.logicOpenToolReturnModal(toolId);
}

// --- LOGS ---
function renderLogs() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;
    
    let allLogs = [];
    const matLogs = AppDB.getMaterialLogs() || [];
    const toolLogs = AppDB.getToolLogs() || [];
    
    matLogs.forEach(l => {
        allLogs.push({
            type: 'material',
            timestamp: l.timestamp,
            action: l.action,
            item: l.material_name,
            qty: l.qty,
            details: `
                <div><i class="fas ${l.action === 'withdraw' ? 'fa-arrow-up text-danger' : 'fa-arrow-down text-success'}"></i> <strong>${l.action === 'withdraw' ? 'เบิกไปใช้' : 'รับเข้าคลัง'}</strong>: ${l.project || l.warehouse || '-'}</div>
                <div style="color:var(--text-muted); font-size:12px; margin-top:4px;">
                    <i class="fas fa-user-edit"></i> ผู้รับของ/ผู้เบิก: ${l.borrower_name || '-'} | <i class="fas fa-user-check"></i> ผู้จ่าย/ผู้อนุมัติ: ${l.approver_name || '-'}
                </div>
            `
        });
    });
    
    toolLogs.forEach(l => {
        let actionStr = '';
        let iconClass = '';
        if (l.action === 'borrow') { actionStr = 'ยืมใช้'; iconClass = 'fa-sign-out-alt text-warning'; }
        else if (l.action === 'return') { actionStr = 'คืนเครื่องมือ'; iconClass = 'fa-sign-in-alt text-success'; }
        else if (l.action === 'repair') { actionStr = 'ส่งซ่อม'; iconClass = 'fa-wrench text-danger'; }
        else { actionStr = l.action; iconClass = 'fa-cog text-muted'; }
        
        allLogs.push({
            type: 'tool',
            timestamp: l.timestamp,
            action: l.action,
            item: l.tool_name,
            qty: '-',
            details: `
                <div><i class="fas ${iconClass}"></i> <strong>การกระทำ: ${actionStr}</strong></div>
                <div style="color:var(--text-muted); font-size:12px; margin-top:4px;">
                    <i class="fas fa-map-marker-alt"></i> โครงการปลายทาง: ${l.to_project || '-'}
                </div>
                <div style="color:var(--text-muted); font-size:12px; margin-top:4px;">
                    <i class="fas fa-user-edit"></i> ผู้ใช้เครื่องมือ: ${l.borrower_name || '-'} | <i class="fas fa-user-check"></i> ผู้อนุมัติ: ${l.approver_name || '-'}
                </div>
                ${l.note ? `<div style="color:var(--text-muted); font-size:12px; margin-top:4px;"><i class="fas fa-sticky-note"></i> หมายเหตุ: ${l.note}</div>` : ''}
            `
        });
    });
    
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    tbody.innerHTML = '';
    allLogs.forEach(l => {
        const tr = document.createElement('tr');
        
        let typeIcon = '';
        if (l.type === 'material') {
            if (l.action === 'withdraw') typeIcon = '<div style="width:24px; height:24px; border-radius:50%; background:#fee2e2; color:#ef4444; display:flex; align-items:center; justify-content:center; margin:0 auto;"><i class="fas fa-arrow-up" style="font-size:12px;"></i></div>';
            else typeIcon = '<div style="width:24px; height:24px; border-radius:50%; background:#dcfce7; color:#10b981; display:flex; align-items:center; justify-content:center; margin:0 auto;"><i class="fas fa-arrow-down" style="font-size:12px;"></i></div>';
        } else {
            if (l.action === 'repair') typeIcon = '<div style="width:24px; height:24px; border-radius:50%; background:#fef3c7; color:#b45309; display:flex; align-items:center; justify-content:center; margin:0 auto;"><i class="fas fa-wrench" style="font-size:12px;"></i></div>';
            else typeIcon = '<div style="width:24px; height:24px; border-radius:50%; background:#ffedd5; color:#ea580c; display:flex; align-items:center; justify-content:center; margin:0 auto;"><i class="fas fa-sign-out-alt" style="font-size:12px;"></i></div>';
        }
        
        const d = new Date(l.timestamp);
        const dateStr = d.toLocaleDateString('th-TH') + ' ' + d.toLocaleTimeString('th-TH');
        
        let qtyHtml = l.qty;
        if (l.type === 'material') {
            qtyHtml = l.action === 'withdraw' ? `<strong class="text-danger">-${l.qty}</strong>` : `<strong class="text-success">+${l.qty}</strong>`;
        }
        
        tr.innerHTML = `
            <td style="text-align:center;">${typeIcon}</td>
            <td style="font-size:13px;">${dateStr}</td>
            <td style="font-weight:600;">${l.item}</td>
            <td style="text-align:center;">${qtyHtml}</td>
            <td style="font-size:13px; line-height:1.4;">${l.details}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- SYNC STATUS ---
function checkSyncStatus() {
    const settings = AppDB.getSettings();
    const dot = document.getElementById('sheet-status-dot');
    const text = document.getElementById('sheet-status-text');
    
    if (dot && text) {
        if (!settings || !settings.googleSheetUrl) {
            dot.style.backgroundColor = '#ef4444'; // Red
            text.textContent = 'ยังไม่ได้เชื่อมต่อ Sheet';
        } else {
            dot.style.backgroundColor = '#10b981'; // Green
            text.textContent = 'เชื่อมต่อ Sheet แล้ว';
        }
    }
}
window.checkSyncStatus = checkSyncStatus;

// --- SETTINGS ---
function renderSettings() {
    const settings = AppDB.getSettings();
    if (!settings) return;
    
    const urlInput = document.getElementById('settings-sheet-url');
    const tokenInput = document.getElementById('settings-telegram-token');
    const chatInput = document.getElementById('settings-telegram-chatid');
    
    if (urlInput) urlInput.value = settings.googleSheetUrl || '';
    if (tokenInput) tokenInput.value = settings.telegramBotToken || '';
    if (chatInput) chatInput.value = settings.telegramChatId || '';
}


window._isSyncing = false;
window.triggerAutoSync = function() {
    if (window._isSyncing) return;
    if (typeof AppDB === 'undefined' || !AppDB.syncGoogleSheets) return;
    
    window._isSyncing = true;
    const btnSync = document.getElementById('btn-sync-sheets');
    if (btnSync) {
        btnSync.disabled = true;
        btnSync.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังซิงก์...';
    }
    
    AppDB.syncGoogleSheets().then(() => {
        if (btnSync) {
            btnSync.disabled = false;
            btnSync.innerHTML = '<i class="fas fa-sync"></i> ทำการซิงก์กับ Google Sheets ตอนนี้';
        }
    }).catch(err => {
        console.error("Auto-sync failed:", err);
        if (btnSync) {
            btnSync.disabled = false;
            btnSync.innerHTML = '<i class="fas fa-sync"></i> ทำการซิงก์กับ Google Sheets ตอนนี้';
        }
    }).finally(() => {
        window._isSyncing = false;
    });
};
// Init
window.onload = initApp;







