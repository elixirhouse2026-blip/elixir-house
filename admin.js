// ============================================
// ELIXIR HOUSE - PANEL DE ADMINISTRACIÓN
// Dashboard + catálogo + marcas + categorías
// + historial + filtros + estadísticas
// ============================================

let perfumes = [];
let marcas = [];
let categorias = [];
let vendedores = [];
let ventas = [];
let solicitudesCompra = [];
let editingPerfumeId = null;
let duplicatedImageURL = null;
let editingBrandId = null;
let editingCategoryId = null;

const ADMIN_ID = "c4fc77d6-0bdf-49cb-81e1-0b7769bdf692";

const $ = id => document.getElementById(id);

const loginSection = $("loginSection");
const adminSection = $("adminSection");
const loginForm = $("loginForm");
const loginMessage = $("loginMessage");
const logoutButton = $("logoutButton");
const showAddPerfume = $("showAddPerfume");
const perfumeFormSection = $("perfumeFormSection");
const perfumeForm = $("perfumeForm");
const cancelForm = $("cancelForm");
const formMessage = $("formMessage");
const adminProducts = $("adminProducts");
const adminSearch = $("adminSearch");

const totalPerfumes = $("totalPerfumes");
const totalStock = $("totalStock");
const totalPremium = $("totalPremium");
const totalBrands = $("totalBrands");
const totalCategories = $("totalCategories");
const totalSales = $("totalSales");
const totalSalesValue = $("totalSalesValue");

const sellerStats = $("sellerStats");
const sellerStatsMessage = $("sellerStatsMessage");
const refreshSellerStats = $("refreshSellerStats");

const perfumeBrand = $("perfumeBrand");
const perfumeCategory = $("perfumeCategory");
const seasonOptions = $("seasonOptions");
const SEASONS = ["Verano", "Invierno", "Otoño", "Primavera"];
function getSelectedSeasons() { return [...document.querySelectorAll('input[name="temporadas"]:checked')].map(el => el.value); }
function setSelectedSeasons(values = []) { document.querySelectorAll('input[name="temporadas"]').forEach(el => { el.checked = values.includes(el.value); }); }
function setupSeasonLimit() { document.querySelectorAll('input[name="temporadas"]').forEach(el => el.addEventListener("change", () => { const selected = getSelectedSeasons(); if (selected.length > 2) { el.checked = false; alert("Podés elegir como máximo 2 temporadas por perfume."); } })); }
setupSeasonLimit();
const perfumeGender = $("perfumeGender");
const productType = $("productType");
const perfumeImageFile = $("perfumeImageFile");
const imagePreview = $("imagePreview");
const imagePreviewContainer = $("imagePreviewContainer");

const brandForm = $("brandForm");
const brandName = $("brandName");
const brandsList = $("brandsList");
const brandSubmitButton = $("brandSubmitButton");
const brandCancelEdit = $("brandCancelEdit");

const categoryForm = $("categoryForm");
const categoryName = $("categoryName");
const categoryGender = $("categoryGender"); // Categorías ya no dependen de un género
const categoriesList = $("categoriesList");
const categorySubmitButton = $("categorySubmitButton");
const categoryCancelEdit = $("categoryCancelEdit");

const refreshSales = $("refreshSales");
const salesDateFrom = $("salesDateFrom");
const salesDateTo = $("salesDateTo");
const salesSellerFilter = $("salesSellerFilter");
const clearSalesFilters = $("clearSalesFilters");
const salesHistoryBody = $("salesHistoryBody");
const salesHistoryMessage = $("salesHistoryMessage");
const confirmedSaleForm = $("confirmedSaleForm");
const confirmedSaleSeller = $("confirmedSaleSeller");
const confirmedSalePerfume = $("confirmedSalePerfume");
const confirmedSalePrice = $("confirmedSalePrice");
const confirmedSaleMessage = $("confirmedSaleMessage");

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatPrice(value) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(new Date(value));
}

function showLogin() {
    loginSection.classList.remove("hidden");
    adminSection.classList.add("hidden");
}

async function checkSession() {
    const result = await supabaseClient.auth.getSession();
    if (result.error || !result.data.session) {
        showLogin();
        return;
    }

    if (result.data.session.user.id !== ADMIN_ID) {
        await supabaseClient.auth.signOut();
        showLogin();
        loginMessage.textContent = "No tenés permisos de administrador.";
        loginMessage.style.color = "#d65a67";
        return;
    }

    await showAdmin();
}

// ---------- Pestañas del panel ----------
const ADMIN_TABS = ["productos", "solicitudes", "ventas", "marcas"];

function setAdminTab(name) {
    if (!ADMIN_TABS.includes(name)) name = "productos";
    document.querySelectorAll("#adminSection [data-tab]").forEach(function (el) {
        el.classList.toggle("tab-hidden", el.dataset.tab !== name);
    });
    document.querySelectorAll("#adminTabs [data-tab-target]").forEach(function (button) {
        const on = button.dataset.tabTarget === name;
        button.classList.toggle("active", on);
        button.setAttribute("aria-selected", String(on));
    });
    try { sessionStorage.setItem("elixirAdminTab", name); } catch (error) { /* sin almacenamiento */ }
}

document.querySelectorAll("#adminTabs [data-tab-target]").forEach(function (button) {
    button.addEventListener("click", function () {
        setAdminTab(button.dataset.tabTarget);
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
});

$("pendingChip")?.addEventListener("click", function () {
    setAdminTab("solicitudes");
    window.scrollTo({ top: 0, behavior: "smooth" });
});

let requestsPollingStarted = false;
let lastPendingOrders = null;

function startRequestsPolling() {
    if (requestsPollingStarted) return;
    requestsPollingStarted = true;
    // Cada minuto se revisan las solicitudes nuevas mientras el panel está abierto y visible.
    setInterval(async function () {
        if (adminSection.classList.contains("hidden") || document.visibilityState !== "visible") return;
        await loadPurchaseRequests();
    }, 60000);
}

async function showAdmin() {
    loginSection.classList.add("hidden");
    adminSection.classList.remove("hidden");
    let savedTab = "productos";
    try { savedTab = sessionStorage.getItem("elixirAdminTab") || "productos"; } catch (error) { /* sin almacenamiento */ }
    setAdminTab(savedTab);
    startRequestsPolling();
    await loadData();
}

loginForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    loginMessage.textContent = "Iniciando sesión...";
    loginMessage.style.color = "#d8b94f";

    const result = await supabaseClient.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
    });

    if (result.error || !result.data.user || result.data.user.id !== ADMIN_ID) {
        if (!result.error && result.data.user) await supabaseClient.auth.signOut();
        loginMessage.textContent = "Email o contraseña incorrectos o usuario sin permisos.";
        loginMessage.style.color = "#d65a67";
        return;
    }

    loginMessage.textContent = "";
    await showAdmin();
});

logoutButton?.addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    editingPerfumeId = null;
    perfumeForm?.reset();
    perfumeFormSection?.classList.add("hidden");
    clearImagePreview();
    showLogin();
});

async function loadData() {
    await Promise.all([
        loadPerfumes(),
        loadBrands(),
        loadCategories(),
        loadSellers(),
        loadSales(),
        loadPurchaseRequests()
    ]);
    updateStatistics();
    renderManagementLists();
    populatePerfumeSelects();
    populateConfirmedSaleForm();
    loadSellerStats();
    renderSalesHistory();
}

let stockQtySupported = false;

