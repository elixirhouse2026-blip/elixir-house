// ============================================
// ELIXIR HOUSE
// CATÁLOGO CON SUPABASE + WHATSAPP
// ============================================


// ============================================
// VARIABLES
// ============================================

let perfumes = [];
let filteredPerfumes = [];


// ============================================
// CONFIGURACIÓN WHATSAPP
// ============================================

const WHATSAPP_NUMBER = "543516163220";


// ============================================
// ELEMENTOS DEL HTML
// ============================================

const productsGrid =
    document.getElementById("productsGrid");

const premiumGrid =
    document.getElementById("premiumGrid");

const searchInput =
    document.getElementById("searchInput");

const genderFilter =
    document.getElementById("genderFilter");

const categoryFilter =
    document.getElementById("categoryFilter");

const brandFilter =
    document.getElementById("brandFilter");

const productCount =
    document.getElementById("productCount");

const noResults =
    document.getElementById("noResults");

const menuBtn =
    document.getElementById("menuBtn");

const nav =
    document.getElementById("nav");

const subcategoryButtons =
    document.querySelectorAll(".subcategory-button");

const mainCategories =
    document.querySelectorAll(".main-category");

const genderNav =
    document.querySelectorAll(".gender-nav");


// ============================================
// FORMATO DE PRECIO
// ============================================

function formatPrice(price) {

    return new Intl.NumberFormat("es-AR", {

        style: "currency",

        currency: "ARS",

        maximumFractionDigits: 0

    }).format(price);

}


// ============================================
// CARGAR PERFUMES DESDE SUPABASE
// ============================================

async function loadPerfumes() {

    try {

        const result =
            await supabaseClient
                .from("perfumes")
                .select(`
                    id,
                    nombre,
                    genero,
                    precio,
                    descripcion,
                    imagen,
                    stock,
                    premium,
                    marca_id,
                    categoria_id,
                    marcas (
                        id,
                        nombre
                    ),
                    categorias (
                        id,
                        nombre,
                        genero
                    )
                `)
                .order("id", {
                    ascending: false
                });


        if (result.error) {

            console.error(
                "Error cargando perfumes:",
                result.error
            );

            showConnectionError();

            return;

        }


        perfumes =
            (result.data || []).map(function(perfume) {

                return {

                    id: perfume.id,

                    nombre: perfume.nombre || "Sin nombre",

                    marca:
                        perfume.marcas
                            ? perfume.marcas.nombre
                            : "Sin marca",

                    marca_id:
                        perfume.marca_id,

                    genero:
                        perfume.genero || "",

                    categoria:
                        perfume.categorias
                            ? perfume.categorias.nombre
                            : "Sin categoría",

                    categoria_id:
                        perfume.categoria_id,

                    precio:
                        Number(perfume.precio) || 0,

                    descripcion:
                        perfume.descripcion || "",

                    imagen:
                        perfume.imagen || "",

                    stock:
                        perfume.stock === true,

                    premium:
                        perfume.premium === true

                };

            });


        filteredPerfumes =
            perfumes;


        console.log(
            "Perfumes cargados desde Supabase:",
            perfumes
        );


        loadCategories();

        loadBrands();

        renderProducts(perfumes);


    } catch (error) {

        console.error(
            "Error inesperado cargando perfumes:",
            error
        );

        showConnectionError();

    }

}


// ============================================
// MENSAJE DE ERROR DE CONEXIÓN
// ============================================

function showConnectionError() {

    if (!productsGrid) {
        return;
    }

    productsGrid.innerHTML = "";

    if (premiumGrid) {
        premiumGrid.innerHTML = "";
    }

    const errorMessage =
        document.createElement("div");

    errorMessage.className =
        "catalog-error";

    errorMessage.textContent =
        "No se pudieron cargar los perfumes. Intentá nuevamente.";

    productsGrid.appendChild(
        errorMessage
    );

}


// ============================================
// CARGAR CATEGORÍAS
// ============================================

function loadCategories() {

    if (!categoryFilter) {
        return;
    }

    categoryFilter.innerHTML = "";


    const defaultOption =
        document.createElement("option");

    defaultOption.value =
        "todos";

    defaultOption.textContent =
        "Todas las categorías";

    categoryFilter.appendChild(
        defaultOption
    );


    const categories = [];


    perfumes.forEach(function(perfume) {

        if (
            perfume.categoria &&
            perfume.categoria !== "Sin categoría" &&
            !categories.includes(perfume.categoria)
        ) {

            categories.push(
                perfume.categoria
            );

        }

    });


    categories.sort();


    categories.forEach(function(category) {

        const option =
            document.createElement("option");

        option.value =
            category;

        option.textContent =
            category;

        categoryFilter.appendChild(
            option
        );

    });

}


