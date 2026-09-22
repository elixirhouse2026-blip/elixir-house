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
let editingPerfumeId = null;
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
const perfumeGender = $("perfumeGender");
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
const categoryGender = $("categoryGender");
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
const deleteSaleModal = $("deleteSaleModal");
const deleteSalePassword = $("deleteSalePassword");
const confirmDeleteSale = $("confirmDeleteSale");
const closeDeleteSaleModal = $("closeDeleteSaleModal");
const deleteSaleMessage = $("deleteSaleMessage");
let pendingSaleDeleteId = null;

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

async function showAdmin() {
    loginSection.classList.add("hidden");
    adminSection.classList.remove("hidden");
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
        loadSales()
    ]);
    updateStatistics();
    renderManagementLists();
    populatePerfumeSelects();
    loadSellerStats();
    renderSalesHistory();
}

async function loadPerfumes() {
    const result = await supabaseClient
        .from("perfumes")
        .select(`
            id, nombre, genero, precio, descripcion, imagen, stock, premium,
            marca_id, categoria_id,
            marcas (id, nombre),
            categorias (id, nombre, genero)
        `)
        .order("id", { ascending: false });

    if (result.error) {
        console.error("Error cargando perfumes:", result.error);
        return;
    }

    perfumes = result.data || [];
    updateStatistics();
    renderAdminProducts(perfumes);
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
        categorias.forEach(category => {
            const option = document.createElement("option");
            option.value = category.id;
            option.textContent = `${category.nombre} - ${category.genero}`;
            perfumeCategory.appendChild(option);
        });
        if (current) perfumeCategory.value = current;
    }
}

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
                <span>${escapeHTML(category.genero || "Sin género")} · ${used ? `${used} perfume${used === 1 ? "" : "s"} asociado${used === 1 ? "" : "s"}` : "Sin perfumes asociados"}</span>
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
    categoryGender.value = category.genero || "";
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
    const gender = categoryGender.value;
    if (!name || !gender) return;

    let result;
    if (editingCategoryId) {
        result = await supabaseClient
            .from("categorias")
            .update({ nombre: name, genero: gender })
            .eq("id", editingCategoryId);
    } else {
        result = await supabaseClient
            .from("categorias")
            .insert({ nombre: name, genero: gender });
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

function openNewPerfumeForm() {
    editingPerfumeId = null;
    perfumeForm.reset();
    $("perfumeStock").checked = true;
    $("perfumePremium").checked = false;
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
    perfumeFormSection.classList.add("hidden");
    formMessage.textContent = "";
    clearImagePreview();
});

perfumeGender?.addEventListener("change", function () {
    const current = perfumeCategory.value;
    const gender = perfumeGender.value;
    perfumeCategory.innerHTML = '<option value="">Seleccionar categoría</option>';
    categorias
        .filter(c => !gender || c.genero === gender)
        .forEach(c => {
            const option = document.createElement("option");
            option.value = c.id;
            option.textContent = `${c.nombre} - ${c.genero}`;
            perfumeCategory.appendChild(option);
        });
    if ([...perfumeCategory.options].some(o => o.value === String(current))) perfumeCategory.value = current;
});

perfumeForm?.addEventListener("submit", async function (event) {
    event.preventDefault();

    formMessage.textContent = "Guardando perfume...";
    formMessage.style.color = "#d8b94f";

    const nombre = $("perfumeName").value.trim();
    const marcaId = perfumeBrand.value || null;
    const genero = perfumeGender.value;
    const categoriaId = perfumeCategory.value || null;
    const precio = Number($("perfumePrice").value);
    const descripcion = $("perfumeDescription").value.trim();
    const stock = $("perfumeStock").checked;
    const premium = $("perfumePremium").checked;

    let imagen = null;
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

        formMessage.textContent = "Subiendo imagen...";
        const extension = imageFile.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = "perfumes/" + Date.now() + "-" + Math.random().toString(36).slice(2, 10) + "." + (extension || "jpg");

        const upload = await supabaseClient.storage.from("perfumes").upload(path, imageFile, {
            cacheControl: "3600",
            upsert: false
        });

        if (upload.error) {
            console.error(upload.error);
            formMessage.textContent = "No se pudo subir la imagen.";
            formMessage.style.color = "#ff4d4d";
            return;
        }

        imagen = supabaseClient.storage.from("perfumes").getPublicUrl(path).data.publicUrl;
    }

    const data = { nombre, marca_id: marcaId, genero, categoria_id: categoriaId, precio, descripcion, imagen, stock, premium };

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

    formMessage.textContent = editingPerfumeId ? "Perfume actualizado correctamente." : "Perfume agregado correctamente.";
    formMessage.style.color = "#65c77a";
    editingPerfumeId = null;
    perfumeForm.reset();
    $("perfumeStock").checked = true;
    clearImagePreview();
    await loadPerfumes();
    await loadCategories();
    await loadBrands();
    populatePerfumeSelects();
    renderManagementLists();
    updateStatistics();
});