function qtyOf(perfume) {
    const raw = perfume?.stock_cantidad;
    if (raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw))) return null;
    return Math.max(0, Math.floor(Number(raw)));
}

function updateStockQtyFieldVisibility() {
    $("stockQtyField")?.classList.toggle("hidden", !stockQtySupported);
    $("stockQtyHint")?.classList.toggle("hidden", stockQtySupported);
}

async function loadPerfumes() {
    const base = `
            id, nombre, tipo_producto, genero, precio, descripcion, acordes, imagen, stock, premium, temporadas,
            destacado, promocion_activa, descuento_porcentaje, promocion_inicio, promocion_fin,
            marca_id, categoria_id,
            marcas (id, nombre),
            categorias (id, nombre, genero)
        `;
    // La columna stock_cantidad es opcional: si todavía no existe, el panel funciona igual sin ella.
    let result = await supabaseClient.from("perfumes").select(base + ", stock_cantidad").order("id", { ascending: false });
    stockQtySupported = !result.error;
    if (result.error) result = await supabaseClient.from("perfumes").select(base).order("id", { ascending: false });
    updateStockQtyFieldVisibility();

    if (result.error) {
        console.error("Error cargando perfumes:", result.error);
        return;
    }

    perfumes = result.data || [];
    updateStatistics();
    renderAdminProducts(getAdminFilteredProducts());
}

async function loadBrands() {
    const result = await supabaseClient.from("marcas").select("*").order("nombre");
    if (result.error) {
        console.error("Error cargando marcas:", result.error);
        return;
    }
    marcas = result.data || [];
}

async function loadCategories() {
    const result = await supabaseClient.from("categorias").select("*").order("nombre");
    if (result.error) {
        console.error("Error cargando categorías:", result.error);
        return;
    }
    categorias = result.data || [];
}

async function loadSellers() {
    const result = await supabaseClient
        .from("vendedores")
        .select("id,nombre,telefono")
        .eq("activo", true)
        .order("nombre");

    if (result.error) {
        console.error("Error cargando vendedores:", result.error);
        vendedores = [];
        return;
    }
    vendedores = result.data || [];
}

async function loadSales() {
    // Primero intentamos traer el precio guardado en el momento del registro.
    let result = await supabaseClient
        .from("ventas")
        .select(`
            id, vendedor_id, perfume_id, precio, created_at,
            vendedores (nombre),
            perfumes (nombre, precio)
        `)
        .order("created_at", { ascending: false });

    // Compatibilidad si todavía no se ejecutó la migración de precio.
    if (result.error) {
        result = await supabaseClient
            .from("ventas")
            .select(`
                id, vendedor_id, perfume_id, created_at,
                vendedores (nombre),
                perfumes (nombre, precio)
            `)
            .order("created_at", { ascending: false });
    }

    if (result.error) {
        console.error("Error cargando registros:", result.error);
        ventas = [];
        if (salesHistoryMessage) salesHistoryMessage.textContent = "No se pudo cargar el historial. Revisá las políticas RLS.";
        return;
    }

    ventas = result.data || [];
    updateStatistics();
}

async function loadPurchaseRequests() {
    const body = $("purchaseRequestsBody");
    const message = $("purchaseRequestsMessage");
    const result = await supabaseClient
        .from("solicitudes_compra")
        .select("id,vendedor_id,perfume_id,producto_nombre,precio_solicitado,estado,created_at,confirmado_at,cancelado_at,vendedores(nombre),perfumes(nombre)")
        .order("created_at", { ascending: false });
    if (result.error) {
        console.error("Error cargando solicitudes:", result.error);
        solicitudesCompra = [];
        if (body) body.innerHTML = '<tr><td colspan="6">No se pudieron cargar las solicitudes. Verificá que hayas ejecutado el SQL de solicitudes en Supabase.</td></tr>';
        if (message) message.textContent = "Las solicitudes deben guardarse en Supabase para que quede un registro central.";
        return;
    }
    solicitudesCompra = result.data || [];
    renderPurchaseRequests();
}

// Las unidades de un mismo pedido del carrito se guardan juntas (misma fecha y vendedor).
function requestGroupKey(req) {
    return `${req.created_at}|${req.vendedor_id ?? ""}`;
}

function orderedRequestGroups() {
    const groups = new Map();
    solicitudesCompra.forEach(function (req) {
        const key = requestGroupKey(req);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(req);
    });
    return [...groups.entries()].map(([key, rows]) => ({ key, rows }));
}

function updatePendingBadge() {
    const pendingOrders = orderedRequestGroups().filter(g => g.rows.some(r => r.estado === "pendiente")).length;
    const badge = $("pendingBadge");
    if (badge) {
        badge.textContent = String(pendingOrders);
        badge.classList.toggle("is-empty", pendingOrders === 0);
        if (lastPendingOrders !== null && pendingOrders > lastPendingOrders) {
            badge.classList.remove("flash");
            void badge.offsetWidth;
            badge.classList.add("flash");
        }
    }
    const chip = $("pendingChip");
    if (chip) {
        chip.classList.toggle("is-empty", pendingOrders === 0);
        const text = $("pendingChipText");
        if (text) text.textContent = pendingOrders === 1 ? "1 pedido pendiente" : `${pendingOrders} pedidos pendientes`;
    }
    document.title = (pendingOrders ? `(${pendingOrders}) ` : "") + "Elixir House | Administración";
    lastPendingOrders = pendingOrders;
}

function renderPurchaseRequests() {
    const body = $("purchaseRequestsBody");
    const message = $("purchaseRequestsMessage");
    if (!body) return;
    body.innerHTML = "";
    const groups = orderedRequestGroups();
    if (!solicitudesCompra.length) {
        body.innerHTML = '<tr><td colspan="6">Todavía no hay solicitudes registradas.</td></tr>';
    } else {
        groups.forEach(function (group, groupIndex) {
            const multi = group.rows.length > 1;
            const pendingRows = group.rows.filter(r => r.estado === "pendiente");
            const groupTotal = group.rows.reduce((sum, r) => sum + (Number(r.precio_solicitado) || 0), 0);
            group.rows.forEach(function (req, rowIndex) {
                const tr = document.createElement("tr");
                tr.className = `order-group-${groupIndex % 2}` + (multi ? (rowIndex === 0 ? " order-group-start" : " order-group-member") : "");
                const status = req.estado || "pendiente";
                const statusLabel = status === "confirmada" ? "CONFIRMADA" : status === "cancelada" ? "CANCELADA" : "PENDIENTE";
                let actions = status === "pendiente"
                    ? `<button type="button" class="secondary-button request-confirm-button" data-id="${escapeHTML(req.id)}">CONFIRMAR COMPRA</button> <button type="button" class="secondary-button request-cancel-button" data-id="${escapeHTML(req.id)}">CANCELAR</button>`
                    : `<span class="request-status request-status-${status}">${statusLabel}</span>`;
                if (multi && rowIndex === 0 && pendingRows.length >= 2) {
                    actions += `<div class="order-group-actions"><button type="button" class="primary-button order-confirm-all" data-key="${escapeHTML(group.key)}">CONFIRMAR PEDIDO COMPLETO (${pendingRows.length})</button> <button type="button" class="secondary-button order-cancel-all" data-key="${escapeHTML(group.key)}">CANCELAR PEDIDO</button></div>`;
                }
                const orderChip = (multi && rowIndex === 0)
                    ? `<span class="order-chip">PEDIDO · ${group.rows.length} productos · ${formatPrice(groupTotal)}</span>`
                    : "";
                tr.innerHTML = `<td><code>${escapeHTML(String(req.id).slice(0, 8).toUpperCase())}</code></td><td>${escapeHTML(formatDate(req.created_at))}${orderChip}</td><td>${escapeHTML(req.vendedores?.nombre || "Vendedor no disponible")}</td><td>${escapeHTML(req.producto_nombre || req.perfumes?.nombre || "Consulta general")}</td><td>${req.precio_solicitado == null ? "—" : formatPrice(req.precio_solicitado)}</td><td>${actions}</td>`;
                body.appendChild(tr);
            });
        });
    }
    if (message) {
        const pending = solicitudesCompra.filter(r => r.estado === "pendiente").length;
        const orders = groups.length;
        message.textContent = `${orders} pedido${orders === 1 ? "" : "s"} (${solicitudesCompra.length} producto${solicitudesCompra.length === 1 ? "" : "s"}) · ${pending} pendiente${pending === 1 ? "" : "s"}. Las solicitudes no suman puntos hasta confirmarse.`;
    }
    body.querySelectorAll(".request-confirm-button").forEach(button => button.addEventListener("click", () => confirmPurchaseRequest(button.dataset.id)));
    body.querySelectorAll(".request-cancel-button").forEach(button => button.addEventListener("click", () => cancelPurchaseRequest(button.dataset.id)));
    body.querySelectorAll(".order-confirm-all").forEach(button => button.addEventListener("click", () => confirmRequestGroup(button.dataset.key)));
    body.querySelectorAll(".order-cancel-all").forEach(button => button.addEventListener("click", () => cancelRequestGroup(button.dataset.key)));
    updatePendingBadge();
}