// ============================================
// CARGAR MARCAS
// ============================================

function loadBrands() {

    if (!brandFilter) {
        return;
    }

    brandFilter.innerHTML = "";


    const defaultOption =
        document.createElement("option");

    defaultOption.value =
        "todos";

    defaultOption.textContent =
        "Todas las marcas";

    brandFilter.appendChild(
        defaultOption
    );


    const brands = [];


    perfumes.forEach(function(perfume) {

        if (
            perfume.marca &&
            perfume.marca !== "Sin marca" &&
            !brands.includes(perfume.marca)
        ) {

            brands.push(
                perfume.marca
            );

        }

    });


    brands.sort();


    brands.forEach(function(brand) {

        const option =
            document.createElement("option");

        option.value =
            brand;

        option.textContent =
            brand;

        brandFilter.appendChild(
            option
        );

    });

}


// ============================================
// CREAR TARJETA DEL PERFUME
// ============================================

function createProductCard(perfume) {

    const article =
        document.createElement("article");

    article.className =
        "product-card";


    if (perfume.premium === true) {

        article.classList.add(
            "premium-card"
        );

    }


    // ========================================
    // IMAGEN
    // ========================================

    const imageContainer =
        document.createElement("div");

    imageContainer.className =
        "product-image";


    // ========================================
    // ETIQUETA
    // ========================================

    const tag =
        document.createElement("span");

    tag.className =
        "product-tag";


    if (perfume.premium === true) {

        tag.classList.add("ruby");

        tag.textContent =
            "PREMIUM";

    } else {

        tag.textContent =
            "ELIXIR HOUSE";

    }


    imageContainer.appendChild(tag);


    // ========================================
    // FOTO
    // ========================================

    if (
        perfume.imagen &&
        perfume.imagen.trim() !== ""
    ) {

        const image =
            document.createElement("img");

        image.src =
            perfume.imagen;

        image.alt =
            perfume.nombre;

        image.loading =
            "lazy";


        image.onerror =
            function() {

                image.style.display =
                    "none";

                const placeholder =
                    document.createElement("div");

                placeholder.className =
                    "product-placeholder";

                placeholder.textContent =
                    "ELIXIR";

                imageContainer.appendChild(
                    placeholder
                );

            };


        imageContainer.appendChild(
            image
        );

    } else {

        const placeholder =
            document.createElement("div");

        placeholder.className =
            "product-placeholder";

        placeholder.textContent =
            "ELIXIR";

        imageContainer.appendChild(
            placeholder
        );

    }


    // ========================================
    // INFORMACIÓN
    // ========================================

    const productInfo =
        document.createElement("div");

    productInfo.className =
        "product-info";


    // ========================================
    // GÉNERO
    // ========================================

    const gender =
        document.createElement("div");

    gender.className =
        "product-gender";

    gender.textContent =
        perfume.genero;


    // ========================================
    // MARCA
    // ========================================

    const brand =
        document.createElement("div");

    brand.className =
        "product-brand";

    brand.textContent =
        perfume.marca;


    // ========================================
    // NOMBRE
    // ========================================

    const name =
        document.createElement("h3");

    name.textContent =
        perfume.nombre;


    // ========================================
    // DESCRIPCIÓN
    // ========================================

    const description =
        document.createElement("p");

    description.className =
        "product-description";

    description.textContent =
        perfume.descripcion;


    // ========================================
    // PARTE INFERIOR
    // ========================================

    const bottom =
        document.createElement("div");

    bottom.className =
        "product-bottom";


    // ========================================
    // PRECIO
    // ========================================

    const price =
        document.createElement("span");

    price.className =
        "product-price";

    price.textContent =
        formatPrice(
            perfume.precio
        );


    // ========================================
    // BOTÓN WHATSAPP
    // ========================================

    const button =
        document.createElement("button");

    button.className =
        "request-button";

    button.type =
        "button";


    if (perfume.stock === true) {

        button.textContent =
            "SOLICITAR";


        button.addEventListener(
            "click",
            function() {

                requestPerfume(
                    perfume
                );

            }
        );

    } else {

        button.textContent =
            "SIN STOCK";

        button.disabled =
            true;

    }


    bottom.appendChild(price);

    bottom.appendChild(button);


    // ========================================
    // STOCK
    // ========================================

    const stock =
        document.createElement("div");


    if (perfume.stock === true) {

        stock.className =
            "stock available";

        stock.textContent =
            "● DISPONIBLE";

    } else {

        stock.className =
            "stock unavailable";

        stock.textContent =
            "● SIN STOCK";

    }


    // ========================================
    // ARMAR TARJETA
    // ========================================

    productInfo.appendChild(
        gender
    );

    productInfo.appendChild(
        brand
    );

    productInfo.appendChild(
        name
    );

    productInfo.appendChild(
        description
    );

    productInfo.appendChild(
        bottom
    );

    productInfo.appendChild(
        stock
    );


    article.appendChild(
        imageContainer
    );

    article.appendChild(
        productInfo
    );


    return article;

}


