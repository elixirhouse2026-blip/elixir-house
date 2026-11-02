// ============================================
// ELIXIR HOUSE - CATÁLOGO PREMIUM
// Supabase + WhatsApp + favoritos + filtros
// ============================================

let perfumes = [];
let filteredPerfumes = [];
let vendedores = [];
let pendingWhatsAppRequest = null;
let favorites = new Set(JSON.parse(localStorage.getItem("elixirFavorites") || "[]"));
let recentlyViewed = JSON.parse(localStorage.getItem("elixirRecentlyViewed") || "[]");

const DEFAULT_SELLERS = [
    { nombre: "Francisco", telefono: "543516163220", id: null },
    { nombre: "Joel", telefono: "543513905392", id: null },
    { nombre: "Ramiro", telefono: "5493516566067", id: null }
];

// ============================================
// DATOS DE LA TIENDA (editá estos textos)
// Lo que dejes vacío ("") no se muestra en la web.
// ============================================
const STORE_INFO = {
    horarios: "Lunes a sábado",
    pagos: "",      // Ej: "Efectivo, transferencia y Mercado Pago"
    entregas: ""    // Ej: "Envíos y retiro en persona"
};

const LOW_STOCK_LIMIT = 3;   // desde cuántas unidades se muestra "¡Últimas unidades!"

const SELLER_FALLBACK_MESSAGE = "Hola Elixir House! 👋\n\nQuisiera hacer una consulta.";

const productsGrid = document.getElementById("productsGrid");
const premiumGrid = document.getElementById("premiumGrid");
const searchInput = document.getElementById("searchInput");
const genderFilter = document.getElementById("genderFilter");
const typeFilter = document.getElementById("typeFilter");
const brandFilter = document.getElementById("brandFilter");
const seasonFilter = document.getElementById("seasonFilter");
const minPriceFilter = document.getElementById("minPriceFilter");
const maxPriceFilter = document.getElementById("maxPriceFilter");
const applyPriceFilterButton = document.getElementById("applyPriceFilter");
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
const featuredCarousel = document.getElementById("featuredCarousel");
const featuredDots = document.getElementById("featuredDots");
let featuredIndex = 0;


// Recomendador de regalos: usa solamente productos que ya están en el catálogo.
function findGiftIdeas() {
    const choice = document.getElementById("giftOccasion")?.value || "todos";
    const target = document.getElementById("giftResults");
    if (!target) return;
    const words = { romantico: ["rosa", "ámbar", "ambar", "vainilla", "floral", "dulce"], diario: ["fresco", "cítrico", "citrico", "suave", "diario"], especial: ["premium", "intenso", "oud", "ámbar", "ambar", "oriental"], fresco: ["fresco", "cítrico", "citrico", "marino", "bergamota", "limón", "limon"], dulce: ["dulce", "vainilla", "caramelo", "gourmand", "tonka"] };
    let list = perfumes.filter(p => p.stock !== false);
    if (choice !== "todos") {
        const keys = words[choice] || [];
        const matched = list.filter(p => (choice === "especial" && p.premium) || keys.some(w => [p.nombre, p.descripcion, p.marca, p.categoria, ...(p.acordes || [])].join(" ").toLowerCase().includes(w)));
        if (matched.length) list = matched;
    }
    list = list.slice().sort((a,b) => Number(b.destacado || b.premium) - Number(a.destacado || a.premium)).slice(0, 3);
    target.innerHTML = "";
    if (!list.length) { target.textContent = "No encontramos opciones disponibles por ahora."; return; }
    list.forEach(p => {
        const card = document.createElement("div"); card.className = "gift-result-card";
        const title = document.createElement("strong"); title.textContent = p.nombre || "Fragancia";
        const brand = document.createElement("span"); brand.textContent = p.marca || "Elixir House";
        const price = document.createElement("span"); price.textContent = formatPrice(effectivePrice(p));
        const btn = document.createElement("button"); btn.type = "button"; btn.textContent = "VER PERFUME"; btn.addEventListener("click", () => { document.getElementById("catalogo")?.scrollIntoView({behavior:"smooth"}); if (searchInput) searchInput.value = p.nombre || ""; if (favoritesToggle) favoritesToggle.dataset.active = "false"; filterProducts(); });
        card.append(title, brand, price, btn); target.appendChild(card);
    });
}
document.getElementById("giftFindButton")?.addEventListener("click", findGiftIdeas);

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

function productLink(perfume) {
    return location.href.split("#")[0] + "#perfume-" + encodeURIComponent(perfume.id);
}

function sharePerfume(perfume) {
    const link = productLink(perfume);
    const text = `Elixir House — ${perfume.nombre}\n${formatPrice(effectivePrice(perfume))}\n${perfume.marca || ""}`.trim();
    if (navigator.share) {
        navigator.share({ title: perfume.nombre, text, url: link }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text + "\n" + link).then(() => showCartToast("Link del perfume copiado para compartir."));
    } else {
        alert(text + "\n" + link);
    }
}