function renderAdminProducts(products) {
    if (!adminProducts) return;
    adminProducts.innerHTML = "";

    if (!products.length) {
        adminProducts.innerHTML = '<p class="empty-management">No hay perfumes que coincidan con la búsqueda.</p>';
        return;
    }

    products.forEach(function (perfume) {
        const card = document.createElement("div");
        card.className = "admin-product" + (perfume.premium ? " premium" : "");

        const brand = perfume.marcas?.nombre || "Sin marca";
        const category = perfume.categorias?.nombre || "Sin categoría";

        card.innerHTML = `
            <div class="admin-product-image">
                ${perfume.imagen ? `<img src="${escapeHTML(perfume.imagen)}" alt="${escapeHTML(perfume.nombre)}">` : `<span>ELIXIR</span>`}
            </div>
            <div class="admin-product-info">
                <h3>${escapeHTML(perfume.nombre)}</h3>
                <p><b>Marca:</b> ${escapeHTML(brand)}</p>
                <p><b>Género:</b> ${escapeHTML(perfume.genero)}</p>
                <p><b>Categoría:</b> ${escapeHTML(category)}</p>
                <div class="admin-product-price">${formatPrice(perfume.precio)}</div>
                <div class="admin-product-status">
                    <span class="${perfume.stock ? "status-stock" : "status-no-stock"}">● ${perfume.stock ? "CON STOCK" : "SIN STOCK"}</span>
                    ${perfume.premium ? '<span class="admin-premium-badge">♦ PREMIUM</span>' : ""}
                </div>
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

function editPerfume(id) {
    const perfume = perfumes.find(p => String(p.id) === String(id));
    if (!perfume) return;

    editingPerfumeId = perfume.id;
    document.querySelector("#perfumeFormSection .section-title h2").textContent = "EDITAR PERFUME";

    $("perfumeName").value = perfume.nombre || "";
    $("perfumeGender").value = perfume.genero || "";
    populatePerfumeSelects();
    perfumeBrand.value = perfume.marca_id || "";
    perfumeCategory.value = perfume.categoria_id || "";
    $("perfumePrice").value = perfume.precio ?? "";
    $("perfumeDescription").value = perfume.descripcion || "";
    $("perfumeStock").checked = perfume.stock === true;
    $("perfumePremium").checked = perfume.premium === true;
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
    const term = this.value.toLowerCase().trim();
    const filtered = !term ? perfumes : perfumes.filter(p => {
        const text = [p.nombre, p.genero, p.marcas?.nombre, p.categorias?.nombre].join(" ").toLowerCase();
        return text.includes(term);
    });
    renderAdminProducts(filtered);
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
        salesHistoryBody.innerHTML = '<tr><td colspan="5" class="history-empty">No hay registros para estos filtros.</td></tr>';
    } else {
        filtered.forEach(function (sale) {
            const tr = document.createElement("tr");
            const price = sale.precio ?? sale.perfumes?.precio ?? 0;
            tr.innerHTML = `
                <td>${escapeHTML(formatDate(sale.created_at))}</td>
                <td>${escapeHTML(sale.vendedores?.nombre || "—")}</td>
                <td>${escapeHTML(sale.perfumes?.nombre || "Perfume eliminado")}</td>
                <td>${formatPrice(price)}</td>
                <td><button type="button" class="delete-sale-button" data-sale-id="${escapeHTML(sale.id)}">ELIMINAR</button></td>
            `;
            salesHistoryBody.appendChild(tr);
        });
        salesHistoryBody.querySelectorAll(".delete-sale-button").forEach(btn => {
            btn.addEventListener("click", () => openDeleteSaleModal(btn.dataset.saleId));
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
    loadSellerStats();
    renderSalesHistory();
    updateStatistics();
});

function openDeleteSaleModal(id) {
    pendingSaleDeleteId = id;
    if (deleteSalePassword) deleteSalePassword.value = "";
    if (deleteSaleMessage) deleteSaleMessage.textContent = "";
    deleteSaleModal?.classList.remove("hidden");
    deleteSaleModal?.setAttribute("aria-hidden", "false");
    deleteSalePassword?.focus();
}

function closeDeleteSale() {
    pendingSaleDeleteId = null;
    deleteSaleModal?.classList.add("hidden");
    deleteSaleModal?.setAttribute("aria-hidden", "true");
}

closeDeleteSaleModal?.addEventListener("click", closeDeleteSale);
deleteSaleModal?.querySelector(".admin-modal-backdrop")?.addEventListener("click", closeDeleteSale);

confirmDeleteSale?.addEventListener("click", async function () {
    if (!pendingSaleDeleteId) return;
    const password = deleteSalePassword?.value || "";
    if (!password) {
        if (deleteSaleMessage) deleteSaleMessage.textContent = "Ingresá la contraseña.";
        return;
    }
    confirmDeleteSale.disabled = true;
    if (deleteSaleMessage) deleteSaleMessage.textContent = "Verificando...";
    const result = await supabaseClient.rpc("eliminar_venta_con_password", {
        p_venta_id: pendingSaleDeleteId,
        p_password: password
    });
    confirmDeleteSale.disabled = false;
    if (result.error) {
        console.error(result.error);
        if (deleteSaleMessage) deleteSaleMessage.textContent = "No se pudo eliminar. Revisá la contraseña o la configuración de Supabase.";
        return;
    }
    if (result.data !== true) {
        if (deleteSaleMessage) deleteSaleMessage.textContent = "Contraseña incorrecta.";
        return;
    }
    closeDeleteSale();
    await loadSales();
    loadSellerStats();
    renderSalesHistory();
    updateStatistics();
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && deleteSaleModal && !deleteSaleModal.classList.contains("hidden")) closeDeleteSale();
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
