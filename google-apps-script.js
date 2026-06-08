/**
 * Google Apps Script สำหรับระบบบริหารสต็อกสินค้าและเครื่องมือช่าง
 * บริษัท Probuild Samui Development
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheets ใหม่
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) > "Apps Script"
 * 3. ลบโค้ดเก่าในโปรเจกต์ออก แล้วคัดลอกโค้ดนี้ไปวางทั้งหมด
 * 4. กดปุ่มบันทึก (รูปแผ่นดิสก์)
 * 5. กดปุ่ม "การใช้งานจริง" (Deploy) > "การจัดการการใช้งานจริงใหม่" (New Deployment)
 * 6. เลือกประเภทการปรับใช้งานเป็น "เว็บแอป" (Web App)
 * 7. ตั้งค่า:
 *    - คำอธิบาย: ระบบจัดการสต็อก
 *    - ผู้ที่มีสิทธิ์เข้าถึง: "ทุกคน" (Anyone) ** สำคัญมาก เพื่อให้แอปเชื่อมต่อได้
 * 8. กด "ปรับใช้" (Deploy) และอนุญาตสิทธิ์เข้าถึงบัญชี (Authorize Access)
 * 9. คัดลอก "URL ของเว็บแอป" (Web App URL) เพื่อนำไปใส่ในเมนูตั้งค่าของแอปพลิเคชัน
 */

function doGet(e) {
  // สร้างชีตเริ่มต้นหากไม่มีอยู่
  initSheets();
  
  // ตรวจเช็คความถูกต้องป้องกันการกด Run โดยตรงในหน้าแก้ไขโค้ด Apps Script
  if (!e || !e.parameter) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "API เชื่อมต่อสำเร็จ (ทดสอบระบบ doGet จากหน้าต่างแก้ไขโค้ดสำเร็จ)" 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
  
  var action = e.parameter.action;
  
  if (action === "fetch") {
    return ContentService.createTextOutput(JSON.stringify(fetchAllData()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "API เชื่อมต่อสำเร็จ" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  initSheets();
  
  // ตรวจเช็คความถูกต้องป้องกันการกด Run โดยตรงในหน้าแก้ไขโค้ด Apps Script หรือคำร้องขอเปล่า
  if (!e || !e.postData || !e.postData.contents) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: "ไม่พบข้อมูลส่งมา (หากนี่เป็นการกด Run ทดสอบจาก Apps Script Editor แสดงว่าฟังก์ชัน doPost พร้อมใช้งานแล้ว)" 
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var result = {};
    
    if (action === "sync") {
      result = syncData(data.payload);
    } else {
      result = { status: "error", message: "ไม่รู้จัก Action ที่ร้องขอ" };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ตารางและหัวข้อคอลัมน์เริ่มต้น
var TABLES = {
  Users: ["id", "username", "password", "name", "role", "status"],
  Materials: ["id", "category", "name", "stock_a_qty", "stock_b_qty", "stock_c_qty", "stock_d_qty", "stock_e_qty", "unit", "price_per_unit", "min_stock", "images", "last_updated"],
  Tools: ["id", "category", "name", "serial_number", "current_project", "status", "repair_status", "repair_date", "purchase_shop", "purchase_date", "purchase_price", "warranty_expiry", "images", "last_updated", "storage_location"],
  MaterialLogs: ["id", "timestamp", "project", "material_id", "material_name", "quantity", "price_at_time", "stock_location", "type", "borrower", "authorizer"],
  ToolLogs: ["id", "timestamp", "action", "tool_id", "tool_name", "from_project", "to_project", "borrower", "authorizer", "notes"],
  Projects: ["id", "name", "description"],
  Warehouses: ["id", "code", "name"]
};

// ตรวจสอบและสร้างตารางต่างๆ ในชีต
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var sheetName in TABLES) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(TABLES[sheetName]);
      // ปรับแต่งสีหัวข้อเพื่อความสวยงามในชีต
      var headerRange = sheet.getRange(1, 1, 1, TABLES[sheetName].length);
      headerRange.setBackground("#0F172A");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
    }
  }
}

// ดึงข้อมูลทั้งหมดจากทุกแท็บในรูปแบบ JSON
function fetchAllData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = {};
  
  for (var sheetName in TABLES) {
    var sheet = ss.getSheetByName(sheetName);
    var rows = sheet.getDataRange().getValues();
    var headers = rows[0];
    var list = [];
    
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var val = row[j];
        // แปลงฟอร์แมตข้อมูลพิเศษ (เช่นวันที่หรือ JSON รูปภาพ)
        if (val instanceof Date) {
          obj[headers[j]] = val.toISOString().split('T')[0]; // ส่งแค่วันที่ YYYY-MM-DD
        } else {
          obj[headers[j]] = val;
        }
      }
      list.push(obj);
    }
    data[sheetName] = list;
  }
  
  return data;
}

