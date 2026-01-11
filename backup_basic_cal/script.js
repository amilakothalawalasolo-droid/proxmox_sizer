document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE MANAGEMENT ---
    let currentMode = 'avg'; // 'avg' or 'total'

    // --- ELEMENTS ---
    const ui = {
        btnAvg: document.getElementById('btnModeAvg'),
        btnTotal: document.getElementById('btnModeTotal'),
        divAvg: document.getElementById('avgInputs'),
        divTotal: document.getElementById('totalInputs'),
        
        // Avg Inputs
        vmCount: document.getElementById('vmCount'),
        vmCpu: document.getElementById('vmCpu'),
        vmRam: document.getElementById('vmRam'),
        vmStore: document.getElementById('vmStorage'),
        lxcCount: document.getElementById('lxcCount'),
        lxcCpu: document.getElementById('lxcCpu'),
        lxcRam: document.getElementById('lxcRam'),
        lxcStore: document.getElementById('lxcStorage'),

        // Total Inputs
        totVcpu: document.getElementById('totalVcpuIn'),
        totRam: document.getElementById('totalRamIn'),
        totStore: document.getElementById('totalStorageIn'),

        // Global Inputs
        type: document.getElementById('storageType'),
        ha: document.getElementById('haMode'),
        nodeInput: document.getElementById('nodeCountInput'),
        buffer: document.getElementById('growthBuffer'),
        
        // Display
        bufferDisp: document.getElementById('bufferDisplay'),
        resultsArea: document.getElementById('resultsArea'),
        resRam: document.getElementById('resRam'),
        resCpu: document.getElementById('resCpu'),
        resStorage: document.getElementById('resStorage'),
        recText: document.getElementById('recommendationText')
    };

    // --- TOGGLE LOGIC ---
    function switchMode(mode) {
        currentMode = mode;
        if(mode === 'avg') {
            ui.divAvg.classList.remove('hidden');
            ui.divTotal.classList.add('hidden');
            ui.btnAvg.className = "px-6 py-2 rounded-lg text-sm font-bold text-slate-700 bg-white shadow transition-all";
            ui.btnTotal.className = "px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-900 transition-all";
        } else {
            ui.divAvg.classList.add('hidden');
            ui.divTotal.classList.remove('hidden');
            ui.btnTotal.className = "px-6 py-2 rounded-lg text-sm font-bold text-slate-700 bg-white shadow transition-all";
            ui.btnAvg.className = "px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-900 transition-all";
        }
    }

    ui.btnAvg.addEventListener('click', () => switchMode('avg'));
    ui.btnTotal.addEventListener('click', () => switchMode('total'));
    ui.buffer.addEventListener('input', (e) => ui.bufferDisp.textContent = `${e.target.value}%`);


    // --- CALCULATION LOGIC ---
    function sanitize(val) { return parseFloat(val) || 0; }

    document.getElementById('calcBtn').addEventListener('click', () => {
        
        // 1. Determine Raw Workload Needs
        let rawRam = 0;
        let rawCpu = 0;
        let rawStorageTB = 0;

        if (currentMode === 'avg') {
            // Calculate from Averages
            const vms = sanitize(ui.vmCount.value);
            const lxcs = sanitize(ui.lxcCount.value);

            const vmRamTot = vms * sanitize(ui.vmRam.value);
            const lxcRamTot = lxcs * sanitize(ui.lxcRam.value);
            rawRam = vmRamTot + lxcRamTot;

            // CPU Logic: VM=1:4 ratio, LXC=1:8 ratio
            const vmThreads = (vms * sanitize(ui.vmCpu.value)) / 4;
            const lxcThreads = (lxcs * sanitize(ui.lxcCpu.value)) / 8;
            rawCpu = vmThreads + lxcThreads;

            const storageGB = (vms * sanitize(ui.vmStore.value)) + (lxcs * sanitize(ui.lxcStore.value));
            rawStorageTB = storageGB / 1024;

            if(vms === 0 && lxcs === 0) { alert("Please enter VM or LXC details."); return; }

        } else {
            // Calculate from Direct Totals
            rawRam = sanitize(ui.totRam.value);
            // Even with total CPU, we assume a safe 1:4 overcommit ratio for generic virtualization
            // If user enters "64 vCPU needed", we generally need 16 Physical Threads
            rawCpu = sanitize(ui.totVcpu.value) / 4; 
            rawStorageTB = sanitize(ui.totStore.value); // User enters TB here

            if(rawRam === 0 && rawCpu === 0) { alert("Please enter total resources."); return; }
        }

        // 2. Global Factors
        const growth = sanitize(ui.buffer.value) / 100;
        const type = ui.type.value;
        const haMode = ui.ha.value;
        let nodes = sanitize(ui.nodeInput.value);
        if (nodes < 1) nodes = 1;

        // 3. Add Platform Overhead (This is the "Sizer" part)
        
        // RAM Overhead
        let baseRam = 2 * nodes; // OS
        let storageOverhead = 0;
        if (type === 'zfs') storageOverhead = Math.max(4 * nodes, rawStorageTB * 1.5);
        if (type === 'ceph') storageOverhead = (rawStorageTB * 1.5) + (4 * nodes);

        let finalRam = Math.ceil((rawRam + baseRam + storageOverhead) * (1 + growth));

        // CPU Overhead
        let overheadCpu = 2 * nodes; // OS
        if (type === 'ceph') overheadCpu += (4 * nodes);
        let finalCpu = Math.ceil((rawCpu + overheadCpu) * (1 + growth));

        // Storage Overhead
        let finalStorage = (rawStorageTB * (1 + growth)).toFixed(2);

        // 4. Node Distribution (N+1)
        let perNodeRam = 0;
        let perNodeCpu = 0;
        let warnings = "";

        if (haMode === 'n1') {
            if (nodes < 2) {
                warnings += `<div class="p-2 bg-red-100 text-red-800 rounded mb-2 text-xs">⛔ HA requires 2+ nodes.</div>`;
            } else {
                perNodeRam = Math.ceil(finalRam / (nodes - 1));
                perNodeCpu = Math.ceil(finalCpu / (nodes - 1));
            }
        } else {
            perNodeRam = Math.ceil(finalRam / nodes);
            perNodeCpu = Math.ceil(finalCpu / nodes);
        }

        // Ceph Check
        if (type === 'ceph' && nodes < 3) {
            warnings += `<div class="p-2 bg-red-100 text-red-800 rounded mb-2 text-xs">⛔ Ceph requires 3+ nodes.</div>`;
        }

        // 5. Output
        ui.resRam.innerText = `${finalRam} GB`;
        ui.resCpu.innerText = `${finalCpu} Threads`;
        ui.resStorage.innerText = `${finalStorage} TB`;

        let recHtml = warnings;
        recHtml += `<p class="mb-2">For a <b>${nodes}-Node Cluster</b> (${type.toUpperCase()}):</p>`;
        recHtml += `<div class="bg-slate-700 p-4 rounded-xl text-sm">`;
        recHtml += `<ul class="space-y-2">`;
        recHtml += `<li class="flex justify-between text-slate-300"><span>RAM per Node:</span> <span class="font-bold text-white">${perNodeRam} GB</span></li>`;
        recHtml += `<li class="flex justify-between text-slate-300"><span>CPU per Node:</span> <span class="font-bold text-white">${perNodeCpu} Threads</span></li>`;
        recHtml += `</ul></div>`;
        
        ui.recText.innerHTML = recHtml;
        ui.resultsArea.classList.remove('hidden');
    });
});