async function confirmPurchaseRequest(requestId) {
    const req = solicitudesCompra.find(r => String(r.id) === String(requestId));
    if (!req || req.estado !== "pendiente") return;
    const entered = prompt(`Confirmar compra de ${req.producto_nombre || "este producto"}. Precio final de venta:`, String(req.precio_solicitado ?? ""));
    if (entered === null) return;
    const price = Number(entered);
    if (!Number.isFinite(price) || price < 0) { alert("Ingresá un precio válido."); return; }
    const result = await supabaseClient.rpc("confirmar_solicitud_compra", { p_solicitud_id: requestId, p_precio: price });
    if (result.error) {
        console.error("No se pudo confirmar la solicitud:", result.error);
        alert("No se pudo confirmar. Revisá que hayas ejecutado el SQL de solicitudes y la función de confirmación en Supabase.");
        return;
    }
    await discountStockFor([req]);
    await Promise.all([loadPurchaseRequests(), loadSales()]);
    updateStatistics();
    renderAdminProducts(getAdminFilteredProducts());
    await loadSellerStats();
    renderSalesHistory();
    alert("Compra confirmada. Ya cuenta en el historial de ventas y los puntos del vendedor.");
}

async function cancelPurchaseRequest(requestId) {
    const req = solicitudesCompra.find(r => String(r.id) === String(requestId));
    if (!req || req.estado !== "pendiente") return;
    if (!confirm("¿Marcar esta solicitud como cancelada? Quedará registrada en el historial de solicitudes.")) return;
    const sessionResult = await supabaseClient.auth.getSession();
    const result = await supabaseClient.from("solicitudes_compra").update({
        estado: "cancelada",
        cancelado_at: new Date().toISOString(),
        cancelado_por: sessionResult.data?.session?.user?.id || null
    }).eq("id", requestId).eq("estado", "pendiente");
    if (result.error) {
        console.error("No se pudo cancelar la solicitud:", result.error);
        alert("No se pudo cancelar la solicitud. Revisá los permisos de Supabase.");
        return;
    }
    await loadPurchaseRequests();
}

async function confirmRequestGroup(key) {
    const rows = solicitudesCompra.filter(r => requestGroupKey(r) === key && r.estado === "pendiente");
    if (rows.length < 2) return;
    if (rows.some(r => r.precio_solicitado == null)) {
        alert("Algunos productos de este pedido no tienen precio solicitado. Confirmalos de a uno.");
        return;
    }
    const total = rows.reduce((sum, r) => sum + Number(r.precio_solicitado), 0);
    if (!confirm(`¿Confirmar el pedido completo (${rows.length} productos) por ${formatPrice(total)}?\n\nSe registrarán ${rows.length} ventas al precio solicitado. Si acordaste otro precio, confirmá los productos de a uno.`)) return;

    const confirmed = [];
    for (const req of rows) {
        const result = await supabaseClient.rpc("confirmar_solicitud_compra", { p_solicitud_id: req.id, p_precio: Number(req.precio_solicitado) });
        if (result.error) {
            console.error("No se pudo confirmar una solicitud del pedido:", result.error);
            break;
        }
        confirmed.push(req);
    }
    await discountStockFor(confirmed);
    await Promise.all([loadPurchaseRequests(), loadSales()]);
    updateStatistics();
    renderAdminProducts(getAdminFilteredProducts());
    await loadSellerStats();
    renderSalesHistory();
    alert(confirmed.length === rows.length
        ? `Pedido confirmado: ${confirmed.length} ventas registradas.`
        : `Se confirmaron ${confirmed.length} de ${rows.length} productos. Las restantes siguen pendientes: revisá la función de confirmación y las políticas en Supabase.`);
}

async function cancelRequestGroup(key) {
    const rows = solicitudesCompra.filter(r => requestGroupKey(r) === key && r.estado === "pendiente");
    if (!rows.length) return;
    if (!confirm(`¿Cancelar las ${rows.length} solicitudes pendientes de este pedido? Quedarán registradas como canceladas.`)) return;
    const sessionResult = await supabaseClient.auth.getSession();
    const result = await supabaseClient.from("solicitudes_compra").update({
        estado: "cancelada",
        cancelado_at: new Date().toISOString(),
        cancelado_por: sessionResult.data?.session?.user?.id || null
    }).in("id", rows.map(r => r.id)).eq("estado", "pendiente");
    if (result.error) {
        console.error("No se pudo cancelar el pedido:", result.error);
        alert("No se pudo cancelar el pedido. Revisá los permisos de Supabase.");
        return;
    }
    await loadPurchaseRequests();
}

// Descuenta del stock una unidad por cada compra confirmada (solo productos con unidades cargadas).
async function discountStockFor(rows) {
    if (!stockQtySupported) return;
    const counts = new Map();
    rows.forEach(function (row) {
        if (!row.perfume_id) return;
        counts.set(String(row.perfume_id), (counts.get(String(row.perfume_id)) || 0) + 1);
    });
    for (const [id, units] of counts) {
        const perfume = perfumes.find(p => String(p.id) === id);
        const qty = perfume ? qtyOf(perfume) : null;
        if (!perfume || qty === null) continue;
        const next = Math.max(0, qty - units);
        const result = await supabaseClient.from("perfumes").update({ stock_cantidad: next, stock: next > 0 }).eq("id", perfume.id);
        if (!result.error) { perfume.stock_cantidad = next; perfume.stock = next > 0; }
    }
}

$("refreshPurchaseRequests")?.addEventListener("click", loadPurchaseRequests);

