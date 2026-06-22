// fix.js v4 - ASCII only, no encoding issues

// SUCCESS POPUP (centered modal, replaces corner toast)
function showSuccessPopup(msg) {
    var old = document.getElementById('_sp_overlay');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = '_sp_overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
    var card = document.createElement('div');
    card.style.cssText = 'background:#fff;border-radius:16px;padding:32px 40px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;font-family:inherit;';
    var icon = document.createElement('div');
    icon.innerHTML = '<i class="fas fa-check-circle" style="font-size:48px;color:#10b981;margin-bottom:16px;"></i>';
    var txt = document.createElement('div');
    txt.style.cssText = 'font-size:16px;color:#1e293b;font-weight:600;line-height:1.7;margin-bottom:24px;white-space:pre-line;';
    txt.textContent = msg;
    var btn = document.createElement('button');
    btn.textContent = '\u0e15\u0e01\u0e25\u0e07';
    btn.style.cssText = 'background:#3b82f6;color:#fff;border:none;border-radius:10px;padding:12px 48px;font-size:16px;font-weight:700;cursor:pointer;';
    btn.onclick = function(){ ov.remove(); };
    ov.onclick = function(e){ if(e.target===ov) ov.remove(); };
    card.appendChild(icon);
    card.appendChild(txt);
    card.appendChild(btn);
    ov.appendChild(card);
    document.body.appendChild(ov);
    setTimeout(function(){ if(ov.parentNode) ov.remove(); }, 10000);
}

// Override showToast to use popup for success/error
var _oToast = window.showToast;
window.showToast = function(msg, type) {
    type = type || 'info';
    if (type === 'success' || type === 'error') {
        showSuccessPopup(msg);
    } else {
        if (typeof _oToast === 'function') try { _oToast(msg, type); } catch(e){}
    }
};

// EDIT MATERIAL - simple and direct
window.editMaterial = function(id) {
    console.log('[fix.js] editMaterial called with id:', id);
    var mats = AppDB.getMaterials();
    console.log('[fix.js] total materials:', mats.length);
    var m = null;
    for (var i = 0; i < mats.length; i++) {
        if (mats[i].id === id) { m = mats[i]; break; }
    }
    if (!m) {
        console.log('[fix.js] material NOT FOUND');
        alert('Not found: ' + id);
        return;
    }
    console.log('[fix.js] found material:', m.name);

    var e1 = document.getElementById('mat-form-id');
    var e2 = document.getElementById('mat-name');
    var e3 = document.getElementById('mat-code');
    var e4 = document.getElementById('mat-unit');
    var e5 = document.getElementById('mat-min-stock');
    var e6 = document.getElementById('mat-price');
    var e7 = document.getElementById('mat-image-url');

    console.log('[fix.js] fields:', !!e1, !!e2, !!e3, !!e4, !!e5, !!e6, !!e7);

    if (e1) e1.value = m.id;
    if (e2) e2.value = m.name || '';
    if (e3) e3.value = m.code || '';
    if (e4) e4.value = m.unit || '';
    if (e5) e5.value = m.min_stock || 0;
    if (e6) e6.value = m.price_per_unit || 0;
    if (e7) e7.value = '';

    var catEl = document.getElementById('mat-category');
    if (catEl && m.category) {
        var found = false;
        for (var j = 0; j < catEl.options.length; j++) {
            if (catEl.options[j].value === m.category) { catEl.selectedIndex = j; found = true; break; }
        }
        if (!found) {
            var o = document.createElement('option');
            o.value = m.category; o.text = m.category;
            catEl.appendChild(o); catEl.value = m.category;
        }
    }

    window._matEditImages = (Array.isArray(m.images) ? m.images.filter(Boolean) : []).slice();
    if (typeof fixRenderPreview === 'function') fixRenderPreview();

    var titleEl = document.getElementById('material-modal-title');
    if (titleEl) titleEl.textContent = '\u0e41\u0e01\u0e49\u0e44\u0e02\u0e27\u0e31\u0e2a\u0e14\u0e38: ' + m.name;

    var modal = document.getElementById('material-edit-modal');
    console.log('[fix.js] modal element:', !!modal);
    if (modal) {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.classList.add('open');
        console.log('[fix.js] modal opened OK');
    } else {
        console.error('[fix.js] material-edit-modal NOT FOUND in DOM');
        alert('Modal not found!');
    }
};