// ============================================
// MOSTRAR PRODUCTOS
// ============================================

function renderProducts(products) {

    if (!productsGrid || !premiumGrid) {
        return;
    }

    productsGrid.innerHTML = "";

    premiumGrid.innerHTML = "";


    let normalProducts = [];

    let premiumProducts = [];


    products.forEach(function(perfume) {

        if (perfume.premium === true) {

            premiumProducts.push(
                perfume
            );

        } else {

            normalProducts.push(
                perfume
            );

        }

    });


    // ========================================
    // PRODUCTOS NORMALES
    // ========================================

    normalProducts.forEach(
        function(perfume) {

            const card =
                createProductCard(
                    perfume
                );

            productsGrid.appendChild(
                card
            );

        }
    );


    // ========================================
    // PRODUCTOS PREMIUM
    // ========================================

    premiumProducts.forEach(
        function(perfume) {

            const card =
                createProductCard(
                    perfume
                );

            premiumGrid.appendChild(
                card
            );

        }
    );


    // ========================================
    // CONTADOR
    // ========================================

    if (productCount) {

        if (products.length === 1) {

            productCount.textContent =
                "1 perfume";

        } else {

            productCount.textContent =
                products.length +
                " perfumes";

        }

    }


    // ========================================
    // SIN RESULTADOS
    // ========================================

    if (noResults) {

        if (products.length === 0) {

            noResults.style.display =
                "block";

        } else {

            noResults.style.display =
                "none";

        }

    }

}


// ============================================
// OBTENER SUBCATEGORÍA ACTIVA
// ============================================

function getActiveSubcategory() {

    const activeButton =
        document.querySelector(
            ".subcategory-button.active"
        );


    if (!activeButton) {

        return "todos";

    }


    return activeButton.dataset.subcategory;

}


// ============================================
// FILTRAR PRODUCTOS
// ============================================

function filterProducts() {

    const search =
        searchInput
            ? searchInput.value
                .toLowerCase()
                .trim()
            : "";


    const gender =
        genderFilter
            ? genderFilter.value
            : "todos";


    const category =
        categoryFilter
            ? categoryFilter.value
            : "todos";


    const brand =
        brandFilter
            ? brandFilter.value
            : "todos";


    const subcategory =
        getActiveSubcategory();


    filteredPerfumes =
        perfumes.filter(
            function(perfume) {


                // =================================
                // BUSCADOR
                // =================================

                const perfumeName =
                    (perfume.nombre || "")
                        .toLowerCase();


                const perfumeBrand =
                    (perfume.marca || "")
                        .toLowerCase();


                const perfumeDescription =
                    (perfume.descripcion || "")
                        .toLowerCase();


                const matchesSearch =

                    perfumeName.includes(
                        search
                    )

                    ||

                    perfumeBrand.includes(
                        search
                    )

                    ||

                    perfumeDescription.includes(
                        search
                    );


                // =================================
                // GÉNERO
                // =================================

                const matchesGender =

                    gender === "todos"

                    ||

                    perfume.genero ===
                        gender;


                // =================================
                // CATEGORÍA
                // =================================

                const matchesCategory =

                    category === "todos"

                    ||

                    perfume.categoria ===
                        category;


                // =================================
                // MARCA
                // =================================

                const matchesBrand =

                    brand === "todos"

                    ||

                    perfume.marca ===
                        brand;


                // =================================
                // SUBCATEGORÍA
                // =================================

                const matchesSubcategory =

                    subcategory === "todos"

                    ||

                    perfume.categoria ===
                        subcategory;


                return (

                    matchesSearch &&

                    matchesGender &&

                    matchesCategory &&

                    matchesBrand &&

                    matchesSubcategory

                );

            }
        );


    renderProducts(
        filteredPerfumes
    );

}


// ============================================
// SOLICITAR PERFUME POR WHATSAPP
// ============================================