function updateStatistics() {
    if (totalPerfumes) totalPerfumes.textContent = perfumes.length;
    if (totalStock) totalStock.textContent = perfumes.filter(p => p.stock).length;
    if (totalPremium) totalPremium.textContent = perfumes.filter(p => p.premium).length;
    if (totalBrands) totalBrands.textContent = marcas.length;
    if (totalCategories) totalCategories.textContent = categorias.length;
    if (totalSales) totalSales.textContent = ventas.length;

    const value = ventas.reduce(function (sum, sale) {
        const price = sale.precio ?? sale.perfumes?.precio ?? 0;
        return sum + (Number(price) || 0);
    }, 0);

    if (totalSalesValue) totalSalesValue.textContent = formatPrice(value);
}

function populatePerfumeSelects() {
    if (perfumeBrand) {
        const current = perfumeBrand.value;
        perfumeBrand.innerHTML = '<option value="">Seleccionar marca</option>';
        marcas.forEach(brand => {
            const option = document.createElement("option");
            option.value = brand.id;
            option.textContent = brand.nombre;
            perfumeBrand.appendChild(option);
        });
        if (current) perfumeBrand.value = current;
    }

    if (perfumeCategory) {
        const current = perfumeCategory.value;
        perfumeCategory.innerHTML = '<option value="">Seleccionar categoría</option>';
        SEASONS.forEach(name => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            perfumeCategory.appendChild(option);
        });
        if (current) perfumeCategory.value = current;
    }
}

function populateConfirmedSaleForm() {
    if (confirmedSaleSeller) {
        const current = confirmedSaleSeller.value;
        confirmedSaleSeller.innerHTML = '<option value="">Seleccionar vendedor</option>';
        vendedores.filter(s => s.activo !== false).forEach(seller => {
            const option = document.createElement("option");
            option.value = seller.id;
            option.textContent = seller.nombre || "Vendedor";
            confirmedSaleSeller.appendChild(option);
        });
        if (current) confirmedSaleSeller.value = current;
    }
    if (confirmedSalePerfume) {
        const current = confirmedSalePerfume.value;
        confirmedSalePerfume.innerHTML = '<option value="">Seleccionar producto</option>';
        perfumes.forEach(perfume => {
            const option = document.createElement("option");
            option.value = perfume.id;
            option.dataset.price = String(Number(perfume.precio) || 0);
            option.dataset.discount = String(Number(perfume.descuento_porcentaje) || 0);
            option.dataset.promo = String(perfume.promocion_activa === true);
            option.textContent = `${perfume.nombre || "Producto"} — ${formatPrice(perfume.precio)}`;
            confirmedSalePerfume.appendChild(option);
        });
        if (current) confirmedSalePerfume.value = current;
    }
    updateConfirmedSalePrice();
}

function updateConfirmedSalePrice() {
    if (!confirmedSalePerfume || !confirmedSalePrice) return;
    const option = confirmedSalePerfume.selectedOptions?.[0];
    if (!option || !option.value) return;
    let price = Number(option.dataset.price) || 0;
    if (option.dataset.promo === "true") {
        const discount = Math.min(100, Math.max(0, Number(option.dataset.discount) || 0));
        price = Math.round(price * (1 - discount / 100));
    }
    confirmedSalePrice.value = String(price);
}

confirmedSalePerfume?.addEventListener("change", updateConfirmedSalePrice);
confirmedSaleForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!confirmedSaleSeller?.value || !confirmedSalePerfume?.value) {
        if (confirmedSaleMessage) confirmedSaleMessage.textContent = "Elegí el vendedor y el producto.";
        return;
    }
    const price = Number(confirmedSalePrice?.value);
    if (!Number.isFinite(price) || price < 0) {
        if (confirmedSaleMessage) confirmedSaleMessage.textContent = "Ingresá un precio válido.";
        return;
    }
    const button = confirmedSaleForm.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "REGISTRANDO…"; }
    if (confirmedSaleMessage) confirmedSaleMessage.textContent = "Guardando venta confirmada…";
    const result = await supabaseClient.from("ventas").insert({
        vendedor_id: confirmedSaleSeller.value,
        perfume_id: confirmedSalePerfume.value,
        precio: price
    });
    if (button) { button.disabled = false; button.textContent = "CONFIRMAR Y REGISTRAR VENTA"; }
    if (result.error) {
        console.error("No se pudo registrar la venta confirmada:", result.error);
        if (confirmedSaleMessage) confirmedSaleMessage.textContent = "No se pudo registrar. Revisá la conexión y las políticas de Supabase.";
        return;
    }
    if (confirmedSaleMessage) confirmedSaleMessage.textContent = "¡Venta confirmada! Ya se actualizarán el historial y los puntos de venta.";
    await discountStockFor([{ perfume_id: confirmedSalePerfume.value }]);
    renderAdminProducts(getAdminFilteredProducts());
    confirmedSaleForm.reset();
    await loadSales();
    updateStatistics();
    await loadSellerStats();
    renderSalesHistory();
});

function renderManagementLists() {
    renderBrands();
    renderCategories();
}

function renderBrands() {
    if (!brandsList) return;
    brandsList.innerHTML = "";

    if (!marcas.length) {
        brandsList.innerHTML = '<p class="empty-management">Todavía no hay marcas creadas.</p>';
        return;
    }

    marcas.forEach(function (brand) {
        const used = perfumes.filter(p => String(p.marca_id) === String(brand.id)).length;
        const row = document.createElement("div");
        row.className = "management-item";
        row.innerHTML = `
            <div>
                <strong>${escapeHTML(brand.nombre)}</strong>
                <span>${used ? `${used} perfume${used === 1 ? "" : "s"} asociado${used === 1 ? "" : "s"}` : "Sin perfumes asociados"}</span>
            </div>
            <div class="management-actions">
                <button type="button" class="edit-management" data-id="${escapeHTML(brand.id)}">EDITAR</button>
                <button type="button" class="delete-management" data-id="${escapeHTML(brand.id)}" ${used ? "disabled title='Marca en uso'" : ""}>ELIMINAR</button>
            </div>
        `;
        brandsList.appendChild(row);
    });

    brandsList.querySelectorAll(".edit-management").forEach(btn => {
        btn.addEventListener("click", () => editBrand(btn.dataset.id));
    });
    brandsList.querySelectorAll(".delete-management").forEach(btn => {
        btn.addEventListener("click", () => deleteBrand(btn.dataset.id));
    });
}

function renderCategories() {
    if (!categoriesList) return;
    categoriesList.innerHTML = "";

    if (!categorias.length) {
        categoriesList.innerHTML = '<p class="empty-management">Todavía no hay categorías creadas.</p>';
        return;
    }

    categorias.forEach(function (category) {
        const used = perfumes.filter(p => String(p.categoria_id) === String(category.id)).length;
        const row = document.createElement("div");
        row.className = "management-item";
        row.innerHTML = `
            <div>
                <strong>${escapeHTML(category.nombre)}</strong>
                <span>${used ? `${used} perfume${used === 1 ? "" : "s"} asociado${used === 1 ? "" : "s"}` : "Sin perfumes asociados"}</span>
            </div>
            <div class="management-actions">
                <button type="button" class="edit-management" data-id="${escapeHTML(category.id)}">EDITAR</button>
                <button type="button" class="delete-management" data-id="${escapeHTML(category.id)}" ${used ? "disabled title='Categoría en uso'" : ""}>ELIMINAR</button>
            </div>
        `;
        categoriesList.appendChild(row);
    });

    categoriesList.querySelectorAll(".edit-management").forEach(btn => {
        btn.addEventListener("click", () => editCategory(btn.dataset.id));
    });
    categoriesList.querySelectorAll(".delete-management").forEach(btn => {
        btn.addEventListener("click", () => deleteCategory(btn.dataset.id));
    });
}

