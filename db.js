/**
 * ตัวจัดการฐานข้อมูลและการสื่อสารข้อมูล (db.js)
 * สำหรับแอปพลิเคชันบริหารสต็อกสินค้าและเครื่องมือช่าง
 * Probuild Samui Development
 */

// รูปภาพจำลองสำหรับสว่าน เครื่องเจียร และใบเสร็จต่างๆ (Base64 SVG เพื่อความเสถียรและไม่ต้องโหลดเน็ต)
const MOCK_IMAGES = {
  drill: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%230D9488'><rect x='20' y='40' width='40' height='20' rx='5'/><rect x='40' y='60' width='12' height='25' rx='3'/><rect x='10' y='46' width='10' height='8'/><line x1='10' y1='50' x2='2' y2='50' stroke='%23333' stroke-width='4'/><rect x='60' y='43' width='15' height='14' rx='2' fill='%230F172A'/></svg>",
  grinder: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23EA580C'><rect x='15' y='42' width='55' height='16' rx='8'/><circle cx='70' cy='50' r='18' fill='%23475569'/><circle cx='70' cy='50' r='6' fill='%2394A3B8'/><rect x='20' y='40' width='10' height='5' fill='%23EF4444'/></svg>",
  welder: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%232563EB'><rect x='20' y='30' width='60' height='45' rx='6'/><circle cx='35' cy='52' r='8' fill='%230F172A'/><circle cx='65' cy='52' r='8' fill='%230F172A'/><rect x='40' y='22' width='20' height='8' rx='2' fill='%23475569'/></svg>",
  receipt: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23F8FAFC'><rect x='25' y='15' width='50' height='70' rx='2' stroke='%23CBD5E1' stroke-width='2'/><line x1='35' y1='30' x2='65' y2='30' stroke='%2394A3B8' stroke-width='3'/><line x1='35' y1='45' x2='55' y2='45' stroke='%2394A3B8' stroke-width='3'/><line x1='35' y1='60' x2='60' y2='60' stroke='%2394A3B8' stroke-width='3'/><line x1='35' y1='72' x2='65' y2='72' stroke='%230D9488' stroke-width='3'/></svg>",
  warranty: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23FEF08A'><rect x='20' y='15' width='60' height='70' rx='5' stroke='%23EAB308' stroke-width='3'/><polygon points='50,30 55,42 68,42 58,50 62,62 50,55 38,62 42,50 32,42 45,42' fill='%23EAB308'/><line x1='35' y1='70' x2='65' y2='70' stroke='%23854D0E' stroke-width='2'/></svg>",
  material: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%2394A3B8'><polygon points='50,15 90,35 90,75 50,95 10,75 10,35' stroke='%23475569' stroke-width='4' fill='none'/><polygon points='50,15 90,35 50,55 10,35' fill='%23cbd5e1'/><polygon points='50,55 90,35 90,75 50,95' fill='%2394a3b8'/><polygon points='10,35 50,55 50,95 10,75' fill='%2364748b'/></svg>"
};