function requestPerfume(perfume) {

    const perfumeName =
        perfume.nombre || "este perfume";

    const perfumeBrand =
        perfume.marca &&
        perfume.marca !== "Sin marca"
            ? perfume.marca
            : "";

    const perfumePrice =
        perfume.precio
            ? formatPrice(perfume.precio)
            : "";


    let message =
        "Hola Elixir House! 👋\n\n" +
        "Quiero solicitar este perfume:\n\n" +
        "✨ " + perfumeName;


    if (perfumeBrand) {

        message +=
            "\n🏷️ Marca: " +
            perfumeBrand;

    }


    if (perfumePrice) {

        message +=
            "\n💰 Precio: " +
            perfumePrice;

    }


    message +=
        "\n\n¿Me pueden confirmar disponibilidad?";


    const whatsappUrl =
        "https://wa.me/" +
        WHATSAPP_NUMBER +
        "?text=" +
        encodeURIComponent(message);


    window.open(
        whatsappUrl,
        "_blank"
    );

}


// ============================================
// ACTIVAR SUBCATEGORÍA
// ============================================

subcategoryButtons.forEach(
    function(button) {

        button.addEventListener(
            "click",
            function() {


                // QUITAR ACTIVE

                subcategoryButtons.forEach(
                    function(item) {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                // ACTIVAR

                button.classList.add(
                    "active"
                );


                // GÉNERO

                const buttonGender =
                    button.dataset.gender;


                if (buttonGender) {

                    if (genderFilter) {

                        genderFilter.value =
                            buttonGender;

                    }

                } else {

                    if (genderFilter) {

                        genderFilter.value =
                            "todos";

                    }

                }


                // RESET CATEGORÍA

                if (categoryFilter) {

                    categoryFilter.value =
                        "todos";

                }


                // FILTRAR

                filterProducts();

            }
        );

    }
);


// ============================================
// CATEGORÍAS HOMBRE / MUJER
// ============================================

mainCategories.forEach(
    function(category) {

        category.addEventListener(
            "click",
            function() {


                const gender =
                    category.dataset.gender;


                if (genderFilter) {

                    genderFilter.value =
                        gender;

                }


                if (categoryFilter) {

                    categoryFilter.value =
                        "todos";

                }


                // ACTIVAR TODOS

                subcategoryButtons.forEach(
                    function(button) {

                        button.classList.remove(
                            "active"
                        );

                    }
                );


                const allButton =
                    document.querySelector(
                        '.subcategory-button[data-subcategory="todos"]'
                    );


                if (allButton) {

                    allButton.classList.add(
                        "active"
                    );

                }


                filterProducts();

            }
        );

    }
);


// ============================================
// NAVEGACIÓN HOMBRE / MUJER
// ============================================

genderNav.forEach(
    function(link) {

        link.addEventListener(
            "click",
            function() {


                const gender =
                    link.dataset.gender;


                if (genderFilter) {

                    genderFilter.value =
                        gender;

                }


                if (categoryFilter) {

                    categoryFilter.value =
                        "todos";

                }


                subcategoryButtons.forEach(
                    function(button) {

                        button.classList.remove(
                            "active"
                        );

                    }
                );


                const allButton =
                    document.querySelector(
                        '.subcategory-button[data-subcategory="todos"]'
                    );


                if (allButton) {

                    allButton.classList.add(
                        "active"
                    );

                }


                filterProducts();

            }
        );

    }
);


// ============================================
// EVENTOS DE FILTROS
// ============================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        filterProducts
    );

}


if (genderFilter) {

    genderFilter.addEventListener(
        "change",
        function() {


            subcategoryButtons.forEach(
                function(button) {

                    button.classList.remove(
                        "active"
                    );

                }
            );


            const allButton =
                document.querySelector(
                    '.subcategory-button[data-subcategory="todos"]'
                );


            if (allButton) {

                allButton.classList.add(
                    "active"
                );

            }


            filterProducts();

        }
    );

}


if (categoryFilter) {

    categoryFilter.addEventListener(
        "change",
        filterProducts
    );

}


if (brandFilter) {

    brandFilter.addEventListener(
        "change",
        filterProducts
    );

}


// ============================================
// MENÚ CELULAR
// ============================================

if (menuBtn && nav) {

    menuBtn.addEventListener(
        "click",
        function() {

            nav.classList.toggle(
                "active"
            );

        }
    );

}


const navLinks =
    document.querySelectorAll(
        ".nav a"
    );


navLinks.forEach(
    function(link) {

        link.addEventListener(
            "click",
            function() {

                if (nav) {

                    nav.classList.remove(
                        "active"
                    );

                }

            }
        );

    }
);


// ============================================
// INICIAR PÁGINA
// ============================================

async function init() {

    console.log(
        "Elixir House iniciando..."
    );


    await loadPerfumes();


    console.log(
        "Elixir House listo."
    );

}


init();