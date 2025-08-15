(function(){
  const stage = document.getElementById('stage');
  const layer = document.getElementById('shapes');
  const live = document.getElementById('live');
  const statusEl = document.getElementById('status');

  const toolbox = document.getElementById('toolbox');
  const showToolsBtn = document.getElementById('showTools');
  const hideToolsBtn = document.getElementById('hideTools');
  const toggleToolsTop = document.getElementById('toggleToolsTop');
  function showTools(){ toolbox.style.display='block'; showToolsBtn.style.display='none'; }
  function hideTools(){ toolbox.style.display='none'; showToolsBtn.style.display='block'; }
  hideTools(); showTools();
  showToolsBtn.addEventListener('click', showTools);
  hideToolsBtn.addEventListener('click', hideTools);
  toggleToolsTop.addEventListener('click', ()=>{ (toolbox.style.display==='none')?showTools():hideTools(); });

  const lockBadge = document.getElementById('lockBadge');

  // === 顏色狀態 ===
  let currentColor = '#233348';  // 預設顏色
  const colorRow = document.getElementById('colorRow');
  const colorPicker = document.getElementById('colorPicker');

  // === 格線與吸附狀態（整合進 IIFE） ===
  let gridOn = false;
  let snapOn = true;
  const GRID = 24; // 與 CSS --grid-size 一致
  const HALF = GRID / 2;
  function snap(v){ return Math.round(v / GRID) * GRID; }
  function snapHalf(v){ return Math.round(v / HALF) * HALF; } // 給圓形半徑用，手感更順

  const btnToggleGrid = document.getElementById('btnToggleGrid');
  const btnToggleSnap = document.getElementById('btnToggleSnap');

  if (btnToggleGrid) {
    btnToggleGrid.addEventListener('click', ()=>{
      gridOn = !gridOn;
      stage.classList.toggle('show-grid', gridOn);
      btnToggleGrid.setAttribute('aria-pressed', String(gridOn));
      btnToggleGrid.textContent = gridOn ? '隱藏格線' : '顯示格線';
      setStatus(gridOn ? '✅ 已顯示格線' : '🟦 已隱藏格線');
    });
  }
  if (btnToggleSnap) {
    btnToggleSnap.addEventListener('click', ()=>{
      snapOn = !snapOn;
      btnToggleSnap.setAttribute('aria-pressed', String(snapOn));
      btnToggleSnap.textContent = snapOn ? '吸附：開' : '吸附：關';
      setStatus(snapOn ? '✅ 吸附：開' : '🟦 吸附：關');
    });
  }

  function setStatus(msg){ statusEl.textContent = msg; }
  function announce(msg){ live.textContent = ''; setTimeout(()=>{ live.textContent = msg; }, 10); }

  let uidCounter = 0; const uid = (p='id') => `${p}-${Date.now().toString(36)}-${(uidCounter++)}`;

  function createGroup(roleLabel='未命名'){
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.classList.add('shape');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role','img');
    g.setAttribute('aria-label', roleLabel);
    g.setAttribute('data-name', roleLabel);
    g.setAttribute('data-locked','false');
    g.setAttribute('aria-selected','false');
    g.id = uid('shape');

      // ★ 新增：SVG title + aria-labelledby（多數行動讀屏最吃這個）
    const titleEl = document.createElementNS('http://www.w3.org/2000/svg','title');
    const titleId = uid('title');
    titleEl.setAttribute('id', titleId);
    titleEl.textContent = roleLabel;
    g.setAttribute('aria-labelledby', titleId);
    g.appendChild(titleEl);

    g.addEventListener('keydown', onShapeKey);
    g.addEventListener('dblclick', ()=> renameShape(g));
    let pressTimer=null;
    g.addEventListener('touchstart', ()=>{ pressTimer=setTimeout(()=>renameShape(g), 600); }, {passive:true});
    g.addEventListener('touchend', ()=>{ if(pressTimer) clearTimeout(pressTimer); });
    return g;
  }

  // 單一版本 selectShape（會同步顏色選取器）
  function selectShape(g){
    document.querySelectorAll('.shape[aria-selected="true"]').forEach(el=> el.setAttribute('aria-selected','false'));
    if (g){
      g.setAttribute('aria-selected','true');
      g.focus({preventScroll:true});
      updateLockBadge(g);
      const c = g.getAttribute('data-color');
      if(c){ currentColor = c; try{ colorPicker.value = c; }catch(_){} }
      announce(`已選取：${g.getAttribute('data-name')}`);
    } else {
      updateLockBadge(null);
    }
  }

  function updateLockBadge(g){ if(!g){ lockBadge.textContent='未選取'; return;} lockBadge.textContent = g.getAttribute('data-locked')==='true'?'已鎖定':'可編輯'; }

  // === 形狀建立 ===
  function addRect(){
    const g = createGroup('未命名方形');
    const x=60, y=60, w=120, h=80;
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', w); rect.setAttribute('height', h);
    rect.setAttribute('rx', 10);
    rect.setAttribute('fill', currentColor);
    rect.setAttribute('stroke', '#2f435a'); rect.setAttribute('stroke-width','1.5');
    g.setAttribute('data-color', currentColor);

    const outline = svg('rect', {x:x-3,y:y-3,width:w+6,height:h+6,rx:12, class:'outline','pointer-events':'none'});
    const label = svgText(x+w/2, y+h/2, '未命名', 'middle');
    label.setAttribute('fill', contrastTextColor(currentColor));
    const handle = resizeHandle(x+w-8, y+h-8);
    g.append(outline, rect, label, handle); layer.appendChild(g);

    // 拖曳：吸附
    enableDrag(g, {
      onMove:(dx,dy)=>{
        const nx = snapOn ? snap(x + dx) : (x + dx);
        const ny = snapOn ? snap(y + dy) : (y + dy);
        rect.setAttribute('x',nx); rect.setAttribute('y',ny);
        outline.setAttribute('x',nx-3); outline.setAttribute('y',ny-3);
        label.setAttribute('x', nx + Number(rect.getAttribute('width'))/2);
        label.setAttribute('y', ny + Number(rect.getAttribute('height'))/2);
        handle.setAttribute('transform', `translate(${nx+Number(rect.getAttribute('width'))-8},${ny+Number(rect.getAttribute('height'))-8})`);
      }
    });

    // 縮放：吸附寬高
    enableResize(g, handle, (dw,dh)=>{
      let nw=Math.max(24, Number(rect.getAttribute('width'))+dw);
      let nh=Math.max(24, Number(rect.getAttribute('height'))+dh);
      if (snapOn){ nw = Math.max(24, snap(nw)); nh = Math.max(24, snap(nh)); }
      rect.setAttribute('width',nw); rect.setAttribute('height',nh);
      outline.setAttribute('width',nw+6); outline.setAttribute('height',nh+6);
      label.setAttribute('x', Number(rect.getAttribute('x'))+nw/2);
      label.setAttribute('y', Number(rect.getAttribute('y'))+nh/2);
      handle.setAttribute('transform', `translate(${Number(rect.getAttribute('x'))+nw-8},${Number(rect.getAttribute('y'))+nh-8})`);
    });

    selectShape(g); setStatus('已新增方形。雙擊可命名，拖曳可移動。');
  }

  function addCircle(){
    const g = createGroup('未命名圓形');
    const cx=200, cy=180, r=48;
    const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
    circle.setAttribute('fill', currentColor);
    circle.setAttribute('stroke','#2f435a'); circle.setAttribute('stroke-width','1.5');
    g.setAttribute('data-color', currentColor);

    const outline = svg('circle', {cx,cy,r:r+6, class:'outline','pointer-events':'none'});
    const label = svgText(cx, cy, '未命名', 'middle');
    label.setAttribute('fill', contrastTextColor(currentColor));
    const handle = resizeHandle(cx+r-6, cy-6);
    g.append(outline, circle, label, handle); layer.appendChild(g);

    // 拖曳：吸附中心點
    enableDrag(g, {
      onMove:(dx,dy)=>{
        const ncx = snapOn ? snap(cx + dx) : (cx + dx);
        const ncy = snapOn ? snap(cy + dy) : (cy + dy);
        circle.setAttribute('cx',ncx); circle.setAttribute('cy',ncy);
        outline.setAttribute('cx',ncx); outline.setAttribute('cy',ncy);
        label.setAttribute('x',ncx); label.setAttribute('y',ncy);
        handle.setAttribute('transform', `translate(${ncx+Number(circle.getAttribute('r'))-6},${ncy-6})`);
      }
    });

    // 縮放：吸附半徑（半格更順）
    enableResize(g, handle, (dw)=>{
      let nr=Math.max(12, Number(circle.getAttribute('r'))+dw);
      if (snapOn){ nr = Math.max(12, snapHalf(nr)); }
      circle.setAttribute('r',nr);
      outline.setAttribute('r',nr+6);
      const ncx=Number(circle.getAttribute('cx')), ncy=Number(circle.getAttribute('cy'));
      handle.setAttribute('transform', `translate(${ncx+nr-6},${ncy-6})`);
    });

    selectShape(g); setStatus('已新增圓形。雙擊可命名，拖曳可移動。');
  }

  function addLabel(){
    const g = createGroup('未命名標籤');
    const x=120, y=120;
    const t = svgText(x, y, '未命名', 'start');
    t.setAttribute('fill', currentColor);
    g.setAttribute('data-color', currentColor);

    const outline = svg('rect', {x:x-6, y:y-22, width:110, height:32, rx:8, class:'outline','pointer-events':'none'});
    g.append(outline, t); layer.appendChild(g);

    // 拖曳：吸附文字座標
    enableDrag(g, {
      onMove:(dx,dy)=>{
        const nx = snapOn ? snap(x + dx) : (x + dx);
        const ny = snapOn ? snap(y + dy) : (y + dy);
        t.setAttribute('x',nx); t.setAttribute('y',ny);
        outline.setAttribute('x',nx-6); outline.setAttribute('y',ny-22);
      }
    });

    selectShape(g); setStatus('已新增標籤。雙擊可命名，拖曳可移動。');
  }

  // === 小工具 ===
  function svg(name, attrs){ const el=document.createElementNS('http://www.w3.org/2000/svg', name); for(const k in attrs){ el.setAttribute(k, attrs[k]); } return el; }
  function svgText(x,y,text,anchor){
  const t = svg('text',{x,y,'text-anchor':anchor,'dominant-baseline':'middle','font-size':textSize, fill:'#dbe6f2'});
  t.textContent = text;
  t.setAttribute('aria-hidden','true');   // ★ 避免和 <title> 名稱重複被念兩次
  return t;
}
  function resizeHandle(x,y){ const g=svg('g', {transform:`translate(${x},${y})`}); g.classList.add('handle'); g.setAttribute('cursor','nwse-resize'); g.appendChild(svg('rect',{width:12,height:12,rx:2})); return g; }

  // === 拖曳/縮放 ===
  function enableDrag(g, opts){
    const locked = ()=> g.getAttribute('data-locked')==='true';
    let start=null;
    g.addEventListener('pointerdown', (ev)=>{ if (ev.target.closest('.handle')) return; if (locked()) { selectShape(g); return; } selectShape(g); const pt=svgPoint(ev); start={x:pt.x,y:pt.y}; g.setPointerCapture?.(ev.pointerId); ev.preventDefault(); });
    g.addEventListener('pointermove', (ev)=>{ if(!start) return; const pt=svgPoint(ev); const dx=pt.x-start.x, dy=pt.y-start.y; opts.onMove(dx,dy); });
    const end=()=>{ start=null; }; g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
    g.addEventListener('pointerdown', ()=> selectShape(g));
  }

  function enableResize(g, handle, onResize){
    const locked = ()=> g.getAttribute('data-locked')==='true';
    let start=null;
    handle.addEventListener('pointerdown', (ev)=>{ if(locked()) return; const pt=svgPoint(ev); start={x:pt.x,y:pt.y}; handle.setPointerCapture?.(ev.pointerId); ev.stopPropagation(); ev.preventDefault(); });
    const move=(ev)=>{ if(!start) return; const pt=svgPoint(ev); const dw=pt.x-start.x, dh=pt.y-start.y; onResize(dw,dh); start=pt; };
    const end=()=>{ start=null; };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }

  function svgPoint(ev){ const pt=stage.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY; const ctm=stage.getScreenCTM().inverse(); return pt.matrixTransform(ctm); }

  // === 命名/刪除/鎖定/鍵盤 ===
  function renameShape(g){
    const name = prompt('輸入名稱（例如：教室A、廁所、電梯、路口）', g.getAttribute('data-name')||'');
    if(name===null) return;
    const trimmed = name.trim() || '未命名';
    g.setAttribute('data-name', trimmed);
    g.setAttribute('aria-label', trimmed);               // 後備
    const text = g.querySelector('text'); if (text) text.textContent = trimmed;
    const titleEl = g.querySelector('title'); if (titleEl) titleEl.textContent = trimmed;  // ★ 同步 <title>
    announce(`已命名為：${trimmed}`);
  }
  function deleteShape(g){ if(!g) return; g.remove(); announce('已刪除項目'); updateLockBadge(null); }
  function toggleLock(g){ if(!g) return; const locked=g.getAttribute('data-locked')==='true'; g.setAttribute('data-locked', String(!locked)); updateLockBadge(g); announce(locked?'已解鎖':'已鎖定'); }

  function onShapeKey(ev){
    const g = ev.currentTarget; const step = ev.shiftKey?10:5;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete','Enter'].includes(ev.key)) ev.preventDefault();
    const locked = g.getAttribute('data-locked')==='true';

    function move(dx,dy){
      if (locked) return;
      const rect=g.querySelector('rect:not(.outline)'); const circ=g.querySelector('circle:not(.outline)'); const label=g.querySelector('text');
      if(rect){
        rect.setAttribute('x', Number(rect.getAttribute('x'))+dx);
        rect.setAttribute('y', Number(rect.getAttribute('y'))+dy);
        const outline=g.querySelector('.outline');
        outline.setAttribute('x', Number(outline.getAttribute('x'))+dx);
        outline.setAttribute('y', Number(outline.getAttribute('y'))+dy);
        if(label){
          label.setAttribute('x', Number(label.getAttribute('x'))+dx);
          label.setAttribute('y', Number(label.getAttribute('y'))+dy);
        }
        const handle=g.querySelector('.handle');
        if(handle){
          const m=/translate\(([-\d.]+),([-\d.]+)\)/.exec(handle.getAttribute('transform'));
          handle.setAttribute('transform', `translate(${parseFloat(m[1])+dx},${parseFloat(m[2])+dy})`);
        }
        // 吸附：鍵盤放開即對齊
        if (snapOn){
          const sx = snap(Number(rect.getAttribute('x')));
          const sy = snap(Number(rect.getAttribute('y')));
          rect.setAttribute('x', sx); rect.setAttribute('y', sy);
          outline.setAttribute('x', sx-3); outline.setAttribute('y', sy-3);
          label.setAttribute('x', sx + Number(rect.getAttribute('width'))/2);
          label.setAttribute('y', sy + Number(rect.getAttribute('height'))/2);
          const w = Number(rect.getAttribute('width')), h = Number(rect.getAttribute('height'));
          if(handle) handle.setAttribute('transform', `translate(${sx+w-8},${sy+h-8})`);
        }
      } else if(circ){
        circ.setAttribute('cx', Number(circ.getAttribute('cx'))+dx);
        circ.setAttribute('cy', Number(circ.getAttribute('cy'))+dy);
        const outline=g.querySelector('.outline');
        outline.setAttribute('cx', Number(outline.getAttribute('cx'))+dx);
        outline.setAttribute('cy', Number(outline.getAttribute('cy'))+dy);
        if(label){
          label.setAttribute('x', Number(label.getAttribute('x'))+dx);
          label.setAttribute('y', Number(label.getAttribute('y'))+dy);
        }
        const r=Number(circ.getAttribute('r')); const handle=g.querySelector('.handle');
        handle.setAttribute('transform', `translate(${Number(circ.getAttribute('cx'))+r-6},${Number(circ.getAttribute('cy'))-6})`);
        if (snapOn){
          const sx = snap(Number(circ.getAttribute('cx')));
          const sy = snap(Number(circ.getAttribute('cy')));
          circ.setAttribute('cx', sx); circ.setAttribute('cy', sy);
          outline.setAttribute('cx', sx); outline.setAttribute('cy', sy);
          label.setAttribute('x', sx); label.setAttribute('y', sy);
          handle.setAttribute('transform', `translate(${sx+r-6},${sy-6})`);
        }
      } else if(label){
        label.setAttribute('x', Number(label.getAttribute('x'))+dx);
        label.setAttribute('y', Number(label.getAttribute('y'))+dy);
        const outline=g.querySelector('.outline');
        outline.setAttribute('x', Number(outline.getAttribute('x'))+dx);
        outline.setAttribute('y', Number(outline.getAttribute('y'))+dy);
        if (snapOn){
          const sx = snap(Number(label.getAttribute('x')));
          const sy = snap(Number(label.getAttribute('y')));
          label.setAttribute('x', sx); label.setAttribute('y', sy);
          outline.setAttribute('x', sx-6); outline.setAttribute('y', sy-22);
        }
      }
    }

    switch(ev.key){
      case 'ArrowUp': move(0,-step); break;
      case 'ArrowDown': move(0, step); break;
      case 'ArrowLeft': move(-step,0); break;
      case 'ArrowRight': move(step,0); break;
      case 'Enter': renameShape(g); break;
      case 'Delete': deleteShape(g); break;
    }
  }

  // === 顏色：色票/自訂/套用 ===
  colorRow.querySelectorAll('.color-swatch').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      currentColor = btn.getAttribute('data-color');
      applyColorToSelection(currentColor);
      try{ colorPicker.value = currentColor; }catch(_){}
    });
  });
  colorPicker.addEventListener('input', ()=>{
    currentColor = colorPicker.value;
    applyColorToSelection(currentColor);
  });
    function applyColorToSelection(color){
      const g = document.querySelector('.shape[aria-selected="true"]');
      if(!g) return;
      const bodyRect = g.querySelector('rect:not(.outline)');
      const bodyCircle = g.querySelector('circle:not(.outline)');
      const text = g.querySelector('text');

      if(bodyRect || bodyCircle){
        (bodyRect || bodyCircle).setAttribute('fill', color);
        // 形狀內的置中文字自動對比
        if (text) text.setAttribute('fill', contrastTextColor(color));
      } else if(text){
        // 純標籤：維持使用者選的顏色
        text.setAttribute('fill', color);
      }

      g.setAttribute('data-color', color);
      announce('已套用顏色');
    }
      // === 文字大小（全域） ===
    let textSize = 14;
    const textSizeInput = document.getElementById('textSize');
    const textSizeVal = document.getElementById('textSizeVal');
    if (textSizeInput) {
      textSizeInput.addEventListener('input', ()=>{
        textSize = Number(textSizeInput.value) || 14;
        if (textSizeVal) textSizeVal.textContent = `${textSize}px`;
        applyTextSizeAll(textSize);
      });
    }
    function applyTextSizeAll(size){
      layer.querySelectorAll('text').forEach(t=>{
        t.setAttribute('font-size', size);
      });
    }
    function hexToRgb(hex){
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if(!m) return {r:35,g:51,b:72}; // fallback
      return {r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16)};
    }
    function relLuminance({r,g,b}){
      const toLinear = v=>{
        v/=255;
        return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
      };
      const R=toLinear(r), G=toLinear(g), B=toLinear(b);
      return 0.2126*R + 0.7152*G + 0.0722*B;
    }
    function contrastTextColor(bgHex){
      const L = relLuminance(hexToRgb(bgHex));
      return (L > 0.5) ? '#0b0e12' : '#ffffff'; // 淺底用深字、深底用白字
    }

  // === 存檔 / 載入 / 匯出 / 匯入 ===
  document.getElementById('btnSave').addEventListener('click', async ()=>{
    const id = prompt('輸入地圖 ID（例如：school-2025-0814）');
    if(!id) return;

    const title = prompt('地圖標題（可留白，預設同 ID）') || id;
    const payload = {
      id,
      title,
      shapes: serialize(),
      meta:{ ua: navigator.userAgent },
      updatedAt: new Date().toISOString()
    };

    setStatus('儲存中…');

    try {
      const res = await fetch('/api/save', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if(data.ok){
        setStatus(`✅ 已存檔：${id}`);
        announce(`已存檔 ${id}`);
        alert("✅ 存檔成功！（注意：目前為測試版暫存，重啟伺服器會清除，請另存 JSON 備份）");
      } else {
        throw new Error(data.error || 'save_failed');
      }

    } catch(err) {
      console.error(err);
      setStatus('❌ 存檔失敗');
      alert('存檔失敗：' + err.message);
    }
  });

  document.getElementById('btnLoad').addEventListener('click', async ()=>{
    try{
      const ls = await (await fetch('/api/list')).json();
      if(!ls.ok) throw new Error('list_failed');
      const names = ls.items.map(x=>x.id);
      const id = prompt('輸入要載入的地圖 ID：\n'+names.join(', '));
      if(!id) return;
      setStatus('載入中…');
      const res = await fetch('/api/load/'+encodeURIComponent(id));
      const data = await res.json();
      if(!data.ok) throw new Error(data.error||'not_found');
      deserialize(data.map.shapes || []);
      setStatus(`✅ 已載入：${id}`);
      announce(`已載入 ${id}`);
    }catch(err){ console.error(err); setStatus('❌ 載入失敗'); alert('載入失敗：'+err.message); }
  });

  document.getElementById('btnExport').addEventListener('click', ()=>{
    const id = prompt('匯出檔名（不含副檔名）：', 'om-map');
    if(id===null) return;
    const blob = new Blob([JSON.stringify({shapes: serialize()}, null, 2)], {type:'application/json;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(id||'om-map')}.json`; a.click();
    setStatus('✅ 已匯出 JSON 檔');
  });

  document.getElementById('fileInput').addEventListener('change', async (ev)=>{
    const file = ev.target.files?.[0]; if(!file) return;
    try{
      const text = await file.text(); const j = JSON.parse(text);
      if(!j || !Array.isArray(j.shapes)) throw new Error('格式錯誤，缺少 shapes[]');
      deserialize(j.shapes);
      setStatus(`✅ 已匯入：${file.name}`);
    }catch(err){ alert('匯入失敗：'+err.message); }
    ev.target.value = '';
  });

  // === 序列化 / 反序列化 ===
  function serialize(){
    const out = [];
    layer.querySelectorAll('.shape').forEach(g=>{
      const name = g.getAttribute('data-name') || '未命名';
      const rect = g.querySelector('rect:not(.outline)');
      const circ = g.querySelector('circle:not(.outline)');
      const label = g.querySelector('text');
      if(rect){
        out.push({
          type:'rect', name,
          x:+rect.getAttribute('x'), y:+rect.getAttribute('y'),
          w:+rect.getAttribute('width'), h:+rect.getAttribute('height'),
          fill: g.getAttribute('data-color') || rect.getAttribute('fill') || '#203041'
        });
      }else if(circ){
        out.push({
          type:'circle', name,
          x:+circ.getAttribute('cx'), y:+circ.getAttribute('cy'),
          r:+circ.getAttribute('r'),
          fill: g.getAttribute('data-color') || circ.getAttribute('fill') || '#233348'
        });
      }else if(label){
        out.push({
          type:'label', name,
          x:+label.getAttribute('x'), y:+label.getAttribute('y'),
          color: g.getAttribute('data-color') || label.getAttribute('fill') || '#dbe6f2'
        });
      }
    });
    return out;
  }

  function clearAll(){ [...layer.querySelectorAll('.shape')].forEach(n=>n.remove()); }

  function deserialize(shapes){
    clearAll();
    for(const s of shapes){
      if(s.type==='rect'){
        const g = createGroup(s.name||'');
        const fill = s.fill || '#203041';
        const rect = svg('rect',{x:s.x,y:s.y,width:s.w,height:s.h,rx:10, fill, stroke:'#2f435a','stroke-width':1.5});
        g.setAttribute('data-color', fill);

        const outline = svg('rect',{x:s.x-3,y:s.y-3,width:(s.w||0)+6,height:(s.h||0)+6,rx:12,class:'outline','pointer-events':'none'});
        const label = svgText(s.x+(s.w||0)/2, s.y+(s.h||0)/2, s.name||'', 'middle');
        // 依圖形填色設定對比字色（只設一次）
        label.setAttribute('fill', contrastTextColor(fill));

        const handle = resizeHandle(s.x+(s.w||0)-8, s.y+(s.h||0)-8);
        g.append(outline, rect, label, handle); layer.appendChild(g);

        // 反序列化後拖曳：以「當下屬性」為基準，避免第二次拖曳跳位
        enableDrag(g,{onMove:(dx,dy)=>{
          const bx = Number(rect.getAttribute('x'));
          const by = Number(rect.getAttribute('y'));
          const nx = snapOn ? snap(bx + dx) : (bx + dx);
          const ny = snapOn ? snap(by + dy) : (by + dy);
          rect.setAttribute('x',nx); rect.setAttribute('y',ny);
          outline.setAttribute('x',nx-3); outline.setAttribute('y',ny-3);
          label.setAttribute('x', nx+Number(rect.getAttribute('width'))/2);
          label.setAttribute('y', ny+Number(rect.getAttribute('height'))/2);
          handle.setAttribute('transform', `translate(${nx+Number(rect.getAttribute('width'))-8},${ny+Number(rect.getAttribute('height'))-8})`);
        }});

        // 縮放吸附
        enableResize(g, handle, (dw,dh)=>{
          let nw=Math.max(24, Number(rect.getAttribute('width'))+dw);
          let nh=Math.max(24, Number(rect.getAttribute('height'))+dh);
          if (snapOn){ nw = Math.max(24, snap(nw)); nh = Math.max(24, snap(nh)); }
          rect.setAttribute('width',nw); rect.setAttribute('height',nh);
          outline.setAttribute('width',nw+6); outline.setAttribute('height',nh+6);
          label.setAttribute('x', Number(rect.getAttribute('x'))+nw/2);
          label.setAttribute('y', Number(rect.getAttribute('y'))+nh/2);
          handle.setAttribute('transform', `translate(${Number(rect.getAttribute('x'))+nw-8},${Number(rect.getAttribute('y'))+nh-8})`);
        });

        g.setAttribute('data-name', s.name||''); g.setAttribute('aria-label', s.name||'');

      }else if(s.type==='circle'){
        const g = createGroup(s.name||'');
        const fill = s.fill || '#233348';
        const circle = svg('circle',{cx:s.x, cy:s.y, r:s.r||48, fill, stroke:'#2f435a','stroke-width':1.5});
        g.setAttribute('data-color', fill);

        const outline = svg('circle',{cx:s.x, cy:s.y, r:(s.r||48)+6, class:'outline','pointer-events':'none'});
        const label = svgText(s.x, s.y, s.name||'', 'middle');
        label.setAttribute('fill', contrastTextColor(fill)); // 只設一次

        const handle = resizeHandle(s.x+(s.r||48)-6, s.y-6);
        g.append(outline, circle, label, handle); layer.appendChild(g);

        // 拖曳：以目前屬性為基準
        enableDrag(g,{onMove:(dx,dy)=>{
          const bx = Number(circle.getAttribute('cx'));
          const by = Number(circle.getAttribute('cy'));
          const ncx = snapOn ? snap(bx + dx) : (bx + dx);
          const ncy = snapOn ? snap(by + dy) : (by + dy);
          circle.setAttribute('cx',ncx); circle.setAttribute('cy',ncy);
          outline.setAttribute('cx',ncx); outline.setAttribute('cy',ncy);
          label.setAttribute('x',ncx); label.setAttribute('y',ncy);
          handle.setAttribute('transform', `translate(${ncx+Number(circle.getAttribute('r'))-6},${ncy-6})`);
        }});

        // 縮放：半徑半格吸附
        enableResize(g, handle, (dw)=>{
          let nr=Math.max(12, Number(circle.getAttribute('r'))+dw);
          if (snapOn){ nr = Math.max(12, snapHalf(nr)); }
          circle.setAttribute('r',nr);
          outline.setAttribute('r',nr+6);
          const ncx=Number(circle.getAttribute('cx')), ncy=Number(circle.getAttribute('cy'));
          handle.setAttribute('transform', `translate(${ncx+nr-6},${ncy-6})`);
        });

        g.setAttribute('data-name', s.name||''); g.setAttribute('aria-label', s.name||'');

      }else if(s.type==='label'){
        const g = createGroup(s.name||'');
        const color = s.color || '#dbe6f2';
        const t = svgText(s.x, s.y, s.name||'', 'start');
        t.setAttribute('fill', color);
        g.setAttribute('data-color', color);

        const outline = svg('rect',{x:(s.x||0)-6, y:(s.y||0)-22, width:110, height:32, rx:8, class:'outline','pointer-events':'none'});
        g.append(outline, t); layer.appendChild(g);

        enableDrag(g,{onMove:(dx,dy)=>{
          const bx = Number(t.getAttribute('x'));
          const by = Number(t.getAttribute('y'));
          const nx = snapOn ? snap(bx + dx) : (bx + dx);
          const ny = snapOn ? snap(by + dy) : (by + dy);
          t.setAttribute('x',nx); t.setAttribute('y',ny);
          outline.setAttribute('x',nx-6); outline.setAttribute('y',ny-22);
        }});

        g.setAttribute('data-name', s.name||''); g.setAttribute('aria-label', s.name||'');
      }
    }

    // 讓載入後也符合目前全域字級
    applyTextSizeAll(textSize);
  }

  // 工具按鈕
  document.getElementById('addRect').addEventListener('click', addRect);
  document.getElementById('addCircle').addEventListener('click', addCircle);
  document.getElementById('addLabel').addEventListener('click', addLabel);
  document.getElementById('rename').addEventListener('click', ()=>{ const g=document.querySelector('.shape[aria-selected="true"]'); if(g) renameShape(g); });
  document.getElementById('delete').addEventListener('click', ()=>{ const g=document.querySelector('.shape[aria-selected="true"]'); if(g) deleteShape(g); });
  document.getElementById('toggleLock').addEventListener('click', ()=>{ const g=document.querySelector('.shape[aria-selected="true"]'); if(g) toggleLock(g); });

  stage.addEventListener('pointerdown', (ev)=>{ if(ev.target===stage){ selectShape(null); } });

  setStatus('準備就緒：點「工具」新增圖形，拖曳移動；雙擊或按 Enter 改名。');
})();
