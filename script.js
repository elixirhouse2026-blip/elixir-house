// ============================================
// ELIXIR HOUSE - CATÁLOGO PREMIUM
// Supabase + WhatsApp + favoritos + filtros
// ============================================

let perfumes = [];
let filteredPerfumes = [];
let vendedores = [];
let pendingWhatsAppRequest = null;
let favorites = new Set(JSON.parse(localStorage.getItem("elixirFavorites") || "[]"));
let compareItems = new Set(JSON.parse(localStorage.getItem("elixirCompare") || "[]"));
let recentlyViewed = JSON.parse(localStorage.getItem("elixirRecentlyViewed") || "[]");

const DEFAULT_SELLERS = [
    { nombre: "Francisco", telefono: "543516163220", id: null },
    { nombre: "Joel", telefono: "543513905392", id: null },
    { nombre: "Ramiro", telefono: "5493516566067", id: null }
];

const SELLER_FALLBACK_MESSAGE = "Hola Elixir House! 👋\n\nQuisiera hacer una consulta.";

const productsGrid = document.getElementById("productsGrid");
const premiumGrid = document.getElementById("premiumGrid");
const searchInput = document.getElementById("searchInput");
const genderFilter = document.getElementById("genderFilter");
const categoryFilter = document.getElementById("categoryFilter");
const brandFilter = document.getElementById("brandFilter");
const sortFilter = document.getElementById("sortFilter");
const productCount = document.getElementById("productCount");
const noResults = document.getElementById("noResults");
const menuBtn = document.getElementById("menuBtn");
const nav = document.getElementById("nav");
const subcategoryButtons = document.getElementById("subcategoryButtons");
const mainCategories = document.querySelectorAll(".main-category");
const genderNav = document.querySelectorAll(".gender-nav");

const sellerModal = document.getElementById("sellerModal");
const sellerOptions = document.getElementById("sellerOptions");
const closeSellerModal = document.getElementById("closeSellerModal");
const footerWhatsappButton = document.getElementById("footerWhatsappButton");
const footerWhatsappButtonBottom = document.getElementById("footerWhatsappButtonBottom");

const productModal = document.getElementById("productModal");
const productModalContent = document.getElementById("productModalContent");
const closeProductModal = document.getElementById("closeProductModal");

const favoritesToggle = document.getElementById("favoritesToggle");
const favoritesCount = document.getElementById("favoritesCount");
const recentGrid = document.getElementById("recentGrid");
const recentSection = document.getElementById("recentSection");
const compareBar = document.getElementById("compareBar");
const compareCount = document.getElementById("compareCount");
const compareModal = document.getElementById("compareModal");
const compareContent = document.getElementById("compareContent");

function formatPrice(price) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    }).format(Number(price) || 0);
}

function saveFavorites() {
    localStorage.setItem("elixirFavorites", JSON.stringify([...favorites]));
    updateFavoritesUI();
}

function saveCompare() {
    localStorage.setItem("elixirCompare", JSON.stringify([...compareItems]));
    updateCompareUI();
}

function updateCompareUI() {
    if (compareCount) compareCount.textContent = compareItems.size;
    compareBar?.classList.toggle("hidden", compareItems.size < 2);
}

function toggleCompare(id) {
    const key = String(id);
    if (compareItems.has(key)) {
        compareItems.delete(key);
    } else {
        if (compareItems.size >= 3) { alert("Podés comparar hasta 3 perfumes."); return; }
        compareItems.add(key);
    }
    saveCompare();
    renderProducts(filteredPerfumes);
}

function rememberViewed(perfume) {
    if (!perfume?.id) return;
    recentlyViewed = [String(perfume.id), ...recentlyViewed.map(String).filter(id => String(id) !== String(perfume.id))].slice(0, 6);
    localStorage.setItem("elixirRecentlyViewed", JSON.stringify(recentlyViewed));
    renderRecentlyViewed();
}