window._matEditImages = window._matEditImages || [];
window._matEditImageDeleteMode = false;
window.toggleMatImageEditMode = function() {
    window._matEditImageDeleteMode = !window._matEditImageDeleteMode;
    var btn = document.getElementById('btn-mat-image-edit-toggle');
    if (btn) {
        if (window._matEditImageDeleteMode) {
            btn.innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข';
            btn.style.backgroundColor = '#ef4444';
            btn.style.color = '#fff';
            btn.style.borderColor = '#ef4444';
        } else {
            btn.innerHTML = '<i class="fas fa-edit"></i> แก้ไขรูปภาพ';
            btn.style.backgroundColor = 'transparent';
            btn.style.color = 'var(--primary-color)';
            btn.style.borderColor = 'var(--primary-color)';
        }
    }
    fixRenderPreview();
};

window.openImagePreviewModal = function(src) {
    var modal = document.getElementById('image-preview-modal');
    var img = document.getElementById('image-preview-full');
    if (modal && img) {
        img.src = src;
        document.body.appendChild(modal); // ESCAPE CSS TRAPS
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('opacity', '1', 'important');
        modal.style.setProperty('pointer-events', 'auto', 'important');
        modal.style.setProperty('z-index', '2147483647', 'important');
        modal.classList.add('open');
    }
};

function fixRenderPreview() {
    var p = document.getElementById('mat-edit-image-preview');
    if (!p) return;
    p.innerHTML = '';
    (window._matEditImages||[]).forEach(function(src, idx) {
        var w = document.createElement('div');
        w.style.cssText = 'position:relative;display:inline-block;margin:4px;';
        
        var img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid #e2e8f0;cursor:pointer; transition:transform 0.2s;';
        img.onmouseover = function() { img.style.transform = 'scale(1.05)'; };
        img.onmouseout = function() { img.style.transform = 'scale(1)'; };
        img.onclick = function() {
            window.openImagePreviewModal(src);
        };
        
        var d = document.createElement('button');
        d.type='button'; d.innerHTML='&times;';
        var dDisplay = window._matEditImageDeleteMode ? 'block' : 'none';
        d.style.cssText='position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:16px;line-height:1;padding:0; display:' + dDisplay + ';';
        d.onclick=(function(i){return function(){window._matEditImages.splice(i,1);fixRenderPreview();};})(idx);
        
        w.appendChild(img); w.appendChild(d); p.appendChild(w);
    });
}
window.renderMatEditImagePreview = fixRenderPreview;

// IMAGE UPLOAD
window.handleMatImageUpload = function(input) {
    Array.from(input.files).forEach(function(file){
        var r=new FileReader();
        r.onload=function(e){
            var i2=new Image();
            i2.onload=function(){
                var c=document.createElement('canvas');
                var w=i2.width,h=i2.height,M=800;
                if(w>h&&w>M){h=Math.round(h*M/w);w=M;}else if(h>M){w=Math.round(w*M/h);h=M;}
                c.width=w;c.height=h;
                c.getContext('2d').drawImage(i2,0,0,w,h);
                window._matEditImages.push(c.toDataURL('image/jpeg',0.7));
                fixRenderPreview();
            };
            i2.src=e.target.result;
        };
        r.readAsDataURL(file);
    });
    input.value='';
};

// SAVE MATERIAL
window.handleSaveMaterial = function(e) {
    e.preventDefault();
    var id   = (document.getElementById('mat-form-id') ||{}).value||'';
    var name = ((document.getElementById('mat-name')   ||{}).value||'').trim();
    if (!name) { showSuccessPopup('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d\u0e27\u0e31\u0e2a\u0e14\u0e38'); return; }
    var urlVal=(document.getElementById('mat-image-url')||{}).value||'';
    var images=(window._matEditImages&&window._matEditImages.length>0)
        ?window._matEditImages.slice()
        :(urlVal?[urlVal]:[(AppDB.MOCK_IMAGES&&AppDB.MOCK_IMAGES.material)||'']);
    var nm={
        id:id||('m'+Date.now()),name:name,
        code:(document.getElementById('mat-code')||{}).value||'',
        category:(document.getElementById('mat-category')||{}).value||'',
        unit:(document.getElementById('mat-unit')||{}).value||'',
        min_stock:parseInt((document.getElementById('mat-min-stock')||{}).value)||0,
        price_per_unit:parseFloat((document.getElementById('mat-price')||{}).value)||0,
        stock_a_qty:0,stock_b_qty:0,stock_c_qty:0,images:images
    };
    var mats=AppDB.getMaterials();
    if(id){
        var idx=mats.findIndex(function(x){return x.id===id;});
        if(idx!==-1){nm.stock_a_qty=mats[idx].stock_a_qty||0;nm.stock_b_qty=mats[idx].stock_b_qty||0;nm.stock_c_qty=mats[idx].stock_c_qty||0;mats[idx]=nm;}
        else mats.push(nm);
    }else mats.push(nm);
    saveToDB('Materials',mats);
    closeModal('material-edit-modal');
    renderMaterials();
    showSuccessPopup('\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e27\u0e31\u0e2a\u0e14\u0e38\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08\n'+name);
    window._matEditImages=[];
};

