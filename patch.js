const fs = require('fs');
let code = fs.readFileSync('logic.js', 'utf8');

const regex = /saveToolsArray\(tools\);\s*closeModal\('tool-form-modal'\);\s*renderTools\(\);/;

const newCode = `    // --- NEW APPROVAL LOGIC ---
    AppDB.addApproval({
        type: 'tool',
        action: isNew ? 'add' : 'edit',
        data: t,
        requested_by: (typeof currentUser !== 'undefined' && currentUser ? currentUser.name : 'Unknown')
    });
    
    AppDB.notifyTelegram('?? <b>?????????????????????</b>\\n??????: <b>' + (isNew ? '???????????????????' : '?????????????????????') + '</b>\\n??????: ' + t.name + '\\n?????: ' + (typeof currentUser !== 'undefined' && currentUser ? currentUser.name : 'Unknown'));

    if (typeof window.updateApprovalBadge === 'function') window.updateApprovalBadge();
    
    closeModal('tool-form-modal');
    
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            html: '<div style="font-size:24px; font-weight:bold; color:#10B981; margin-bottom:10px;"><i class="fas fa-check-circle"></i> ????????????????????????????</div>' +
                  '<div style="font-size:18px;">' + t.name + '</div>' +
                  '<div style="color:#ef4444; font-weight:bold; margin-top:20px; padding:10px; background:#fee2e2; border-radius:8px; display:inline-block;">??????????????</div>',
            confirmButtonText: '????',
            confirmButtonColor: '#3b82f6',
            width: '400px'
        });
    } else {
        showToast('?????????????????????????????????', 'success');
    }`;

if (regex.test(code)) {
    code = code.replace(regex, newCode);
    fs.writeFileSync('logic.js', code, 'utf8');
    console.log('Successfully replaced saveToolsArray in logic.js');
} else {
    console.log('Could not find regex match in logic.js');
}