function editBrand(id) {
    const brand = marcas.find(item => String(item.id) === String(id));
    if (!brand) return;
    editingBrandId = brand.id;
    brandName.value = brand.nombre || "";
    brandSubmitButton.textContent = "GUARDAR CAMBIOS";
    brandCancelEdit.classList.remove("hidden");
    brandName.focus();
    brandName.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelBrandEdit() {
    editingBrandId = null;
    brandForm?.reset();
    if (brandSubmitButton) brandSubmitButton.textContent = "+ AGREGAR MARCA";
    brandCancelEdit?.classList.add("hidden");
}

brandCancelEdit?.addEventListener("click", cancelBrandEdit);

brandForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    const name = brandName.value.trim();
    if (!name) return;

    let result;
    if (editingBrandId) {
        result = await supabaseClient.from("marcas").update({ nombre: name }).eq("id", editingBrandId);
    } else {
        result = await supabaseClient.from("marcas").insert({ nombre: name });
    }

    if (result.error) {
        console.error(result.error);
        alert(result.error.code === "23505" ? "Esa marca ya existe." : "No se pudo guardar la marca.");
        return;
    }

    cancelBrandEdit();
    await loadBrands();
    populatePerfumeSelects();
    renderManagementLists();
    updateStatistics();
});

async function deleteBrand(id) {
    const brand = marcas.find(item => String(item.id) === String(id));
    if (!brand) return;

    const used = perfumes.filter(p => String(p.marca_id) === String(id)).length;
    if (used) {
        alert(`No se puede eliminar "${brand.nombre}" porque está asociada a ${used} perfume${used === 1 ? "" : "s"}. Reasigná esos perfumes primero.`);
        return;
    }

    if (!confirm(`¿Eliminar la marca "${brand.nombre}"?`)) return;

    const result = await supabaseClient.from("marcas").delete().eq("id", id);
    if (result.error) {
        console.error(result.error);
        alert("No se pudo eliminar la marca. Supabase rechazó la operación.");
        return;
    }

    await loadBrands();
    populatePerfumeSelects();
    renderManagementLists();
    updateStatistics();
}

function editCategory(id) {
    const category = categorias.find(item => String(item.id) === String(id));
    if (!category) return;
    editingCategoryId = category.id;
    categoryName.value = category.nombre || "";
    categorySubmitButton.textContent = "GUARDAR CAMBIOS";
    categoryCancelEdit.classList.remove("hidden");
    categoryName.focus();
    categoryName.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelCategoryEdit() {
    editingCategoryId = null;
    categoryForm?.reset();
    if (categorySubmitButton) categorySubmitButton.textContent = "+ AGREGAR CATEGORÍA";
    categoryCancelEdit?.classList.add("hidden");
}

categoryCancelEdit?.addEventListener("click", cancelCategoryEdit);

categoryForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    const name = categoryName.value.trim();
    if (!name) return;

    let result;
    if (editingCategoryId) {
        result = await supabaseClient
            .from("categorias")
            .update({ nombre: name })
            .eq("id", editingCategoryId);
    } else {
        result = await supabaseClient
            .from("categorias")
            .insert({ nombre: name });
    }

    if (result.error) {
        console.error(result.error);
        alert(result.error.code === "23505" ? "Esa categoría ya existe." : "No se pudo guardar la categoría.");
        return;
    }

    cancelCategoryEdit();
    await loadCategories();
    populatePerfumeSelects();
    renderManagementLists();
    updateStatistics();
});

async function deleteCategory(id) {
    const category = categorias.find(item => String(item.id) === String(id));
    if (!category) return;

    const used = perfumes.filter(p => String(p.categoria_id) === String(id)).length;
    if (used) {
        alert(`No se puede eliminar "${category.nombre}" porque está asociada a ${used} perfume${used === 1 ? "" : "s"}. Reasigná esos perfumes primero.`);
        return;
    }

    if (!confirm(`¿Eliminar la categoría "${category.nombre}"?`)) return;

    const result = await supabaseClient.from("categorias").delete().eq("id", id);
    if (result.error) {
        console.error(result.error);
        alert("No se pudo eliminar la categoría. Supabase rechazó la operación.");
        return;
    }

    await loadCategories();
    populatePerfumeSelects();
    renderManagementLists();
    updateStatistics();
}

function updateProductTypeFields() {
    const isPerfume = (productType?.value || "Perfume") === "Perfume";
    const genderField = $("genderField");
    const accordsField = $("accordsField");
    const seasonsField = document.querySelector(".season-selector-group");
    if (genderField) genderField.classList.toggle("hidden", !isPerfume);
    if (accordsField) accordsField.classList.toggle("hidden", !isPerfume);
    if (seasonsField) seasonsField.classList.toggle("hidden", !isPerfume);
    const label = $("productNameLabel");
    if (label) label.textContent = isPerfume ? "Nombre del perfume" : "Nombre del producto";
    const heading = document.querySelector("#perfumeFormSection .section-title h2");
    if (heading && !editingPerfumeId) heading.textContent = isPerfume ? "AGREGAR PERFUME" : "AGREGAR PRODUCTO";
}
productType?.addEventListener("change", updateProductTypeFields);

function openNewPerfumeForm() {
    editingPerfumeId = null;
    [1, 2, 3].forEach(n => { const el = $(`perfumeAccord${n}`); if (el) el.value = ""; });
    perfumeForm.reset();
    if (productType) productType.value = "Perfume";
    setSelectedSeasons([]);
    updateProductTypeFields();
    $("perfumeStock").checked = true;
    $("perfumePremium").checked = false;
    if ($("perfumeFeatured")) $("perfumeFeatured").checked = false;
    if ($("perfumePromoActive")) $("perfumePromoActive").checked = false;
    if ($("perfumeDiscount")) $("perfumeDiscount").value = "0";
    if ($("promoStart")) $("promoStart").value = "";
    if ($("promoEnd")) $("promoEnd").value = "";
    document.querySelector("#perfumeFormSection .section-title h2").textContent = "AGREGAR PERFUME";
    formMessage.textContent = "";
    clearImagePreview();
    perfumeFormSection.classList.remove("hidden");
    perfumeFormSection.scrollIntoView({ behavior: "smooth" });
}

showAddPerfume?.addEventListener("click", openNewPerfumeForm);

cancelForm?.addEventListener("click", function () {
    editingPerfumeId = null;
    perfumeForm.reset();
    setSelectedSeasons([]);
    [1, 2, 3].forEach(n => { const el = $(`perfumeAccord${n}`); if (el) el.value = ""; });
    perfumeFormSection.classList.add("hidden");
    formMessage.textContent = "";
    clearImagePreview();
});

perfumeGender?.addEventListener("change", function () {
    const current = perfumeCategory.value;
    perfumeCategory.innerHTML = '<option value="">Seleccionar categoría</option>';
    SEASONS.forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        perfumeCategory.appendChild(option);
    });
    if ([...perfumeCategory.options].some(o => o.value === String(current))) perfumeCategory.value = current;
});