// WITHDRAW FORM SUBMIT
window.handleWithdrawMaterialFinal = function(e) {
    e.preventDefault();
    var matName=((document.getElementById('withdraw-mat-name')||{}).value||'').trim();
    var qty=parseInt((document.getElementById('withdraw-mat-qty')||{}).value)||0;
    var locSel=document.getElementById('withdraw-mat-location');
    var location=locSel?locSel.value:'Stock A';
    var borrower=(document.getElementById('withdraw-mat-borrower')||{}).value||'';
    if(!matName){showSuccessPopup('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d\u0e27\u0e31\u0e2a\u0e14\u0e38');return;}
    if(qty<=0){showSuccessPopup('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e30\u0e1a\u0e38\u0e08\u0e33\u0e19\u0e27\u0e19');return;}
    if(!borrower){showSuccessPopup('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e1c\u0e39\u0e49\u0e40\u0e1a\u0e34\u0e01');return;}
    var mats=AppDB.getMaterials();
    var m=mats.find(function(x){return x.name===matName;})||mats.find(function(x){return x.name&&x.name.toLowerCase().indexOf(matName.toLowerCase())>=0;});
    if(!m){showSuccessPopup('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e27\u0e31\u0e2a\u0e14\u0e38 "'+matName+'"');return;}
    var cm={'Stock A':'stock_a_qty','Stock B':'stock_b_qty','Stock C':'stock_c_qty','Stock D':'stock_d_qty'};
    var whs=AppDB.getWarehouses?AppDB.getWarehouses():[];
    var wh=whs.find(function(w){return w.code===location||w.name===location;});
    var field=cm[(wh?wh.code:location)]||'stock_a_qty';
    var avail=m[field]||0;
    if(avail<qty){showSuccessPopup('\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e40\u0e1e\u0e35\u0e22\u0e07\u0e1e\u0e2d (\u0e21\u0e35 '+avail+' '+(m.unit||'\u0e0a\u0e34\u0e49\u0e19')+')');return;}
    m[field]=avail-qty;
    saveToDB('Materials',mats);
    var proj=(document.getElementById('withdraw-mat-project')||{}).value||location;
    if(typeof logMaterialAction==='function') logMaterialAction(m.name,'withdraw',qty,proj,borrower);
    closeModal('withdraw-material-modal');
    renderMaterials();
    e.target.reset();
    showSuccessPopup('\u0e40\u0e1a\u0e34\u0e01\u0e27\u0e31\u0e2a\u0e14\u0e38\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08\n\n'+m.name+'\n\u0e08\u0e33\u0e19\u0e27\u0e19: '+qty+' '+(m.unit||'\u0e0a\u0e34\u0e49\u0e19')+'\n\u0e08\u0e32\u0e01: '+location+'\n\u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d: '+m[field]+' '+(m.unit||'\u0e0a\u0e34\u0e49\u0e19'));
    if(locSel) ['Stock A','Stock B','Stock C'].forEach(function(n,i){if(locSel.options[i]) locSel.options[i].text=n;});
    var inf=document.getElementById('withdraw-stock-info');
    if(inf) inf.textContent='';
};