function stockStatus(perfume) {
    if (!perfume.stock) return { cls: "unavailable", text: "● SIN STOCK" };
    const qty = perfume.stock_cantidad;
    if (qty !== null && qty !== undefined && qty <= LOW_STOCK_LIMIT) {
        return { cls: "available low", text: qty === 1 ? "● ¡ÚLTIMA UNIDAD!" : `● ¡ÚLTIMAS ${qty} UNIDADES!` };
    }
    return { cls: "available", text: "● DISPONIBLE" };
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

async function fetchPerfumeRows() {
    const base = `
        id, nombre, tipo_producto, genero, precio, descripcion, acordes, imagen, stock, premium, temporadas,
        marca_id, categoria_id, destacado, promocion_activa, descuento_porcentaje, promocion_inicio, promocion_fin,
        marcas (id, nombre),
        categorias (id, nombre, genero)
    `;
    // La columna stock_cantidad es opcional: si todavía no existe en Supabase, se consulta sin ella.
    let result = await supabaseClient.from("perfumes").select(base + ", stock_cantidad").order("id", { ascending: false });
    if (result.error) result = await supabaseClient.from("perfumes").select(base).order("id", { ascending: false });
    return result;
}

async function loadPerfumes() {
    try {
        const result = await fetchPerfumeRows();

        if (result.error) throw result.error;

        perfumes = (result.data || []).map(function (p) {
            const qtyRaw = p.stock_cantidad;
            const qty = (qtyRaw === null || qtyRaw === undefined || qtyRaw === "" || !Number.isFinite(Number(qtyRaw)))
                ? null : Math.max(0, Math.floor(Number(qtyRaw)));
            return {
                id: p.id,
                nombre: p.nombre || "Sin nombre",
                marca: p.marcas ? p.marcas.nombre : "Sin marca",
                marca_id: p.marca_id,
                tipo_producto: p.tipo_producto || "Perfume",
                genero: p.genero || "",
                temporadas: Array.isArray(p.temporadas) ? p.temporadas : [],
                categoria: Array.isArray(p.temporadas) && p.temporadas.length ? p.temporadas.join(", ") : (p.categorias ? p.categorias.nombre : "Sin categoría"),
                categoria_id: p.categoria_id,
                precio: Number(p.precio) || 0,
                descripcion: p.descripcion || "",
                acordes: Array.isArray(p.acordes) ? p.acordes : [],
                imagen: p.imagen || "",
                stock_cantidad: qty,
                stock: p.stock === true && (qty === null || qty > 0),
                premium: p.premium === true,
                destacado: p.destacado === true,
                promocion_activa: p.promocion_activa === true || p.promocion_activa === "true" || p.promocion_activa === 1 || p.promocion_activa === "1",
                descuento_porcentaje: Math.min(90, Math.max(0, Number(p.descuento_porcentaje ?? p.descuento ?? 0) || 0)),
                promocion_inicio: p.promocion_inicio || null,
                promocion_fin: p.promocion_fin || null
            };
        });

        catalogReady = true;
        syncCartWithCatalog();

        buildDynamicFilters();
        // La fila de subcategorías visuales se quitó del HTML; no debe bloquear la carga del catálogo.
        if (typeof renderSubcategories === "function") renderSubcategories();
        filterProducts();
        renderFeaturedCarousel();
        renderStoreInfo();
        openProductFromHash();
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
    const errorText = document.createElement("p");
    errorText.textContent = "No se pudieron cargar los perfumes. Revisá tu conexión e intentá nuevamente.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "retry-button";
    retry.textContent = "REINTENTAR";
    retry.addEventListener("click", function () { renderSkeletons(); loadPerfumes(); });
    errorMessage.append(errorText, retry);
    productsGrid.appendChild(errorMessage);
}

function buildDynamicFilters() {
    const categories = ["Verano", "Invierno", "Otoño", "Primavera"];
    const brands = [...new Set(perfumes.map(p => p.marca).filter(x => x && x !== "Sin marca"))].sort();

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


function applySort(items) {
    const list = [...items];
    const mode = sortFilter?.value || "recent";
    if (mode === "name-asc") list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    if (mode === "name-desc") list.sort((a, b) => b.nombre.localeCompare(a.nombre, "es"));
    if (mode === "price-asc") list.sort((a, b) => a.precio - b.precio);
    if (mode === "price-desc") list.sort((a, b) => b.precio - a.precio);
    // Los productos sin stock quedan siempre al final (el orden previo se mantiene dentro de cada grupo).
    return [...list.filter(p => p.stock), ...list.filter(p => !p.stock)];
}

let catalogCurrentPage = 1;
const CATALOG_PAGE_SIZE = 12;

const filtersToggle = document.getElementById("filtersToggle");
const filtersPanel = document.getElementById("filtersPanel");
const genderPills = document.getElementById("genderPills");
const activeFiltersCount = document.getElementById("activeFiltersCount");

function syncGenderPills() {
    const value = genderFilter?.value || "todos";
    genderPills?.querySelectorAll("button").forEach(function (button) {
        const on = button.dataset.gender === value;
        button.classList.toggle("active", on);
        button.setAttribute("aria-pressed", String(on));
    });
}

function updateFiltersBadge() {
    if (!activeFiltersCount) return;
    let count = 0;
    if ((typeFilter?.value || "todos") !== "todos") count++;
    if ((seasonFilter?.value || "todos") !== "todos") count++;
    if ((brandFilter?.value || "todos") !== "todos") count++;
    if ((minPriceFilter?.value || "").trim() !== "") count++;
    if ((maxPriceFilter?.value || "").trim() !== "") count++;
    activeFiltersCount.textContent = String(count);
    activeFiltersCount.classList.toggle("is-empty", count === 0);
}

genderPills?.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-gender]");
    if (!button || !genderFilter) return;
    genderFilter.value = button.dataset.gender;
    filterProducts();
});

filtersToggle?.addEventListener("click", function () {
    const open = filtersPanel?.classList.toggle("open");
    filtersToggle.setAttribute("aria-expanded", String(!!open));
    filtersToggle.classList.toggle("active", !!open);
});

function filterProducts() {
    catalogCurrentPage = 1;
    syncGenderPills();
    updateFiltersBadge();
    const search = searchInput?.value.toLowerCase().trim() || "";
    const gender = genderFilter?.value || "todos";
    const type = typeFilter?.value || "todos";
    const brand = brandFilter?.value || "todos";
    const minPriceRaw = minPriceFilter?.value.trim() ?? "";
    const maxPriceRaw = maxPriceFilter?.value.trim() ?? "";
    const minPrice = minPriceRaw === "" ? null : Number(minPriceRaw);
    const maxPrice = maxPriceRaw === "" ? null : Number(maxPriceRaw);
    const subcategory = "todos"; // Los botones de subcategorías fueron retirados del catálogo.
    const onlyFavorites = favoritesToggle?.dataset.active === "true";
    const finderAccord = document.getElementById("finderAccord")?.value || "todos";
    const accordKeywords = {
        dulce: ["dulce", "vainilla", "caramelo", "gourmand", "praliné", "praline", "tonka"],
        fresco: ["fresco", "cítrico", "citrico", "acuático", "acuatico", "marino", "bergamota", "limón", "limon", "mandarina"],
        amaderado: ["amaderado", "madera", "cedro", "sándalo", "sandalo", "vetiver", "oud", "pachulí", "pachuli"],
        floral: ["floral", "rosa", "jazmín", "jazmin", "flor", "peonía", "peonia", "neroli"],
        especiado: ["especiado", "especias", "canela", "pimienta", "cardamomo", "clavo"],
        intenso: ["oriental", "ámbar", "ambar", "incienso", "oud", "intenso", "cuero", "tabaco", "resina"]
    };

    filteredPerfumes = perfumes.filter(function (p) {
        const haystack = [p.nombre, p.marca, p.descripcion, p.categoria, p.genero, p.tipo_producto, ...(p.acordes || []), ...(p.temporadas || [])].join(" ").toLowerCase();
        const accordMatch = finderAccord === "todos" || (accordKeywords[finderAccord] || [finderAccord]).some(keyword => haystack.includes(keyword));
        return (
            (!search || haystack.includes(search)) &&
            accordMatch &&
            (type === "todos" || (type === "Otro producto" ? (p.tipo_producto || "Perfume") !== "Perfume" : (p.tipo_producto || "Perfume") === type)) &&
            (gender === "todos" || (p.tipo_producto || "Perfume") !== "Perfume" || p.genero === gender) &&
            (brand === "todos" || p.marca === brand) &&
            (minPrice === null || effectivePrice(p) >= minPrice) &&
            (maxPrice === null || effectivePrice(p) <= maxPrice) &&
            (subcategory === "todos" || (p.temporadas || []).includes(subcategory)) &&
            (!onlyFavorites || isFavorite(p.id))
        );
    });

    filteredPerfumes = applySort(filteredPerfumes);
    renderProducts(filteredPerfumes);
}