perfumeForm?.addEventListener("submit", async function (event) {
    event.preventDefault();

    formMessage.textContent = "Guardando perfume...";
    formMessage.style.color = "#d8b94f";

    const nombre = $("perfumeName").value.trim();
    const tipo_producto = productType?.value || "Perfume";
    const marcaId = perfumeBrand.value || null;
    const genero = tipo_producto === "Perfume" ? perfumeGender.value : "Unisex";
    const temporadas = tipo_producto === "Perfume" ? getSelectedSeasons() : [];
    if (temporadas.length > 2) {
        formMessage.textContent = "Elegí como máximo 2 temporadas.";
        formMessage.style.color = "#ff6b6b";
        return;
    }
    const categoriaId = null;
    const precio = Number($("perfumePrice").value);
    const descripcion = $("perfumeDescription").value.trim();
    const acordes = tipo_producto === "Perfume" ? [1, 2, 3].map(n => $(`perfumeAccord${n}`)?.value.trim() || "").filter(Boolean) : [];
    if (tipo_producto === "Perfume" && (acordes.length < 1 || acordes.length > 3)) {
        formMessage.textContent = "Ingresá entre 1 y 3 acordes para el perfume.";
        formMessage.style.color = "#ff6b6b";
        return;
    }
    let stock = $("perfumeStock").checked;
    let stock_cantidad;   // undefined = la columna no existe, no se envía
    if (stockQtySupported) {
        const qtyText = ($("perfumeStockQty")?.value || "").trim();
        if (qtyText === "") stock_cantidad = null;
        else {
            const n = Math.floor(Number(qtyText));
            if (!Number.isFinite(n) || n < 0) {
                formMessage.textContent = "Ingresá una cantidad de unidades válida (0 o más).";
                formMessage.style.color = "#ff6b6b";
                return;
            }
            stock_cantidad = n;
            stock = n > 0;   // con unidades cargadas, el stock se deduce de la cantidad
        }
    }
    const premium = $("perfumePremium").checked;
    const destacado = $("perfumeFeatured")?.checked || false;
    const promocion_activa = $("perfumePromoActive")?.checked || false;
    const descuento_porcentaje = Math.min(90, Math.max(0, Number($("perfumeDiscount")?.value) || 0));
    const promocion_inicio = $("promoStart")?.value || null;
    const promocion_fin = $("promoEnd")?.value || null;
    if (promocion_activa && descuento_porcentaje <= 0) {
        formMessage.textContent = "Ingresá un descuento mayor que 0 para activar la promoción.";
        formMessage.style.color = "#ff6b6b"; return;
    }
    if (promocion_inicio && promocion_fin && promocion_fin < promocion_inicio) {
        formMessage.textContent = "La fecha de fin no puede ser anterior a la fecha de inicio.";
        formMessage.style.color = "#ff6b6b"; return;
    }

    let imagen = duplicatedImageURL || null;
    if (editingPerfumeId) {
        const current = perfumes.find(p => String(p.id) === String(editingPerfumeId));
        imagen = current?.imagen || null;
    }

    const imageFile = perfumeImageFile.files[0];
    if (imageFile) {
        if (!imageFile.type.startsWith("image/")) {
            formMessage.textContent = "El archivo seleccionado no es una imagen.";
            formMessage.style.color = "#ff4d4d";
            return;
        }
        if (imageFile.size > 5 * 1024 * 1024) {
            formMessage.textContent = "La imagen no puede superar los 5 MB.";
            formMessage.style.color = "#ff4d4d";
            return;
        }

        formMessage.textContent = "Optimizando imagen...";
        const optimized = await optimizeImage(imageFile);
        formMessage.textContent = "Subiendo imagen...";
        const path = "perfumes/" + Date.now() + "-" + Math.random().toString(36).slice(2, 10) + "." + optimized.extension;

        // El nombre del archivo es único, por eso puede guardarse en caché por mucho tiempo.
        const upload = await supabaseClient.storage.from("perfumes").upload(path, optimized.file, {
            cacheControl: "31536000",
            upsert: false,
            contentType: optimized.file.type || undefined
        });

        if (upload.error) {
            console.error(upload.error);
            formMessage.textContent = "No se pudo subir la imagen.";
            formMessage.style.color = "#ff4d4d";
            return;
        }

        imagen = supabaseClient.storage.from("perfumes").getPublicUrl(path).data.publicUrl;
    }

    const data = { nombre, tipo_producto, marca_id: marcaId, genero, categoria_id: categoriaId, temporadas, precio, descripcion, acordes, imagen, stock, premium, destacado, promocion_activa, descuento_porcentaje, promocion_inicio, promocion_fin };
    if (stock_cantidad !== undefined) data.stock_cantidad = stock_cantidad;

    let result;
    if (editingPerfumeId) {
        result = await supabaseClient.from("perfumes").update(data).eq("id", editingPerfumeId);
    } else {
        result = await supabaseClient.from("perfumes").insert(data);
    }

    if (result.error) {
        console.error(result.error);
        formMessage.textContent = result.error.message || "No se pudo guardar el perfume.";
        formMessage.style.color = "#d65a67";
        return;
    }

    formMessage.textContent = editingPerfumeId ? "Producto actualizado correctamente." : "Producto agregado correctamente.";
    duplicatedImageURL = null;
    formMessage.style.color = "#65c77a";
    editingPerfumeId = null;
    perfumeForm.reset();
    if (productType) productType.value = "Perfume";
    setSelectedSeasons([]);
    updateProductTypeFields();
    $("perfumeStock").checked = true;
    clearImagePreview();
    await loadPerfumes();
    await loadCategories();
    await loadBrands();
    populatePerfumeSelects();
    renderManagementLists();
    updateStatistics();
});

// ---------- Paginación del listado de productos (máx. 12 por página) ----------
const ADMIN_PAGE_SIZE = 12;
let adminCurrentPage = 1;

function getAdminFilteredProducts() {
    const term = (adminSearch?.value || "").toLowerCase().trim();
    if (!term) return perfumes;
    return perfumes.filter(p => {
        const text = [p.nombre, p.genero, p.tipo_producto, p.descripcion, p.marcas?.nombre, p.categorias?.nombre, ...(p.acordes || []), ...(p.temporadas || [])].join(" ").toLowerCase();
        return text.includes(term);
    });
}

function renderAdminPagination(totalItems, totalPages) {
    const nav = $("adminPagination");
    if (!nav) return;
    nav.innerHTML = "";
    if (totalItems <= ADMIN_PAGE_SIZE) return;

    const makeButton = (label, page, extra = {}) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        if (extra.disabled) button.disabled = true;
        if (extra.active) button.classList.add("active");
        if (extra.aria) button.setAttribute("aria-label", extra.aria);
        button.addEventListener("click", () => changeAdminPage(page));
        return button;
    };

    nav.appendChild(makeButton("‹ Anterior", adminCurrentPage - 1, { disabled: adminCurrentPage === 1 }));
    for (let page = 1; page <= totalPages; page++) {
        nav.appendChild(makeButton(String(page), page, { active: page === adminCurrentPage, aria: `Página ${page}` }));
    }
    nav.appendChild(makeButton("Siguiente ›", adminCurrentPage + 1, { disabled: adminCurrentPage === totalPages }));

    const label = document.createElement("span");
    label.className = "page-label";
    const from = (adminCurrentPage - 1) * ADMIN_PAGE_SIZE + 1;
    const to = Math.min(adminCurrentPage * ADMIN_PAGE_SIZE, totalItems);
    label.textContent = `Mostrando ${from}–${to} de ${totalItems} · Página ${adminCurrentPage} de ${totalPages}`;
    nav.appendChild(label);
}