// ข้อมูลเริ่มต้นสำหรับระบบ
const INITIAL_DATABASE = {
  Users: [
    { id: "u1", username: "somsak", password: "123", name: "คุณสมศักดิ์ รักดี (ผู้จัดการ)", role: "manager", status: "active" },
    { id: "u2", username: "wichai", password: "123", name: "นายวิชัย ดีเลิศ (โฟร์แมนโครงการ A)", role: "foreman", status: "active" },
    { id: "u3", username: "somchai", password: "123", name: "นายสมชาย ไชยดี (ผู้ดูแลสต็อกสินค้า)", role: "stock_keeper", status: "active" },
    { id: "u4", username: "manop", password: "123", name: "นายมานพ ร่วงหล่น (พนักงานลาออก)", role: "foreman", status: "inactive" }
  ],
  Materials: [
    { id: "m1", category: "ปูนซีเมนต์", name: "ปูนซีเมนต์ปอร์ตแลนด์ ตราช้าง SCG (50 กก.)", stock_a_qty: 45, stock_b_qty: 25, stock_c_qty: 15, unit: "ถุง", price_per_unit: 145, min_stock: 25, images: [], last_updated: "2026-06-08T10:00:00.000Z" },
    { id: "m2", category: "เหล็กเส้น", name: "เหล็กเส้นกลม SR24 ขนาด 9 มม. (ยาว 10 ม.)", stock_a_qty: 80, stock_b_qty: 40, stock_c_qty: 0, unit: "เส้น", price_per_unit: 115, min_stock: 30, images: [], last_updated: "2026-06-08T10:00:00.000Z" },
    { id: "m3", category: "ท่อ PVC", name: "ท่อ PVC ตราช้าง 4 นิ้ว ชั้น 8.5 (ยาว 4 ม.)", stock_a_qty: 12, stock_b_qty: 15, stock_c_qty: 8, unit: "ท่อน", price_per_unit: 320, min_stock: 15, images: [], last_updated: "2026-06-08T10:00:00.000Z" },
    { id: "m4", category: "สายไฟ", name: "สายไฟบางกอกเคเบิ้ล THW 1x2.5 ตร.มม. (100 ม.)", stock_a_qty: 8, stock_b_qty: 3, stock_c_qty: 1, unit: "ม้วน", price_per_unit: 890, min_stock: 5, images: [], last_updated: "2026-06-08T10:00:00.000Z" }
  ],
  Tools: [
    { 
      id: "t1", 
      category: "เครื่องมือไฟฟ้า", 
      name: "สว่านกระแทกโรตารี่ Makita HR2470FT 24 มม.", 
      serial_number: "MK-892341", 
      current_project: "โครงการ วิลล่า A (แม่น้ำ)", 
      status: "usable", 
      repair_status: "none",
      repair_date: "", 
      purchase_shop: "ไทวัสดุ สาขาสมุย", 
      purchase_date: "2025-06-15", 
      purchase_price: 4500, 
      warranty_expiry: "2026-12-15", 
      images: [MOCK_IMAGES.drill, MOCK_IMAGES.receipt, MOCK_IMAGES.warranty],
      last_updated: "2026-06-08T10:00:00.000Z" 
    },
    { 
      id: "t2", 
      category: "เครื่องมือไฟฟ้า", 
      name: "เครื่องเจียรไฟฟ้า 4 นิ้ว Bosch GWS 7-100", 
      serial_number: "BS-902113", 
      current_project: "โครงการ วิลล่า B (บ่อผุด)", 
      status: "usable", 
      repair_status: "none",
      repair_date: "", 
      purchase_shop: "โฮมโปร สมุย", 
      purchase_date: "2025-02-10", 
      purchase_price: 1850, 
      warranty_expiry: "2026-08-10", 
      images: [MOCK_IMAGES.grinder, MOCK_IMAGES.receipt],
      last_updated: "2026-06-08T10:00:00.000Z" 
    },
    { 
      id: "t3", 
      category: "ตู้เชื่อม", 
      name: "ตู้เชื่อมอินเวอร์เตอร์ Jasic TIG200S", 
      serial_number: "JS-77621", 
      current_project: "คลังสินค้ากลาง", 
      status: "damaged", 
      repair_status: "sent_to_shop",
      repair_date: "2026-06-05T09:15:00.000Z", 
      purchase_shop: "สมุยฮาร์ดแวร์", 
      purchase_date: "2024-05-20", 
      purchase_price: 9200, 
      warranty_expiry: "2025-05-20", // หมดประกันแล้ว
      images: [MOCK_IMAGES.welder, MOCK_IMAGES.receipt],
      last_updated: "2026-06-08T10:00:00.000Z" 
    },
    { 
      id: "t4", 
      category: "เครื่องมือวัด", 
      name: "เครื่องวัดระดับเลเซอร์ 5 เส้น Dewalt DW088K", 
      serial_number: "DW-44321", 
      current_project: "โครงการ วิลล่า A (แม่น้ำ)", 
      status: "usable", 
      repair_status: "none",
      repair_date: "", 
      purchase_shop: "ไทวัสดุ สาขาสมุย", 
      purchase_date: "2024-01-10", 
      purchase_price: 5200, 
      warranty_expiry: "2025-01-10", // หมดประกันแล้ว
      images: [MOCK_IMAGES.drill, MOCK_IMAGES.warranty],
      last_updated: "2026-06-08T10:00:00.000Z" 
    }
  ],
  MaterialLogs: [
    { id: "ml-1", timestamp: "2026-06-01T08:30:00.000Z", project: "โครงการ วิลล่า A (แม่น้ำ)", material_id: "m1", material_name: "ปูนซีเมนต์ปอร์ตแลนด์ ตราช้าง SCG (50 กก.)", quantity: 20, price_at_time: 145, stock_location: "Stock A", type: "withdraw", borrower: "นายวิชัย ดีเลิศ", authorizer: "นายสมชาย ไชยดี" },
    { id: "ml-2", timestamp: "2026-06-02T10:15:00.000Z", project: "โครงการ วิลล่า B (บ่อผุด)", material_id: "m3", material_name: "ท่อ PVC ตราช้าง 4 นิ้ว ชั้น 8.5 (ยาว 4 ม.)", quantity: 5, price_at_time: 320, stock_location: "Stock B", type: "withdraw", borrower: "นายมานพ ร่วงหล่น", authorizer: "นายสมชาย ไชยดี" },
    { id: "ml-3", timestamp: "2026-06-05T14:00:00.000Z", project: "คลังสินค้ากลาง", material_id: "m2", material_name: "เหล็กเส้นกลม SR24 ขนาด 9 มม. (ยาว 10 ม.)", quantity: 50, price_at_time: 110, stock_location: "Stock A", type: "receive", borrower: "นายสมชาย ไชยดี", authorizer: "คุณสมศักดิ์ รักดี" },
    { id: "ml-4", timestamp: "2026-06-07T09:00:00.000Z", project: "โครงการ วิลล่า A (แม่น้ำ)", material_id: "m2", material_name: "เหล็กเส้นกลม SR24 ขนาด 9 มม. (ยาว 10 ม.)", quantity: 15, price_at_time: 115, stock_location: "Stock A", type: "withdraw", borrower: "นายวิชัย ดีเลิศ", authorizer: "นายสมชาย ไชยดี" }
  ],
  ToolLogs: [
    { id: "tl-1", timestamp: "2026-06-01T08:35:00.000Z", action: "borrow", tool_id: "t1", tool_name: "สว่านกระแทกโรตารี่ Makita HR2470FT 24 มม.", from_project: "คลังสินค้ากลาง", to_project: "โครงการ วิลล่า A (แม่น้ำ)", borrower: "นายวิชัย ดีเลิศ", authorizer: "นายสมชาย ไชยดี", notes: "ยืมไปใช้งานปูกระเบื้อง" },
    { id: "tl-2", timestamp: "2026-06-02T10:20:00.000Z", action: "borrow", tool_id: "t2", tool_name: "เครื่องเจียรไฟฟ้า 4 นิ้ว Bosch GWS 7-100", from_project: "คลังสินค้ากลาง", to_project: "โครงการ วิลล่า B (บ่อผุด)", borrower: "นายมานพ ร่วงหล่น", authorizer: "นายสมชาย ไชยดี", notes: "ยืมไปใช้เจียรเหล็กเสา" },
    { id: "tl-3", timestamp: "2026-06-05T09:15:00.000Z", action: "repair", tool_id: "t3", tool_name: "ตู้เชื่อมอินเวอร์เตอร์ Jasic TIG200S", from_project: "คลังสินค้ากลาง", to_project: "ร้านซ่อมสมุยเซอร์วิส", borrower: "นายสมชาย ไชยดี", authorizer: "คุณสมศักดิ์ รักดี", notes: "อาการไฟไม่เข้า สวิตช์พัง ส่งไปที่ร้านสมุยเซอร์วิส (ส่งร้านแล้ว)" }
  ],
  Projects: [
    { id: "p1", name: "โครงการ วิลล่า A (แม่น้ำ)", description: "วิลล่าหรูสองชั้น 4 ห้องนอน วิวแม่น้ำ" },
    { id: "p2", name: "โครงการ วิลล่า B (บ่อผุด)", description: "วิลล่าสไตล์โมเดิร์น 3 ห้องนอน พร้อมสระว่ายน้ำ บ่อผุด" },
    { id: "p3", name: "โครงการ วิลล่า C (ลิปะน้อย)", description: "วิลล่าตากอากาศริมทะเล ลิปะน้อย" },
    { id: "p4", name: "สำนักงานหน้างาน", description: "ออฟฟิศชั่วคราวและคลังเก็บของหลักหน้างาน" },
    { id: "p5", name: "คลังสินค้ากลาง", description: "คลังจัดเก็บสินค้าและเครื่องมือหลักของบริษัท" }
  ],
  Warehouses: [
    { id: "w1", code: "Stock A", name: "Stock A", is_default: true },
    { id: "w2", code: "Stock B", name: "Stock B", is_default: false },
    { id: "w3", code: "Stock C", name: "Stock C", is_default: false }
  ],
  Settings: {
    googleSheetUrl: "",
    telegramBotToken: "",
    telegramChatId: ""
  },
  Approvals: []
};