function promoIsActive(perfume) {
    // Acepta el booleano de Supabase y también valores serializados como texto.
    const enabled = perfume?.promocion_activa === true ||
        perfume?.promocion_activa === "true" ||
        perfume?.promocion_activa === 1 ||
        perfume?.promocion_activa === "1";
    const discount = Number(perfume?.descuento_porcentaje ?? perfume?.descuento ?? 0);
    if (!enabled || !Number.isFinite(discount) || discount <= 0) return false;

    // Las fechas son opcionales; sin fechas, la promoción está activa inmediatamente.
    const todayDate = new Date();
    const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
    const start = perfume?.promocion_inicio ? String(perfume.promocion_inicio).slice(0, 10) : "";
    const end = perfume?.promocion_fin ? String(perfume.promocion_fin).slice(0, 10) : "";
    if (start && today < start) return false;
    if (end && today > end) return false;
    return true;
}
function effectivePrice(perfume) {
    return promoIsActive(perfume) ? Math.round(Number(perfume.precio) * (1 - Number(perfume.descuento_porcentaje) / 100)) : Number(perfume.precio) || 0;
}
function renderFeaturedCarousel() {
    if (!featuredCarousel) return;
    const featured = perfumes.filter(p => p.destacado === true).slice(0, 12);
    featuredCarousel.innerHTML = "";
    featured.forEach(p => {
        const card = createProductCard(p, true);
        card.classList.add("featured-card");
        featuredCarousel.appendChild(card);
    });
    if (!featured.length) {
        featuredCarousel.innerHTML = '<p class="featured-empty">Próximamente vas a encontrar acá nuestra selección especial.</p>';
    }
    if (featuredDots) {
        featuredDots.innerHTML = "";
        const count = Math.ceil(featured.length / visibleFeaturedCards());
        for (let i=0;i<count;i++) {
            const dot=document.createElement("button"); dot.type="button"; dot.className="carousel-dot"+(i===featuredIndex?" active":""); dot.setAttribute("aria-label",`Ir a la selección ${i+1}`);
            dot.addEventListener("click",()=>{featuredIndex=i; scrollFeatured();}); featuredDots.appendChild(dot);
        }
    }
}
function visibleFeaturedCards() { return 1; }
function scrollFeatured() {
    if (!featuredCarousel) return;
    const card=featuredCarousel.querySelector(".featured-card");
    if (card) featuredCarousel.scrollTo({left: featuredIndex * visibleFeaturedCards() * (card.getBoundingClientRect().width), behavior:"smooth"});
    featuredDots?.querySelectorAll(".carousel-dot").forEach((d,i)=>d.classList.toggle("active",i===featuredIndex));
}
document.getElementById("featuredPrev")?.addEventListener("click",()=>{const count=featuredDots?.children.length||0;featuredIndex=Math.max(0,featuredIndex-1);scrollFeatured();});
document.getElementById("featuredNext")?.addEventListener("click",()=>{const count=featuredDots?.children.length||0;featuredIndex=Math.min(Math.max(0,count-1),featuredIndex+1);scrollFeatured();});
window.addEventListener("resize",()=>{if(featuredCarousel) renderFeaturedCarousel();});

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
    tag.textContent = promoIsActive(perfume) ? `${perfume.descuento_porcentaje}% OFF` : (perfume.premium ? "PREMIUM" : (perfume.destacado ? "DESTACADO" : "ELIXIR HOUSE"));
    if (promoIsActive(perfume)) tag.classList.add("promo-tag");
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


    if (perfume.imagen) {
        const image = document.createElement("img");
        image.src = perfume.imagen;
        image.alt = perfume.nombre;
        image.loading = compact ? "lazy" : "lazy";
        image.decoding = "async";
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
    gender.textContent = (perfume.tipo_producto || "Perfume") === "Perfume" ? perfume.genero : "OTRO PRODUCTO";

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
    if (promoIsActive(perfume)) {
        const priceWrap = document.createElement("span"); priceWrap.className = "price-promo-wrap";
        const oldPrice = document.createElement("del"); oldPrice.className = "old-price"; oldPrice.textContent = formatPrice(perfume.precio);
        price.textContent = formatPrice(effectivePrice(perfume)); price.classList.add("promo-price");
        priceWrap.append(oldPrice, price); bottom.appendChild(priceWrap);
    } else { price.textContent = formatPrice(perfume.precio); bottom.appendChild(price); }

    const button = document.createElement("button");
    button.className = "request-button";
    button.type = "button";
    button.textContent = perfume.stock ? "+ AGREGAR" : "AVISARME";
    if (!perfume.stock) {
        button.classList.add("notify-button");
        button.title = "Te avisamos por WhatsApp cuando vuelva a haber stock";
    }
    button.addEventListener("click", () => perfume.stock ? addToCart(perfume) : notifyRestock(perfume));

    bottom.append(button);

    const stock = document.createElement("div");
    const status = stockStatus(perfume);
    stock.className = "stock " + status.cls;
    stock.textContent = status.text;

    info.append(gender, brand, name, description, bottom, stock);
    article.append(imageContainer, info);
    return article;
}

