window.logicOpenToolReturnModal = function(toolId = '') {
    document.getElementById('return-tool-id').value = toolId;
    const t = AppDB.getTools().find(x => x.id === toolId);
    if (t) {
        document.getElementById('return-tool-display-name').textContent = t.name;
    }

    const selectBorrower = document.getElementById('return-tool-borrower');
    if (selectBorrower) {
        selectBorrower.innerHTML = '<option value="" disabled selected>-- ??????????????? --</option>';
        const users = AppDB.getUsers();
        users.forEach(u => {
            selectBorrower.innerHTML += <option value=" + u.name + "> + u.name + </option>;
        });
        if (t && t.current_borrower) {
            selectBorrower.value = t.current_borrower;
        }
    }

    const selectLocation = document.getElementById('return-tool-location');
    if (selectLocation) {
        selectLocation.innerHTML = '<option value="" disabled selected>-- ???????????????? --</option>';
        const whs = AppDB.getWarehouses();
        whs.forEach(w => {
            selectLocation.innerHTML += <option value=" + w.name + "> + w.name + </option>;
        });
        // Default to base warehouse if exists
        const baseWh = whs.find(w => w.name === '??????????????');
        if (baseWh) selectLocation.value = baseWh.name;
    }

    document.getElementById('return-tool-auth').value = currentUser?.name || 'Admin';

    clearSignature();
    initSignatureCanvas();

    openModal('return-tool-modal');
};

let isDrawingSignature = false;
let sigCtx = null;
let sigCanvas = null;

function initSignatureCanvas() {
    sigCanvas = document.getElementById('return-tool-signature');
    if (!sigCanvas) return;
    
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';
    sigCtx.strokeStyle = '#000';

    sigCanvas.removeEventListener('mousedown', startDrawing);
    sigCanvas.removeEventListener('mousemove', drawSignature);
    sigCanvas.removeEventListener('mouseup', stopDrawing);
    sigCanvas.removeEventListener('mouseout', stopDrawing);
    
    sigCanvas.removeEventListener('touchstart', startDrawingTouch, {passive: false});
    sigCanvas.removeEventListener('touchmove', drawSignatureTouch, {passive: false});
    sigCanvas.removeEventListener('touchend', stopDrawing);

    sigCanvas.addEventListener('mousedown', startDrawing);
    sigCanvas.addEventListener('mousemove', drawSignature);
    sigCanvas.addEventListener('mouseup', stopDrawing);
    sigCanvas.addEventListener('mouseout', stopDrawing);

    sigCanvas.addEventListener('touchstart', startDrawingTouch, {passive: false});
    sigCanvas.addEventListener('touchmove', drawSignatureTouch, {passive: false});
    sigCanvas.addEventListener('touchend', stopDrawing);
}

function getCursorPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (event.touches) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

function startDrawing(e) {
    isDrawingSignature = true;
    const pos = getCursorPosition(sigCanvas, e);
    sigCtx.beginPath();
    sigCtx.moveTo(pos.x, pos.y);
}

function startDrawingTouch(e) {
    e.preventDefault();
    startDrawing(e);
}

function drawSignature(e) {
    if (!isDrawingSignature) return;
    const pos = getCursorPosition(sigCanvas, e);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
}

function drawSignatureTouch(e) {
    e.preventDefault();
    drawSignature(e);
}

function stopDrawing() {
    isDrawingSignature = false;
    if (sigCtx) sigCtx.closePath();
}

window.clearSignature = function() {
    if (sigCanvas && sigCtx) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }
};