function changeAdminPage(page) {
    adminCurrentPage = page;
    renderAdminProducts(getAdminFilteredProducts());
    document.querySelector(".products-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAdminProducts(allProducts) {
    if (!adminProducts) return;
    adminProducts.innerHTML = "";

    const totalPages = Math.max(1, Math.ceil(allProducts.length / ADMIN_PAGE_SIZE));
    adminCurrentPage = Math.min(Math.max(1, adminCurrentPage), totalPages);
    const pageStart = (adminCurrentPage - 1) * ADMIN_PAGE_SIZE;
    const products = allProducts.slice(pageStart, pageStart + ADMIN_PAGE_SIZE);
    renderAdminPagination(allProducts.length, totalPages);

    if (!allProducts.length) {
        adminProducts.innerHTML = '<p class="empty-management">No hay perfumes que coincidan con la búsqueda.</p>';
        return;
    }

    products.forEach(function (perfume) {
        const card = document.createElement("div");
        card.className = "admin-product" + (perfume.premium ? " premium" : "");

        const brand = perfume.marcas?.nombre || "Sin marca";
        const category = (perfume.temporadas || []).join(", ") || perfume.categorias?.nombre || "Sin temporada";

        const qty = stockQtySupported ? qtyOf(perfume) : null;
        let stockStatusHTML;
        let stockControlsHTML;
        if (qty !== null) {
            const cls = qty === 0 ? "status-no-stock" : (qty <= 3 ? "status-low" : "status-stock");
            stockStatusHTML = `<span class="${cls}">● ${qty === 0 ? "SIN STOCK" : qty + (qty === 1 ? " UNIDAD" : " UNIDADES") + (qty <= 3 ? " · POCAS" : "")}</span>`;
            stockControlsHTML = `<div class="stock-stepper" role="group" aria-label="Unidades de ${escapeHTML(perfume.nombre)}"><button type="button" data-stock-action="dec" data-id="${perfume.id}" aria-label="Restar una unidad">−</button><span>${qty}</span><button type="button" data-stock-action="inc" data-id="${perfume.id}" aria-label="Sumar una unidad">+</button></div>`;
        } else {
            stockStatusHTML = `<span class="${perfume.stock ? "status-stock" : "status-no-stock"}">● ${perfume.stock ? "CON STOCK" : "SIN STOCK"}</span>`;
            stockControlsHTML = `<button type="button" class="stock-toggle-button" data-stock-action="toggle" data-id="${perfume.id}">${perfume.stock ? "MARCAR SIN STOCK" : "MARCAR CON STOCK"}</button>`
                + (stockQtySupported ? `<button type="button" class="stock-toggle-button" data-stock-action="count" data-id="${perfume.id}">CONTAR UNIDADES</button>` : "");
        }

        card.innerHTML = `
            <div class="admin-product-image">
                ${perfume.imagen ? `<img src="${escapeHTML(perfume.imagen)}" alt="${escapeHTML(perfume.nombre)}">` : `<span>ELIXIR</span>`}
            </div>
            <div class="admin-product-info">
                <h3>${escapeHTML(perfume.nombre)}</h3>
                <p><b>Marca:</b> ${escapeHTML(brand)}</p>
                <p><b>Tipo:</b> ${escapeHTML(perfume.tipo_producto || "Perfume")}</p>
                ${((perfume.tipo_producto || "Perfume") === "Perfume") ? `<p><b>Género:</b> ${escapeHTML(perfume.genero)}</p>` : ""}
                <p><b>Categoría:</b> ${escapeHTML(category)}</p>
                <p><b>Acordes:</b> ${escapeHTML((perfume.acordes || []).join(", ") || "Sin acordes")}</p>
                <div class="admin-product-price">${perfume.promocion_activa && Number(perfume.descuento_porcentaje)>0 ? `<del>${formatPrice(perfume.precio)}</del> ${formatPrice(Number(perfume.precio)*(1-Number(perfume.descuento_porcentaje)/100))} <span class="admin-promo-badge">${escapeHTML(perfume.descuento_porcentaje)}% OFF</span>` : formatPrice(perfume.precio)}</div>
                    ${perfume.destacado ? '<span class="admin-featured-badge">DESTACADO EN INICIO</span>' : ''}
                <div class="admin-product-status">
                    ${stockStatusHTML}
                    ${perfume.premium ? '<span class="admin-premium-badge">♦ PREMIUM</span>' : ""}
                </div>
                <div class="admin-stock-controls">${stockControlsHTML}</div>
                <div class="product-actions">
                    <button type="button" class="edit-button" data-id="${perfume.id}">EDITAR</button>
                    <button type="button" class="delete-button" data-id="${perfume.id}">ELIMINAR</button>
                </div>
            </div>
        `;

        adminProducts.appendChild(card);
    });

    adminProducts.querySelectorAll(".edit-button").forEach(btn => btn.addEventListener("click", () => editPerfume(btn.dataset.id)));
    adminProducts.querySelectorAll(".delete-button").forEach(btn => btn.addEventListener("click", () => deletePerfume(btn.dataset.id)));
}

async function handleStockAction(action, id, button) {
    const perfume = perfumes.find(p => String(p.id) === String(id));
    if (!perfume) return;
    const qty = stockQtySupported ? qtyOf(perfume) : null;
    let patch = null;
    if (action === "inc") patch = { stock_cantidad: (qty ?? 0) + 1, stock: true };
    else if (action === "dec") { const next = Math.max(0, (qty ?? 0) - 1); patch = { stock_cantidad: next, stock: next > 0 }; }
    else if (action === "toggle") patch = { stock: !perfume.stock };
    else if (action === "count") {
        const entered = prompt("¿Cuántas unidades hay disponibles?", "1");
        if (entered === null) return;
        const n = Math.floor(Number(entered));
        if (!Number.isFinite(n) || n < 0) { alert("Ingresá un número válido (0 o más)."); return; }
        patch = { stock_cantidad: n, stock: n > 0 };
    }
    if (!patch) return;
    if (button) button.disabled = true;
    const result = await supabaseClient.from("perfumes").update(patch).eq("id", perfume.id);
    if (result.error) {
        console.error("No se pudo actualizar el stock:", result.error);
        alert("No se pudo actualizar el stock. Revisá la conexión y los permisos de Supabase.");
        renderAdminProducts(getAdminFilteredProducts());
        return;
    }
    Object.assign(perfume, patch);
    updateStatistics();
    renderAdminProducts(getAdminFilteredProducts());
}

adminProducts?.addEventListener("click", function (event) {
    const button = event.target.closest("[data-stock-action]");
    if (button) handleStockAction(button.dataset.stockAction, button.dataset.id, button);
});

function editPerfume(id) {
    const perfume = perfumes.find(p => String(p.id) === String(id));
    if (!perfume) return;

    editingPerfumeId = perfume.id;
    document.querySelector("#perfumeFormSection .section-title h2").textContent = "EDITAR PERFUME";

    $("perfumeName").value = perfume.nombre || "";
    if (productType) productType.value = perfume.tipo_producto || "Perfume";
    updateProductTypeFields();
    $("perfumeGender").value = perfume.genero || "";
    populatePerfumeSelects();
    perfumeBrand.value = perfume.marca_id || "";
    perfumeCategory.value = "";
    setSelectedSeasons(Array.isArray(perfume.temporadas) ? perfume.temporadas : []);
    $("perfumePrice").value = perfume.precio ?? "";
    $("perfumeDescription").value = perfume.descripcion || "";
    [1, 2, 3].forEach((n, i) => { const el = $(`perfumeAccord${n}`); if (el) el.value = (perfume.acordes || [])[i] || ""; });
    $("perfumeStock").checked = perfume.stock === true;
    if ($("perfumeStockQty")) $("perfumeStockQty").value = qtyOf(perfume) ?? "";
    $("perfumePremium").checked = perfume.premium === true;
    if ($("perfumeFeatured")) $("perfumeFeatured").checked = perfume.destacado === true;
    if ($("perfumePromoActive")) $("perfumePromoActive").checked = perfume.promocion_activa === true;
    if ($("perfumeDiscount")) $("perfumeDiscount").value = perfume.descuento_porcentaje ?? 0;
    if ($("promoStart")) $("promoStart").value = perfume.promocion_inicio || "";
    if ($("promoEnd")) $("promoEnd").value = perfume.promocion_fin || "";
    perfumeImageFile.value = "";

    if (perfume.imagen) {
        imagePreview.src = perfume.imagen;
        imagePreviewContainer.style.display = "block";
    } else {
        clearImagePreview();
    }

    formMessage.textContent = "";
    perfumeFormSection.classList.remove("hidden");
    perfumeFormSection.scrollIntoView({ behavior: "smooth" });
}

async function deletePerfume(id) {
    const perfume = perfumes.find(p => String(p.id) === String(id));
    if (!perfume) return;
    if (!confirm(`¿Querés eliminar "${perfume.nombre}"? Esta acción no se puede deshacer.`)) return;

    const result = await supabaseClient.from("perfumes").delete().eq("id", id);
    if (result.error) {
        console.error(result.error);
        alert("No se pudo eliminar el perfume. Puede tener registros asociados.");
        return;
    }

    await loadPerfumes();
    await loadSales();
    updateStatistics();
    renderSalesHistory();
}

// Reduce la foto a 900 px y la convierte a WebP: se ven igual y la web carga mucho más rápido.
async function optimizeImage(file, maxSide = 900, quality = 0.82) {
    const original = {
        file: file,
        extension: (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
    };
    try {
        if (!window.createImageBitmap || file.type === "image/gif" || file.type === "image/svg+xml") return original;
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
        if (bitmap.close) bitmap.close();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
        if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return original;
        return { file: blob, extension: "webp" };
    } catch (error) {
        console.warn("No se pudo optimizar la imagen; se sube la original.", error);
        return original;
    }
}

function clearImagePreview() {
    if (imagePreview) imagePreview.src = "";
    if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
    if (perfumeImageFile) perfumeImageFile.value = "";
}

perfumeImageFile?.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return clearImagePreview();

    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        alert("Seleccioná una imagen de hasta 5 MB.");
        this.value = "";
        clearImagePreview();
        return;
    }

    imagePreview.src = URL.createObjectURL(file);
    imagePreviewContainer.style.display = "block";
});