function renderProducts(products) {
    if (!productsGrid || !premiumGrid) return;
    productsGrid.innerHTML = "";
    premiumGrid.innerHTML = "";
    // Los perfumes comunes se paginan de a 12; los Premium aparecen siempre
    // en su sección independiente, en todas las páginas del catálogo.
    const commonProducts = products.filter(p => !p.premium);
    const premiumProducts = products.filter(p => !!p.premium);
    const totalPages = Math.max(1, Math.ceil(commonProducts.length / CATALOG_PAGE_SIZE));
    catalogCurrentPage = Math.min(catalogCurrentPage, totalPages);
    const start = (catalogCurrentPage - 1) * CATALOG_PAGE_SIZE;
    const pageProducts = commonProducts.slice(start, start + CATALOG_PAGE_SIZE);

    pageProducts.forEach(p => productsGrid.appendChild(createProductCard(p)));
    premiumProducts.forEach(p => premiumGrid.appendChild(createProductCard(p)));
    renderFeaturedCarousel();
    renderCatalogPagination(commonProducts.length, totalPages);
    if (productCount) {
        const shown = commonProducts.length
            ? `${start + 1}–${Math.min(start + CATALOG_PAGE_SIZE, commonProducts.length)} de ${commonProducts.length} productos`
            : "0 productos comunes";
        productCount.textContent = premiumProducts.length
            ? `${shown} · ${premiumProducts.length} Premium`
            : shown;
    }
    if (noResults) noResults.style.display = products.length ? "none" : "block";
}

function renderCatalogPagination(totalItems, totalPages) {
    ["catalogPagination", "catalogPaginationBottom"].forEach(function (id) {
        const nav = document.getElementById(id);
        if (!nav) return;
        nav.innerHTML = "";
        if (totalItems <= CATALOG_PAGE_SIZE) return;
        const previous = document.createElement("button");
        previous.type = "button"; previous.textContent = "‹ Anterior"; previous.disabled = catalogCurrentPage === 1;
        previous.addEventListener("click", () => changeCatalogPage(catalogCurrentPage - 1)); nav.appendChild(previous);
        for (let page = 1; page <= totalPages; page++) {
            const button = document.createElement("button"); button.type = "button"; button.textContent = String(page);
            button.classList.toggle("active", page === catalogCurrentPage); button.setAttribute("aria-label", `Página ${page}`);
            button.addEventListener("click", () => changeCatalogPage(page)); nav.appendChild(button);
        }
        const next = document.createElement("button");
        next.type = "button"; next.textContent = "Siguiente ›"; next.disabled = catalogCurrentPage === totalPages;
        next.addEventListener("click", () => changeCatalogPage(catalogCurrentPage + 1)); nav.appendChild(next);
        const label = document.createElement("span"); label.className = "page-label"; label.textContent = `Página ${catalogCurrentPage} de ${totalPages}`; nav.appendChild(label);
    });
}

function changeCatalogPage(page) {
    const totalPages = Math.max(1, Math.ceil(filteredPerfumes.length / CATALOG_PAGE_SIZE));
    catalogCurrentPage = Math.max(1, Math.min(page, totalPages));
    renderProducts(filteredPerfumes);
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const isPerfume = (perfume.tipo_producto || "Perfume") === "Perfume";
    let message = "Hola Elixir House! 👋\n\nQuiero consultar por este " + (isPerfume ? "perfume" : "producto") + ":\n\n✨ " + perfume.nombre;
    if (perfume.marca && perfume.marca !== "Sin marca") message += "\n🏷️ Marca: " + perfume.marca;
    if (isPerfume && perfume.genero) message += "\n👤 " + perfume.genero;
    if (perfume.categoria && perfume.categoria !== "Sin categoría") message += "\n🌿 Categoría: " + perfume.categoria;
    message += "\n💰 Precio: " + formatPrice(effectivePrice(perfume));
    if (promoIsActive(perfume)) message += `\n🏷️ Promoción: ${perfume.descuento_porcentaje}% OFF (antes ${formatPrice(perfume.precio)})`;
    message += "\n\n¿Me pueden confirmar disponibilidad?";
    return message;
}

function buildRestockMessage(perfume) {
    let message = "Hola Elixir House! 👋\n\nMe interesa este producto que figura sin stock:\n\n✨ " + perfume.nombre;
    if (perfume.marca && perfume.marca !== "Sin marca") message += "\n🏷️ Marca: " + perfume.marca;
    message += "\n\n¿Me pueden avisar cuando vuelva a estar disponible?";
    return message;
}

function notifyRestock(perfume) {
    openSellerModal(perfume, false, null, { restock: true });
}

