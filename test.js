const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('admin-dashboard.html', 'utf-8');
const scriptContent = fs.readFileSync('js/admin.js', 'utf-8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("jsdomError", (e) => {
    console.error("JSDOM Error:", e);
});
virtualConsole.on("error", (e) => {
    console.error("Console Error:", e);
});
virtualConsole.on("warn", (w) => {
    console.warn("Console Warn:", w);
});
virtualConsole.on("log", (l) => {
    console.log("Console Log:", l);
});

const dom = new JSDOM(html, {
    url: "http://localhost:3000/admin-dashboard.html",
    runScripts: "dangerously",
    resources: "usable",
    virtualConsole: virtualConsole
});

// Polyfills
dom.window.sessionStorage.setItem('isAdminLoggedIn', 'true');

// Ensure DOMContentLoaded fires if needed or just execute
const scriptEl = dom.window.document.createElement("script");
scriptEl.textContent = scriptContent;
dom.window.document.body.appendChild(scriptEl);

// Dispatch DOMContentLoaded since script is inline after parsing
dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

setTimeout(() => {
    const list = dom.window.document.getElementById('itemsList');
    if (list) {
        console.log("Items rendered:", list.children.length);
        if (list.children.length === 0) {
            console.log("Table is empty! LocalStorage adminData:", dom.window.localStorage.getItem('adminData'));
        }
    } else {
        console.log("List not found!");
    }
}, 500);