const DB_KEY = "probuild_stock_db";

// ฟังก์ชันดึงข้อมูลจาก LocalStorage หรือตั้งค่าค่าเริ่มต้นหากไม่มีข้อมูล
function getDB() {
  let db = localStorage.getItem(DB_KEY);
  if (!db) {
    saveDB(INITIAL_DATABASE);
    return INITIAL_DATABASE;
  }
  try {
    let parsed = JSON.parse(db);
    // ตรวจเช็คโครงสร้างย้อนหลังเผื่อขาดฟิลด์
    if (!parsed.Settings) parsed.Settings = INITIAL_DATABASE.Settings;
    if (!parsed.Users) parsed.Users = INITIAL_DATABASE.Users;
    if (!parsed.Materials) parsed.Materials = INITIAL_DATABASE.Materials;
    if (!parsed.Tools) parsed.Tools = INITIAL_DATABASE.Tools;
    if (!parsed.MaterialLogs) parsed.MaterialLogs = INITIAL_DATABASE.MaterialLogs;
    if (!parsed.ToolLogs) parsed.ToolLogs = INITIAL_DATABASE.ToolLogs;
    if (!parsed.Projects) parsed.Projects = INITIAL_DATABASE.Projects;
    if (!parsed.Approvals) parsed.Approvals = [];
    
    // แปลงรูปภาพวัสดุหากอยู่ในรูปสตริง JSON
    parsed.Materials.forEach(m => {
      if (typeof m.images === 'string') {
        try { m.images = JSON.parse(m.images); } catch(err) { m.images = []; }
      } else if (!m.images) {
        m.images = [];
      }
      if (m.stock_d_qty === undefined) m.stock_d_qty = 0;
      if (m.stock_e_qty === undefined) m.stock_e_qty = 0;
      if (m.stock_f_qty === undefined) m.stock_f_qty = 0;
      if (m.stock_g_qty === undefined) m.stock_g_qty = 0;
      if (m.stock_h_qty === undefined) m.stock_h_qty = 0;
      if (m.stock_i_qty === undefined) m.stock_i_qty = 0;
      if (m.stock_j_qty === undefined) m.stock_j_qty = 0;
    });

    // ป้องกันกรณีรหัสผ่านของพนักงานเป็นค่าว่างจากการซิงก์ Google Sheets
    parsed.Users.forEach(u => {
      if (u.password === undefined || u.password === null || u.password.toString().trim() === "") {
        u.password = "123";
      }
    });

    // แปลงรูปภาพเครื่องมือหากอยู่ในรูปสตริง JSON
    parsed.Tools.forEach(t => {
      if (typeof t.images === 'string') {
        try { t.images = JSON.parse(t.images); } catch(err) { t.images = []; }
      } else if (!t.images) {
        t.images = [];
      }
      if (!t.storage_location) {
        t.storage_location = "Stock A";
      }
    });

    if (!parsed.Warehouses) parsed.Warehouses = INITIAL_DATABASE.Warehouses;

    return parsed;
  } catch (e) {
    console.error("เกิดข้อผิดพลาดในการโหลด Database", e);
    return INITIAL_DATABASE;
  }
}