async function openSellerModal(perfume, countSale, order = null, options = {}) {
    if (!sellerModal || !sellerOptions) return;
    if (!vendedores.length) await loadVendedores();

    const titleEl = document.getElementById("sellerModalTitle");
    const textEl = document.getElementById("sellerModalText");
    if (!openSellerModal.defaults) openSellerModal.defaults = { title: titleEl?.textContent || "", text: textEl?.textContent || "" };
    if (titleEl) titleEl.textContent = options.restock ? "¿Con quién querés hablar?" : openSellerModal.defaults.title;
    if (textEl) textEl.textContent = options.restock ? "Elegí un vendedor y te avisamos cuando vuelva a haber stock." : openSellerModal.defaults.text;

    pendingWhatsAppRequest = { perfume: perfume || null, countSale: countSale === true, order: order || null, restock: options.restock === true };
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
            const order = request?.order || null;
            const selectedPerfume = request?.perfume || null;

            // Aviso de stock: es solo una consulta, no se registra como solicitud de compra.
            if (request?.restock && selectedPerfume) {
                const restockMessage = buildRestockMessage(selectedPerfume);
                closeSellerChooser();
                window.location.href = "https://wa.me/" + String(seller.telefono).replace(/\D/g, "") + "?text=" + encodeURIComponent(restockMessage);
                return;
            }

            const message = order
                ? buildOrderMessage(order)
                : (selectedPerfume ? buildPerfumeMessage(selectedPerfume) : SELLER_FALLBACK_MESSAGE);
            button.disabled = true;
            button.querySelector(".seller-option-name").textContent = "Registrando solicitud…";

            // Guardar la solicitud antes de abrir WhatsApp. No es una venta todavía.
            // Un pedido de carrito guarda una solicitud por unidad, así cada una se confirma por separado.
            let rows;
            if (order) {
                rows = [];
                order.lines.forEach(function (line) {
                    for (let i = 0; i < line.qty; i++) {
                        rows.push({
                            vendedor_id: seller.id,
                            perfume_id: line.perfume.id,
                            producto_nombre: line.perfume.nombre,
                            precio_solicitado: line.unit,
                            estado: "pendiente"
                        });
                    }
                });
            } else {
                rows = [{
                    vendedor_id: seller.id,
                    perfume_id: selectedPerfume?.id || null,
                    producto_nombre: selectedPerfume?.nombre || "Consulta general",
                    precio_solicitado: selectedPerfume ? effectivePrice(selectedPerfume) : null,
                    estado: "pendiente"
                }];
            }

            const requestResult = await supabaseClient.from("solicitudes_compra").insert(rows).select("id");

            if (requestResult.error || !requestResult.data?.length) {
                console.error("No se pudo guardar la solicitud:", requestResult.error);
                button.disabled = false;
                button.querySelector(".seller-option-name").textContent = seller.nombre || "Vendedor";
                alert("No pudimos registrar la solicitud en el sistema. No se abrirá WhatsApp para evitar que la compra quede sin registro. Probá nuevamente o avisale al administrador.");
                return;
            }

            const requestCode = requestResult.data[0]?.id ? String(requestResult.data[0].id).slice(0, 8).toUpperCase() : "registrada";
            const registeredLine = (order && requestResult.data.length > 1)
                ? "📋 Pedido registrado en Elixir House: " + requestCode + " (" + requestResult.data.length + " productos)"
                : "📋 Solicitud registrada en Elixir House: " + requestCode;
            const trackedMessage = message + "\n\n" + registeredLine + "\n(La solicitud no significa que la compra esté confirmada.)";
            if (order) clearCart();
            closeSellerChooser();
            window.location.href = "https://wa.me/" + String(seller.telefono).replace(/\D/g, "") + "?text=" + encodeURIComponent(trackedMessage);
        });
        sellerOptions.appendChild(button);
    });

    sellerModal.classList.remove("hidden");
    sellerModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function syncBodyLock() {
    const anyOpen = [sellerModal, productModal].some(m => m && !m.classList.contains("hidden")) || isCartOpen();
    document.body.classList.toggle("modal-open", anyOpen);
}

function closeSellerChooser() {
    if (!sellerModal) return;
    sellerModal.classList.add("hidden");
    sellerModal.setAttribute("aria-hidden", "true");
    pendingWhatsAppRequest = null;
    syncBodyLock();
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
            <span class="product-modal-gender">${escapeHTML((perfume.tipo_producto || "Perfume") === "Perfume" ? perfume.genero : "OTRO PRODUCTO")}</span>
            <div class="product-modal-brand">${escapeHTML(perfume.marca)}</div>
            <h2>${escapeHTML(perfume.nombre)}</h2>
            <p class="product-modal-meta">${escapeHTML(perfume.categoria)}</p>
            <p class="product-modal-description">${escapeHTML(perfume.descripcion || "Sin descripción disponible.")}</p>
            ${(perfume.acordes && perfume.acordes.length) ? `<div class="product-modal-accords"><strong>Acordes</strong><div>${perfume.acordes.map(acorde => `<span>${escapeHTML(acorde)}</span>`).join("")}</div></div>` : ""}
            <div class="product-modal-price">${promoIsActive(perfume) ? `<del>${formatPrice(perfume.precio)}</del> <strong>${formatPrice(effectivePrice(perfume))}</strong> <span class="modal-promo-badge">${perfume.descuento_porcentaje}% OFF</span>` : formatPrice(perfume.precio)}</div>
            <div class="product-modal-stock ${stockStatus(perfume).cls}">${stockStatus(perfume).text}</div>
            <button type="button" class="product-modal-request${perfume.stock ? "" : " notify"}">
                ${perfume.stock ? "AGREGAR AL CARRITO" : "AVISARME CUANDO HAYA STOCK"}
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
        if (perfume.stock) addToCart(perfume);
        else notifyRestock(perfume);
    });

    try {
        const hash = "#perfume-" + encodeURIComponent(perfume.id);
        if (location.hash !== hash) history.replaceState(null, "", hash);
    } catch (error) { /* sin historial disponible */ }

    productModal.classList.remove("hidden");
    productModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeProductModalChooser() {
    if (!productModal) return;
    productModal.classList.add("hidden");
    productModal.setAttribute("aria-hidden", "true");
    try {
        if (/^#perfume-/.test(location.hash)) history.replaceState(null, "", location.href.split("#")[0]);
    } catch (error) { /* sin historial disponible */ }
    syncBodyLock();
}

// Abre el perfume indicado en el link (…#perfume-12) cuando el catálogo ya cargó.
function openProductFromHash() {
    const match = /^#perfume-(.+)$/.exec(location.hash || "");
    if (!match) return;
    let wanted = match[1];
    try { wanted = decodeURIComponent(wanted); } catch (error) { /* se usa tal cual */ }
    const perfume = perfumes.find(p => String(p.id) === wanted);
    if (perfume) openProductModal(perfume);
}

window.addEventListener("hashchange", function () {
    if (/^#perfume-/.test(location.hash)) openProductFromHash();
    else if (productModal && !productModal.classList.contains("hidden")) closeProductModalChooser();
});

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

function closeOnEscape(event) {
    if (event.key !== "Escape") return;
    if (sellerModal && !sellerModal.classList.contains("hidden")) closeSellerChooser();
    else if (productModal && !productModal.classList.contains("hidden")) closeProductModalChooser();
    else if (isCartOpen()) closeCart();
}

closeProductModal?.addEventListener("click", closeProductModalChooser);
productModal?.querySelector(".product-modal-backdrop")?.addEventListener("click", closeProductModalChooser);
closeSellerModal?.addEventListener("click", closeSellerChooser);
sellerModal?.querySelector(".seller-modal-backdrop")?.addEventListener("click", closeSellerChooser);
document.addEventListener("keydown", closeOnEscape);

footerWhatsappButton?.addEventListener("click", () => openSellerModal(null, false));
footerWhatsappButtonBottom?.addEventListener("click", () => openSellerModal(null, false));

document.getElementById("mobileWhatsappButton")?.addEventListener("click", () => openSellerModal(null, false));
document.getElementById("floatingWhatsapp")?.addEventListener("click", () => openSellerModal(null, false));
document.getElementById("mobileFavoritesButton")?.addEventListener("click", function () {
    if (favoritesToggle) { favoritesToggle.dataset.active = "true"; favoritesToggle.classList.add("active"); }
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    filterProducts();
});

searchInput?.addEventListener("input", filterProducts);
typeFilter?.addEventListener("change", filterProducts);
genderFilter?.addEventListener("change", function () {
    subcategoryButtons?.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
    subcategoryButtons?.querySelector('[data-subcategory="todos"]')?.classList.add("active");
    filterProducts();
});
brandFilter?.addEventListener("change", filterProducts);
seasonFilter?.addEventListener("change", function () {
    subcategoryButtons?.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
    subcategoryButtons?.querySelector('[data-subcategory="todos"]')?.classList.add("active");
    filterProducts();
});
[minPriceFilter, maxPriceFilter].forEach(el => {
    el?.addEventListener("input", filterProducts);
    el?.addEventListener("keydown", event => {
        if (event.key === "Enter") { event.preventDefault(); filterProducts(); }
    });
});
applyPriceFilterButton?.addEventListener("click", filterProducts);
document.getElementById("clearCatalogFilters")?.addEventListener("click", function () {
    if (searchInput) searchInput.value = "";
    if (genderFilter) genderFilter.value = "todos";
    if (typeFilter) typeFilter.value = "todos";
    if (brandFilter) brandFilter.value = "todos";
    if (seasonFilter) seasonFilter.value = "todos";
    if (minPriceFilter) minPriceFilter.value = "";
    if (maxPriceFilter) maxPriceFilter.value = "";
    if (sortFilter) sortFilter.value = "recent";
    if (favoritesToggle) { favoritesToggle.dataset.active = "false"; favoritesToggle.classList.remove("active"); }
    subcategoryButtons?.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
    subcategoryButtons?.querySelector('[data-subcategory="todos"]')?.classList.add("active");
    filterProducts();
});
sortFilter?.addEventListener("change", filterProducts);

favoritesToggle?.addEventListener("click", function () {
    const active = favoritesToggle.dataset.active === "true";
    favoritesToggle.dataset.active = String(!active);
    favoritesToggle.classList.toggle("active", !active);
    filterProducts();
});

mainCategories.forEach(category => category.addEventListener("click", function () {
    if (genderFilter) genderFilter.value = category.dataset.gender;
    if (typeFilter) typeFilter.value = "Perfume";
    subcategoryButtons?.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
    subcategoryButtons?.querySelector('[data-subcategory="todos"]')?.classList.add("active");
    filterProducts();
}));

genderNav.forEach(link => link.addEventListener("click", function () {
    if (genderFilter) genderFilter.value = link.dataset.gender;
    subcategoryButtons?.querySelectorAll(".subcategory-button").forEach(b => b.classList.remove("active"));
    subcategoryButtons?.querySelector('[data-subcategory="todos"]')?.classList.add("active");
    filterProducts();
}));

if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => nav.classList.toggle("active"));
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => nav.classList.remove("active")));
}