// อัปเดตและซิงก์ข้อมูลจากแอปพลิเคชัน
function syncData(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. ซิงก์ข้อมูลพนักงาน (Users)
  if (payload.Users) {
    updateTable("Users", payload.Users);
  }
  
  // 2. ซิงก์ข้อมูลวัสดุ (Materials)
  if (payload.Materials) {
    updateTable("Materials", payload.Materials);
  }
  
  // 3. ซิงก์ข้อมูลเครื่องมือ (Tools)
  if (payload.Tools) {
    updateTable("Tools", payload.Tools);
  }
  
  // 4. บันทึกประวัติวัสดุ (MaterialLogs) - เพิ่มอย่างเดียวไม่มีการอัปเดตบรรทัดเดิม
  if (payload.MaterialLogs && payload.MaterialLogs.length > 0) {
    appendLogs("MaterialLogs", payload.MaterialLogs);
  }
  
  // 5. บันทึกประวัติเครื่องมือ (ToolLogs) - เพิ่มอย่างเดียว
  if (payload.ToolLogs && payload.ToolLogs.length > 0) {
    appendLogs("ToolLogs", payload.ToolLogs);
  }
  
  // 6. ซิงก์ข้อมูลโครงการ (Projects)
  if (payload.Projects) {
    updateTable("Projects", payload.Projects);
  }
  
  // 7. ซิงก์ข้อมูลคลังสินค้า (Warehouses)
  if (payload.Warehouses) {
    updateTable("Warehouses", payload.Warehouses);
  }
  
  // ส่งข้อมูลล่าสุดกลับไปอัปเดตในฝั่งแอป
  return {
    status: "success",
    message: "ซิงก์ข้อมูลสำเร็จ",
    data: fetchAllData()
  };
}

// อัปเดตหรือแทรกแถวข้อมูลในชีตตาม ID
function updateTable(sheetName, items) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  
  // สร้าง Map ค้นหาแถวตาม id ในคอลัมน์แรก
  var idRowMap = {};
  for (var i = 1; i < rows.length; i++) {
    var rowId = rows[i][0].toString();
    if (rowId) {
      idRowMap[rowId] = i + 1; // 1-indexed สำหรับชีต
    }
  }
  
  items.forEach(function(item) {
    var id = item.id.toString();
    var newRow = [];
    
    // เรียงลำดับคอลัมน์ให้ตรงตามที่ตั้งค่า
    headers.forEach(function(header) {
      var val = item[header];
      if (val === undefined || val === null) {
        newRow.push("");
      } else if (Array.isArray(val) || typeof val === "object") {
        newRow.push(JSON.stringify(val)); // แปลง List หรือ Object ให้เป็น JSON String เช่นภาพ
      } else {
        newRow.push(val);
      }
    });
    
    var rowNum = idRowMap[id];
    if (rowNum) {
      // อัปเดตแถวเดิม
      var range = sheet.getRange(rowNum, 1, 1, headers.length);
      range.setValues([newRow]);
    } else {
      // เขียนแถวใหม่ต่อท้าย
      sheet.appendRow(newRow);
    }
  });
}

// เพิ่มประวัติ (Logs) เข้าไปต่อท้ายแถวล่าสุดเสมอ
function appendLogs(sheetName, logs) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  
  // ดึง ID ล่าสุดในตารางเพื่อหลีกเลี่ยงการบันทึกประวัติซ้ำซ้อน
  var existingIds = {};
  for (var i = 1; i < rows.length; i++) {
    existingIds[rows[i][0].toString()] = true;
  }
  
  logs.forEach(function(log) {
    var id = log.id.toString();
    if (!existingIds[id]) {
      var newRow = [];
      headers.forEach(function(header) {
        var val = log[header];
        if (val === undefined || val === null) {
          newRow.push("");
        } else if (Array.isArray(val) || typeof val === "object") {
          newRow.push(JSON.stringify(val));
        } else {
          newRow.push(val);
        }
      });
      sheet.appendRow(newRow);
    }
  });
}