// ฟังก์ชันบันทึกข้อมูลกลับลง LocalStorage
function saveDB(data, noSync = false) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
  if (!noSync && typeof window.triggerAutoSync === 'function') setTimeout(window.triggerAutoSync, 1000);
}

// คลาสจัดการคำสั่งฐานข้อมูล
const AppDB = {
  // --- ล็อกอิน & พนักงาน ---
  getUsers: () => getDB().Users,

  // --- โครงการ ---
  getProjects: () => getDB().Projects || [],

  // --- คลังเก็บวัสดุ (Warehouses) ---
  getWarehouses: () => getDB().Warehouses || [],

  addWarehouse: (warehouse) => {
    let db = getDB();
    if (!db.Warehouses) db.Warehouses = [];
    if (db.Warehouses.length >= 10) {
      throw new Error("ระบบรองรับการเปิดใช้งานคลังย่อยสูงสุด 10 คลัง");
    }
    
    // ค้นหารหัสสล็อตคลังที่ยังไม่เปิดใช้งาน (Stock A-J)
    const usedCodes = db.Warehouses.map(w => w.code);
    const allCodes = ["Stock A", "Stock B", "Stock C", "Stock D", "Stock E", "Stock F", "Stock G", "Stock H", "Stock I", "Stock J"];
    const freeCode = allCodes.find(c => !usedCodes.includes(c));
    
    warehouse.id = "w-" + Date.now();
    warehouse.code = freeCode;
    db.Warehouses.push(warehouse);
    saveDB(db);
    return warehouse;
  },

  updateWarehouse: (updatedWh) => {
    let db = getDB();
    db.Warehouses = (db.Warehouses || []).map(w => w.id === updatedWh.id ? { ...w, ...updatedWh } : w);
    saveDB(db);
    return updatedWh;
  },

  deleteWarehouse: (id) => {
    let db = getDB();
    db.Warehouses = (db.Warehouses || []).filter(w => w.id !== id);
    saveDB(db);
  },

  // ดึง Store กลาง (is_default = true)
  getDefaultWarehouse: () => {
    const warehouses = getDB().Warehouses || [];
    return warehouses.find(w => w.is_default) || warehouses[0] || { code: 'Stock A', name: 'Stock A' };
  },

  // ตั้ง Store กลางใหม่ (ยกเลิก default ทั้งหมด แล้วตั้งอันใหม่)
  setDefaultWarehouse: (id) => {
    let db = getDB();
    db.Warehouses = (db.Warehouses || []).map(w => ({ ...w, is_default: (w.id === id) }));
    saveDB(db);
  },

  // อัพเดทรูปภาพเครื่องมือ (บันทึก Base64)
  updateToolImage: (toolId, base64ImageArray) => {
    let db = getDB();
    db.Tools = db.Tools.map(t => t.id === toolId ? { ...t, images: base64ImageArray } : t);
    saveDB(db);
  },

  addProject: (project) => {
    let db = getDB();
    project.id = "p-" + Date.now();
    if (!db.Projects) db.Projects = [];
    db.Projects.push(project);
    saveDB(db);
    return project;
  },

  updateProject: (updatedProj) => {
    let db = getDB();
    db.Projects = (db.Projects || []).map(p => p.id === updatedProj.id ? { ...p, ...updatedProj } : p);
    saveDB(db);
    return updatedProj;
  },

  deleteProject: (id) => {
    let db = getDB();
    db.Projects = (db.Projects || []).filter(p => p.id !== id);
    saveDB(db);
  },
  
  addUser: (user) => {
    let db = getDB();
    user.id = "u-" + Date.now();
    db.Users.push(user);
    saveDB(db);
    return user;
  },
  
  updateUser: (updatedUser) => {
    let db = getDB();
    db.Users = db.Users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u);
    saveDB(db);
    return updatedUser;
  },

  deleteUser: (id) => {
    let db = getDB();
    db.Users = db.Users.filter(u => u.id !== id);
    saveDB(db);
  },

  // --- วัสดุสินค้า ---
  getMaterials: () => getDB().Materials,
  
  addMaterial: (material) => {
    let db = getDB();
    material.id = "m-" + Date.now();
    material.last_updated = new Date().toISOString();
    db.Materials.push(material);
    saveDB(db);
    return material;
  },

  updateMaterial: (updatedMat) => {
    let db = getDB();
    updatedMat.last_updated = new Date().toISOString();
    db.Materials = db.Materials.map(m => m.id === updatedMat.id ? { ...m, ...updatedMat } : m);
    saveDB(db);
    return updatedMat;
  },

  // ทำรายการเบิก/รับวัสดุ
  transactMaterial: (log) => {
    let db = getDB();
    let mat = db.Materials.find(m => m.id === log.material_id);
    if (!mat) throw new Error("ไม่พบรายการวัสดุที่เลือก");

    let qty = Number(log.quantity);
    let loc = log.stock_location; // คลังจัดเก็บ (Stock A, B, C, D, E)
    let qtyField = loc.toLowerCase().replace(" ", "_") + "_qty";

    if (log.type === "withdraw") {
      if (mat[qtyField] < qty) {
        throw new Error(`วัสดุในคลัง ${loc} มีไม่เพียงพอ (คงเหลือ ${mat[qtyField]} ${mat.unit})`);
      }
      mat[qtyField] -= qty;
    } else if (log.type === "receive") {
      mat[qtyField] = (Number(mat[qtyField]) || 0) + qty;
    }

    mat.last_updated = new Date().toISOString();
    log.id = "ml-" + Date.now();
    log.timestamp = new Date().toISOString();
    
    db.MaterialLogs.push(log);
    saveDB(db);
    return { material: mat, log: log };
  },

  getMaterialLogs: () => getDB().MaterialLogs,

  // --- เครื่องมือช่าง ---
  getTools: () => getDB().Tools.filter(t => t.status !== 'deleted'), // ซ่อนตัวที่ถูกลบแบบถาวร
  
  addTool: (tool) => {
    let db = getDB();
    tool.id = "t-" + Date.now();
    tool.last_updated = new Date().toISOString();
    db.Tools.push(tool);
    saveDB(db);
    return tool;
  },

  updateTool: (updatedTool) => {
    let db = getDB();
    updatedTool.last_updated = new Date().toISOString();
    db.Tools = db.Tools.map(t => t.id === updatedTool.id ? { ...t, ...updatedTool } : t);
    saveDB(db);
    return updatedTool;
  },

  approveToolAdd: (toolId, managerName) => {
    let db = getDB();
    let tool = db.Tools.find(t => t.id === toolId);
    if (!tool) throw new Error("ไม่พบเครื่องมือช่าง");
    tool.status = "usable";
    tool.current_project = "คลังสินค้ากลาง";
    tool.last_updated = new Date().toISOString();
    
    db.ToolLogs.push({
      id: "tl-" + Date.now(),
      tool_id: tool.id,
      tool_name: tool.name,
      action: "approve_add",
      from_project: "-",
      to_project: "คลังสินค้ากลาง",
      borrower: managerName,
      authorizer: managerName,
      timestamp: new Date().toISOString(),
      notes: "อนุมัติการเพิ่มเครื่องมือช่างเข้าคลัง"
    });
    
    db.Tools = db.Tools.map(t => t.id === toolId ? tool : t);
    saveDB(db);
    return tool;
  },

  rejectToolAdd: (toolId, managerName) => {
    let db = getDB();
    let tool = db.Tools.find(t => t.id === toolId);
    if (!tool) throw new Error("ไม่พบเครื่องมือช่าง");
    tool.status = "deleted";
    tool.last_updated = new Date().toISOString();
    
    db.ToolLogs.push({
      id: "tl-" + Date.now(),
      tool_id: tool.id,
      tool_name: tool.name,
      action: "reject_add",
      from_project: "-",
      to_project: "-",
      borrower: managerName,
      authorizer: managerName,
      timestamp: new Date().toISOString(),
      notes: "ปฏิเสธคำขอเพิ่มเครื่องมือช่าง"
    });
    
    db.Tools = db.Tools.map(t => t.id === toolId ? tool : t);
    saveDB(db);
    return tool;
  },

  approveToolRetire: (toolId, managerName, notes) => {
    let db = getDB();
    let tool = db.Tools.find(t => t.id === toolId);
    if (!tool) throw new Error("ไม่พบเครื่องมือช่าง");
    
    const prevProject = tool.current_project;
    tool.status = "retired";
    tool.current_project = "ยุติการใช้งาน (" + (notes || "ชำรุด/พัง") + ")";
    tool.last_updated = new Date().toISOString();
    
    db.ToolLogs.push({
      id: "tl-" + Date.now(),
      tool_id: tool.id,
      tool_name: tool.name,
      action: "retire",
      from_project: prevProject,
      to_project: tool.current_project,
      borrower: managerName,
      authorizer: managerName,
      timestamp: new Date().toISOString(),
      notes: notes || "อนุมัติการยุติการใช้งาน"
    });
    
    db.Tools = db.Tools.map(t => t.id === toolId ? tool : t);
    saveDB(db);
    return tool;
  },

  rejectToolRetire: (toolId, managerName) => {
    let db = getDB();
    let tool = db.Tools.find(t => t.id === toolId);
    if (!tool) throw new Error("ไม่พบเครื่องมือช่าง");
    tool.status = "usable";
    tool.last_updated = new Date().toISOString();
    
    db.ToolLogs.push({
      id: "tl-" + Date.now(),
      tool_id: tool.id,
      tool_name: tool.name,
      action: "reject_retire",
      from_project: tool.current_project,
      to_project: tool.current_project,
      borrower: managerName,
      authorizer: managerName,
      timestamp: new Date().toISOString(),
      notes: "ปฏิเสธคำขอยุติการใช้งาน คืนสถานะพร้อมใช้"
    });
    
    db.Tools = db.Tools.map(t => t.id === toolId ? tool : t);
    saveDB(db);
    return tool;
  },

  // ทำรายการเครื่องมือ (ยืม, คืน, โยกย้าย, ส่งซ่อม, เกษียณ)
  transactTool: (log) => {
    let db = getDB();
    let tool = db.Tools.find(t => t.id === log.tool_id);
    if (!tool) throw new Error("ไม่พบเครื่องมือช่างที่เลือก");

    log.id = "tl-" + Date.now();
    log.timestamp = new Date().toISOString();
    tool.last_updated = new Date().toISOString();

    if (log.action === "borrow") {
      tool.current_project = log.to_project;
      tool.status = "usable";
      tool.repair_status = "none";
    } else if (log.action === "return") {
      tool.current_project = "คลังสินค้ากลาง";
      tool.storage_location = log.storage_location || "Stock A";
      // ถ้าคืนมาแล้วเสียหาย สามารถแจ้งซ่อมได้ทันที
      if (log.notes.includes("ชำรุด") || log.notes.includes("เสีย")) {
        tool.status = "damaged";
        tool.repair_status = "requested";
        tool.repair_date = new Date().toISOString();
      } else {
        tool.status = "usable";
        tool.repair_status = "none";
      }
    } else if (log.action === "transfer") {
      tool.current_project = log.to_project;
    } else if (log.action === "repair") {
      // ปรับปรุงสถานะซ่อม
      tool.status = "damaged";
      tool.repair_status = log.repair_status || "requested"; // requested, in_progress, sent_to_shop, repaired
      
      if (tool.repair_status === "repaired") {
        tool.status = "usable";
        tool.repair_status = "none";
        tool.repair_date = "";
        log.action = "repair_returned";
      } else {
        tool.repair_date = tool.repair_date || new Date().toISOString();
        log.action = "repair_sent";
      }
    } else if (log.action === "retire") {
      tool.status = "retired";
      tool.repair_status = "none";
      tool.current_project = "ยุติการใช้งาน (" + log.notes + ")";
    } else if (log.action === "reactivate") {
      tool.status = "usable";
      tool.repair_status = "none";
      const defaultWh = (db.Warehouses || []).find(w => w.is_default);
      tool.current_project = "คลังสินค้ากลาง";
      tool.storage_location = defaultWh ? defaultWh.code : "Stock A";
    }

    db.ToolLogs.push(log);
    saveDB(db);
    return { tool: tool, log: log };
  },

  getToolLogs: () => getDB().ToolLogs,

  // --- ระบบรออนุมัติ (Approvals) ---
  getApprovals: () => getDB().Approvals || [],

  addApproval: (approvalData) => {
    let db = getDB();
    if (!db.Approvals) db.Approvals = [];
    approvalData.id = "ap-" + Date.now();
    approvalData.timestamp = new Date().toISOString();
    approvalData.status = "pending";
    if (!db.Approvals) db.Approvals = [];
    db.Approvals.push(approvalData);
    saveDB(db);
    return approvalData;
  },

  approveRequest: (approvalId, managerName) => {
    let db = getDB();
    if (!db.Approvals) db.Approvals = [];
    let reqIndex = db.Approvals.findIndex(a => a.id === approvalId);
    if (reqIndex === -1) throw new Error("ไม่พบคำขออนุมัตินี้");
    
    let req = db.Approvals[reqIndex];
    let data = req.data;
    
    if (req.type === 'material') {
      if (req.action === 'add') {
        data.last_updated = new Date().toISOString();
        db.Materials.push(data);
      } else if (req.action === 'edit') {
        data.last_updated = new Date().toISOString();
        db.Materials = db.Materials.map(m => m.id === data.id ? { ...m, ...data } : m);
      }
    } else if (req.type === 'tool') {
      if (req.action === 'add') {
        data.last_updated = new Date().toISOString();
        data.status = "usable";
        data.current_project = "คลังสินค้ากลาง";
        db.Tools.push(data);
        db.ToolLogs.push({
          id: "tl-" + Date.now(),
          tool_id: data.id,
          tool_name: data.name,
          action: "approve_add",
          from_project: "-",
          to_project: "คลังสินค้ากลาง",
          borrower: managerName,
          authorizer: managerName,
          timestamp: new Date().toISOString(),
          notes: "อนุมัติการเพิ่มเครื่องมือช่างเข้าคลัง"
        });
      } else if (req.action === 'retire') {
        let tool = db.Tools.find(t => t.id === data.id);
        if (tool) {
          const prevProject = tool.current_project;
          tool.status = "retired";
          tool.current_project = "ยุติการใช้งาน (" + (data.notes || "ชำรุด/พัง") + ")";
          tool.last_updated = new Date().toISOString();
          db.ToolLogs.push({
            id: "tl-" + Date.now(),
            tool_id: tool.id,
            tool_name: tool.name,
            action: "retire",
            from_project: prevProject,
            to_project: tool.current_project,
            borrower: managerName,
            authorizer: managerName,
            timestamp: new Date().toISOString(),
            notes: data.notes || "อนุมัติการยุติการใช้งาน"
          });
          db.Tools = db.Tools.map(t => t.id === tool.id ? tool : t);
        }
      }
    }
    
    // เอาออกจากคิวรออนุมัติ
    db.Approvals.splice(reqIndex, 1);
    saveDB(db);
    return true;
  },

  rejectRequest: (approvalId, managerName) => {
    let db = getDB();
    if (!db.Approvals) db.Approvals = [];
    let reqIndex = db.Approvals.findIndex(a => a.id === approvalId);
    if (reqIndex === -1) throw new Error("ไม่พบคำขออนุมัตินี้");
    
    // เอาออกจากคิวรออนุมัติ
    db.Approvals.splice(reqIndex, 1);
    saveDB(db);
    return true;
  },

  // --- การตั้งค่า & ระบบเชื่อมต่อ ---
  getSettings: () => getDB().Settings,
  
  saveSettings: (settings) => {
    let db = getDB();
    db.Settings = { ...db.Settings, ...settings };
    saveDB(db);
  },

  // --- การแจ้งเตือนผ่าน Telegram Bot ---
  notifyTelegram: async (message) => {
    let settings = AppDB.getSettings();
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      console.log("Telegram notification skipped: Bot Token or Chat ID not configured.");
      return false;
    }
    try {
      let url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
      let response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: message,
          parse_mode: "HTML"
        })
      });
      let result = await response.json();
      return result.ok;
    } catch (e) {
      console.error("ส่งข้อความเข้า Telegram ล้มเหลว:", e);
      return false;
    }
  },

  // --- ระบบซิงโครไนซ์ข้อมูลกับ Google Sheet ---
  syncGoogleSheets: async (onProgress) => {
    let db = getDB();
    let url = db.Settings.googleSheetUrl;
    if (!url) {
      throw new Error("ยังไม่ได้กำหนด URL ของ Google Web App ในหน้าตั้งค่า");
    }

    if (onProgress) onProgress("กำลังอ่านข้อมูลฝั่งแอปเพื่อเตรียมอัปโหลด...");

    // สร้าง payload ซิงก์ข้อมูลพนักงาน, วัสดุ, เครื่องมือ และประวัติทั้งหมด
    let payload = {
      action: "sync",
      payload: {
        Users: db.Users,
        Materials: db.Materials,
        Tools: db.Tools,
        MaterialLogs: db.MaterialLogs,
        ToolLogs: db.ToolLogs,
        Projects: db.Projects,
        Warehouses: db.Warehouses
      }
    };

    if (onProgress) onProgress("กำลังส่งข้อมูลไปยัง Google Sheets...");

    try {
      // แนะนำให้ใช้ fetch แบบ POST เพื่อส่งข้อมูลขนาดใหญ่ได้เสถียร
      let response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "text/plain;charset=utf-8" // จำเป็นต้องส่งแบบนี้ใน Apps Script เพื่อป้องกัน Pre-flight CORS บล็อกในบางเบราว์เซอร์
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      let result = await response.json();
      if (result.status === "success" && result.data) {
        if (onProgress) onProgress("ดาวน์โหลดข้อมูลอัปเดตล่าสุดลงเครื่อง...");
        
        // ผสานและบันทึกข้อมูลล่าสุดจาก Google Sheets ลง Local
        let sheetData = result.data;
        
        // รวมข้อมูล
        db.Users = sheetData.Users || db.Users;
        db.Materials = sheetData.Materials || db.Materials;
        db.Tools = sheetData.Tools || db.Tools;
        db.MaterialLogs = sheetData.MaterialLogs || db.MaterialLogs;
        db.ToolLogs = sheetData.ToolLogs || db.ToolLogs;
        db.Projects = sheetData.Projects || db.Projects;
        db.Warehouses = sheetData.Warehouses || db.Warehouses;
        
        // เคลียร์ประวัติคอลัมน์ที่ไม่จำเป็นหากได้รับมาในรูปสตริง JSON
        db.Materials.forEach(m => {
          if (typeof m.images === 'string') {
            try { m.images = JSON.parse(m.images); } catch(err) { m.images = []; }
          }
        });
        db.Tools.forEach(t => {
          if (typeof t.images === 'string') {
            try { t.images = JSON.parse(t.images); } catch(err) { t.images = []; }
          }
        });
        
        saveDB(db, true);
        if (onProgress) onProgress("ซิงก์ข้อมูลเสร็จสมบูรณ์!");
        return true;
      } else {
        throw new Error(result.message || "การซิงก์ข้อมูลล้มเหลวโดยไม่ทราบสาเหตุ");
      }
    } catch (e) {
      console.error("Google Sheets Sync Error:", e);
      throw new Error("ไม่สามารถซิงก์ข้อมูลได้: " + e.message + "\n\nคำแนะนำ: กรุณาตรวจสอบให้แน่ใจว่า Web App URL ถูกต้อง และตั้งค่าการปรับใช้ Apps Script เป็น 'ทุกคน (Anyone)' แล้ว");
    }
  }
};

window.AppDB = AppDB;







