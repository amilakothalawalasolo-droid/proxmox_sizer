// --- NAVIGATION LOGIC ---
function navigateTo(pageId) {
    // 1. Hide all pages
    const pages = document.querySelectorAll('.page-section');
    pages.forEach(p => p.classList.add('hidden'));

    // 2. Show target page
    if (pageId === 'home') document.getElementById('page-home').classList.remove('hidden');
    if (pageId === 'about') document.getElementById('page-about').classList.remove('hidden');
    if (pageId === 'legal') document.getElementById('page-legal').classList.remove('hidden');
    if (pageId === 'blog') return; // Hidden for now

    // 3. Update Navbar State
    const navHome = document.getElementById('nav-home');
    const navAbout = document.getElementById('nav-about');
    
    // Simple Active State Toggle
    if (pageId === 'home') {
        navHome.classList.add('active-nav-link');
        navAbout.classList.remove('active-nav-link');
    } else if (pageId === 'about') {
        navAbout.classList.add('active-nav-link');
        navHome.classList.remove('active-nav-link');
    }

    // 4. Close Mobile Menu & Scroll Top
    document.getElementById('mobileMenu').classList.add('hidden');
    window.scrollTo(0,0);
}

// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.getElementById('mobileMenu').classList.toggle('hidden');
    });
});


// --- CALCULATOR TABS LOGIC ---
function switchTab(event, tabId) {
    // Hide content
    const contents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < contents.length; i++) contents[i].classList.add('hidden');

    // Deactivate buttons
    const buttons = document.getElementsByClassName('result-tab');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('active-tab');
        buttons[i].classList.remove('text-blue-400');
        buttons[i].classList.remove('border-blue-400');
    }

    // Show content & Activate button
    document.getElementById(tabId).classList.remove('hidden');
    const clickedBtn = event.currentTarget;
    clickedBtn.classList.add('active-tab');
    clickedBtn.classList.add('text-blue-400');
    clickedBtn.classList.add('border-blue-400');
}