function renderRecentlyViewed() {
    if (!recentGrid || !recentSection) return;
    const items = recentlyViewed.map(id => perfumes.find(p => String(p.id) === String(id))).filter(Boolean);
    recentGrid.innerHTML = "";
    recentSection.hidden = !items.length;
    items.forEach(perfume => recentGrid.appendChild(createProductCard(perfume, true)));
}

function sharePerfume(perfume) {
    const text = `Elixir House — ${perfume.nombre}\n${formatPrice(perfume.precio)}\n${perfume.marca || ""}`;
    if (navigator.share) {
        navigator.share({ title: perfume.nombre, text }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => alert("Datos del perfume copiados para compartir."));
    } else {
        alert(text);
    }
}

function openCompareModal() {
    if (!compareModal || !compareContent) return;
    const items = [...compareItems].map(id => perfumes.find(p => String(p.id) === String(id))).filter(Boolean);
    if (items.length < 2) return;
    compareContent.innerHTML = items.map(p => `
        <div class="compare-column">
            <div class="compare-image">${p.imagen ? `<img src="${escapeHTML(p.imagen)}" alt="${escapeHTML(p.nombre)}">` : "ELIXIR"}</div>
            <h3>${escapeHTML(p.nombre)}</h3>
            <p>${escapeHTML(p.marca)}</p>
            <strong>${formatPrice(p.precio)}</strong>
            <span>${escapeHTML(p.genero)} · ${escapeHTML(p.categoria)}</span>
            <span class="${p.stock ? "compare-stock-ok" : "compare-stock-no"}">${p.stock ? "● DISPONIBLE" : "● SIN STOCK"}</span>
        </div>`).join("");
    compareModal.classList.remove("hidden");
    compareModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function updateFavoritesUI() {
    if (favoritesCount) favoritesCount.textContent = favorites.size;
    const mobileCount = document.getElementById("mobileFavoritesCount");
    if (mobileCount) mobileCount.textContent = favorites.size;
    if (favoritesToggle) favoritesToggle.classList.toggle("active", favoritesToggle.dataset.active === "true");
}

function isFavorite(id) {
    return favorites.has(String(id));
}

function toggleFavorite(id) {
    const key = String(id);
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    saveFavorites();
    renderProducts(filteredPerfumes);
}

async function loadPerfumes() {
    try {
        const result = await supabaseClient
            .from("perfumes")
            .select(`
                id, nombre, genero, precio, descripcion, imagen, stock, premium,
                marca_id, categoria_id,
                marcas (id, nombre),
                categorias (id, nombre, genero)
            `)
            .order("id", { ascending: false });

        if (result.error) throw result.error;

        perfumes = (result.data || []).map(function (p) {
            return {
                id: p.id,
                nombre: p.nombre || "Sin nombre",
                marca: p.marcas ? p.marcas.nombre : "Sin marca",
                marca_id: p.marca_id,
                genero: p.genero || "",
                categoria: p.categorias ? p.categorias.nombre : "Sin categoría",
                categoria_id: p.categoria_id,
                precio: Number(p.precio) || 0,
                descripcion: p.descripcion || "",
                imagen: p.imagen || "",
                stock: p.stock === true,
                premium: p.premium === true
            };
        });

        buildDynamicFilters();
        renderSubcategories();
        filterProducts();
    } catch (error) {
        console.error("Error cargando perfumes:", error);
        showConnectionError();
    }
}

function showConnectionError() {
    if (!productsGrid) return;
    productsGrid.innerHTML = "";
    if (premiumGrid) premiumGrid.innerHTML = "";
    const errorMessage = document.createElement("div");
    errorMessage.className = "catalog-error";
    errorMessage.textContent = "No se pudieron cargar los perfumes. Intentá nuevamente.";
    productsGrid.appendChild(errorMessage);
}

function buildDynamicFilters() {
    const categories = [...new Set(perfumes.map(p => p.categoria).filter(x => x && x !== "Sin categoría"))].sort();
    const brands = [...new Set(perfumes.map(p => p.marca).filter(x => x && x !== "Sin marca"))].sort();

    if (categoryFilter) {
        const current = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="todos">Todas las categorías</option>';
        categories.forEach(name => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            categoryFilter.appendChild(option);
        });
        if (categories.includes(current)) categoryFilter.value = current;
    }

    if (brandFilter) {
        const current = brandFilter.value;
        brandFilter.innerHTML = '<option value="todos">Todas las marcas</option>';
        brands.forEach(name => {
            const option = document.createElement("option");
            option.value = name;
            option.textContent = name;
            brandFilter.appendChild(option);
        });
        if (brands.includes(current)) brandFilter.value = current;
    }
}