// ============================================
// CARRITO DE COMPRAS
// ============================================
// El carrito guarda solo { id, qty } en el navegador. Nombre, stock y precio se leen
// siempre del catálogo actual, así nunca se muestra un precio vencido.

const CART_KEY = "elixirCart";
const CART_CUSTOMER_KEY = "elixirCartCustomer";
const MAX_CART_QTY = 10;     // unidades máximas por producto
const MAX_CART_UNITS = 30;   // unidades máximas por pedido

const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartBody = document.getElementById("cartBody");
const cartFooter = document.getElementById("cartFooter");
const cartToast = document.getElementById("cartToast");
const cartNameInput = document.getElementById("cartName");
const cartNoteInput = document.getElementById("cartNote");
const cartCheckoutButton = document.getElementById("cartCheckout");

let catalogReady = false;
let cart = loadCartFromStorage();
let cartLastFocus = null;
let cartToastTimer = null;

function loadCartFromStorage() {
    try {
        const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        if (!Array.isArray(raw)) return [];
        const seen = new Set();
        const clean = [];
        raw.forEach(function (item) {
            const id = String(item?.id ?? "");
            const qty = Math.floor(Number(item?.qty));
            if (!id || seen.has(id) || !(qty > 0)) return;
            seen.add(id);
            clean.push({ id: id, qty: Math.min(qty, MAX_CART_QTY) });
        });
        return clean;
    } catch (error) {
        return [];
    }
}

function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (error) { /* sin almacenamiento */ }
    renderCart();
}

function cartUnits() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
}

function isCartOpen() {
    return !!cartDrawer && cartDrawer.classList.contains("open");
}

function getCartLines() {
    return cart.map(function (item) {
        const perfume = perfumes.find(p => String(p.id) === item.id);
        if (!perfume) return null;
        return {
            id: item.id,
            perfume: perfume,
            qty: item.qty,
            unit: effectivePrice(perfume),
            list: Number(perfume.precio) || 0,
            available: perfume.stock === true
        };
    }).filter(Boolean);
}

function cartTotals(lines) {
    const buyable = lines.filter(l => l.available);
    return {
        units: buyable.reduce((sum, l) => sum + l.qty, 0),
        total: buyable.reduce((sum, l) => sum + l.unit * l.qty, 0),
        savings: buyable.reduce((sum, l) => sum + Math.max(0, l.list - l.unit) * l.qty, 0)
    };
}

function syncCartWithCatalog() {
    if (!catalogReady || !cart.length) { renderCart(); return; }
    const before = cart.length;
    cart = cart.filter(item => perfumes.some(p => String(p.id) === item.id));
    if (cart.length !== before) showCartToast("Algunos productos ya no están en el catálogo y se quitaron de tu carrito.");
    let adjusted = false;
    cart.forEach(function (item) {
        const p = perfumes.find(x => String(x.id) === item.id);
        if (!p || !p.stock) return;
        const limit = cartLimitFor(p);
        if (item.qty > limit) { item.qty = limit; adjusted = true; }
    });
    if (adjusted) showCartToast("Ajustamos algunas cantidades según el stock disponible.");
    saveCart();
}

function cartLimitFor(perfume) {
    const qty = perfume?.stock_cantidad;
    return (qty === null || qty === undefined) ? MAX_CART_QTY : Math.max(0, Math.min(MAX_CART_QTY, qty));
}