adminSearch?.addEventListener("input", function () {
    adminCurrentPage = 1;
    renderAdminProducts(getAdminFilteredProducts());
});

async function loadSellerStats() {
    if (!sellerStats) return;
    sellerStats.innerHTML = "";
    sellerStatsMessage.textContent = "Cargando vendedores...";

    const salesBySeller = {};
    ventas.forEach(sale => {
        salesBySeller[sale.vendedor_id] = (salesBySeller[sale.vendedor_id] || 0) + 1;
    });

    vendedores.forEach(function (seller) {
        const count = salesBySeller[seller.id] || 0;
        const card = document.createElement("div");
        card.className = "seller-stat-card";
        card.innerHTML = `
            <span class="seller-stat-label">VENDEDOR</span>
            <h3>${escapeHTML(seller.nombre)}</h3>
            <strong>${count}</strong>
            <span class="seller-stat-points">${count === 1 ? "PERFUME REGISTRADO" : "PERFUMES REGISTRADOS"}</span>
            <span class="seller-stat-phone">+${escapeHTML(formatSellerPhone(seller.telefono))}</span>
        `;
        sellerStats.appendChild(card);
    });

    sellerStatsMessage.textContent = `Total registrado: ${ventas.length} ${ventas.length === 1 ? "perfume" : "perfumes"}.`;
}

function formatSellerPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("549")) return `${digits.slice(3, 6)} ${digits.slice(6, 9)}-${digits.slice(9)}`;
    if (digits.length === 12 && digits.startsWith("54")) return `${digits.slice(2, 5)} ${digits.slice(5, 8)}-${digits.slice(8)}`;
    return digits;
}

refreshSellerStats?.addEventListener("click", async function () {
    await loadSellers();
    await loadSales();
    populateConfirmedSaleForm();
    loadSellerStats();
    renderSalesHistory();
    updateStatistics();
});

function populateSalesSellerFilter() {
    if (!salesSellerFilter) return;
    const current = salesSellerFilter.value;
    salesSellerFilter.innerHTML = '<option value="todos">Todos los vendedores</option>';
    vendedores.forEach(seller => {
        const option = document.createElement("option");
        option.value = seller.id;
        option.textContent = seller.nombre;
        salesSellerFilter.appendChild(option);
    });
    if (current) salesSellerFilter.value = current;
}

function renderSalesHistory() {
    if (!salesHistoryBody) return;
    populateSalesSellerFilter();

    const from = salesDateFrom?.value ? new Date(salesDateFrom.value + "T00:00:00") : null;
    const to = salesDateTo?.value ? new Date(salesDateTo.value + "T23:59:59") : null;
    const sellerId = salesSellerFilter?.value || "todos";

    const filtered = ventas.filter(function (sale) {
        const date = new Date(sale.created_at);
        return (
            (!from || date >= from) &&
            (!to || date <= to) &&
            (sellerId === "todos" || String(sale.vendedor_id) === String(sellerId))
        );
    });

    salesHistoryBody.innerHTML = "";

    if (!filtered.length) {
        salesHistoryBody.innerHTML = '<tr><td colspan="4" class="history-empty">No hay registros para estos filtros.</td></tr>';
    } else {
        filtered.forEach(function (sale) {
            const tr = document.createElement("tr");
            const price = sale.precio ?? sale.perfumes?.precio ?? 0;
            tr.innerHTML = `
                <td>${escapeHTML(formatDate(sale.created_at))}</td>
                <td>${escapeHTML(sale.vendedores?.nombre || "—")}</td>
                <td>${escapeHTML(sale.perfumes?.nombre || "Perfume eliminado")}</td>
                <td>${formatPrice(price)}</td>
            `;
            salesHistoryBody.appendChild(tr);
        });
    }

    if (salesHistoryMessage) {
        salesHistoryMessage.textContent = `${filtered.length} registro${filtered.length === 1 ? "" : "s"} mostrado${filtered.length === 1 ? "" : "s"}.`;
    }
}

[salesDateFrom, salesDateTo, salesSellerFilter].forEach(el => el?.addEventListener("change", renderSalesHistory));

clearSalesFilters?.addEventListener("click", function () {
    if (salesDateFrom) salesDateFrom.value = "";
    if (salesDateTo) salesDateTo.value = "";
    if (salesSellerFilter) salesSellerFilter.value = "todos";
    renderSalesHistory();
});

refreshSales?.addEventListener("click", async function () {
    await loadSellers();
    await loadSales();
    populateConfirmedSaleForm();
    loadSellerStats();
    renderSalesHistory();
    updateStatistics();
});

function cancelManagementEdits() {
    cancelBrandEdit();
    cancelCategoryEdit();
}

async function init() {
    updateFavoritesUIIfNeeded();
    await checkSession();
}

// This helper only keeps the admin script independent from the public page.
function updateFavoritesUIIfNeeded() {}

init();