function renderSubcategories() {
    if (!subcategoryButtons) return;
    const current = subcategoryButtons.querySelector(".subcategory-button.active")?.dataset.subcategory || "todos";
    const categories = [...new Map(
        perfumes
            .filter(p => p.categoria && p.categoria !== "Sin categoría")
            .map(p => [p.categoria, p.genero])
    )].sort((a, b) => a[0].localeCompare(b[0], "es"));

    subcategoryButtons.innerHTML = "";
    const all = document.createElement("button");
    all.type = "button";
    all.className = "subcategory-button" + (current === "todos" ? " active" : "");
    all.dataset.subcategory = "todos";
    all.textContent = "TODOS";
    subcategoryButtons.appendChild(all);

    categories.forEach(([name, gender]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "subcategory-button" + (current === name ? " active" : "");
        button.dataset.subcategory = name;
        button.dataset.gender = gender || "";
        button.textContent = name.toUpperCase();
        subcategoryButtons.appendChild(button);
    });

    subcategoryButtons.querySelectorAll(".subcategory-button").forEach(button => {
        button.addEventListener("click", function () {
            subcategoryButtons.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
            button.classList.add("active");
            if (genderFilter) genderFilter.value = button.dataset.gender || "todos";
            if (categoryFilter) categoryFilter.value = "todos";
            filterProducts();
        });
    });
}

function getActiveSubcategory() {
    return subcategoryButtons?.querySelector(".subcategory-button.active")?.dataset.subcategory || "todos";
}

function applySort(items) {
    const list = [...items];
    const mode = sortFilter?.value || "recent";
    if (mode === "name-asc") list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    if (mode === "name-desc") list.sort((a, b) => b.nombre.localeCompare(a.nombre, "es"));
    if (mode === "price-asc") list.sort((a, b) => a.precio - b.precio);
    if (mode === "price-desc") list.sort((a, b) => b.precio - a.precio);
    return list;
}

function filterProducts() {
    const search = searchInput?.value.toLowerCase().trim() || "";
    const gender = genderFilter?.value || "todos";
    const category = categoryFilter?.value || "todos";
    const brand = brandFilter?.value || "todos";
    const subcategory = getActiveSubcategory();
    const onlyFavorites = favoritesToggle?.dataset.active === "true";

    filteredPerfumes = perfumes.filter(function (p) {
        const haystack = [p.nombre, p.marca, p.descripcion, p.categoria, p.genero].join(" ").toLowerCase();
        return (
            (!search || haystack.includes(search)) &&
            (gender === "todos" || p.genero === gender) &&
            (category === "todos" || p.categoria === category) &&
            (brand === "todos" || p.marca === brand) &&
            (subcategory === "todos" || p.categoria === subcategory) &&
            (!onlyFavorites || isFavorite(p.id))
        );
    });

    filteredPerfumes = applySort(filteredPerfumes);
    renderProducts(filteredPerfumes);
}