// RECEIVE FORM
window.handleReceiveMaterialFixed = function(e) {
    e.preventDefault();
    var matName=((document.getElementById('receive-mat-name')||{}).value||'').trim();
    var qty=parseInt((document.getElementById('receive-mat-qty')||{}).value)||0;
    var location=(document.getElementById('receive-mat-location')||{}).value||'Stock A';
    if(!matName||qty<=0){showSuccessPopup('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d\u0e27\u0e31\u0e2a\u0e14\u0e38\u0e41\u0e25\u0e30\u0e08\u0e33\u0e19\u0e27\u0e19');return;}
    var mats=AppDB.getMaterials();
    var m=mats.find(function(x){return x.name===matName;})||mats.find(function(x){return x.name&&x.name.toLowerCase().indexOf(matName.toLowerCase())>=0;});
    if(!m){showSuccessPopup('\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e27\u0e31\u0e2a\u0e14\u0e38 "'+matName+'"');return;}
    var cm={'Stock A':'stock_a_qty','Stock B':'stock_b_qty','Stock C':'stock_c_qty','Stock D':'stock_d_qty'};
    var field=cm[location]||'stock_a_qty';
    m[field]=(m[field]||0)+qty;
    saveToDB('Materials',mats);
    if(typeof logMaterialAction==='function') logMaterialAction(m.name,'receive',qty,location,typeof currentUser!=='undefined'&&currentUser?currentUser.name:'');
    closeModal('receive-material-modal');
    renderMaterials();
    e.target.reset();
    showSuccessPopup('\u0e23\u0e31\u0e1a\u0e27\u0e31\u0e2a\u0e14\u0e38\u0e40\u0e02\u0e49\u0e32\u0e04\u0e25\u0e31\u0e07\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08\n\n'+m.name+'\n\u0e08\u0e33\u0e19\u0e27\u0e19: +'+qty+' '+(m.unit||'\u0e0a\u0e34\u0e49\u0e19')+'\n\u0e04\u0e25\u0e31\u0e07: '+location+'\n\u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d: '+m[field]+' '+(m.unit||'\u0e0a\u0e34\u0e49\u0e19'));
};

// ADD MATERIAL
window.openAddMaterialModal = function() {
    var fm=document.getElementById('add-mat-form');
    if(fm) fm.reset();
    var container=document.getElementById('add-mat-stocks-container');
    if(container){
        var whs=AppDB.getWarehouses?AppDB.getWarehouses():[{id:'w1',code:'Stock A',name:'Stock A'},{id:'w2',code:'Stock B',name:'Stock B'},{id:'w3',code:'Stock C',name:'Stock C'}];
        container.innerHTML='';
        whs.forEach(function(w){
            container.innerHTML+='<div class="form-group"><label class="form-label">'+w.name+'</label><input type="number" id="addmat-wh-'+w.id+'" data-whcode="'+w.code+'" class="form-control" min="0" value="0"></div>';
        });
    }
    openModal('material-add-modal');
};

window.handleAddMaterialForm = function(e) {
    e.preventDefault();
    var name=((document.getElementById('add-mat-name')||{}).value||'').trim();
    if(!name){showSuccessPopup('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e30\u0e1a\u0e38\u0e0a\u0e37\u0e48\u0e2d\u0e27\u0e31\u0e2a\u0e14\u0e38');return;}
    var cat=(document.getElementById('add-mat-category')||{}).value||'';
    var unit=((document.getElementById('add-mat-unit')||{}).value||'\u0e0a\u0e34\u0e49\u0e19').trim();
    var price=parseFloat((document.getElementById('add-mat-price')||{}).value)||0;
    var minS=parseInt((document.getElementById('add-mat-min')||{}).value)||0;
    var cm={'Stock A':'stock_a_qty','Stock B':'stock_b_qty','Stock C':'stock_c_qty','Stock D':'stock_d_qty','Stock E':'stock_e_qty','Stock F':'stock_f_qty'};
    var sd={stock_a_qty:0,stock_b_qty:0,stock_c_qty:0};
    document.querySelectorAll('#add-mat-stocks-container input[data-whcode]').forEach(function(inp){
        var f=cm[inp.getAttribute('data-whcode')]||'stock_a_qty';
        sd[f]=(sd[f]||0)+(parseInt(inp.value)||0);
    });
    var nm={id:'m'+Date.now(),name:name,code:'',category:cat,unit:unit,min_stock:minS,price_per_unit:price,stock_a_qty:sd.stock_a_qty,stock_b_qty:sd.stock_b_qty,stock_c_qty:sd.stock_c_qty,images:[(AppDB.MOCK_IMAGES&&AppDB.MOCK_IMAGES.material)||'']};
    Object.keys(sd).forEach(function(k){if(!nm.hasOwnProperty(k)) nm[k]=sd[k];});
    var mats=AppDB.getMaterials();
    mats.push(nm);
    saveToDB('Materials',mats);
    closeModal('material-add-modal');
    renderMaterials();
    e.target.reset();
    showSuccessPopup('\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e27\u0e31\u0e2a\u0e14\u0e38\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08\n\n'+name+'\n\u0e2b\u0e21\u0e27\u0e14: '+(cat||'-'));
};

