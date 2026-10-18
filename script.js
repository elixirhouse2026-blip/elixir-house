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
                id, nombre, tipo_producto, genero, precio, descripcion, acordes, imagen, stock, premium, temporadas,
                marca_id, categoria_id, destacado, promocion_activa, descuento_porcentaje, promocion_inicio, promocion_fin,
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
                tipo_producto: p.tipo_producto || "Perfume",
                genero: p.genero || "",
                temporadas: Array.isArray(p.temporadas) ? p.temporadas : [],
                categoria: Array.isArray(p.temporadas) && p.temporadas.length ? p.temporadas.join(", ") : (p.categorias ? p.categorias.nombre : "Sin categoría"),
                categoria_id: p.categoria_id,
                precio: Number(p.precio) || 0,
                descripcion: p.descripcion || "",
                acordes: Array.isArray(p.acordes) ? p.acordes : [],
                imagen: p.imagen || "",
                stock: p.stock === true,
                premium: p.premium === true,
                destacado: p.destacado === true,
                promocion_activa: p.promocion_activa === true || p.promocion_activa === "true" || p.promocion_activa === 1 || p.promocion_activa === "1",
                descuento_porcentaje: Math.min(90, Math.max(0, Number(p.descuento_porcentaje ?? p.descuento ?? 0) || 0)),
                promocion_inicio: p.promocion_inicio || null,
                promocion_fin: p.promocion_fin || null
            };
        });

        buildDynamicFilters();
        renderSubcategories();
        filterProducts();
        renderFeaturedCarousel();
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
    return list;
}

let catalogCurrentPage = 1;
const CATALOG_PAGE_SIZE = 12;

function filterProducts() {
    catalogCurrentPage = 1;
    const search = searchInput?.value.toLowerCase().trim() || "";
    const gender = genderFilter?.value || "todos";
    const type = typeFilter?.value || "todos";
    const brand = brandFilter?.value || "todos";
    const minPriceRaw = minPriceFilter?.value.trim() ?? "";
    const maxPriceRaw = maxPriceFilter?.value.trim() ?? "";
    const minPrice = minPriceRaw === "" ? null : Number(minPriceRaw);
    const maxPrice = maxPriceRaw === "" ? null : Number(maxPriceRaw);
    const subcategory = getActiveSubcategory();
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
    button.textContent = perfume.stock ? "SOLICITAR" : "SIN STOCK";
    button.disabled = !perfume.stock;
    if (perfume.stock) button.addEventListener("click", () => requestPerfume(perfume));

    bottom.append(button);

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
    const nav = document.getElementById("catalogPagination");
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
            const selectedPerfume = request?.perfume || null;
            const message = selectedPerfume ? buildPerfumeMessage(selectedPerfume) : SELLER_FALLBACK_MESSAGE;
            button.disabled = true;
            button.querySelector(".seller-option-name").textContent = "Registrando solicitud…";

            // Guardar la solicitud antes de abrir WhatsApp. No es una venta todavía.
            const currentPrice = selectedPerfume ? effectivePrice(selectedPerfume) : null;
            const requestResult = await supabaseClient.from("solicitudes_compra").insert({
                vendedor_id: seller.id,
                perfume_id: selectedPerfume?.id || null,
                producto_nombre: selectedPerfume?.nombre || "Consulta general",
                precio_solicitado: currentPrice,
                estado: "pendiente"
            }).select("id").single();

            if (requestResult.error) {
                console.error("No se pudo guardar la solicitud:", requestResult.error);
                button.disabled = false;
                button.querySelector(".seller-option-name").textContent = seller.nombre || "Vendedor";
                alert("No pudimos registrar la solicitud en el sistema. No se abrirá WhatsApp para evitar que la compra quede sin registro. Probá nuevamente o avisale al administrador.");
                return;
            }

            const requestCode = requestResult.data?.id ? String(requestResult.data.id).slice(0, 8).toUpperCase() : "registrada";
            const trackedMessage = message + "\n\n📋 Solicitud registrada en Elixir House: " + requestCode + "\n(La solicitud no significa que la compra esté confirmada.)";
            closeSellerChooser();
            window.location.href = "https://wa.me/" + String(seller.telefono).replace(/\D/g, "") + "?text=" + encodeURIComponent(trackedMessage);
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
            <span class="product-modal-gender">${escapeHTML((perfume.tipo_producto || "Perfume") === "Perfume" ? perfume.genero : "OTRO PRODUCTO")}</span>
            <div class="product-modal-brand">${escapeHTML(perfume.marca)}</div>
            <h2>${escapeHTML(perfume.nombre)}</h2>
            <p class="product-modal-meta">${escapeHTML(perfume.categoria)}</p>
            <p class="product-modal-description">${escapeHTML(perfume.descripcion || "Sin descripción disponible.")}</p>
            ${(perfume.acordes && perfume.acordes.length) ? `<div class="product-modal-accords"><strong>Acordes</strong><div>${perfume.acordes.map(acorde => `<span>${escapeHTML(acorde)}</span>`).join("")}</div></div>` : ""}
            <div class="product-modal-price">${promoIsActive(perfume) ? `<del>${formatPrice(perfume.precio)}</del> <strong>${formatPrice(effectivePrice(perfume))}</strong> <span class="modal-promo-badge">${perfume.descuento_porcentaje}% OFF</span>` : formatPrice(perfume.precio)}</div>
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

function closeOnEscape(event) {
    if (event.key !== "Escape") return;
    if (sellerModal && !sellerModal.classList.contains("hidden")) closeSellerChooser();
    else if (productModal && !productModal.classList.contains("hidden")) closeProductModalChooser();
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

updateFavoritesUI();
loadVendedores();
loadPerfumes().then(renderRecentlyViewed);