function createProductCard(perfume, compact = false) {
    const article = document.createElement("article");
    article.className = "product-card" + (perfume.premium ? " premium-card" : "");
    article.setAttribute("tabindex", "0");

    article.addEventListener("click", function (event) {
        if (event.target.closest("button, a, input, select, textarea")) return;
        openProductModal(perfume);
    });

    article.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProductModal(perfume);
        }
    });

    const imageContainer = document.createElement("div");
    imageContainer.className = "product-image";

    const tag = document.createElement("span");
    tag.className = "product-tag" + (perfume.premium ? " ruby" : "");
    tag.textContent = perfume.premium ? "PREMIUM" : "ELIXIR HOUSE";
    imageContainer.appendChild(tag);

    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "favorite-button" + (isFavorite(perfume.id) ? " active" : "");
    favorite.innerHTML = isFavorite(perfume.id) ? "♥" : "♡";
    favorite.title = isFavorite(perfume.id) ? "Quitar de favoritos" : "Agregar a favoritos";
    favorite.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleFavorite(perfume.id);
    });
    imageContainer.appendChild(favorite);

    const compare = document.createElement("button");
    compare.type = "button";
    compare.className = "compare-button" + (compareItems.has(String(perfume.id)) ? " active" : "");
    compare.textContent = compareItems.has(String(perfume.id)) ? "✓" : "⇄";
    compare.title = "Comparar perfume";
    compare.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleCompare(perfume.id);
    });
    imageContainer.appendChild(compare);

    if (perfume.imagen) {
        const image = document.createElement("img");
        image.src = perfume.imagen;
        image.alt = perfume.nombre;
        image.loading = "lazy";
        image.onerror = function () {
            image.style.display = "none";
            const placeholder = document.createElement("div");
            placeholder.className = "product-placeholder";
            placeholder.textContent = "ELIXIR";
            imageContainer.appendChild(placeholder);
        };
        imageContainer.appendChild(image);
    } else {
        const placeholder = document.createElement("div");
        placeholder.className = "product-placeholder";
        placeholder.textContent = "ELIXIR";
        imageContainer.appendChild(placeholder);
    }

    const info = document.createElement("div");
    info.className = "product-info";

    const gender = document.createElement("div");
    gender.className = "product-gender";
    gender.textContent = perfume.genero;

    const brand = document.createElement("div");
    brand.className = "product-brand";
    brand.textContent = perfume.marca;

    const name = document.createElement("h3");
    name.textContent = perfume.nombre;

    const description = document.createElement("p");
    description.className = "product-description";
    description.textContent = perfume.descripcion;

    const bottom = document.createElement("div");
    bottom.className = "product-bottom";

    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = formatPrice(perfume.precio);

    const button = document.createElement("button");
    button.className = "request-button";
    button.type = "button";
    button.textContent = perfume.stock ? "SOLICITAR" : "SIN STOCK";
    button.disabled = !perfume.stock;
    if (perfume.stock) button.addEventListener("click", () => requestPerfume(perfume));

    bottom.append(price, button);

    const stock = document.createElement("div");
    stock.className = perfume.stock ? "stock available" : "stock unavailable";
    stock.textContent = perfume.stock ? "● DISPONIBLE" : "● SIN STOCK";

    info.append(gender, brand, name, description, bottom, stock);
    article.append(imageContainer, info);
    return article;
}

function renderProducts(products) {
    if (!productsGrid || !premiumGrid) return;
    productsGrid.innerHTML = "";
    premiumGrid.innerHTML = "";

    products.filter(p => !p.premium).forEach(p => productsGrid.appendChild(createProductCard(p)));
    products.filter(p => p.premium).forEach(p => premiumGrid.appendChild(createProductCard(p)));

    if (productCount) productCount.textContent = products.length === 1 ? "1 perfume" : `${products.length} perfumes`;
    if (noResults) noResults.style.display = products.length ? "none" : "block";
}

async function loadVendedores() {
    try {
        const result = await supabaseClient.from("vendedores").select("id,nombre,telefono").eq("activo", true).order("nombre");
        if (result.error || !result.data?.length) throw result.error || new Error("Sin vendedores");
        vendedores = result.data;
    } catch (error) {
        console.warn("Usando vendedores de respaldo.", error);
        vendedores = DEFAULT_SELLERS;
    }
    return vendedores;
}

function buildPerfumeMessage(perfume) {
    if (!perfume) return SELLER_FALLBACK_MESSAGE;
    let message = "Hola Elixir House! 👋\n\nQuiero solicitar este perfume:\n\n✨ " + perfume.nombre;
    if (perfume.marca && perfume.marca !== "Sin marca") message += "\n🏷️ Marca: " + perfume.marca;
    if (perfume.genero) message += "\n👤 " + perfume.genero;
    if (perfume.categoria && perfume.categoria !== "Sin categoría") message += "\n🌿 Categoría: " + perfume.categoria;
    message += "\n💰 Precio: " + formatPrice(perfume.precio);
    message += "\n\n¿Me pueden confirmar disponibilidad?";
    return message;
}