function addToCart(perfume, qty = 1) {
    if (!perfume || perfume.stock !== true) return;
    const id = String(perfume.id);
    const existing = cart.find(item => item.id === id);

    if (cartUnits() + qty > MAX_CART_UNITS) {
        showCartToast(`Podés pedir hasta ${MAX_CART_UNITS} productos por vez. Para más, escribinos por WhatsApp.`, true);
        return;
    }
    const limit = cartLimitFor(perfume);
    if (existing && existing.qty + qty > limit) {
        showCartToast(limit < MAX_CART_QTY
            ? `Solo quedan ${limit} unidad${limit === 1 ? "" : "es"} de ${perfume.nombre}.`
            : `Máximo ${MAX_CART_QTY} unidades de ${perfume.nombre} por pedido.`, true);
        return;
    }

    if (existing) existing.qty += qty;
    else cart.push({ id: id, qty: qty });
    saveCart();
    bumpCartBadges();
    showCartToast(`✓ ${perfume.nombre} agregado al carrito`, true);
}

function setCartQty(id, qty) {
    const item = cart.find(i => i.id === String(id));
    if (!item) return;
    if (qty <= 0) return removeFromCart(id);
    const others = cartUnits() - item.qty;
    const perfume = perfumes.find(p => String(p.id) === item.id);
    const limit = perfume ? cartLimitFor(perfume) : MAX_CART_QTY;
    if (qty > limit) {
        showCartToast(limit < MAX_CART_QTY ? `Solo quedan ${limit} unidad${limit === 1 ? "" : "es"} disponibles.` : `Máximo ${MAX_CART_QTY} unidades por producto.`);
        return;
    }
    if (others + qty > MAX_CART_UNITS) { showCartToast(`Podés pedir hasta ${MAX_CART_UNITS} productos por vez.`); return; }
    item.qty = qty;
    saveCart();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== String(id));
    saveCart();
}

function clearCart() {
    cart = [];
    saveCart();
}

function bumpCartBadges() {
    document.querySelectorAll(".header-cart, .floating-cart").forEach(function (el) {
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
    });
}

function showCartToast(message, withAction = false) {
    if (!cartToast) return;
    cartToast.innerHTML = "";
    const text = document.createElement("span");
    text.textContent = message;
    cartToast.appendChild(text);
    if (withAction && !isCartOpen()) {
        const action = document.createElement("button");
        action.type = "button";
        action.textContent = "VER CARRITO";
        action.addEventListener("click", openCart);
        cartToast.appendChild(action);
    }
    cartToast.classList.add("show");
    clearTimeout(cartToastTimer);
    cartToastTimer = setTimeout(() => cartToast.classList.remove("show"), 3600);
}

function renderCart() {
    const units = cartUnits();
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
        el.textContent = units > 99 ? "99+" : String(units);
        el.classList.toggle("is-empty", units === 0);
    });
    document.querySelectorAll(".header-cart, .floating-cart").forEach(el => el.classList.toggle("has-items", units > 0));

    if (!cartBody || !cartFooter) return;

    // Todavía no cargó el catálogo y hay productos guardados.
    if (!catalogReady && cart.length) {
        cartBody.innerHTML = '<div class="cart-empty"><p>Cargando tu carrito…</p></div>';
        cartFooter.hidden = true;
        return;
    }

    const lines = getCartLines();
    if (!lines.length) {
        cartBody.innerHTML = `
            <div class="cart-empty">
                <span class="cart-empty-icon">✦</span>
                <h3>Tu carrito está vacío</h3>
                <p>Agregá tus fragancias favoritas y pedilas todas juntas por WhatsApp.</p>
                <button type="button" class="cart-empty-button" data-action="browse">VER CATÁLOGO</button>
            </div>`;
        cartFooter.hidden = true;
        return;
    }

    cartBody.innerHTML = lines.map(function (line) {
        const p = line.perfume;
        const promo = promoIsActive(p);
        const image = p.imagen
            ? `<img src="${escapeHTML(p.imagen)}" alt="${escapeHTML(p.nombre)}" loading="lazy">`
            : `<span>ELIXIR</span>`;
        const brand = p.marca && p.marca !== "Sin marca" ? p.marca : "Elixir House";
        const priceHTML = promo
            ? `<del>${formatPrice(line.list)}</del> <strong>${formatPrice(line.unit)}</strong> <em>${escapeHTML(p.descuento_porcentaje)}% OFF</em>`
            : `<strong>${formatPrice(line.unit)}</strong>`;
        const controls = line.available
            ? `<div class="cart-qty" role="group" aria-label="Cantidad de ${escapeHTML(p.nombre)}">
                    <button type="button" data-action="dec" data-id="${escapeHTML(line.id)}" aria-label="Quitar una unidad">−</button>
                    <span aria-live="polite">${line.qty}</span>
                    <button type="button" data-action="inc" data-id="${escapeHTML(line.id)}" aria-label="Agregar una unidad">+</button>
               </div>`
            : `<p class="cart-item-warning">Sin stock por ahora. No se incluirá en el pedido.</p>`;
        return `
            <article class="cart-item${line.available ? "" : " is-unavailable"}">
                <div class="cart-item-image">${image}</div>
                <div class="cart-item-info">
                    <span class="cart-item-brand">${escapeHTML(brand)}</span>
                    <h3>${escapeHTML(p.nombre)}</h3>
                    <div class="cart-item-price">${priceHTML}</div>
                    ${(line.available && p.stock_cantidad !== null && p.stock_cantidad !== undefined && p.stock_cantidad <= LOW_STOCK_LIMIT) ? `<span class="cart-item-low">¡Quedan ${p.stock_cantidad}!</span>` : ""}
                    ${controls}
                </div>
                <div class="cart-item-side">
                    ${line.available ? `<strong class="cart-line-total">${formatPrice(line.unit * line.qty)}</strong>` : ""}
                    <button type="button" class="cart-remove" data-action="remove" data-id="${escapeHTML(line.id)}" aria-label="Quitar ${escapeHTML(p.nombre)} del carrito">Quitar</button>
                </div>
            </article>`;
    }).join("");

    const totals = cartTotals(lines);
    document.getElementById("cartUnits").textContent = String(totals.units);
    document.getElementById("cartTotal").textContent = formatPrice(totals.total);
    const savingsRow = document.getElementById("cartSavingsRow");
    if (savingsRow) {
        savingsRow.hidden = totals.savings <= 0;
        document.getElementById("cartSavings").textContent = "− " + formatPrice(totals.savings);
    }
    cartFooter.hidden = false;
    if (cartCheckoutButton) cartCheckoutButton.disabled = totals.units === 0;
}

