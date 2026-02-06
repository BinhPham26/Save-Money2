/**
 * BACKEND.GS - Google Apps Script
 * 
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Vào https://sheets.new để tạo Google Sheet mới.
 * 2. Đổi tên Sheet1 thành "Users".
 * 3. Hàng 1 (Header): A1: "Username", B1: "Password", C1: "Data", D1: "LastUpdated".
 * 4. Vào Tiện ích mở rộng (Extensions) > Apps Script.
 * 5. Xóa code cũ, paste toàn bộ code này vào.
 * 6. Nhấn Deploy (Triển khai) > New Deployment (Tạo triển khai mới).
 * 7. Chọn loại: Web App.
 * 8. Description: "SmartSpend API".
 * 9. Execute as: Me (Tôi).
 * 10. Who has access: Anyone (Bất kỳ ai). <-- QUAN TRỌNG
 * 11. Copy URL Web App (bắt đầu bằng https://script.google.com/macros/s/...).
 * 12. Dán URL này vào biến API_URL trong file js/auth.js (sẽ tạo ở bước sau).
 */

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const customCorsHeader = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    // Check parameters
    if (!e || !e.parameter) {
       return ContentService.createTextOutput(JSON.stringify({ success: false, message: "No parameters" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const action = e.parameter.action;
    const username = e.parameter.username;
    const password = e.parameter.password;
    const data = e.parameter.data; // JSON string for users data
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Users");
    
    if (!sheet) {
      return responseJSON({ success: false, message: "Sheet 'Users' not found" });
    }

    if (action === "register") {
      return handleRegister(sheet, username, password);
    } else if (action === "login") {
      return handleLogin(sheet, username, password);
    } else if (action === "save") {
      return handleSave(sheet, username, password, data);
    } else if (action === "load") {
      return handleLoad(sheet, username, password);
    } else {
      return responseJSON({ success: false, message: "Invalid action" });
    }

  } catch (err) {
    return responseJSON({ success: false, message: "Error: " + err.toString() });
  }
}

function handleRegister(sheet, username, password) {
  if (!username || !password) return responseJSON({ success: false, message: "Missing info" });
  
  const users = sheet.getDataRange().getValues();
  // Check duplicate
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] == username) {
      return responseJSON({ success: false, message: "Username exists" });
    }
  }
  
  sheet.appendRow([username, password, "{}", new Date()]);
  return responseJSON({ success: true, message: "Registered successfully" });
}

function handleLogin(sheet, username, password) {
  const rowIndex = findUserRow(sheet, username, password);
  if (rowIndex > 0) {
    return responseJSON({ success: true, message: "Login success" });
  }
  return responseJSON({ success: false, message: "Invalid credentials" });
}

function handleSave(sheet, username, password, data) {
  const rowIndex = findUserRow(sheet, username, password);
  if (rowIndex > 0) {
    // Update Data column (C is 3) and Timestamp (D is 4)
    sheet.getRange(rowIndex, 3).setValue(data);
    sheet.getRange(rowIndex, 4).setValue(new Date());
    return responseJSON({ success: true, message: "Saved" });
  }
  return responseJSON({ success: false, message: "Auth failed during save" });
}

function handleLoad(sheet, username, password) {
  const rowIndex = findUserRow(sheet, username, password);
  if (rowIndex > 0) {
    const data = sheet.getRange(rowIndex, 3).getValue();
    return responseJSON({ success: true, data: data });
  }
  return responseJSON({ success: false, message: "Auth failed during load" });
}

function findUserRow(sheet, username, password) {
  const users = sheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    // Simple check - in real app use hash!
    if (users[i][0] == username && users[i][1] == password) {
      return i + 1; // 1-indexed
    }
  }
  return -1;
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
