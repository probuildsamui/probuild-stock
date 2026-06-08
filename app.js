/**
 * ตรรกะควบคุมแอปพลิเคชัน (app.js)
 * สำหรับแอปพลิเคชันบริหารสต็อกสินค้าและเครื่องมือช่าง
 * Probuild Samui Development
 */

document.addEventListener("DOMContentLoaded", () => {
  // สมาชิกผู้ล็อกอินปัจจุบัน
  let currentUser = null;
  
  // รายการรูปภาพที่ถูกเลือกชั่วคราวตอนเพิ่มวัสดุ/เครื่องมือ
  let tempUploadedImages = [];
  let tempUploadedMatImages = [];

  // ทะเบียนระบบ Autocomplete (ประกาศไว้ที่นี่เพื่อหลีกเลี่ยง Temporal Dead Zone ในช่วงโหลดหน้าเว็บ)
  const autocompleteRegistry = {};

  // เริ่มต้นทำงาน
  try {
    checkLoginSession();
    initRouter();
    initEventListeners();
    populateProjectDropdowns();
    renderAllViews();
    setupAutocomplete();
    setupFAB();
  } catch (err) {
    alert("❌ Error during initialization:\n" + err.message + "\n\n" + err.stack);
  }

  // --- 1. ระบบจัดการการเข้าสู่ระบบ (Authentication) ---
  function checkLoginSession() {
    const savedUser = sessionStorage.getItem("current_user");
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      hideLoginScreen();
    } else {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    const loginOverlay = document.getElementById("login-overlay");
    loginOverlay.style.display = "flex";
    
    // โหลดรายชื่อผู้ใช้งานเฉพาะสถานะ 'active' ลง Dropdown
    const userSelect = document.getElementById("login-user-select");
    userSelect.innerHTML = '<option value="" disabled selected>-- เลือกพนักงาน --</option>';
    
    const activeUsers = AppDB.getUsers().filter(u => u.status === "active");
    activeUsers.forEach(u => {
      const option = document.createElement("option");
      option.value = u.id;
      option.textContent = `${u.name} (${translateRole(u.role)})`;
      userSelect.appendChild(option);
    });
    
    document.getElementById("login-password").value = "";
    document.getElementById("login-error-msg").textContent = "";
  }

  function hideLoginScreen() {
    document.getElementById("login-overlay").style.display = "none";
    updateSidebarUserCard();
    toggleRoleBasedMenu();
    // ย้ายไปที่ Dashboard เมื่อเข้าสู่ระบบสำเร็จ
    switchTab("dashboard");
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const userId = document.getElementById("login-user-select").value;
    const password = document.getElementById("login-password").value;
    const errorMsg = document.getElementById("login-error-msg");

    if (!userId) {
      errorMsg.textContent = "กรุณาเลือกพนักงานเพื่อเข้าสู่ระบบ";
      return;
    }

    const user = AppDB.getUsers().find(u => u.id === userId);
    const dbPassword = user ? (user.password || "").toString().trim() : "";
    const effectivePassword = dbPassword === "" ? "123" : dbPassword;

    if (user && password === effectivePassword) {
      currentUser = user;
      sessionStorage.setItem("current_user", JSON.stringify(user));
      hideLoginScreen();
      
      // ส่งแจ้งเตือนการเข้าสู่ระบบเข้า Telegram (แบบ Asynchronous ไม่ต้องรอบล็อกผู้ใช้)
      const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
      const telegramMessage = `🔐 <b>แจ้งเตือนการเข้าสู่ระบบ</b>\n\n👤 ผู้ใช้งาน: <b>${user.name}</b>\n💼 ตำแหน่ง: <b>${translateRole(user.role)}</b>\n⏰ เวลาล็อกอิน: <code>${now}</code>`;
      AppDB.notifyTelegram(telegramMessage);
    } else {
      errorMsg.textContent = "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง (หากเพิ่งซิงก์ข้อมูลและไม่ได้ใส่รหัสผ่านใน Google Sheet ให้ลองใช้ '123')";
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("current_user");
    currentUser = null;
    showLoginScreen();
  }

  function updateSidebarUserCard() {
    if (!currentUser) return;
    const initial = currentUser.name.charAt(0);
    document.getElementById("user-initial").textContent = initial;
    document.getElementById("user-display-name").textContent = currentUser.name;
    document.getElementById("user-display-role").textContent = translateRole(currentUser.role);
  }

  function toggleRoleBasedMenu() {
    const usersTab = document.getElementById("nav-users");
    const projectsTab = document.getElementById("nav-projects");
    const warehousesTab = document.getElementById("nav-warehouses");
    const isManager = currentUser && currentUser.role === "manager";
    if (usersTab) usersTab.style.display = isManager ? "flex" : "none";
    if (projectsTab) projectsTab.style.display = isManager ? "flex" : "none";
    if (warehousesTab) warehousesTab.style.display = isManager ? "flex" : "none";
  }

  // --- 2. การจัดการ Routing (Tabs & Panels) ---
  function initRouter() {
    const menuItems = document.querySelectorAll(".menu-item[data-tab]");
    menuItems.forEach(item => {
      item.addEventListener("click", () => {
        const tabName = item.getAttribute("data-tab");
        switchTab(tabName);
      });
    });

    // ตรวจจับกรณีเปลี่ยนแฮชบนเบราว์เซอร์
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.substring(1);
      if (hash) switchTab(hash);
    });
  }

  function switchTab(tabName) {
    // ป้องกันการแอบเข้าแท็บพนักงานของ Foreman
    if ((tabName === "users" || tabName === "projects" || tabName === "warehouses") && (!currentUser || currentUser.role !== "manager")) {
      tabName = "dashboard";
    }

    // อัปเดตลิงก์เมนูที่ Active
    const menuItems = document.querySelectorAll(".menu-item[data-tab]");
    menuItems.forEach(item => {
      if (item.getAttribute("data-tab") === tabName) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // อัปเดตหน้าต่างที่แสดง
    const panels = document.querySelectorAll(".view-panel");
    panels.forEach(panel => {
      if (panel.id === `view-${tabName}`) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });

    // เปลี่ยนแฮช URL
    window.location.hash = tabName;
    
    // ตั้งชื่อหัวกระดาษหน้าหลัก
    const titles = {
      dashboard: "แดชบอร์ดสรุปผล",
      materials: "คลังวัสดุก่อสร้าง",
      tools: "ระบบบริหารเครื่องมือช่าง",
      logs: "ประวัติการเบิกจ่ายและย้ายโครงการ",
      users: "การจัดการบัญชีพนักงาน",
      projects: "การจัดการโครงการ",
      warehouses: "การจัดการคลังวัสดุ",
      reports: "รายงานสรุปโครงการรายเดือน",
      settings: "ตั้งค่าและการซิงก์ข้อมูล"
    };
    document.getElementById("main-page-title").textContent = titles[tabName] || "ระบบบริหารสต็อก";
    
    // ปิด Sidebar บนมือถือ
    document.querySelector(".sidebar").classList.remove("open");

    // โหลดข้อมูลเฉพาะหน้าเมื่อเปิด
    renderAllViews();
  }

  // --- 3. การแสดงผลเนื้อหาหลัก (Render Engine) ---
  function renderAllViews() {
    const activeTab = window.location.hash.substring(1) || "dashboard";
    
    // อัปเดตสถานะการเชื่อมต่อกับ Google Sheet ใน Topbar
    const sheetUrl = AppDB.getSettings().googleSheetUrl;
    const statusDot = document.getElementById("sheet-status-dot");
    const statusText = document.getElementById("sheet-status-text");
    if (sheetUrl) {
      statusDot.className = "status-dot online";
      statusText.textContent = "เชื่อมต่อชีตแล้ว";
    } else {
      statusDot.className = "status-dot offline";
      statusText.textContent = "ไม่ได้เชื่อมต่อชีต";
    }

    if (activeTab === "dashboard") renderDashboard();
    else if (activeTab === "materials") renderMaterials();
    else if (activeTab === "tools") renderTools();
    else if (activeTab === "logs") renderLogs();
    else if (activeTab === "users") renderUsers();
    else if (activeTab === "projects") renderProjects();
    else if (activeTab === "warehouses") renderWarehouses();
    else if (activeTab === "reports") renderReports();
    else if (activeTab === "settings") renderSettings();
  }

  // แดชบอร์ดสรุปผลรายสัปดาห์
  function renderDashboard() {
    const materials = AppDB.getMaterials();
    const tools = AppDB.getTools();
    const matLogs = AppDB.getMaterialLogs();
    const toolLogs = AppDB.getToolLogs();

    // 1. คำนวณมูลค่าของในคลังรวมทั้งหมด (รวมคลังย่อย 5 คลัง)
    let totalValue = 0;
    materials.forEach(m => {
      const totalQty = (m.stock_a_qty || 0) + (m.stock_b_qty || 0) + (m.stock_c_qty || 0) + (m.stock_d_qty || 0) + (m.stock_e_qty || 0);
      totalValue += totalQty * m.price_per_unit;
    });
    document.getElementById("dash-total-value").textContent = totalValue.toLocaleString() + " ฿";

    // 2. คำนวณจำนวนเครื่องมือพร้อมใช้งาน
    const usableTools = tools.filter(t => t.status === "usable").length;
    document.getElementById("dash-active-tools").textContent = usableTools + " / " + tools.length + " ชิ้น";

    // 3. หาสินค้าสต็อกใกล้หมด (รวมคลังย่อยต่ำกว่าระดับสั่งซื้อขั้นต่ำ)
    const lowStockItems = materials.filter(m => {
      const totalQty = (m.stock_a_qty || 0) + (m.stock_b_qty || 0) + (m.stock_c_qty || 0) + (m.stock_d_qty || 0) + (m.stock_e_qty || 0);
      return totalQty <= m.min_stock;
    });
    document.getElementById("dash-low-stock").textContent = lowStockItems.length + " รายการ";

    // 4. ค้นหาอุปกรณ์ส่งซ่อม
    const repairTools = tools.filter(t => t.status === "damaged" || t.repair_status !== "none");
    document.getElementById("dash-in-repair").textContent = repairTools.length + " รายการ";

    // 5. รายการสินค้าใกล้หมดประกัน (หมดประกันแล้ว หรือเหลือน้อยกว่า 30 วัน)
    const today = new Date();
    const warrantyAlerts = tools.filter(t => {
      if (!t.warranty_expiry) return false;
      const expiry = new Date(t.warranty_expiry);
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30; // หมดประกันแล้ว หรือใกล้หมดใน 30 วัน
    });
    document.getElementById("dash-warranty-exp").textContent = warrantyAlerts.length + " เครื่องมือ";

    // --- แสดงข้อมูลรายการแนะนำใน Widgets ---
    // ก) สต็อกแจ้งเตือนวิกฤต
    const lowStockContainer = document.getElementById("dash-low-stock-list");
    lowStockContainer.innerHTML = "";
    if (lowStockItems.length === 0) {
      lowStockContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 10px;">ไม่มีรายการของขาดคลัง</div>';
    } else {
      const warehouses = AppDB.getWarehouses();
      lowStockItems.forEach(m => {
        const total = (m.stock_a_qty || 0) + (m.stock_b_qty || 0) + (m.stock_c_qty || 0) + (m.stock_d_qty || 0) + (m.stock_e_qty || 0);
        
        const whListText = warehouses.map(wh => {
          const fieldName = wh.code.toLowerCase().replace(" ", "_") + "_qty";
          const qty = m[fieldName] || 0;
          return `${wh.name}(${qty})`;
        }).join(" ");

        lowStockContainer.innerHTML += `
          <div class="list-item">
            <div>
              <div class="list-item-title">${m.name}</div>
              <div class="list-item-subtitle">คลังย่อย: ${whListText}</div>
            </div>
            <span class="list-item-badge badge-danger">เหลือ ${total} ${m.unit} (ขั้นต่ำ ${m.min_stock})</span>
          </div>
        `;
      });
    }

    // ข) ติดตามความก้าวหน้าการแจ้งซ่อม
    const repairContainer = document.getElementById("dash-repair-list");
    repairContainer.innerHTML = "";
    if (repairTools.length === 0) {
      repairContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 10px;">ไม่มีเครื่องมือชำรุด/ส่งซ่อม</div>';
    } else {
      repairTools.forEach(t => {
        let statusLabel = "";
        let colorClass = "";
        let daysText = "";
        
        if (t.repair_date) {
          const sentDate = new Date(t.repair_date);
          const days = Math.ceil((today - sentDate) / (1000 * 60 * 60 * 24));
          daysText = ` (ซ่อมมาแล้ว ${days} วัน)`;
        }

        switch (t.repair_status) {
          case "requested": statusLabel = "แจ้งส่งซ่อม"; colorClass = "badge-danger"; break;
          case "in_progress": statusLabel = "กำลังซ่อม"; colorClass = "badge-warning"; break;
          case "sent_to_shop": statusLabel = "ส่งร้านภายนอก"; colorClass = "badge-info"; break;
        }

        let repairDetailsText = "";
        const logs = AppDB.getToolLogs().filter(l => l.tool_id === t.id && (l.action === "repair" || l.action === "repair_sent" || l.action === "repair_returned"));
        if (logs.length > 0) {
          logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // latest first
          const latestLog = logs[0];
          const logDate = new Date(latestLog.timestamp).toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: '2-digit' });
          if (t.repair_status === "requested") {
            repairDetailsText = `<br><span style="font-size:11px; color:var(--danger);">แจ้งส่งซ่อมโดย ${latestLog.authorizer || latestLog.borrower} เมื่อ ${logDate}</span>`;
          } else if (t.repair_status === "in_progress" || t.repair_status === "sent_to_shop") {
            repairDetailsText = `<br><span style="font-size:11px; color:var(--warning);">ซ่อมที่: ${latestLog.notes || 'ไม่ระบุร้าน'} เมื่อ ${logDate}</span>`;
          }
        }

        repairContainer.innerHTML += `
          <div class="list-item">
            <div>
              <div class="list-item-title">${t.name}</div>
              <div class="list-item-subtitle">S/N: ${t.serial_number} ${daysText}${repairDetailsText}</div>
            </div>
            <span class="list-item-badge ${colorClass}">${statusLabel}</span>
          </div>
        `;
      });
    }

    // ค) สรุปยอดการใช้งานสูงสุดในรอบสัปดาห์ (Top Used Tools / Materials)
    const statsContainer = document.getElementById("dash-top-used-list");
    statsContainer.innerHTML = "";

    // ดึงประวัติเบิกวัสดุในรอบ 7 วัน
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // รวมยอดวัสดุที่เบิกมากที่สุด
    let matCounts = {};
    matLogs.filter(l => l.type === "withdraw" && new Date(l.timestamp) >= oneWeekAgo)
            .forEach(l => {
              matCounts[l.material_name] = (matCounts[l.material_name] || 0) + Number(l.quantity);
            });

    // รวมจำนวนรอบยืมเครื่องมือ
    let toolCounts = {};
    toolLogs.filter(l => l.action === "borrow" && new Date(l.timestamp) >= oneWeekAgo)
            .forEach(l => {
              toolCounts[l.tool_name] = (toolCounts[l.tool_name] || 0) + 1;
            });

    let topItems = [];
    for (let name in matCounts) {
      topItems.push({ name: name, value: matCounts[name] + " ชิ้น", type: "วัสดุสินค้า" });
    }
    for (let name in toolCounts) {
      topItems.push({ name: name, value: toolCounts[name] + " ครั้ง", type: "ยืมเครื่องมือช่าง" });
    }

    // เรียงความถี่สูงสุด
    topItems.sort((a, b) => parseInt(b.value) - parseInt(a.value));
    topItems = topItems.slice(0, 4);

    if (topItems.length === 0) {
      statsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 10px;">ไม่มีการทำรายการในรอบสัปดาห์นี้</div>';
    } else {
      topItems.forEach(item => {
        statsContainer.innerHTML += `
          <div class="list-item">
            <div>
              <div class="list-item-title">${item.name}</div>
              <div class="list-item-subtitle">หมวดหมู่: ${item.type}</div>
            </div>
            <span class="list-item-badge badge-success">เบิกใช้ ${item.value}</span>
          </div>
        `;
      });
    }

    // ง) รายการเครื่องมือช่างหมดประกัน/ใกล้หมดประกัน
    const warrantyContainer = document.getElementById("dash-warranty-list");
    warrantyContainer.innerHTML = "";
    if (warrantyAlerts.length === 0) {
      warrantyContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 10px;">เครื่องมือทั้งหมดอยู่ในประกันปลอดภัย</div>';
    } else {
      warrantyAlerts.forEach(t => {
        const expiry = new Date(t.warranty_expiry);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        let badgeText = "";
        let badgeClass = "";
        
        if (diffDays < 0) {
          badgeText = `หมดประกันแล้ว (${Math.abs(diffDays)} วัน)`;
          badgeClass = "badge-danger";
        } else {
          badgeText = `เหลืออีก ${diffDays} วัน`;
          badgeClass = "badge-warning";
        }

        warrantyContainer.innerHTML += `
          <div class="list-item">
            <div>
              <div class="list-item-title">${t.name}</div>
              <div class="list-item-subtitle">หมดอายุ: ${t.warranty_expiry} (จากร้าน: ${t.purchase_shop})</div>
            </div>
            <span class="list-item-badge ${badgeClass}">${badgeText}</span>
          </div>
        `;
      });
    }

    // จ) โครงการกับค่าใช้จ่ายสะสม (Project Cost Breakdown)
    const projectSummaryContainer = document.getElementById("dash-project-costs");
    projectSummaryContainer.innerHTML = "";
    let projectCosts = {};
    
    // สะสมมูลค่าจากการถอนวัสดุ (withdraw)
    matLogs.filter(l => l.type === "withdraw").forEach(l => {
      const cost = Number(l.quantity) * (Number(l.price_at_time) || 0);
      projectCosts[l.project] = (projectCosts[l.project] || 0) + cost;
    });

    const projects = Object.keys(projectCosts);
    if (projects.length === 0) {
      projectSummaryContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 10px;">ยังไม่มีมูลค่าการเบิกใช้ในโครงการใดๆ</div>';
    } else {
      projects.forEach(p => {
        const totalCost = projectCosts[p];
        projectSummaryContainer.innerHTML += `
          <div style="margin-bottom: 14px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom: 4px;">
              <span style="font-weight:500;">${p}</span>
              <span style="color:var(--accent); font-weight:600;">${totalCost.toLocaleString()} บาท</span>
            </div>
            <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
              <div style="height:100%; background:var(--accent); width:${Math.min(100, (totalCost / 20000) * 100)}%; border-radius:4px;"></div>
            </div>
          </div>
        `;
      });
    }
  }

  // หน้ารายการวัสดุสินค้า
  function renderMaterials() {
    const searchVal = document.getElementById("mat-search").value.toLowerCase();
    const catVal = document.getElementById("mat-cat-filter").value;
    
    const headerRow = document.getElementById("materials-table-header");
    const tbody = document.getElementById("materials-table-body");
    tbody.innerHTML = "";
    
    const warehouses = AppDB.getWarehouses();
    
    // อัปเดตหัวตารางแบบไดนามิก
    let warehouseHeadersHtml = warehouses.map(w => `<th style="text-align:center;">${w.name}</th>`).join("");
    headerRow.innerHTML = `
      <th>ชื่อวัสดุก่อสร้าง</th>
      ${warehouseHeadersHtml}
      <th>ยอดคงเหลือรวม</th>
      <th>ราคากลาง</th>
      <th>มูลค่ารวมในคลัง</th>
      <th>จัดการ</th>
    `;
    
    let filtered = AppDB.getMaterials();
    
    // คัดกรอง
    if (searchVal) {
      filtered = filtered.filter(m => m.name.toLowerCase().includes(searchVal) || m.category.toLowerCase().includes(searchVal));
    }
    if (catVal) {
      filtered = filtered.filter(m => m.category === catVal);
    }
    
    if (filtered.length === 0) {
      const colSpan = warehouses.length + 5;
      tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; color: var(--text-muted);">ไม่พบข้อมูลวัสดุก่อสร้าง</td></tr>`;
      return;
    }
    
    filtered.forEach(m => {
      let totalQty = 0;
      let warehouseColsHtml = warehouses.map(w => {
        const fieldName = w.code.toLowerCase().replace(" ", "_") + "_qty";
        const qty = m[fieldName] || 0;
        totalQty += qty;
        return qty;
      });

      const totalValue = totalQty * m.price_per_unit;
      const isCritical = totalQty <= m.min_stock;
      const firstImage = (m.images && m.images[0]) || MOCK_IMAGES.material;
      
      let warehouseCellsHtml = warehouseColsHtml.map(qty => {
        return `<td style="text-align:center; font-weight:600; color:${isCritical ? 'var(--danger)' : 'var(--success)'}">${qty}</td>`;
      }).join("");
      
      tbody.innerHTML += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:40px; height:40px; border-radius:6px; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; cursor:pointer;" onclick="viewMaterialDetail('${m.id}')" title="ดูรูปวัสดุก่อสร้าง">
                <img src="${firstImage}" style="max-height:100%; max-width:100%; object-fit:contain;">
              </div>
              <div>
                <strong style="color:var(--text-primary); font-size:14px;">${m.name}</strong><br>
                <span style="font-size:11px; color:var(--text-muted);">${m.category}</span>
              </div>
            </div>
          </td>
          ${warehouseCellsHtml}
          <td style="font-weight:600;">${totalQty} <span style="font-size:12px; color:var(--text-secondary); font-weight:normal;">${m.unit}</span></td>
          <td>${m.price_per_unit.toLocaleString()} ฿</td>
          <td><strong style="color:var(--accent);">${totalValue.toLocaleString()} ฿</strong></td>
          <td>
            <div class="action-buttons">
              <button class="btn-icon btn-icon-plus" onclick="openReceiveMaterialModal('${m.id}')" title="รับสินค้าเข้าคลังด่วน" style="color:var(--success); background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.2);"><i class="fas fa-plus"></i></button>
              <button class="btn-icon btn-icon-minus" onclick="openWithdrawMaterialModal('${m.id}')" title="เบิกใช้ด่วน" style="color:var(--danger); background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.2);"><i class="fas fa-minus"></i></button>
              <button class="btn-icon btn-icon-edit" onclick="editMaterial('${m.id}')" title="แก้ไขราคา/ค่าแนะนำ"><i class="fas fa-edit"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
  }

  // หน้ารายการเครื่องมือช่าง
  function renderTools() {
    const searchVal = document.getElementById("tool-search").value.toLowerCase();
    const catVal = document.getElementById("tool-cat-filter").value;
    const statusVal = document.getElementById("tool-status-filter").value;
    
    const container = document.getElementById("tools-list-container");
    container.innerHTML = "";
    
    let filtered = AppDB.getTools();
    
    if (searchVal) {
      filtered = filtered.filter(t => t.name.toLowerCase().includes(searchVal) || t.serial_number.toLowerCase().includes(searchVal) || t.current_project.toLowerCase().includes(searchVal));
    }
    if (catVal) {
      filtered = filtered.filter(t => t.category === catVal);
    }
    if (statusVal) {
      filtered = filtered.filter(t => t.status === statusVal);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:30px;">ไม่พบรายการเครื่องมือช่างชิ้นที่ค้นหา</div>';
      return;
    }

    filtered.forEach(t => {
      // คำนวณประกัน
      const today = new Date();
      let warrantyLabel = "";
      let warrantyClass = "";
      if (t.warranty_expiry) {
        const expiry = new Date(t.warranty_expiry);
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          warrantyLabel = "หมดประกันแล้ว";
          warrantyClass = "badge-danger";
        } else {
          warrantyLabel = `ในประกัน (อีก ${diffDays} วัน)`;
          warrantyClass = "badge-success";
        }
      } else {
        warrantyLabel = "ไม่มีข้อมูลประกัน";
        warrantyClass = "badge-warning";
      }

      // แปลงคำศัพท์ไทย
      let statusLabel = "";
      let statusClass = "";
      if (t.status === "usable") { statusLabel = "ใช้งานได้"; statusClass = "badge-success"; }
      else if (t.status === "damaged") {
        if (t.repair_status === "requested") statusLabel = "เสีย (แจ้งส่งซ่อม)";
        else if (t.repair_status === "in_progress") statusLabel = "เสีย (กำลังซ่อม)";
        else if (t.repair_status === "sent_to_shop") statusLabel = "เสีย (ส่งร้านแล้ว)";
        statusClass = "badge-danger";
      }
      else if (t.status === "retired") { statusLabel = "ยุติการใช้งาน"; statusClass = "badge-warning"; }

      const firstImage = (t.images && t.images[0]) || MOCK_IMAGES.drill;

      // รายละเอียดการซ่อมบำรุง
      let repairDetailHtml = "";
      if (t.status === "damaged") {
        const logs = AppDB.getToolLogs().filter(l => l.tool_id === t.id && (l.action === "repair" || l.action === "repair_sent" || l.action === "repair_returned"));
        if (logs.length > 0) {
          logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          const latestLog = logs[0];
          const logDate = new Date(latestLog.timestamp).toLocaleDateString("th-TH");
          if (t.repair_status === "requested") {
            repairDetailHtml = `<div style="font-size:11px; color:var(--danger); margin-top:4px;"><i class="fas fa-info-circle"></i> แจ้งซ่อมโดย ${latestLog.authorizer || latestLog.borrower} เมื่อ ${logDate}</div>`;
          } else {
            repairDetailHtml = `<div style="font-size:11px; color:var(--warning); margin-top:4px;"><i class="fas fa-info-circle"></i> ซ่อมที่: ${latestLog.notes} เมื่อ ${logDate}</div>`;
          }
        }
      }

      // ปุ่มทางลัดยืม/คืนของการ์ด
      let shortcutBtn = "";
      if (t.status === "usable") {
        if (t.current_project === "คลังสินค้ากลาง") {
          shortcutBtn = `<button class="btn btn-primary" style="width:100%; margin-top:8px; padding:6px 12px; font-size:12px; background:var(--accent); border:none;" onclick="openToolBorrowModalShortcut('${t.id}')"><i class="fas fa-sign-out-alt"></i> ยืมเครื่องมือ</button>`;
        } else {
          shortcutBtn = `<button class="btn btn-secondary" style="width:100%; margin-top:8px; padding:6px 12px; font-size:12px; color:var(--info); border:1px solid var(--info); background:rgba(0,180,216,0.05);" onclick="openToolReturnModalShortcut('${t.id}')"><i class="fas fa-sign-in-alt"></i> คืนเครื่องมือ</button>`;
        }
      }

      // แสดงสถานที่เก็บคลังย่อยล่าสุดเมื่ออยู่ในคลังสินค้ากลาง
      let storageLocationText = "";
      if (t.current_project === "คลังสินค้ากลาง") {
        storageLocationText = ` (จัดเก็บที่ ${t.storage_location || 'Stock A'})`;
      }

      container.innerHTML += `
        <div class="card" style="display:flex; flex-direction:column; gap:16px; margin-bottom:0;">
          <div style="height: 140px; background: rgba(255,255,255,0.02); border-radius: 8px; border:1px solid var(--border-color); overflow:hidden; display:flex; align-items:center; justify-content:center;">
            <img src="${firstImage}" style="max-height:100%; max-width:100%; object-fit:contain;" alt="${t.name}">
          </div>
          <div style="flex-grow:1; display:flex; flex-direction:column; gap:4px;">
            <strong style="font-size:15px; display:block; color:var(--text-primary); line-height:1.3;">${t.name}</strong>
            <span style="font-size:11px; color:var(--text-muted);">${t.category}</span>
            <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
              <span class="list-item-badge ${statusClass}">${statusLabel}</span>
              <span class="list-item-badge ${warrantyClass}">${warrantyLabel}</span>
            </div>
            ${repairDetailHtml}
            <div style="margin-top:10px; font-size:12px; display:flex; flex-direction:column; gap:4px;">
              <div><span style="color:var(--text-secondary);">หมายเลขซีเรียล:</span> <code style="color:var(--accent); font-weight:600;">${t.serial_number}</code></div>
              <div><span style="color:var(--text-secondary);">โครงการปัจจุบัน:</span> <strong style="color:var(--info);">${t.current_project}${storageLocationText}</strong></div>
            </div>
          </div>
          <div style="border-top:1px solid var(--border-color); padding-top:12px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:bold; font-size:14px; color:var(--text-primary);">${t.purchase_price.toLocaleString()} ฿</span>
            <div class="action-buttons">
              <button class="btn-icon btn-icon-eye" onclick="viewToolDetail('${t.id}')" title="ดูรายละเอียดร้านค้า/ใบเสร็จ"><i class="fas fa-eye"></i></button>
              <button class="btn-icon btn-icon-transfer" onclick="openTransferToolModal('${t.id}')" title="ย้ายโครงการ"><i class="fas fa-exchange-alt"></i></button>
              <button class="btn-icon btn-icon-edit" onclick="openToolRepairModal('${t.id}')" title="สถานะซ่อม"><i class="fas fa-tools"></i></button>
            </div>
          </div>
          ${shortcutBtn}
        </div>
      `;
    });
  }

  // หน้าล็อกความเคลื่อนไหว (Logs)
  function renderLogs() {
    const searchVal = document.getElementById("log-search").value.toLowerCase();
    const typeVal = document.getElementById("log-type-filter").value;
    
    const tbody = document.getElementById("logs-table-body");
    tbody.innerHTML = "";
    
    // โหลด logs ทั้งสองประเภทมารวมกันและเรียงเวลาล่าสุด
    const matLogs = AppDB.getMaterialLogs().map(l => ({ ...l, logType: "material" }));
    const toolLogs = AppDB.getToolLogs().map(l => ({ ...l, logType: "tool" }));
    
    let combined = [...matLogs, ...toolLogs];
    combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (typeVal === "material") {
      combined = combined.filter(l => l.logType === "material");
    } else if (typeVal === "tool") {
      combined = combined.filter(l => l.logType === "tool");
    }
    
    if (searchVal) {
      combined = combined.filter(l => {
        const name = (l.material_name || l.tool_name || "").toLowerCase();
        const proj = (l.project || l.to_project || "").toLowerCase();
        const borrower = (l.borrower || "").toLowerCase();
        return name.includes(searchVal) || proj.includes(searchVal) || borrower.includes(searchVal);
      });
    }
    
    if (combined.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">ไม่พบประวัติรายการเคลื่อนไหว</td></tr>';
      return;
    }
    
    combined.forEach(l => {
      let icon = "";
      let title = "";
      let detail = "";
      let quantityCol = "-";
      let date = new Date(l.timestamp).toLocaleString("th-TH");
      
      if (l.logType === "material") {
        icon = l.type === "withdraw" ? '<i class="fas fa-arrow-circle-up" style="color:var(--danger);"></i>' : '<i class="fas fa-arrow-circle-down" style="color:var(--success);"></i>';
        title = l.material_name;
        quantityCol = `<strong style="color:${l.type === 'withdraw' ? 'var(--danger)' : 'var(--success)'}">${l.type === 'withdraw' ? '-' : '+'}${l.quantity}</strong>`;
        detail = `
          📌 ${l.type === 'withdraw' ? 'เบิกใช้ที่' : 'รับเข้าคลัง'} <strong>${l.project}</strong> (${l.stock_location})<br>
          🙋‍♂️ ผู้รับของ/ผู้เบิก: ${l.borrower || '-'} | 👮‍♂️ ผู้จ่าย/ผู้อนุมัติ: ${l.authorizer}
        `;
      } else {
        let actionLabel = "";
        let actionColor = "";
        if (l.action === "borrow") { actionLabel = "ยืมใช้"; actionColor = "var(--warning)"; icon = '<i class="fas fa-sign-out-alt" style="color:var(--warning);"></i>'; }
        else if (l.action === "return") { actionLabel = "คืน"; actionColor = "var(--success)"; icon = '<i class="fas fa-sign-in-alt" style="color:var(--success);"></i>'; }
        else if (l.action === "transfer") { actionLabel = "ย้ายโครงการ"; actionColor = "var(--info)"; icon = '<i class="fas fa-random" style="color:var(--info);"></i>'; }
        else if (l.action === "repair_sent") { actionLabel = "ส่งซ่อม"; actionColor = "var(--danger)"; icon = '<i class="fas fa-wrench" style="color:var(--danger);"></i>'; }
        else if (l.action === "repair_returned") { actionLabel = "ซ่อมเสร็จ"; actionColor = "var(--success)"; icon = '<i class="fas fa-wrench" style="color:var(--success);"></i>'; }
        else if (l.action === "retire") { actionLabel = "ยุติการใช้งาน"; actionColor = "var(--text-muted)"; icon = '<i class="fas fa-trash-alt" style="color:var(--text-muted);"></i>'; }
        
        title = l.tool_name;
        detail = `
          🔑 การกระทำ: <strong style="color:${actionColor};">${actionLabel}</strong><br>
          📍 โครงการปลายทาง: <strong>${l.to_project || l.from_project}</strong><br>
          🙋‍♂️ ผู้ใช้เครื่องมือ: ${l.borrower || '-'} | 👮‍♂️ ผู้อนุมัติ: ${l.authorizer}<br>
          📝 หมายเหตุ: <span style="font-style:italic; color:var(--text-secondary);">${l.notes || '-'}</span>
        `;
      }
      
      tbody.innerHTML += `
        <tr>
          <td style="text-align:center; font-size:18px;">${icon}</td>
          <td><span style="font-size:12px; color:var(--text-secondary);">${date}</span></td>
          <td><strong>${title}</strong></td>
          <td style="text-align:center;">${quantityCol}</td>
          <td style="font-size:13px; line-height:1.5;">${detail}</td>
        </tr>
      `;
    });
  }

  // หน้าจัดการพนักงาน (Users) - มีสิทธิ์เฉพาะผู้จัดการ
  function renderUsers() {
    const listContainer = document.getElementById("users-list");
    listContainer.innerHTML = "";
    
    const users = AppDB.getUsers();
    users.forEach(u => {
      let roleThai = translateRole(u.role);
      let statusBadge = u.status === "active" ? '<span class="list-item-badge badge-success">กำลังทำงาน (Active)</span>' : '<span class="list-item-badge badge-danger">พนักงานออก (Inactive)</span>';
      
      listContainer.innerHTML += `
        <div class="list-item" style="padding:16px;">
          <div>
            <div style="font-size:15px; font-weight:600; color:var(--text-primary);">${u.name}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
              ชื่อเข้าระบบ: <code>${u.username}</code> | บทบาท: <strong>${roleThai}</strong>
            </div>
            <div style="margin-top:8px;">${statusBadge}</div>
          </div>
          <div>
            <button class="btn btn-secondary" onclick="editUser('${u.id}')" style="padding: 6px 12px; font-size:12px;"><i class="fas fa-edit"></i> จัดการพนักงาน</button>
          </div>
        </div>
      `;
    });
  }

  // หน้ารายงานสรุปโครงการรายเดือน (Printable Report)
  function renderReports() {
    // กำหนดค่าโครงการใน Dropdown รายงาน
    const projSelect = document.getElementById("report-project-select");
    const existingProjects = new Set();
    existingProjects.add("คลังสินค้ากลาง");
    
    AppDB.getToolLogs().forEach(l => {
      if (l.to_project) existingProjects.add(l.to_project);
      if (l.from_project) existingProjects.add(l.from_project);
    });
    AppDB.getMaterialLogs().forEach(l => {
      if (l.project) existingProjects.add(l.project);
    });
    
    // ดึงค่าโครงการทั้งหมดจากระบบเข้ามาเสริมในรายการ
    AppDB.getProjects().forEach(p => {
      existingProjects.add(p.name);
    });

    // ล้างและเขียนตัวเลือก
    projSelect.innerHTML = '<option value="" disabled selected>-- เลือกวิลล่า / โครงการ --</option>';
    existingProjects.forEach(p => {
      if (!p.includes("ยุติการใช้งาน") && !p.includes("ร้านซ่อม")) {
        const option = document.createElement("option");
        option.value = p;
        option.textContent = p;
        projSelect.appendChild(option);
      }
    });

    // กำหนดค่าเดือนปัจจุบัน
    const monthSelect = document.getElementById("report-month-select");
    if (monthSelect.value === "") {
      const curMonth = new Date().getMonth() + 1;
      monthSelect.value = curMonth.toString();
    }
  }

  // ดำเนินการสร้างตัวรายงานที่สรุปราคารายเดือน
  window.generateMonthlyReport = function() {
    const project = document.getElementById("report-project-select").value;
    const month = parseInt(document.getElementById("report-month-select").value);
    const year = parseInt(document.getElementById("report-year-select").value);
    
    if (!project) {
      alert("กรุณาเลือกโครงการที่ต้องการดูก่อน!");
      return;
    }

    const reportOutput = document.getElementById("report-output-container");
    reportOutput.style.display = "block";

    // 1. ตั้งข้อมูลหัวกระดาษของรายงาน (ใช้ในตอนปริ้นต์)
    document.getElementById("print-report-title").textContent = `รายงานสรุปการใช้วัสดุและเครื่องมือประจำโครงการ: ${project}`;
    document.getElementById("print-report-meta").textContent = `ประจำเดือน: ${getMonthName(month)} พ.ศ. ${year + 543}`;
    
    document.getElementById("ui-report-title").textContent = `โครงการ: ${project}`;
    document.getElementById("ui-report-meta").textContent = `รอบประจำเดือน: ${getMonthName(month)} พ.ศ. ${year + 543}`;

    // 2. ดึงประวัติการใช้วัสดุ (Material Logs) ที่ถูกเบิกออกไปใช้งานในโครงการนั้นๆ ช่วงเดือนและปีที่เลือก
    const matLogs = AppDB.getMaterialLogs().filter(l => {
      const logDate = new Date(l.timestamp);
      return l.project === project && 
             l.type === "withdraw" && 
             (logDate.getMonth() + 1) === month && 
             logDate.getFullYear() === year;
    });

    // รวมยอดวัสดุแยกตาม ID
    let matGroup = {};
    matLogs.forEach(l => {
      if (!matGroup[l.material_id]) {
        matGroup[l.material_id] = {
          name: l.material_name,
          unit: "",
          totalQty: 0,
          batches: [] // เก็บรายละเอียดว่าเบิกราคาชิ้นละเท่าไหร่บ้าง (ต่างล็อต)
        };
      }
      matGroup[l.material_id].totalQty += Number(l.quantity);
      matGroup[l.material_id].batches.push({
        qty: Number(l.quantity),
        price: Number(l.price_at_time) || 0
      });
    });

    // ดึงหน่วยนับ
    const materials = AppDB.getMaterials();
    for (let id in matGroup) {
      const found = materials.find(m => m.id === id);
      if (found) matGroup[id].unit = found.unit;
    }

    // เขียนตารางสรุปวัสดุ
    const matTbody = document.getElementById("report-materials-tbody");
    matTbody.innerHTML = "";
    
    let totalMaterialCost = 0;
    let index = 1;

    if (Object.keys(matGroup).length === 0) {
      matTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">ไม่มีรายการเบิกใช้วัสดุในเดือนนี้</td></tr>';
    } else {
      for (let id in matGroup) {
        const item = matGroup[id];
        
        // แตกแจงรายละเอียดราคาต่อหน่วย
        let priceDetailText = "";
        let rowSumCost = 0;
        
        item.batches.forEach(b => {
          const cost = b.qty * b.price;
          rowSumCost += cost;
          priceDetailText += `${b.qty} ชิ้น x ${b.price.toLocaleString()} ฿<br>`;
        });
        
        totalMaterialCost += rowSumCost;

        matTbody.innerHTML += `
          <tr>
            <td style="text-align:center;">${index++}</td>
            <td><strong>${item.name}</strong></td>
            <td style="text-align:center;">${item.totalQty} ${item.unit}</td>
            <td style="font-size:12px; line-height:1.4;">${priceDetailText}</td>
            <td style="font-weight:600; text-align:right; color:var(--accent);">${rowSumCost.toLocaleString()} ฿</td>
          </tr>
        `;
      }
    }

    // 3. ดึงเครื่องมือที่เข้ามาทำงานในโครงการนี้ในรอบเดือน
    const toolLogs = AppDB.getToolLogs().filter(l => {
      const logDate = new Date(l.timestamp);
      return l.to_project === project && 
             l.action === "borrow" && 
             (logDate.getMonth() + 1) === month && 
             logDate.getFullYear() === year;
    });

    const toolTbody = document.getElementById("report-tools-tbody");
    toolTbody.innerHTML = "";
    let toolIndex = 1;

    if (toolLogs.length === 0) {
      toolTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">ไม่มีเครื่องมือช่างที่ถูกเบิกเข้ามาใช้งาน</td></tr>';
    } else {
      toolLogs.forEach(l => {
        // หาข้อมูลราคาเครื่องมือเพื่อดูมูลค่ารวมของสินทรัพย์
        const toolObj = AppDB.getTools().find(t => t.id === l.tool_id);
        const price = toolObj ? toolObj.purchase_price : 0;
        const serial = toolObj ? toolObj.serial_number : "-";
        
        toolTbody.innerHTML += `
          <tr>
            <td style="text-align:center;">${toolIndex++}</td>
            <td><strong>${l.tool_name}</strong></td>
            <td style="text-align:center;"><code>${serial}</code></td>
            <td>${l.borrower} (ผู้อนุมัติ: ${l.authorizer})</td>
            <td style="text-align:right;">${price.toLocaleString()} ฿</td>
          </tr>
        `;
      });
    }

    // สรุปยอดเงินรวม
    document.getElementById("report-summary-value").textContent = totalMaterialCost.toLocaleString() + " บาท";
  };

  // หน้าตั้งค่าการซิงก์ระบบ
  function renderSettings() {
    const settings = AppDB.getSettings();
    document.getElementById("settings-sheet-url").value = settings.googleSheetUrl || "";
    document.getElementById("settings-telegram-token").value = settings.telegramBotToken || "";
    document.getElementById("settings-telegram-chatid").value = settings.telegramChatId || "";
  }

  // --- 4. ระบบการเพิ่ม/แก้ไขวัสดุ & เครื่องมือช่าง (Forms) ---
  
  // เปิดกล้องจำลองระบบ OCR
  window.triggerMockOCRScan = function() {
    const overlay = document.getElementById("ocr-scan-overlay");
    overlay.className = "scanner-overlay active";
    document.getElementById("ocr-scan-text").textContent = "กำลังสแกนหาข้อความและเลขซีเรียล...";
    
    // ตั้งค่าตัวเลือกเครื่องมือจำลองเพื่อสแกนออโต้หลังผ่านไป 2.5 วินาที
    setTimeout(() => {
      // แกล้งจำลองการอ่านค่า OCR จากภาพถ่าย
      const mockScannedData = {
        name: "สว่านกระแทกโรตารี่ Bosch GBH 2-26 DFR",
        brand: "Bosch",
        model: "GBH 2-26 DFR",
        serial: "BS-" + Math.floor(Math.random() * 900000 + 100000),
        category: "เครื่องมือไฟฟ้า",
        shop: "ไทวัสดุ สาขาสมุย",
        price: 5900,
        warranty: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // ประกัน 1 ปี
      };

      document.getElementById("ocr-scan-text").textContent = "✅ สแกนสำเร็จ!";
      
      // นำค่าไปใส่ในฟอร์มการเพิ่มเครื่องมือโดยอัตโนมัติ
      document.getElementById("tool-name").value = mockScannedData.name;
      document.getElementById("tool-category").value = mockScannedData.category;
      document.getElementById("tool-serial").value = mockScannedData.serial;
      document.getElementById("tool-shop").value = mockScannedData.shop;
      document.getElementById("tool-price").value = mockScannedData.price;
      document.getElementById("tool-warranty").value = mockScannedData.warranty;

      // แนบรูปจำลองเข้าไปในภาพเครื่องมือ
      tempUploadedImages = [MOCK_IMAGES.drill, MOCK_IMAGES.receipt, MOCK_IMAGES.warranty];
      updateTempImagesPreview();

      // ปิดกล้องสแกนหลังจากนั้น 1 วินาที
      setTimeout(() => {
        overlay.className = "scanner-overlay";
      }, 1000);
    }, 2500);
  };

  // ดึงค่าภาพตัวอย่างชั่วคราว
  function updateTempImagesPreview() {
    const container = document.getElementById("tool-images-preview");
    container.innerHTML = "";
    
    tempUploadedImages.forEach((img, index) => {
      container.innerHTML += `
        <div class="image-preview-wrapper">
          <img src="${img}" alt="Preview ${index + 1}">
          <button class="btn-delete-img" onclick="removeTempImage(${index})"><i class="fas fa-times"></i></button>
        </div>
      `;
    });

    // สลักปุ่มอัปโหลดรูปให้จำกัดไม่เกิน 5 รูป
    if (tempUploadedImages.length < 5) {
      container.innerHTML += `
        <label class="image-upload-trigger">
          <i class="fas fa-camera"></i>
          <span>เพิ่มรูปภาพ</span>
          <input type="file" accept="image/*" style="display:none;" onchange="handleImageFileSelect(event)">
        </label>
      `;
    }
  }

  // การทำงานตอนเลือกรูปภาพ
  window.handleImageFileSelect = function(e) {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = function(evt) {
        tempUploadedImages.push(evt.target.result); // บันทึกในรูป Base64 DataURL
        updateTempImagesPreview();
      };
      reader.readAsDataURL(file);
    }
  };

  window.removeTempImage = function(index) {
    tempUploadedImages.splice(index, 1);
    updateTempImagesPreview();
  };

  // ดึงค่าภาพตัวอย่างวัสดุชั่วคราว
  function updateTempMatImagesPreview(isEdit = false) {
    const containerId = isEdit ? "mat-edit-images-preview" : "mat-images-preview";
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    
    tempUploadedMatImages.forEach((img, index) => {
      container.innerHTML += `
        <div class="image-preview-wrapper">
          <img src="${img}" alt="Preview ${index + 1}">
          <button type="button" class="btn-delete-img" onclick="removeTempMatImage(${index}, ${isEdit})"><i class="fas fa-times"></i></button>
        </div>
      `;
    });

    if (tempUploadedMatImages.length < 5) {
      container.innerHTML += `
        <label class="image-upload-trigger">
          <i class="fas fa-camera"></i>
          <span>เพิ่มรูปภาพ</span>
          <input type="file" accept="image/*" style="display:none;" onchange="handleMatImageFileSelect(event, ${isEdit})">
        </label>
      `;
    }
  }

  window.handleMatImageFileSelect = function(e, isEdit) {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = function(evt) {
        tempUploadedMatImages.push(evt.target.result); // บันทึกในรูป Base64 DataURL
        updateTempMatImagesPreview(isEdit);
      };
      reader.readAsDataURL(file);
    }
  };

  window.removeTempMatImage = function(index, isEdit) {
    tempUploadedMatImages.splice(index, 1);
    updateTempMatImagesPreview(isEdit);
  };

  // จัดการฟอร์มบันทึกเครื่องมือ
  window.handleSaveToolSubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("tool-form-id").value;
    const name = document.getElementById("tool-name").value;
    const category = document.getElementById("tool-category").value;
    const serial = document.getElementById("tool-serial").value;
    const shop = document.getElementById("tool-shop").value;
    const pDate = document.getElementById("tool-pdate").value || new Date().toISOString().split('T')[0];
    const price = Number(document.getElementById("tool-price").value) || 0;
    const warranty = document.getElementById("tool-warranty").value;

    const toolData = {
      name: name,
      category: category,
      serial_number: serial,
      purchase_shop: shop,
      purchase_date: pDate,
      purchase_price: price,
      warranty_expiry: warranty,
      images: tempUploadedImages.length > 0 ? tempUploadedImages : [MOCK_IMAGES.drill]
    };

    if (id) {
      // แก้ไขเครื่องมือเดิม
      toolData.id = id;
      const original = AppDB.getTools().find(t => t.id === id);
      toolData.status = original.status;
      toolData.repair_status = original.repair_status;
      toolData.repair_date = original.repair_date;
      toolData.current_project = original.current_project;
      AppDB.updateTool(toolData);
    } else {
      // เพิ่มเครื่องมือชิ้นใหม่เข้าระบบคลังกลาง
      toolData.status = "usable";
      toolData.repair_status = "none";
      toolData.repair_date = "";
      toolData.current_project = "คลังสินค้ากลาง";
      AppDB.addTool(toolData);
    }

    closeModal("tool-form-modal");
    renderAllViews();
  };

  // แก้ไขวัสดุเดิม
  window.editMaterial = function(id) {
    const materials = AppDB.getMaterials();
    const mat = materials.find(m => m.id === id);
    if (!mat) return;

    document.getElementById("mat-form-id").value = mat.id;
    document.getElementById("mat-form-name").textContent = mat.name;
    document.getElementById("mat-form-price").value = mat.price_per_unit;
    document.getElementById("mat-form-min").value = mat.min_stock;

    tempUploadedMatImages = mat.images ? [...mat.images] : [];
    updateTempMatImagesPreview(true);

    openModal("material-edit-modal");
  };

  window.handleEditMaterialSubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("mat-form-id").value;
    const price = Number(document.getElementById("mat-form-price").value) || 0;
    const min = Number(document.getElementById("mat-form-min").value) || 0;

    const materials = AppDB.getMaterials();
    const original = materials.find(m => m.id === id);
    if (original) {
      original.price_per_unit = price;
      original.min_stock = min;
      original.images = tempUploadedMatImages;
      AppDB.updateMaterial(original);
    }

    closeModal("material-edit-modal");
    renderAllViews();
  };

  // เพิ่มสินค้าวัสดุใหม่ผ่านหน้าจอแอปพลิเคชัน
  window.openAddMaterialModal = function() {
    document.getElementById("add-mat-form").reset();
    tempUploadedMatImages = [];
    updateTempMatImagesPreview(false);
    
    // โหลดอินพุตจำนวนคลังย่อยตามคลังที่มีอยู่จริง
    const warehouses = AppDB.getWarehouses();
    const stocksContainer = document.getElementById("add-mat-stocks-container");
    if (stocksContainer) {
      stocksContainer.innerHTML = warehouses.map(wh => {
        const fieldId = "add-mat-" + wh.code.toLowerCase().replace(" ", "");
        return `
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" style="font-size:11px;">${wh.name}</label>
            <input type="number" id="${fieldId}" class="form-control" value="0">
          </div>
        `;
      }).join("");
    }
    
    // ตั้งค่ารายชื่อแนะนำ Autocomplete ชื่อวัสดุจากของเดิมที่มีอยู่
    const matList = AppDB.getMaterials();
    window.setAutocompleteItems("add-mat-name", matList.map(m => m.name));
    
    openModal("material-add-modal");
  };

  window.handleAddMaterialSubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById("add-mat-name").value;
    const category = document.getElementById("add-mat-category").value;
    const unit = document.getElementById("add-mat-unit").value;
    const price = Number(document.getElementById("add-mat-price").value) || 0;
    const min = Number(document.getElementById("add-mat-min").value) || 0;

    const warehouses = AppDB.getWarehouses();
    const newMat = {
      name: name,
      category: category,
      unit: unit,
      price_per_unit: price,
      min_stock: min,
      images: tempUploadedMatImages
    };

    // Initialize all stock values to 0
    newMat.stock_a_qty = 0;
    newMat.stock_b_qty = 0;
    newMat.stock_c_qty = 0;
    newMat.stock_d_qty = 0;
    newMat.stock_e_qty = 0;

    // Pull values from dynamic fields
    warehouses.forEach(wh => {
      const fieldId = "add-mat-" + wh.code.toLowerCase().replace(" ", "");
      const inputEl = document.getElementById(fieldId);
      const qty = inputEl ? Number(inputEl.value) || 0 : 0;
      const fieldName = wh.code.toLowerCase().replace(" ", "_") + "_qty";
      newMat[fieldName] = qty;
    });

    const savedMat = AppDB.addMaterial(newMat);
    
    // บันทึกประวัติการรับเข้าครั้งแรกแยกแต่ละสต็อก
    const curUser = currentUser ? currentUser.name : "ระบบแอป";
    warehouses.forEach(wh => {
      const fieldName = wh.code.toLowerCase().replace(" ", "_") + "_qty";
      const qty = newMat[fieldName] || 0;
      if (qty > 0) {
        AppDB.transactMaterial({ 
          project: "คลังสินค้ากลาง", 
          material_id: savedMat.id, 
          material_name: name, 
          quantity: qty, 
          price_at_time: price, 
          stock_location: wh.code, 
          type: "receive", 
          borrower: curUser, 
          authorizer: curUser 
        });
      }
    });

    closeModal("material-add-modal");
    renderAllViews();
  };

  // --- 5. ตรรกะการทำธุรกรรม (Transactions) ---
  
  // ก) หน้าเบิกสินค้าวัสดุออกไปใช้งานโครงการ
  window.openWithdrawMaterialModal = function(preselectedId = null) {
    document.getElementById("withdraw-mat-form").reset();
    
    // ตั้งพนักงานอนุมัติค่าเริ่มต้นเป็นคนล็อกอิน
    document.getElementById("withdraw-mat-auth").value = currentUser ? currentUser.name : "";
    document.getElementById("withdraw-mat-qty-label").textContent = "กรุณาเลือกวัสดุเพื่อดูยอดคงเหลือ";
    
    const warehouses = AppDB.getWarehouses();
    const select = document.getElementById("withdraw-mat-location");
    select.innerHTML = warehouses.map(wh => `<option value="${wh.code}">${wh.name}</option>`).join("");

    // อัปเดตลิสต์พนักงานสำหรับ Autocomplete ดึงมาเฉพาะ Role manager/stock_keeper
    const authList = AppDB.getUsers().filter(u => u.status === "active").map(u => u.name);
    window.setAutocompleteItems("withdraw-mat-auth", authList);
    
    // อัปเดตลิสต์วัสดุทั้งหมด
    const matList = AppDB.getMaterials();
    window.setAutocompleteItems("withdraw-mat-name", matList.map(m => m.name));

    if (preselectedId) {
      const mat = matList.find(m => m.id === preselectedId);
      if (mat) {
        document.getElementById("withdraw-mat-name").value = mat.name;
        setTimeout(() => updateWithdrawStockHint(mat.name), 50);
      }
    }

    openModal("withdraw-material-modal");
  };

  window.handleWithdrawMaterialSubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById("withdraw-mat-name").value;
    const project = document.getElementById("withdraw-mat-project").value;
    const location = document.getElementById("withdraw-mat-location").value; // Stock A, B, C
    const qty = Number(document.getElementById("withdraw-mat-qty").value);
    const borrower = document.getElementById("withdraw-mat-borrower").value;
    const authorizer = document.getElementById("withdraw-mat-auth").value;

    const materials = AppDB.getMaterials();
    const mat = materials.find(m => m.name === name);
    if (!mat) {
      alert("ไม่พบวัสดุชื่อนี้ในคลังสินค้า กรุณาเลือกรายการที่ปรากฏในแอปพลิเคชัน!");
      return;
    }

    try {
      AppDB.transactMaterial({
        project: project,
        material_id: mat.id,
        material_name: mat.name,
        quantity: qty,
        price_at_time: mat.price_per_unit, // บันทึกราคาทุนต่อชิ้น ณ ขณะเบิก
        stock_location: location,
        type: "withdraw",
        borrower: borrower,
        authorizer: authorizer
      });
      closeModal("withdraw-material-modal");
      renderAllViews();
    } catch (err) {
      alert(err.message);
    }
  };

  // ข) หน้าการรับสินค้าวัสดุเข้าคลังเพิ่ม
  window.openReceiveMaterialModal = function() {
    document.getElementById("receive-mat-form").reset();
    document.getElementById("receive-mat-auth").value = currentUser ? currentUser.name : "";

    const matList = AppDB.getMaterials();
    window.setAutocompleteItems("receive-mat-name", matList.map(m => m.name));
    
    const usersList = AppDB.getUsers().filter(u => u.status === "active").map(u => u.name);
    window.setAutocompleteItems("receive-mat-auth", usersList);
    window.setAutocompleteItems("receive-mat-borrower", usersList);

    openModal("receive-material-modal");
  };

  window.handleReceiveMaterialSubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById("receive-mat-name").value;
    const location = document.getElementById("receive-mat-location").value;
    const qty = Number(document.getElementById("receive-mat-qty").value);
    const price = Number(document.getElementById("receive-mat-price").value) || 0;
    const supplier = document.getElementById("receive-mat-borrower").value; // ผู้จัดส่ง/ผู้ซื้อ
    const authorizer = document.getElementById("receive-mat-auth").value;

    const materials = AppDB.getMaterials();
    let mat = materials.find(m => m.name === name);
    if (!mat) {
      alert("ไม่พบวัสดุก่อสร้างในระบบ กรุณากดปุ่ม 'เพิ่มวัสดุใหม่' ก่อนหากไม่มีของตัวนี้คลัง!");
      return;
    }

    // ปรับปรุงราคากลางหากราคาต่างจากเดิม
    if (price > 0 && price !== mat.price_per_unit) {
      mat.price_per_unit = price;
      AppDB.updateMaterial(mat);
    }

    AppDB.transactMaterial({
      project: "คลังสินค้ากลาง",
      material_id: mat.id,
      material_name: mat.name,
      quantity: qty,
      price_at_time: price > 0 ? price : mat.price_per_unit,
      stock_location: location,
      type: "receive",
      borrower: supplier,
      authorizer: authorizer
    });

    closeModal("receive-material-modal");
    renderAllViews();
  };

  // ค) ระบบยืม/คืนเครื่องมือช่างและโยกย้าย
  window.openToolBorrowModal = function() {
    document.getElementById("borrow-tool-form").reset();
    document.getElementById("borrow-tool-auth").value = currentUser ? currentUser.name : "";

    // ดึงเฉพาะเครื่องมือที่อยู่ในคลังกลางและพร้อมใช้
    const toolList = AppDB.getTools().filter(t => t.current_project === "คลังสินค้ากลาง" && t.status === "usable");
    window.setAutocompleteItems("borrow-tool-name", toolList.map(t => t.name));

    const usersList = AppDB.getUsers().filter(u => u.status === "active").map(u => u.name);
    window.setAutocompleteItems("borrow-tool-borrower", usersList);
    window.setAutocompleteItems("borrow-tool-auth", usersList);

    openModal("borrow-tool-modal");
  };

  window.handleBorrowToolSubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById("borrow-tool-name").value;
    const project = document.getElementById("borrow-tool-project").value;
    const borrower = document.getElementById("borrow-tool-borrower").value;
    const authorizer = document.getElementById("borrow-tool-auth").value;
    const notes = document.getElementById("borrow-tool-notes").value;

    const tools = AppDB.getTools();
    const tool = tools.find(t => t.name === name && t.current_project === "คลังสินค้ากลาง");
    if (!tool) {
      alert("ไม่พบเครื่องมือช่างชิ้นนี้พร้อมใช้ในคลังกลาง!");
      return;
    }

    AppDB.transactTool({
      action: "borrow",
      tool_id: tool.id,
      tool_name: tool.name,
      from_project: "คลังสินค้ากลาง",
      to_project: project,
      borrower: borrower,
      authorizer: authorizer,
      notes: notes
    });

    closeModal("borrow-tool-modal");
    renderAllViews();
  };

  // ง) หน้าการคืนเครื่องมือช่าง
  window.openToolReturnModal = function() {
    document.getElementById("return-tool-form").reset();
    document.getElementById("return-tool-auth").value = currentUser ? currentUser.name : "";

    // ค้นหาเครื่องมือทั้งหมดที่ไม่ได้อยู่คลังกลาง
    const borrowedTools = AppDB.getTools().filter(t => t.current_project !== "คลังสินค้ากลาง" && t.status !== "retired");
    window.setAutocompleteItems("return-tool-name", borrowedTools.map(t => t.name));

    const usersList = AppDB.getUsers().filter(u => u.status === "active").map(u => u.name);
    window.setAutocompleteItems("return-tool-borrower", usersList);
    window.setAutocompleteItems("return-tool-auth", usersList);

    // โหลดคลังย่อยจัดเก็บสำหรับรับคืน
    const warehouses = AppDB.getWarehouses();
    const returnLocationSelect = document.getElementById("return-tool-location");
    if (returnLocationSelect) {
      returnLocationSelect.innerHTML = warehouses.map(wh => `<option value="${wh.code}">${wh.name}</option>`).join("");
    }

    openModal("return-tool-modal");
  };

  window.handleReturnToolSubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById("return-tool-name").value;
    const returnCondition = document.getElementById("return-tool-condition").value; // usable / damaged
    const borrower = document.getElementById("return-tool-borrower").value;
    const authorizer = document.getElementById("return-tool-auth").value;
    const returnLocation = document.getElementById("return-tool-location").value;
    let notes = document.getElementById("return-tool-notes").value;

    const tools = AppDB.getTools();
    const tool = tools.find(t => t.name === name && t.current_project !== "คลังสินค้ากลาง");
    if (!tool) {
      alert("เครื่องมือนี้ไม่มีบันทึกว่าอยู่นอกคลัง!");
      return;
    }

    if (returnCondition === "damaged") {
      notes = "⛔ คืนอุปกรณ์ชำรุดเสียหาย! " + notes;
    }

    AppDB.transactTool({
      action: "return",
      tool_id: tool.id,
      tool_name: tool.name,
      from_project: tool.current_project,
      to_project: "คลังสินค้ากลาง",
      borrower: borrower,
      authorizer: authorizer,
      storage_location: returnLocation,
      notes: notes
    });

    closeModal("return-tool-modal");
    renderAllViews();
  };

  // จ) ระบบโยกย้ายเครื่องมือระหว่างโครงการแบบเร็ว
  window.openTransferToolModal = function(id) {
    const tool = AppDB.getTools().find(t => t.id === id);
    if (!tool) return;

    document.getElementById("trans-tool-id").value = tool.id;
    document.getElementById("trans-tool-name").textContent = tool.name;
    document.getElementById("trans-tool-from").textContent = tool.current_project;
    document.getElementById("trans-tool-auth").value = currentUser ? currentUser.name : "";

    const usersList = AppDB.getUsers().filter(u => u.status === "active").map(u => u.name);
    window.setAutocompleteItems("trans-tool-borrower", usersList);
    window.setAutocompleteItems("trans-tool-auth", usersList);

    openModal("transfer-tool-modal");
  };

  window.handleTransferToolSubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("trans-tool-id").value;
    const toProject = document.getElementById("trans-tool-to").value;
    const borrower = document.getElementById("trans-tool-borrower").value;
    const authorizer = document.getElementById("trans-tool-auth").value;
    const notes = document.getElementById("trans-tool-notes").value;

    const tool = AppDB.getTools().find(t => t.id === id);
    if (!tool) return;

    AppDB.transactTool({
      action: "transfer",
      tool_id: tool.id,
      tool_name: tool.name,
      from_project: tool.current_project,
      to_project: toProject,
      borrower: borrower,
      authorizer: authorizer,
      notes: "โยกย้าย: " + notes
    });

    closeModal("transfer-tool-modal");
    renderAllViews();
  };

  // ฉ) แผงส่งซ่อมและการติดตามสถานะ
  window.openToolRepairModal = function(id) {
    const tool = AppDB.getTools().find(t => t.id === id);
    if (!tool) return;

    document.getElementById("repair-tool-id").value = tool.id;
    document.getElementById("repair-tool-name").textContent = tool.name;
    document.getElementById("repair-tool-sn").textContent = tool.serial_number;
    document.getElementById("repair-tool-status").value = tool.repair_status === "none" ? "requested" : tool.repair_status;
    document.getElementById("repair-tool-auth").value = currentUser ? currentUser.name : "";

    // แสดงประวัติการทำรายการซ่อม (Timeline)
    renderRepairTimeline(tool);

    const usersList = AppDB.getUsers().filter(u => u.status === "active").map(u => u.name);
    window.setAutocompleteItems("repair-tool-auth", usersList);

    openModal("repair-tool-modal");
  };

  function renderRepairTimeline(tool) {
    const container = document.getElementById("repair-timeline-container");
    container.innerHTML = "";

    const steps = [
      { key: "requested", label: "แจ้งส่งซ่อม (Requested)", desc: "บันทึกข้อมูลอาการเสียหายของอุปกรณ์" },
      { key: "in_progress", label: "กำลังดำเนินการซ่อม (In Progress)", desc: "กำลังซ่อมแซมชั่วคราวหรือประเมินอาการ" },
      { key: "sent_to_shop", label: "ส่งร้านภายนอก (Sent to Shop)", desc: "ส่งต่อไปยังศูนย์บริการช่างซ่อมมืออาชีพ" },
      { key: "repaired", label: "ซ่อมเสร็จแล้ว (Repaired/Usable)", desc: "ซ่อมเรียบร้อย ส่งคืนเข้าคลังพร้อมใช้" }
    ];

    const logs = AppDB.getToolLogs().filter(l => l.tool_id === tool.id && (l.action === "repair" || l.action === "repair_sent" || l.action === "repair_returned"));
    // group by repair_status to get the latest log for each status
    const stepLogs = {};
    logs.forEach(l => {
      if (l.repair_status) {
        stepLogs[l.repair_status] = l;
      }
    });

    let currentStatus = tool.repair_status;
    let reachedActive = false;

    steps.forEach(step => {
      let stepClass = "";
      if (currentStatus === "none") {
        stepClass = "";
      } else if (step.key === currentStatus) {
        stepClass = "active";
        reachedActive = true;
      } else if (!reachedActive) {
        stepClass = "completed";
      }

      let stepDescHtml = `<span style="color:var(--text-muted);">${step.desc}</span>`;
      const stepLog = stepLogs[step.key];
      if (stepLog) {
        const formattedDate = new Date(stepLog.timestamp).toLocaleString("th-TH", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit"
        });
        stepDescHtml = `
          <div style="font-size:11px; margin-top:4px; line-height:1.4;">
            <span style="color:var(--text-primary); font-weight:500;">📅 บันทึกเมื่อ: ${formattedDate}</span><br>
            <span style="color:var(--text-secondary);">👤 ผู้บันทึก: ${stepLog.authorizer || stepLog.borrower || '-'}</span><br>
            ${stepLog.notes ? `<span style="color:var(--accent); font-weight:500;">📝 หมายเหตุ: ${stepLog.notes}</span>` : ''}
          </div>
        `;
      }

      container.innerHTML += `
        <div class="timeline-step ${stepClass}">
          <div class="step-marker-container">
            <div class="step-marker"></div>
            <div class="step-line"></div>
          </div>
          <div class="step-content">
            <div class="step-title">${step.label}</div>
            <div class="step-desc">${stepDescHtml}</div>
          </div>
        </div>
      `;
    });
  }

  window.handleToolRepairSubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("repair-tool-id").value;
    const repairStatus = document.getElementById("repair-tool-status").value;
    const authorizer = document.getElementById("repair-tool-auth").value;
    const notes = document.getElementById("repair-tool-notes").value;

    const tool = AppDB.getTools().find(t => t.id === id);
    if (!tool) return;

    AppDB.transactTool({
      action: "repair",
      tool_id: tool.id,
      tool_name: tool.name,
      repair_status: repairStatus,
      from_project: tool.current_project,
      to_project: repairStatus === "repaired" ? "คลังสินค้ากลาง" : "ร้านซ่อม/โรงประเมิน",
      borrower: currentUser ? currentUser.name : "แอปหลัก",
      authorizer: authorizer,
      notes: notes
    });

    closeModal("repair-tool-modal");
    renderAllViews();
  };

  // ช) หน้ากดยื่นเกษียณ/ยุติการใช้งานเครื่องมือ
  window.triggerRetireTool = function() {
    const id = document.getElementById("repair-tool-id").value;
    const authorizer = document.getElementById("repair-tool-auth").value;
    const reason = prompt("กรุณาระบุเหตุผลการยุติการใช้งาน (เช่น: พังพินาศซ่อมไม่ได้, สูญหายที่หน้างาน, อุปกรณ์หมดความปลอดภัย):");
    
    if (!reason) return;

    const tool = AppDB.getTools().find(t => t.id === id);
    if (!tool) return;

    AppDB.transactTool({
      action: "retire",
      tool_id: tool.id,
      tool_name: tool.name,
      from_project: tool.current_project,
      to_project: "จำหน่ายออกจากระบบคลัง",
      borrower: currentUser ? currentUser.name : "ผู้ดูแล",
      authorizer: authorizer || (currentUser ? currentUser.name : ""),
      notes: reason
    });

    closeModal("repair-tool-modal");
    renderAllViews();
  };

  // --- 6. ดูภาพจำลองและข้อมูลจัดซื้ออย่างละเอียด ---
  window.viewToolDetail = function(id) {
    const tool = AppDB.getTools().find(t => t.id === id);
    if (!tool) return;

    document.getElementById("detail-tool-name").textContent = tool.name;
    document.getElementById("detail-tool-sn").textContent = tool.serial_number;
    document.getElementById("detail-tool-shop").textContent = tool.purchase_shop;
    document.getElementById("detail-tool-pdate").textContent = tool.purchase_date;
    document.getElementById("detail-tool-price").textContent = tool.purchase_price.toLocaleString() + " บาท";
    document.getElementById("detail-tool-warranty").textContent = tool.warranty_expiry || "ไม่มีการรับประกัน";

    // ตั้งค่ารูปหลักและลิสต์ Thumbnail
    const mainImg = document.getElementById("detail-main-img-el");
    const thumbContainer = document.getElementById("detail-thumbnails-container");
    
    const images = tool.images && tool.images.length > 0 ? tool.images : [MOCK_IMAGES.drill];
    mainImg.src = images[0];
    
    thumbContainer.innerHTML = "";
    images.forEach((img, idx) => {
      thumbContainer.innerHTML += `
        <div class="detail-thumbnail ${idx === 0 ? 'active' : ''}" onclick="changeDetailMainImage(this, '${img}')">
          <img src="${img}" alt="Thumb ${idx + 1}">
        </div>
      `;
    });

    openModal("tool-detail-modal");
  };

  window.changeDetailMainImage = function(el, src) {
    document.getElementById("detail-main-img-el").src = src;
    document.querySelectorAll(".detail-thumbnail").forEach(t => t.classList.remove("active"));
    el.classList.add("active");
  };

  // ดูภาพจำลองและข้อมูลวัสดุอย่างละเอียด
  window.viewMaterialDetail = function(id) {
    const mat = AppDB.getMaterials().find(m => m.id === id);
    if (!mat) return;

    const mainImg = document.getElementById("detail-mat-main-img-el");
    const thumbContainer = document.getElementById("detail-mat-thumbnails-container");
    
    const images = mat.images && mat.images.length > 0 ? mat.images : [MOCK_IMAGES.material];
    mainImg.src = images[0];
    
    thumbContainer.innerHTML = "";
    images.forEach((img, idx) => {
      thumbContainer.innerHTML += `
        <div class="detail-thumbnail ${idx === 0 ? 'active' : ''}" onclick="changeMatDetailMainImage(this, '${img}')">
          <img src="${img}" alt="Thumb ${idx + 1}">
        </div>
      `;
    });

    openModal("material-detail-modal");
  };

  window.changeMatDetailMainImage = function(el, src) {
    document.getElementById("detail-mat-main-img-el").src = src;
    document.querySelectorAll("#detail-mat-thumbnails-container .detail-thumbnail").forEach(t => t.classList.remove("active"));
    el.classList.add("active");
  };

  // --- 7. การจัดการพนักงาน (User CRUD) ---
  window.openAddUserModal = function() {
    document.getElementById("user-form-el").reset();
    document.getElementById("user-form-id").value = "";
    document.getElementById("user-modal-title").textContent = "เพิ่มพนักงานใหม่";
    openModal("user-modal");
  };

  window.editUser = function(id) {
    const user = AppDB.getUsers().find(u => u.id === id);
    if (!user) return;

    document.getElementById("user-form-id").value = user.id;
    document.getElementById("user-username").value = user.username;
    document.getElementById("user-password").value = user.password;
    document.getElementById("user-name").value = user.name;
    document.getElementById("user-role").value = user.role;
    document.getElementById("user-status").value = user.status;
    
    document.getElementById("user-modal-title").textContent = "แก้ไขข้อมูลพนักงาน";
    openModal("user-modal");
  };

  window.handleUserSubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("user-form-id").value;
    const username = document.getElementById("user-username").value;
    const password = document.getElementById("user-password").value;
    const name = document.getElementById("user-name").value;
    const role = document.getElementById("user-role").value;
    const status = document.getElementById("user-status").value;

    const userData = {
      username: username,
      password: password,
      name: name,
      role: role,
      status: status
    };

    if (id) {
      userData.id = id;
      AppDB.updateUser(userData);
    } else {
      AppDB.addUser(userData);
    }

    closeModal("user-modal");
    renderAllViews();
  };

  // --- 8. บันทึกข้อมูลและซิงก์ Google Sheets ---
  function validateSheetUrl(sheetUrl) {
    if (!sheetUrl) return true;
    if (sheetUrl.includes("script.google.com") && (sheetUrl.includes("home/projects") || sheetUrl.includes("/projects/"))) {
      alert("⚠️ ลิงก์ไม่ถูกต้อง!\n\nลิงก์ที่คุณกรอกเป็นลิงก์หน้าแก้ไขโค้ด (Script Editor)\n\nกรุณาทำการ Deploy (การใช้งานจริง) ในหน้า Apps Script จากนั้นคัดลอก 'Web App URL' (ที่ขึ้นต้นด้วย https://script.google.com/macros/s/...) มาใส่แทน");
      return false;
    }
    return true;
  }

  window.handleSaveSettings = function(e) {
    try {
      e.preventDefault();
      let sheetUrl = document.getElementById("settings-sheet-url").value.trim();
      const botToken = document.getElementById("settings-telegram-token").value.trim();
      const chatId = document.getElementById("settings-telegram-chatid").value.trim();

      // ป้องกันข้อผิดพลาดกรณีผู้ใช้ลืมใส่โปรโตคอล URL
      if (sheetUrl && !sheetUrl.startsWith("http://") && !sheetUrl.startsWith("https://")) {
        sheetUrl = "https://" + sheetUrl;
      }

      // ตรวจสอบความถูกต้องของลิงก์โครงการ Apps Script
      if (!validateSheetUrl(sheetUrl)) {
        return;
      }

      // ระบบช่วยกรอกอัตโนมัติ: เติม /exec หากเป็นลิงก์ Google Macro แต่ลืมใส่ตัวลงท้าย
      if (sheetUrl && sheetUrl.includes("script.google.com") && !sheetUrl.endsWith("/exec")) {
        if (sheetUrl.endsWith("/")) {
          sheetUrl += "exec";
        } else {
          sheetUrl += "/exec";
        }
      }

      // อัปเดตในช่องกรอกบนหน้าจอทันที
      document.getElementById("settings-sheet-url").value = sheetUrl;

      AppDB.saveSettings({
        googleSheetUrl: sheetUrl,
        telegramBotToken: botToken,
        telegramChatId: chatId
      });

      alert("บันทึกการตั้งค่าลงเครื่องเรียบร้อย!");
      renderAllViews();
    } catch (err) {
      alert("❌ เกิดข้อผิดพลาดในการบันทึกค่า:\n" + err.message + "\n\n" + err.stack);
    }
  };

  window.triggerGoogleSheetsSync = async function() {
    const btn = document.getElementById("btn-sync-sheets");
    const logBox = document.getElementById("sync-log-box");
    
    try {
      // ดึงค่าและบันทึกข้อมูลการตั้งค่าโดยอัตโนมัติก่อนทำการซิงก์ เพื่อความสะดวก
      let sheetUrl = document.getElementById("settings-sheet-url").value.trim();
      const botToken = document.getElementById("settings-telegram-token").value.trim();
      const chatId = document.getElementById("settings-telegram-chatid").value.trim();

      // ป้องกันข้อผิดพลาดกรณีผู้ใช้ลืมใส่โปรโตคอล URL
      if (sheetUrl && !sheetUrl.startsWith("http://") && !sheetUrl.startsWith("https://")) {
        sheetUrl = "https://" + sheetUrl;
      }

      // ตรวจสอบความถูกต้องของลิงก์โครงการ Apps Script
      if (!validateSheetUrl(sheetUrl)) {
        return;
      }

      // ระบบช่วยกรอกอัตโนมัติ: เติม /exec หากเป็นลิงก์ Google Macro แต่ลืมใส่ตัวลงท้าย
      if (sheetUrl && sheetUrl.includes("script.google.com") && !sheetUrl.endsWith("/exec")) {
        if (sheetUrl.endsWith("/")) {
          sheetUrl += "exec";
        } else {
          sheetUrl += "/exec";
        }
      }

      // อัปเดตบนจอ
      document.getElementById("settings-sheet-url").value = sheetUrl;

      AppDB.saveSettings({
        googleSheetUrl: sheetUrl,
        telegramBotToken: botToken,
        telegramChatId: chatId
      });

      if (btn) btn.disabled = true;
      if (logBox) {
        logBox.style.display = "block";
        logBox.innerHTML = "";
      }

      const addLog = (msg) => {
        if (logBox) {
          logBox.innerHTML += `<div>⚡ [${new Date().toLocaleTimeString()}] ${msg}</div>`;
          logBox.scrollTop = logBox.scrollHeight;
        }
      };

      addLog("บันทึกการตั้งค่าตัวเชื่อมโยงลงเครื่องแล้ว...");
      addLog("เริ่มทำการเชื่อมต่อข้อมูล...");
      await AppDB.syncGoogleSheets((progressMessage) => {
        addLog(progressMessage);
      });
      addLog("✅ การซิงโครไนซ์เสร็จเรียบร้อย! ข้อมูลเชื่อมตรงกันแล้ว");
    } catch (err) {
      if (logBox) {
        logBox.style.display = "block";
        logBox.innerHTML += `<div style="color:var(--danger)">❌ ข้อผิดพลาด: ${err.message}</div>`;
      }
      alert("❌ เกิดข้อผิดพลาดในการซิงก์ข้อมูล:\n" + err.message + "\n\n" + err.stack);
    } finally {
      if (btn) btn.disabled = false;
      renderAllViews();
    }
  };

  // --- 9. ระบบแนะนำการค้นหาและกรอกข้อมูล (Autocomplete Engine) ---

  function setupAutocomplete() {
    // ลงทะเบียน Input และ Dropdown ที่ต้องการทำ Autocomplete
    registerAutocomplete("add-mat-name", "add-mat-name-dropdown");
    registerAutocomplete("withdraw-mat-name", "withdraw-mat-dropdown");
    registerAutocomplete("withdraw-mat-auth", "withdraw-mat-auth-dropdown");
    registerAutocomplete("receive-mat-name", "receive-mat-dropdown");
    registerAutocomplete("receive-mat-auth", "receive-mat-auth-dropdown");
    registerAutocomplete("receive-mat-borrower", "receive-mat-borrower-dropdown");
    
    registerAutocomplete("borrow-tool-name", "borrow-tool-dropdown");
    registerAutocomplete("borrow-tool-borrower", "borrow-tool-borrower-dropdown");
    registerAutocomplete("borrow-tool-auth", "borrow-tool-auth-dropdown");
    
    registerAutocomplete("return-tool-name", "return-tool-dropdown");
    registerAutocomplete("return-tool-borrower", "return-tool-borrower-dropdown");
    registerAutocomplete("return-tool-auth", "return-tool-auth-dropdown");
    
    registerAutocomplete("trans-tool-borrower", "trans-tool-borrower-dropdown");
    registerAutocomplete("trans-tool-auth", "trans-tool-auth-dropdown");
    
    registerAutocomplete("repair-tool-auth", "repair-tool-auth-dropdown");
  }

  function registerAutocomplete(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    autocompleteRegistry[inputId] = {
      input: input,
      dropdown: dropdown,
      items: []
    };

    // เหตุการณ์ตอนพิมพ์
    input.addEventListener("input", () => {
      showSuggestions(inputId);
      if (inputId === "withdraw-mat-name") {
        updateWithdrawStockHint(input.value);
      }
    });

    // เหตุการณ์ตอนโฟกัส (แสดงคำแนะนำทันทีหากมีคำค้นหาค้างอยู่)
    input.addEventListener("focus", () => {
      showSuggestions(inputId);
    });

    // ปิดหน้าแนะนำเมื่อกดนอกส่วนของ Input
    document.addEventListener("click", (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove("show");
      }
    });
  }

  window.setAutocompleteItems = function(inputId, items) {
    if (autocompleteRegistry[inputId]) {
      autocompleteRegistry[inputId].items = [...new Set(items)]; // เก็บข้อมูลเฉพาะที่ไม่ซ้ำกัน
    }
  };

  function showSuggestions(inputId) {
    const registry = autocompleteRegistry[inputId];
    if (!registry) return;

    const val = registry.input.value.toLowerCase();
    const dropdown = registry.dropdown;
    const filtered = registry.items.filter(item => item.toLowerCase().includes(val));

    dropdown.innerHTML = "";
    if (filtered.length > 0) {
      filtered.slice(0, 8).forEach(item => {
        const row = document.createElement("div");
        row.className = "autocomplete-item";
        row.textContent = item;
        row.addEventListener("click", () => {
          registry.input.value = item;
          dropdown.classList.remove("show");
          
          // ทริกเกอร์อีเวนต์พิเศษเผื่อเรียกยอดวัสดุคงเหลือมาโชว์ในกรณีที่เป็นวัสดุเบิก
          if (inputId === "withdraw-mat-name") {
            updateWithdrawStockHint(item);
          }
        });
        dropdown.appendChild(row);
      });
      dropdown.classList.add("show");
    } else {
      dropdown.classList.remove("show");
    }
  }

  // ตัวช่วยแสดงจำนวนวัสดุคงเหลือที่สามารถเบิกได้ในฟอร์มเบิก
  function updateWithdrawStockHint(matName) {
    const materials = AppDB.getMaterials();
    const mat = materials.find(m => m.name === matName);
    const label = document.getElementById("withdraw-mat-qty-label");
    const select = document.getElementById("withdraw-mat-location");
    
    const warehouses = AppDB.getWarehouses();
    
    if (mat) {
      let hintTexts = warehouses.map(wh => {
        const fieldName = wh.code.toLowerCase().replace(" ", "_") + "_qty";
        const qty = mat[fieldName] || 0;
        return `${wh.name}(<strong>${qty}</strong>)`;
      }).join(" ");
      
      label.innerHTML = `คงเหลือ: ${hintTexts} ${mat.unit} | ทุนชิ้นละ <strong>${mat.price_per_unit} ฿</strong>`;
      
      // อัปเดตข้อความคงเหลือตัวเลือกในคลังย่อย
      select.innerHTML = warehouses.map(wh => {
        const fieldName = wh.code.toLowerCase().replace(" ", "_") + "_qty";
        const qty = mat[fieldName] || 0;
        return `<option value="${wh.code}">${wh.name} (เหลือ ${qty} ${mat.unit})</option>`;
      }).join("");
      
      // เปลี่ยนฟลอยด์จำนวนสูงสุดใน input
      document.getElementById("withdraw-mat-qty").placeholder = `กรอกไม่เกินยอดรวมในคลังที่เลือก`;
    } else {
      label.textContent = "ไม่พบรายการวัสดุชิ้นนี้ในคลัง!";
      select.innerHTML = warehouses.map(wh => {
        return `<option value="${wh.code}">${wh.name}</option>`;
      }).join("");
    }
  }

  // --- 10. แผงเมนูปุ่มลอยด่วนบนโทรศัพท์มือถือ (Floating Action Button) ---
  function setupFAB() {
    const mainBtn = document.getElementById("fab-main-btn");
    const menu = document.getElementById("fab-menu-container");
    if (!mainBtn || !menu) return;

    mainBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      mainBtn.classList.toggle("active");
      menu.classList.toggle("show");
    });

    document.addEventListener("click", () => {
      mainBtn.classList.remove("active");
      menu.classList.remove("show");
    });
  }

  // --- 13. ฟังก์ชันตัวช่วยดึงและจัดการโครงการ (Dynamic Projects Dropdowns & CRUD) ---
  
  window.populateProjectDropdowns = function() {
    const projects = AppDB.getProjects();
    
    // 1. ตัวเลือกโครงการในหน้าเบิกวัสดุ
    const withdrawProj = document.getElementById("withdraw-mat-project");
    if (withdrawProj) {
      withdrawProj.innerHTML = '<option value="" disabled selected>-- เลือกวิลล่าปลายทาง --</option>' +
        projects.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    }
    
    // 2. ตัวเลือกโครงการในหน้ายืมเครื่องมือ
    const borrowProj = document.getElementById("borrow-tool-project");
    if (borrowProj) {
      borrowProj.innerHTML = '<option value="" disabled selected>-- เลือกวิลล่าเป้าหมาย --</option>' +
        projects.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    }
    
    // 3. ตัวเลือกโครงการในหน้าโยกย้ายเครื่องมือ
    const transProj = document.getElementById("trans-tool-to");
    if (transProj) {
      transProj.innerHTML = '<option value="" disabled selected>-- เลือกวิลล่าปลายทาง --</option>' +
        projects.map(p => `<option value="${p.name}">${p.name}</option>`).join('') +
        '<option value="คลังสินค้ากลาง">คลังสินค้ากลาง (ย้ายกลับคลัง)</option>';
    }
  };

  window.openAddProjectModal = function() {
    document.getElementById("project-form-el").reset();
    document.getElementById("project-form-id").value = "";
    document.getElementById("project-modal-title").textContent = "เพิ่มโครงการใหม่";
    openModal("project-modal");
  };

  window.editProject = function(id) {
    const proj = AppDB.getProjects().find(p => p.id === id);
    if (!proj) return;

    document.getElementById("project-form-id").value = proj.id;
    document.getElementById("project-name").value = proj.name;
    document.getElementById("project-desc").value = proj.description || "";
    
    document.getElementById("project-modal-title").textContent = "แก้ไขรายละเอียดโครงการ";
    openModal("project-modal");
  };

  window.handleProjectSubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("project-form-id").value;
    const name = document.getElementById("project-name").value.trim();
    const desc = document.getElementById("project-desc").value.trim();

    const projData = {
      name: name,
      description: desc
    };

    if (id) {
      projData.id = id;
      AppDB.updateProject(projData);
    } else {
      AppDB.addProject(projData);
    }

    closeModal("project-modal");
    populateProjectDropdowns();
    renderAllViews();
  };

  window.deleteProject = function(id) {
    if (confirm("⚠️ ยืนยันการลบโครงการนี้ออกจากฐานข้อมูลคลัง?\n(ประวัติการเบิกจ่ายที่มีอยู่แล้วจะไม่ถูกกระทบ)")) {
      AppDB.deleteProject(id);
      populateProjectDropdowns();
      renderAllViews();
    }
  };

  function renderProjects() {
    const listContainer = document.getElementById("projects-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";
    
    const projects = AppDB.getProjects();
    projects.forEach(p => {
      const isSystemProj = p.name === "คลังสินค้ากลาง" || p.name === "สำนักงานหน้างาน";
      const actionBtns = isSystemProj 
        ? `<span style="font-size:12px; color:var(--text-muted); font-style:italic;">โครงการระบบ (ไม่สามารถลบได้)</span>`
        : `
            <button class="btn btn-secondary" onclick="editProject('${p.id}')" style="padding: 6px 12px; font-size:12px; margin-right:5px;"><i class="fas fa-edit"></i> แก้ไข</button>
            <button class="btn btn-danger" onclick="deleteProject('${p.id}')" style="padding: 6px 12px; font-size:12px; background:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt"></i> ลบ</button>
          `;
      
      listContainer.innerHTML += `
        <div class="list-item" style="padding:16px;">
          <div>
            <div style="font-size:15px; font-weight:600; color:var(--text-primary);">${p.name}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
              รายละเอียด: <strong>${p.description || '-'}</strong>
            </div>
          </div>
          <div>
            ${actionBtns}
          </div>
        </div>
      `;
    });
  }

  // --- 14. ระบบพิมพ์เอกสารประวัติ (Logs Printing PDF) ---
  window.printLogs = function() {
    const meta = document.getElementById("print-logs-meta");
    if (meta) {
      const now = new Date().toLocaleString("th-TH");
      meta.textContent = `ข้อมูล ณ วันที่: ${now}`;
    }
    window.print();
  };

  // --- 11. ฟังก์ชันตัวช่วยเปิด-ปิดกล่องป๊อปอัป (Modal Helpers) ---
  window.openModal = function(id) {
    // พิเศษ: ล้างรูปตัวอย่างตอนเปิดฟอร์มเครื่องมือ
    if (id === "tool-form-modal") {
      tempUploadedImages = [];
      document.getElementById("ocr-scan-overlay").className = "scanner-overlay";
      
      const formId = document.getElementById("tool-form-id").value;
      if (formId) {
        // ดึงรูปที่มีของเครื่องมือชิ้นนั้นมาแสดง
        const toolObj = AppDB.getTools().find(t => t.id === formId);
        if (toolObj && toolObj.images) {
          tempUploadedImages = [...toolObj.images];
        }
      }
      updateTempImagesPreview();
    }

    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.add("open");
    }
  };

  window.closeModal = function(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.remove("open");
    }
  };

  // --- 12. ฟังก์ชันแปลชื่อและแปลงวันทั่วไป ---
  function translateRole(role) {
    if (role === "manager") return "ผู้จัดการ/หัวหน้างาน";
    if (role === "foreman") return "โฟร์แมนโครงการ";
    if (role === "stock_keeper") return "ผู้ดูแลสต็อก";
    return role;
  }

  function getMonthName(monthNum) {
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return months[monthNum - 1] || "";
  }

  // เชื่อมปุ่มแฮมเบอร์เกอร์บนหัวมือถือเปิดเมนูซ้าย
  window.toggleMobileSidebar = function() {
    const sidebar = document.querySelector(".sidebar");
    sidebar.classList.toggle("open");
  };

  // ฟังก์ชันลัดในการเปิดฟอร์มสำหรับเมนูลอยตัว
  window.quickAction = function(actionType) {
    if (actionType === 'withdraw') openWithdrawMaterialModal();
    else if (actionType === 'receive') openReceiveMaterialModal();
    else if (actionType === 'borrow') openToolBorrowModal();
    else if (actionType === 'return') openToolReturnModal();
  };

  // --- 15. ระบบจัดการคลังสินค้า (Warehouses CRUD) ---
  window.openAddWarehouseModal = function() {
    document.getElementById("warehouse-form-el").reset();
    document.getElementById("warehouse-form-id").value = "";
    document.getElementById("warehouse-modal-title").textContent = "เพิ่มคลังสินค้าใหม่";
    openModal("warehouse-modal");
  };

  window.editWarehouse = function(id) {
    const wh = AppDB.getWarehouses().find(w => w.id === id);
    if (!wh) return;

    document.getElementById("warehouse-form-id").value = wh.id;
    document.getElementById("warehouse-name").value = wh.name;
    document.getElementById("warehouse-modal-title").textContent = "แก้ไขชื่อคลังสินค้า";
    openModal("warehouse-modal");
  };

  window.handleWarehouseSubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("warehouse-form-id").value;
    const name = document.getElementById("warehouse-name").value.trim();

    const whData = {
      name: name
    };

    try {
      if (id) {
        whData.id = id;
        AppDB.updateWarehouse(whData);
      } else {
        AppDB.addWarehouse(whData);
      }
      closeModal("warehouse-modal");
      renderAllViews();
    } catch (err) {
      alert("❌ เกิดข้อผิดพลาด: " + err.message);
    }
  };

  window.deleteWarehouse = function(id) {
    if (confirm("⚠️ ยืนยันการลบคลังสินค้าย่อยนี้?\n(ระบบจะลบคอลัมน์คลังนี้ออกจากการแสดงผล แต่ข้อมูลปริมาณคงเหลือเดิมจะไม่ถูกกระทบ)")) {
      AppDB.deleteWarehouse(id);
      renderAllViews();
    }
  };

  function renderWarehouses() {
    const listContainer = document.getElementById("warehouses-list");
    if (!listContainer) return;
    listContainer.innerHTML = "";
    
    const warehouses = AppDB.getWarehouses();
    if (warehouses.length === 0) {
      listContainer.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">ไม่มีข้อมูลคลังสินค้าคลังย่อยที่เปิดใช้งาน</div>';
      return;
    }
    
    warehouses.forEach(w => {
      listContainer.innerHTML += `
        <div class="list-item" style="padding:16px;">
          <div>
            <div style="font-size:15px; font-weight:600; color:var(--text-primary);">${w.name}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
              รหัสอ้างอิงระบบ: <strong>${w.code}</strong>
            </div>
          </div>
          <div>
            <button class="btn btn-secondary" onclick="editWarehouse('${w.id}')" style="padding: 6px 12px; font-size:12px; margin-right:5px;"><i class="fas fa-edit"></i> แก้ไข</button>
            <button class="btn btn-danger" onclick="deleteWarehouse('${w.id}')" style="padding: 6px 12px; font-size:12px; background:var(--danger); border-color:var(--danger);"><i class="fas fa-trash-alt"></i> ลบ</button>
          </div>
        </div>
      `;
    });
  }

  // --- 16. ทางลัดยืม/คืนเครื่องมือจากหน้ารายการ (Tool Shortcuts) ---
  window.openToolBorrowModalShortcut = function(id) {
    const tool = AppDB.getTools().find(t => t.id === id);
    if (!tool) return;
    
    openToolBorrowModal();
    document.getElementById("borrow-tool-name").value = tool.name;
  };

  window.openToolReturnModalShortcut = function(id) {
    const tool = AppDB.getTools().find(t => t.id === id);
    if (!tool) return;
    
    openToolReturnModal();
    document.getElementById("return-tool-name").value = tool.name;
  };

  // จัดการฟอร์มยื่นทั้งหมดผ่าน Event Listener
  function initEventListeners() {
    document.getElementById("login-form").addEventListener("submit", handleLoginSubmit);
    document.getElementById("nav-logout").addEventListener("click", handleLogout);
    
    document.getElementById("tool-form").addEventListener("submit", (e) => window.handleSaveToolSubmit(e));
    document.getElementById("mat-edit-form").addEventListener("submit", (e) => window.handleEditMaterialSubmit(e));
    document.getElementById("add-mat-form").addEventListener("submit", (e) => window.handleAddMaterialSubmit(e));
    
    document.getElementById("withdraw-mat-form").addEventListener("submit", (e) => window.handleWithdrawMaterialSubmit(e));
    document.getElementById("receive-mat-form").addEventListener("submit", (e) => window.handleReceiveMaterialSubmit(e));
    document.getElementById("borrow-tool-form").addEventListener("submit", (e) => window.handleBorrowToolSubmit(e));
    document.getElementById("return-tool-form").addEventListener("submit", (e) => window.handleReturnToolSubmit(e));
    document.getElementById("transfer-tool-form").addEventListener("submit", (e) => window.handleTransferToolSubmit(e));
    document.getElementById("repair-tool-form").addEventListener("submit", (e) => window.handleToolRepairSubmit(e));
    document.getElementById("user-form-el").addEventListener("submit", (e) => window.handleUserSubmit(e));
    document.getElementById("project-form-el").addEventListener("submit", (e) => window.handleProjectSubmit(e));
    document.getElementById("warehouse-form-el").addEventListener("submit", (e) => window.handleWarehouseSubmit(e));
    document.getElementById("settings-form").addEventListener("submit", (e) => {
      try {
        window.handleSaveSettings(e);
      } catch (err) {
        alert("❌ Error in Settings Form Submit:\n" + err.message + "\n\n" + err.stack);
      }
    });
    document.getElementById("btn-sync-sheets").addEventListener("click", () => {
      try {
        window.triggerGoogleSheetsSync().catch((err) => {
          alert("❌ Async Error in Sync Sheets:\n" + err.message + "\n\n" + err.stack);
        });
      } catch (err) {
        alert("❌ Sync Click Error:\n" + err.message + "\n\n" + err.stack);
      }
    });
    
    // ค้นหาสดเรียลไทม์
    document.getElementById("mat-search").addEventListener("input", renderMaterials);
    document.getElementById("mat-cat-filter").addEventListener("change", renderMaterials);
    document.getElementById("tool-search").addEventListener("input", renderTools);
    document.getElementById("tool-cat-filter").addEventListener("change", renderTools);
    document.getElementById("tool-status-filter").addEventListener("change", renderTools);
    document.getElementById("log-search").addEventListener("input", renderLogs);
    document.getElementById("log-type-filter").addEventListener("change", renderLogs);
  }
});