// STOCK INFO
window.updateWithdrawStockInfo = function(location) {
    var infoDiv=document.getElementById('withdraw-stock-info');
    var locSel=document.getElementById('withdraw-mat-location');
    if(!infoDiv) return;
    var nameVal=((document.getElementById('withdraw-mat-name')||{}).value||'').trim();
    var mat=window._withdrawCurrentMat;
    if(!mat&&nameVal) mat=AppDB.getMaterials().find(function(x){return x.name&&x.name.toLowerCase().indexOf(nameVal.toLowerCase())>=0;});
    var cm={'Stock A':'stock_a_qty','Stock B':'stock_b_qty','Stock C':'stock_c_qty'};
    if(mat&&locSel){
        var whs=AppDB.getWarehouses?AppDB.getWarehouses():[{code:'Stock A',name:'Stock A'},{code:'Stock B',name:'Stock B'},{code:'Stock C',name:'Stock C'}];
        whs.forEach(function(w,i){if(locSel.options[i]){var f=cm[w.code]||'stock_a_qty';locSel.options[i].text=w.name+' ('+(mat[f]||0)+' '+(mat.unit||'')+')';}});
        var qty=mat[cm[location]||'stock_a_qty']||0;
        infoDiv.textContent='\u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d\u0e43\u0e19 '+location+': '+qty+' '+(mat.unit||'\u0e0a\u0e34\u0e49\u0e19');
        infoDiv.style.color=qty>0?'#3b82f6':'#ef4444';
    }else{
        infoDiv.textContent='';
        if(locSel) ['Stock A','Stock B','Stock C'].forEach(function(n,i){if(locSel.options[i]) locSel.options[i].text=n;});
    }
};

// MIC PERMISSION
window.requestMicPermission = function() {
    if(window._micPermissionRequested) return;
    window._micPermissionRequested=true;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({audio:true})
        .then(function(stream){stream.getTracks().forEach(function(t){t.stop();});window._voicePermissionGranted=true;window._voicePermissionWarned=true;})
        .catch(function(){});
};

// VOICE
window.startVoice = function(inputId, btnId) {
    if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){if(!window._voiceNotSupportedWarned){window._voiceNotSupportedWarned=true;showSuccessPopup('\u0e40\u0e1a\u0e23\u0e32\u0e27\u0e4c\u0e40\u0e0b\u0e2d\u0e23\u0e4c\u0e44\u0e21\u0e48\u0e23\u0e2d\u0e07\u0e23\u0e31\u0e1a\u0e23\u0e30\u0e1a\u0e1a\u0e40\u0e2a\u0e35\u0e22\u0e07');}return;}
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    var rec=new SR();rec.lang='th-TH';rec.interimResults=false;rec.maxAlternatives=1;
    var btn=document.getElementById(btnId);var ob=btn?btn.style.background:'';var oc=btn?btn.style.color:'';
    if(btn){btn.style.background='#ef4444';btn.style.color='#fff';}
    rec.onresult=function(ev){var text=ev.results[0][0].transcript;var inp=document.getElementById(inputId);if(inp){inp.value=text;inp.dispatchEvent(new Event('input'));}if(btn){btn.style.background=ob;btn.style.color=oc;}if(inputId==='mat-search'&&typeof renderMaterials==='function') renderMaterials();};
    rec.onerror=function(ev){if(btn){btn.style.background=ob;btn.style.color=oc;}if(ev.error==='not-allowed'&&!window._voicePermissionWarned){window._voicePermissionWarned=true;showSuccessPopup('\u0e01\u0e23\u0e38\u0e13\u0e32\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e44\u0e21\u0e42\u0e04\u0e23\u0e42\u0e1f\u0e19');}};
    rec.onend=function(){if(btn){btn.style.background=ob;btn.style.color=oc;}};
    rec.start();
};

console.log('[fix.js v4] OK - editMaterial ready');