async function registerSellerSale(perfume, seller) {
    if (!seller?.id || !perfume?.id) return;
    const result = await supabaseClient.from("ventas").insert({
        vendedor_id: seller.id,
        perfume_id: perfume.id,
        precio: perfume.precio
    });
    if (result.error) console.error("No se pudo registrar el registro:", result.error);
}

async function openSellerModal(perfume, countSale) {
    if (!sellerModal || !sellerOptions) return;
    if (!vendedores.length) await loadVendedores();

    pendingWhatsAppRequest = { perfume: perfume || null, countSale: countSale === true };
    sellerOptions.innerHTML = "";

    vendedores.forEach(function (seller) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "seller-option";
        button.innerHTML = `
            <span class="seller-option-name">${escapeHTML(seller.nombre || "Vendedor")}</span>
            <span class="seller-option-number">+${formatDisplayPhone(seller.telefono)}</span>
        `;
        button.addEventListener("click", async function () {
            const request = pendingWhatsAppRequest;
            if (request?.countSale && request.perfume) await registerSellerSale(request.perfume, seller);
            const message = request?.perfume ? buildPerfumeMessage(request.perfume) : SELLER_FALLBACK_MESSAGE;
            closeSellerChooser();
            window.location.href = "https://wa.me/" + String(seller.telefono).replace(/\D/g, "") + "?text=" + encodeURIComponent(message);
        });
        sellerOptions.appendChild(button);
    });

    sellerModal.classList.remove("hidden");
    sellerModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeSellerChooser() {
    if (!sellerModal) return;
    sellerModal.classList.add("hidden");
    sellerModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    pendingWhatsAppRequest = null;
}