// --- MAIN CALCULATOR LOGIC ---
document.addEventListener('DOMContentLoaded', () => {

    let mode = 'avg'; 
    const ui = {
        btnAvg: document.getElementById('modeAvg'),
        btnTotal: document.getElementById('modeTotal'),
        inAvg: document.getElementById('inputsAvg'),
        inTotal: document.getElementById('inputsTotal'),
        
        vmCount: document.getElementById('vmCount'),
        vmCpu: document.getElementById('vmCpu'),
        vmRam: document.getElementById('vmRam'),
        vmStore: document.getElementById('vmStore'),
        lxcCount: document.getElementById('lxcCount'),
        lxcCpu: document.getElementById('lxcCpu'),
        lxcRam: document.getElementById('lxcRam'),
        lxcStore: document.getElementById('lxcStore'),
        
        totVcpu: document.getElementById('totVcpu'),
        totRam: document.getElementById('totRam'),
        totStore: document.getElementById('totStore'),
        
        type: document.getElementById('storageType'),
        ha: document.getElementById('haMode'),
        nodes: document.getElementById('nodeCount'),
        buffer: document.getElementById('growthBuffer'),
        bufferVal: document.getElementById('bufferVal'),
        
        area: document.getElementById('resultsArea'),
        rRam: document.getElementById('resRam'),
        rCpu: document.getElementById('resCpu'),
        rStore: document.getElementById('resStore'),
        rNet: document.getElementById('infraNet'),
        rPower: document.getElementById('infraPower'),
        rReport: document.getElementById('reportText')
    };

    // Mode Switching
    ui.btnAvg.addEventListener('click', () => {
        mode = 'avg';
        ui.inAvg.classList.remove('hidden');
        ui.inTotal.classList.add('hidden');
        ui.btnAvg.classList.add('bg-slate-800', 'text-white');
        ui.btnAvg.classList.remove('text-slate-500');
        ui.btnTotal.classList.remove('bg-slate-800', 'text-white');
        ui.btnTotal.classList.add('text-slate-500');
    });

    ui.btnTotal.addEventListener('click', () => {
        mode = 'total';
        ui.inTotal.classList.remove('hidden');
        ui.inAvg.classList.add('hidden');
        ui.btnTotal.classList.add('bg-slate-800', 'text-white');
        ui.btnTotal.classList.remove('text-slate-500');
        ui.btnAvg.classList.remove('bg-slate-800', 'text-white');
        ui.btnAvg.classList.add('text-slate-500');
    });

    ui.buffer.addEventListener('input', (e) => ui.bufferVal.textContent = e.target.value + "%");

    // Calculation Function
    function val(id) { return parseFloat(id.value) || 0; }

    document.getElementById('btnCalc').addEventListener('click', () => {
        
        let rawRam = 0, rawCpu = 0, rawStoreTB = 0;
        let vms = 0, lxcs = 0;

        if (mode === 'avg') {
            vms = val(ui.vmCount);
            lxcs = val(ui.lxcCount);
            rawRam = (vms * val(ui.vmRam)) + (lxcs * val(ui.lxcRam));
            rawCpu = ((vms * val(ui.vmCpu)) / 4) + ((lxcs * val(ui.lxcCpu)) / 8);
            rawStoreTB = ((vms * val(ui.vmStore)) + (lxcs * val(ui.lxcStore))) / 1024;
            if (vms === 0 && lxcs === 0) { alert("Please enter VM or LXC details."); return; }
        } else {
            rawRam = val(ui.totRam);
            rawCpu = val(ui.totVcpu) / 4; 
            rawStoreTB = val(ui.totStore);
            if (rawRam === 0) { alert("Please enter total resources."); return; }
        }

        const growth = val(ui.buffer) / 100;
        const type = ui.type.value;
        const ha = ui.ha.value;
        let nodeCount = val(ui.nodes);
        if (nodeCount < 1) nodeCount = 1;

        // Auto-fix Logic
        if (ha === 'n1' && nodeCount < 2) nodeCount = 3;
        if (type === 'ceph' && nodeCount < 3) nodeCount = 3;

        // Overhead Calculation
        let baseRam = 2 * nodeCount; 
        let storeOverheadRam = 0;
        if (type === 'zfs') storeOverheadRam = Math.max(4 * nodeCount, rawStoreTB * 1.5);
        if (type === 'ceph') storeOverheadRam = (rawStoreTB * 1.5) + (4 * nodeCount);

        let finalRam = Math.ceil((rawRam + baseRam + storeOverheadRam) * (1 + growth));
        let overheadCpu = 2 * nodeCount; 
        if (type === 'ceph') overheadCpu += (4 * nodeCount);
        let finalCpu = Math.ceil((rawCpu + overheadCpu) * (1 + growth));
        let finalStore = (rawStoreTB * (1 + growth)).toFixed(2);

        // N+1 Logic
        let perNodeRam = 0, perNodeCpu = 0;
        if (ha === 'n1') {
            perNodeRam = Math.ceil(finalRam / (nodeCount - 1));
            perNodeCpu = Math.ceil(finalCpu / (nodeCount - 1));
        } else {
            perNodeRam = Math.ceil(finalRam / nodeCount);
            perNodeCpu = Math.ceil(finalCpu / nodeCount);
        }

        // Output Update
        ui.rRam.textContent = `${perNodeRam} GB`;
        ui.rCpu.textContent = `${perNodeCpu}`;
        ui.rStore.textContent = `${(finalStore / nodeCount).toFixed(2)} TB`;

        let netMsg = (type === 'ceph') ? "Required: <b class='text-white'>Dual 10Gbps SFP+</b> for Ceph traffic." : "Recommended: <b class='text-white'>Bonded 1Gbps</b> (LACP) or 10Gbps Uplink.";
        ui.rNet.innerHTML = netMsg;

        let powerMsg = (ha === 'n1') ? `Cluster: ${nodeCount} Nodes. Quorum needs ${(Math.floor(nodeCount/2)+1)} votes.` : "Standalone: Ensure regular external backups.";
        if (ha === 'n1' && nodeCount === 2) powerMsg += "<br><span class='text-yellow-400'>⚠ 2-Node Cluster requires a QDevice!</span>";
        ui.rPower.innerHTML = powerMsg;

        let report = `<p>Designed for a <b>${nodeCount}-Node ${type.toUpperCase()} Cluster</b> with <b>${Math.round(growth*100)}% Growth Buffer</b>.</p>`;
        if (ha === 'n1') {
            report += `<p class="mt-2">✅ <b>High Availability (N+1):</b> Sized so if 1 node fails, others handle the full load.</p>`;
        } else {
            report += `<p class="mt-2">ℹ️ <b>No HA:</b> Load is distributed evenly.</p>`;
        }
        if (type === 'zfs') report += `<p class="mt-2 text-xs text-slate-400">Includes ~${Math.round(storeOverheadRam)}GB RAM for ZFS ARC.</p>`;
        
        ui.rReport.innerHTML = report;

        ui.area.classList.remove('hidden');
        switchTab({ currentTarget: document.querySelector('.result-tab') }, 'tabSpecs');
        ui.area.scrollIntoView({behavior: "smooth"});
    });
});
