function handleReturnTool(e) {
    e.preventDefault();
    const tools = AppDB.getTools();
    const id = document.getElementById('return-tool-id').value;
    const condition = document.getElementById('return-tool-condition').value;
    const returner = document.getElementById('return-tool-borrower').value;
    const location = document.getElementById('return-tool-location').value;
    const auth = document.getElementById('return-tool-auth').value;
    
    // Get signature data
    let signatureData = null;
    if (typeof sigCanvas !== 'undefined' && sigCanvas) {
        signatureData = sigCanvas.toDataURL('image/png');
    }
    
    const t = tools.find(x => x.id === id);
    if(t) {
        t.current_project = location;
        t.current_borrower = null;
        t.status = condition === 'damaged' ? 'damaged' : 'ready';
        saveToolsArray(tools);
        logToolAction(t.name, 'return', location, returner);
        // We could also log signatureData if needed, but for now we just process the return
        closeModal('return-tool-modal');
        renderTools();
        showCenterAlert('???????????????????', ??????????  ???????????????  ?????????? );
    }
}