function openProductModal(perfume) {
    if (!productModal || !productModalContent || !perfume) return;
    rememberViewed(perfume);

    const image = perfume.imagen
        ? `<img src="${escapeHTML(perfume.imagen)}" alt="${escapeHTML(perfume.nombre)}">`
        : `<div class="product-modal-placeholder">ELIXIR</div>`;

    productModalContent.innerHTML = `
        <div class="product-modal-image-wrap">
            ${image}
            ${perfume.premium ? '<span class="product-modal-premium">PREMIUM</span>' : ''}
        </div>
        <div class="product-modal-info">
            <div class="modal-action-row">
                <button type="button" class="modal-favorite ${isFavorite(perfume.id) ? "active" : ""}">
                    ${isFavorite(perfume.id) ? "♥" : "♡"} FAVORITO
                </button>
                <button type="button" class="modal-share">↗ COMPARTIR</button>
            </div>
            <span class="product-modal-gender">${escapeHTML(perfume.genero)}</span>
            <div class="product-modal-brand">${escapeHTML(perfume.marca)}</div>
            <h2>${escapeHTML(perfume.nombre)}</h2>
            <p class="product-modal-meta">${escapeHTML(perfume.categoria)}</p>
            <p class="product-modal-description">${escapeHTML(perfume.descripcion || "Sin descripción disponible.")}</p>
            <div class="product-modal-price">${formatPrice(perfume.precio)}</div>
            <div class="product-modal-stock ${perfume.stock ? "available" : "unavailable"}">${perfume.stock ? "● DISPONIBLE" : "● SIN STOCK"}</div>
            <button type="button" class="product-modal-request" ${perfume.stock ? "" : "disabled"}>
                ${perfume.stock ? "SOLICITAR POR WHATSAPP" : "SIN STOCK"}
            </button>
        </div>
    `;

    const share = productModalContent.querySelector(".modal-share");
    share?.addEventListener("click", function () { sharePerfume(perfume); });

    const fav = productModalContent.querySelector(".modal-favorite");
    fav?.addEventListener("click", function () {
        toggleFavorite(perfume.id);
        openProductModal(perfume);
    });

    const request = productModalContent.querySelector(".product-modal-request");
    request?.addEventListener("click", function () {
        closeProductModalChooser();
        requestPerfume(perfume);
    });

    productModal.classList.remove("hidden");
    productModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeProductModalChooser() {
    if (!productModal) return;
    productModal.classList.add("hidden");
    productModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function requestPerfume(perfume) {
    openSellerModal(perfume, true);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatDisplayPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    let local = digits;
    if (digits.startsWith("549") && digits.length === 13) local = digits.slice(3);
    else if (digits.startsWith("54") && digits.length === 12) local = digits.slice(2);
    if (local.length === 10) return "54 " + local.slice(0, 3) + " " + local.slice(3, 6) + "-" + local.slice(6);
    return digits;
}

function closeCompareModal() {
    if (!compareModal) return;
    compareModal.classList.add("hidden");
    compareModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function closeOnEscape(event) {
    if (event.key !== "Escape") return;
    if (sellerModal && !sellerModal.classList.contains("hidden")) closeSellerChooser();
    else if (productModal && !productModal.classList.contains("hidden")) closeProductModalChooser();
    else if (compareModal && !compareModal.classList.contains("hidden")) closeCompareModal();
}

closeProductModal?.addEventListener("click", closeProductModalChooser);
productModal?.querySelector(".product-modal-backdrop")?.addEventListener("click", closeProductModalChooser);
closeSellerModal?.addEventListener("click", closeSellerChooser);
sellerModal?.querySelector(".seller-modal-backdrop")?.addEventListener("click", closeSellerChooser);
document.addEventListener("keydown", closeOnEscape);

footerWhatsappButton?.addEventListener("click", () => openSellerModal(null, false));
footerWhatsappButtonBottom?.addEventListener("click", () => openSellerModal(null, false));

document.getElementById("openCompare")?.addEventListener("click", openCompareModal);
document.getElementById("closeCompare")?.addEventListener("click", closeCompareModal);
document.querySelector(".compare-backdrop")?.addEventListener("click", closeCompareModal);
document.getElementById("clearCompare")?.addEventListener("click", function () { compareItems.clear(); saveCompare(); renderProducts(filteredPerfumes); });
document.getElementById("mobileWhatsappButton")?.addEventListener("click", () => openSellerModal(null, false));
document.getElementById("mobileFavoritesButton")?.addEventListener("click", function () {
    if (favoritesToggle) { favoritesToggle.dataset.active = "true"; favoritesToggle.classList.add("active"); }
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    filterProducts();
});

searchInput?.addEventListener("input", filterProducts);
genderFilter?.addEventListener("change", function () {
    subcategoryButtons?.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
    subcategoryButtons?.querySelector('[data-subcategory="todos"]')?.classList.add("active");
    filterProducts();
});
categoryFilter?.addEventListener("change", filterProducts);
brandFilter?.addEventListener("change", filterProducts);
sortFilter?.addEventListener("change", filterProducts);

favoritesToggle?.addEventListener("click", function () {
    const active = favoritesToggle.dataset.active === "true";
    favoritesToggle.dataset.active = String(!active);
    favoritesToggle.classList.toggle("active", !active);
    filterProducts();
});

mainCategories.forEach(category => category.addEventListener("click", function () {
    if (genderFilter) genderFilter.value = category.dataset.gender;
    if (categoryFilter) categoryFilter.value = "todos";
    subcategoryButtons?.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
    subcategoryButtons?.querySelector('[data-subcategory="todos"]')?.classList.add("active");
    filterProducts();
}));

genderNav.forEach(link => link.addEventListener("click", function () {
    if (genderFilter) genderFilter.value = link.dataset.gender;
    if (categoryFilter) categoryFilter.value = "todos";
    subcategoryButtons?.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
    subcategoryButtons?.querySelector('[data-subcategory="todos"]')?.classList.add("active");
    filterProducts();
}));

if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => nav.classList.toggle("active"));
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => nav.classList.remove("active")));
}

updateFavoritesUI();
updateCompareUI();
loadVendedores();
loadPerfumes().then(renderRecentlyViewed);