function openCart() {
    if (!cartDrawer) return;
    cartLastFocus = document.activeElement;
    cartToast?.classList.remove("show");
    renderCart();
    cartDrawer.classList.add("open");
    cartOverlay?.classList.add("open");
    cartDrawer.setAttribute("aria-hidden", "false");
    syncBodyLock();
    document.getElementById("closeCart")?.focus();
}

function closeCart() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove("open");
    cartOverlay?.classList.remove("open");
    cartDrawer.setAttribute("aria-hidden", "true");
    syncBodyLock();
    if (cartLastFocus && typeof cartLastFocus.focus === "function") cartLastFocus.focus();
}

function buildOrderMessage(order) {
    const items = order.lines.map(function (line, index) {
        const p = line.perfume;
        const brand = p.marca && p.marca !== "Sin marca" ? ` (${p.marca})` : "";
        const promo = promoIsActive(p) ? `  🏷️ ${p.descuento_porcentaje}% OFF` : "";
        return `${index + 1}. ${p.nombre}${brand}\n   ${line.qty} x ${formatPrice(line.unit)} = ${formatPrice(line.unit * line.qty)}${promo}`;
    });
    let message = "Hola Elixir House! 👋\n\nQuiero hacer este pedido:\n\n🛍️ *MI PEDIDO*\n" + items.join("\n");
    message += `\n\n📦 Productos: ${order.units}`;
    if (order.savings > 0) message += `\n🏷️ Ahorro por promociones: ${formatPrice(order.savings)}`;
    message += `\n💰 *TOTAL: ${formatPrice(order.total)}*`;
    if (order.customer.nombre) message += `\n\n👤 Nombre: ${order.customer.nombre}`;
    if (order.customer.nota) message += `\n📝 Comentarios: ${order.customer.nota}`;
    message += "\n\n¿Me pueden confirmar disponibilidad y formas de pago?";
    return message;
}

function checkoutCart() {
    const lines = getCartLines().filter(l => l.available);
    if (!lines.length) return;
    const totals = cartTotals(lines);
    const order = {
        lines: lines,
        units: totals.units,
        total: totals.total,
        savings: totals.savings,
        customer: {
            nombre: (cartNameInput?.value || "").trim(),
            nota: (cartNoteInput?.value || "").trim()
        }
    };
    openSellerModal(null, true, order);
}

function saveCartCustomer() {
    try {
        localStorage.setItem(CART_CUSTOMER_KEY, JSON.stringify({
            nombre: cartNameInput?.value || "",
            nota: cartNoteInput?.value || ""
        }));
    } catch (error) { /* sin almacenamiento */ }
}

(function restoreCartCustomer() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_CUSTOMER_KEY) || "{}");
        if (cartNameInput && saved.nombre) cartNameInput.value = String(saved.nombre).slice(0, 60);
        if (cartNoteInput && saved.nota) cartNoteInput.value = String(saved.nota).slice(0, 300);
        if ((saved.nombre || saved.nota)) document.getElementById("cartCustomer")?.setAttribute("open", "");
    } catch (error) { /* datos inválidos: se ignoran */ }
})();

cartNameInput?.addEventListener("input", saveCartCustomer);
cartNoteInput?.addEventListener("input", saveCartCustomer);

cartBody?.addEventListener("click", function (event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const id = target.dataset.id;
    const current = cart.find(item => item.id === id);
    if (target.dataset.action === "inc" && current) setCartQty(id, current.qty + 1);
    else if (target.dataset.action === "dec" && current) setCartQty(id, current.qty - 1);
    else if (target.dataset.action === "remove") removeFromCart(id);
    else if (target.dataset.action === "browse") {
        closeCart();
        document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    }
});

document.getElementById("headerCartButton")?.addEventListener("click", openCart);
document.getElementById("floatingCart")?.addEventListener("click", openCart);
document.getElementById("closeCart")?.addEventListener("click", closeCart);
cartOverlay?.addEventListener("click", closeCart);
cartCheckoutButton?.addEventListener("click", checkoutCart);
document.getElementById("cartClear")?.addEventListener("click", function () {
    if (cart.length && confirm("¿Querés vaciar el carrito?")) clearCart();
});

// Mantiene el foco dentro del carrito mientras está abierto.
cartDrawer?.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;
    const focusables = [...cartDrawer.querySelectorAll("button:not([disabled]), input, textarea, summary, [tabindex]:not([tabindex='-1'])")]
        .filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

// Si el carrito cambia en otra pestaña, esta se actualiza sola.
window.addEventListener("storage", function (event) {
    if (event.key !== CART_KEY) return;
    cart = loadCartFromStorage();
    renderCart();
});

renderCart();

function renderStoreInfo() {
    const box = document.getElementById("storeInfo");
    if (!box) return;
    const entries = [
        ["HORARIOS", STORE_INFO.horarios],
        ["MEDIOS DE PAGO", STORE_INFO.pagos],
        ["ENTREGAS", STORE_INFO.entregas]
    ].filter(entry => String(entry[1] || "").trim());
    box.innerHTML = "";
    box.hidden = entries.length === 0;
    entries.forEach(function (entry) {
        const card = document.createElement("div");
        card.className = "store-info-card";
        const title = document.createElement("span");
        title.textContent = entry[0];
        const text = document.createElement("p");
        text.textContent = entry[1];
        card.append(title, text);
        box.appendChild(card);
    });
}

function renderSkeletons(count = 8) {
    if (!productsGrid) return;
    productsGrid.innerHTML = Array.from({ length: count }, () =>
        '<article class="product-card skeleton-card" aria-hidden="true"><div class="skeleton-image"></div><div class="skeleton-lines"><span></span><span></span><span></span></div></article>'
    ).join("");
    if (productCount) productCount.textContent = "Cargando catálogo…";
}

renderStoreInfo();
renderSkeletons();
updateFavoritesUI();
loadVendedores();
loadPerfumes().then(() => { renderRecentlyViewed(); findGiftIdeas(); });
