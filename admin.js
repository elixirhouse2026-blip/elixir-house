// ============================================
// ELIXIR HOUSE
// PANEL DE ADMINISTRACIÓN
// ============================================

let perfumes = [];
let editingPerfumeId = null;


// ============================================
// ELEMENTOS DEL DOM
// ============================================

const loginSection =
    document.getElementById("loginSection");

const adminSection =
    document.getElementById("adminSection");

const loginForm =
    document.getElementById("loginForm");

const loginMessage =
    document.getElementById("loginMessage");

const logoutButton =
    document.getElementById("logoutButton");

const showAddPerfume =
    document.getElementById("showAddPerfume");

const perfumeFormSection =
    document.getElementById("perfumeFormSection");

const perfumeForm =
    document.getElementById("perfumeForm");

const cancelForm =
    document.getElementById("cancelForm");

const formMessage =
    document.getElementById("formMessage");

const adminProducts =
    document.getElementById("adminProducts");

const adminSearch =
    document.getElementById("adminSearch");

const totalPerfumes =
    document.getElementById("totalPerfumes");

const totalStock =
    document.getElementById("totalStock");

const totalPremium =
    document.getElementById("totalPremium");

const perfumeBrand =
    document.getElementById("perfumeBrand");

const perfumeCategory =
    document.getElementById("perfumeCategory");

const perfumeGender =
    document.getElementById("perfumeGender");


// ============================================
// IMAGEN
// ============================================

const perfumeImageFile =
    document.getElementById("perfumeImageFile");

const imagePreview =
    document.getElementById("imagePreview");

const imagePreviewContainer =
    document.getElementById(
        "imagePreviewContainer"
    );


// ============================================
// ID DEL ADMINISTRADOR
// ============================================

const ADMIN_ID =
    "c4fc77d6-0bdf-49cb-81e1-0b7769bdf692";


// ============================================
// COMPROBAR SESIÓN
// ============================================

async function checkSession() {

    const result =
        await supabaseClient.auth.getSession();

    if (result.error) {

        console.error(
            "Error comprobando sesión:",
            result.error
        );

        showLogin();

        return;
    }

    const session =
        result.data.session;

    if (!session) {

        showLogin();

        return;
    }

    // Comprobar que sea el administrador
    if (
        session.user.id !== ADMIN_ID
    ) {

        await supabaseClient.auth.signOut();

        showLogin();

        loginMessage.textContent =
            "No tenés permisos de administrador.";

        loginMessage.style.color =
            "#d65a67";

        return;
    }

    showAdmin();
}


// ============================================
// MOSTRAR LOGIN
// ============================================

function showLogin() {

    loginSection.classList.remove(
        "hidden"
    );

    adminSection.classList.add(
        "hidden"
    );
}


// ============================================
// MOSTRAR ADMIN
// ============================================

async function showAdmin() {

    loginSection.classList.add(
        "hidden"
    );

    adminSection.classList.remove(
        "hidden"
    );

    await loadData();
}


// ============================================
// LOGIN
// ============================================

loginForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        loginMessage.textContent =
            "Iniciando sesión...";

        loginMessage.style.color =
            "#d8b94f";

        const email =
            document.getElementById(
                "email"
            ).value.trim();

        const password =
            document.getElementById(
                "password"
            ).value;

        const result =
            await supabaseClient.auth
                .signInWithPassword({

                    email: email,

                    password: password

                });

        if (result.error) {

            console.error(
                "Error de login:",
                result.error
            );

            loginMessage.textContent =
                "Email o contraseña incorrectos.";

            loginMessage.style.color =
                "#d65a67";

            return;
        }

        // Seguridad adicional
        if (
            !result.data.user ||
            result.data.user.id !== ADMIN_ID
        ) {

            await supabaseClient.auth.signOut();

            loginMessage.textContent =
                "No tenés permisos de administrador.";

            loginMessage.style.color =
                "#d65a67";

            return;
        }

        loginMessage.textContent =
            "";

        await showAdmin();
    }
);


// ============================================
// CERRAR SESIÓN
// ============================================

logoutButton.addEventListener(
    "click",
    async function() {

        await supabaseClient.auth.signOut();

        editingPerfumeId =
            null;

        perfumeForm.reset();

        perfumeFormSection.classList.add(
            "hidden"
        );

        clearImagePreview();

        showLogin();
    }
);


// ============================================
// CARGAR TODOS LOS DATOS
// ============================================

async function loadData() {

    await loadPerfumes();

    await loadBrands();

    await loadCategories();
}


// ============================================
// CARGAR PERFUMES
// ============================================

async function loadPerfumes() {

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
            .order(
                "id",
                {
                    ascending: false
                }
            );

    if (result.error) {

        console.error(
            "Error cargando perfumes:",
            result.error
        );

        return;
    }

    perfumes =
        result.data || [];

    updateStatistics();

    renderAdminProducts(
        perfumes
    );
}


// ============================================
// ESTADÍSTICAS
// ============================================

function updateStatistics() {

    totalPerfumes.textContent =
        perfumes.length;

    totalStock.textContent =
        perfumes.filter(
            function(perfume) {

                return perfume.stock === true;

            }
        ).length;

    totalPremium.textContent =
        perfumes.filter(
            function(perfume) {

                return perfume.premium === true;

            }
        ).length;
}


// ============================================
// CARGAR MARCAS
// ============================================

async function loadBrands() {

    const result =
        await supabaseClient
            .from("marcas")
            .select("*")
            .order(
                "nombre",
                {
                    ascending: true
                }
            );

    if (result.error) {

        console.error(
            "Error cargando marcas:",
            result.error
        );

        return;
    }

    perfumeBrand.innerHTML = "";

    const defaultOption =
        document.createElement(
            "option"
        );

    defaultOption.value =
        "";

    defaultOption.textContent =
        "Seleccionar marca";

    perfumeBrand.appendChild(
        defaultOption
    );

    (result.data || []).forEach(
        function(brand) {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                brand.id;

            option.textContent =
                brand.nombre;

            perfumeBrand.appendChild(
                option
            );
        }
    );
}


// ============================================
// CARGAR CATEGORÍAS
// ============================================

async function loadCategories() {

    const result =
        await supabaseClient
            .from("categorias")
            .select("*")
            .order(
                "nombre",
                {
                    ascending: true
                }
            );

    if (result.error) {

        console.error(
            "Error cargando categorías:",
            result.error
        );

        return;
    }

    perfumeCategory.innerHTML = "";

    const defaultOption =
        document.createElement(
            "option"
        );

    defaultOption.value =
        "";

    defaultOption.textContent =
        "Seleccionar categoría";

    perfumeCategory.appendChild(
        defaultOption
    );

    (result.data || []).forEach(
        function(category) {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                category.id;

            option.textContent =
                category.nombre +
                " - " +
                category.genero;

            perfumeCategory.appendChild(
                option
            );
        }
    );
}


// ============================================
// ABRIR FORMULARIO NUEVO PERFUME
// ============================================

showAddPerfume.addEventListener(
    "click",
    function() {

        editingPerfumeId =
            null;

        perfumeForm.reset();

        document.getElementById(
            "perfumeStock"
        ).checked = true;

        document.getElementById(
            "perfumePremium"
        ).checked = false;

        document.querySelector(
            ".section-title h2"
        ).textContent =
            "AGREGAR PERFUME";

        formMessage.textContent =
            "";

        clearImagePreview();

        perfumeFormSection.classList.remove(
            "hidden"
        );

        perfumeFormSection.scrollIntoView({
            behavior: "smooth"
        });
    }
);


// ============================================
// CANCELAR FORMULARIO
// ============================================

cancelForm.addEventListener(
    "click",
    function() {

        editingPerfumeId =
            null;

        perfumeForm.reset();

        perfumeFormSection.classList.add(
            "hidden"
        );

        formMessage.textContent =
            "";

        clearImagePreview();
    }
);


// ============================================
// GUARDAR PERFUME
// ============================================

perfumeForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        formMessage.textContent =
            "Guardando perfume...";

        formMessage.style.color =
            "#d8b94f";


        // ========================================
        // DATOS DEL FORMULARIO
        // ========================================

        const nombre =
            document.getElementById(
                "perfumeName"
            ).value.trim();

        const marcaId =
            perfumeBrand.value || null;

        const genero =
            perfumeGender.value;

        const categoriaId =
            perfumeCategory.value || null;

        const precio =
            Number(
                document.getElementById(
                    "perfumePrice"
                ).value
            );

        const descripcion =
            document.getElementById(
                "perfumeDescription"
            ).value.trim();

        const stock =
            document.getElementById(
                "perfumeStock"
            ).checked;

        const premium =
            document.getElementById(
                "perfumePremium"
            ).checked;


        // ========================================
        // IMAGEN ACTUAL
        // ========================================

        let imagen = null;

        if (editingPerfumeId) {

            const perfumeActual =
                perfumes.find(
                    function(item) {

                        return (
                            item.id ===
                            editingPerfumeId
                        );

                    }
                );

            if (perfumeActual) {

                imagen =
                    perfumeActual.imagen ||
                    null;
            }
        }


        // ========================================
        // NUEVA IMAGEN
        // ========================================

        const imageFile =
            perfumeImageFile.files[0];


        if (imageFile) {

            // Comprobar tipo
            if (
                !imageFile.type.startsWith(
                    "image/"
                )
            ) {

                formMessage.textContent =
                    "El archivo seleccionado no es una imagen.";

                formMessage.style.color =
                    "#ff4d4d";

                return;
            }


            // Máximo 5 MB
            if (
                imageFile.size >
                5 * 1024 * 1024
            ) {

                formMessage.textContent =
                    "La imagen no puede superar los 5 MB.";

                formMessage.style.color =
                    "#ff4d4d";

                return;
            }


            formMessage.textContent =
                "Subiendo imagen...";


            // Obtener extensión
            const extension =
                imageFile.name
                    .split(".")
                    .pop()
                    .toLowerCase();


            // Nombre único
            const nombreArchivo =
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2, 10) +
                "." +
                extension;


            const ruta =
                "perfumes/" +
                nombreArchivo;


            // Subir a Storage
            const uploadResult =
                await supabaseClient
                    .storage
                    .from("perfumes")
                    .upload(
                        ruta,
                        imageFile,
                        {
                            cacheControl:
                                "3600",

                            upsert:
                                false
                        }
                    );


            if (uploadResult.error) {

                console.error(
                    "Error subiendo imagen:",
                    uploadResult.error
                );

                formMessage.textContent =
                    "No se pudo subir la imagen.";

                formMessage.style.color =
                    "#ff4d4d";

                return;
            }


            // Obtener URL pública
            const publicUrlResult =
                supabaseClient
                    .storage
                    .from("perfumes")
                    .getPublicUrl(
                        ruta
                    );


            imagen =
                publicUrlResult
                    .data
                    .publicUrl;
        }


        // ========================================
        // OBJETO DEL PERFUME
        // ========================================

        const perfumeData = {

            nombre:
                nombre,

            marca_id:
                marcaId,

            genero:
                genero,

            categoria_id:
                categoriaId,

            precio:
                precio,

            descripcion:
                descripcion,

            imagen:
                imagen,

            stock:
                stock,

            premium:
                premium
        };


        let result;


        // ========================================
        // ACTUALIZAR
        // ========================================

        if (editingPerfumeId) {

            result =
                await supabaseClient
                    .from("perfumes")
                    .update(
                        perfumeData
                    )
                    .eq(
                        "id",
                        editingPerfumeId
                    );

        }


        // ========================================
        // AGREGAR
        // ========================================

        else {

            result =
                await supabaseClient
                    .from("perfumes")
                    .insert(
                        perfumeData
                    );
        }


        // ========================================
        // ERROR
        // ========================================

        if (result.error) {

            console.error(
                "Error guardando perfume:",
                result.error
            );

            formMessage.textContent =
                "No se pudo guardar el perfume.";

            formMessage.style.color =
                "#d65a67";

            return;
        }


        // ========================================
        // ÉXITO
        // ========================================

        formMessage.textContent =
            editingPerfumeId
                ? "Perfume actualizado correctamente."
                : "Perfume agregado correctamente.";

        formMessage.style.color =
            "#65c77a";


        editingPerfumeId =
            null;


        // Limpiar formulario
        perfumeForm.reset();


        document.getElementById(
            "perfumeStock"
        ).checked = true;


        document.querySelector(
            ".section-title h2"
        ).textContent =
            "AGREGAR PERFUME";


        clearImagePreview();


        // Recargar productos
        await loadPerfumes();

    }
);


// ============================================
// MOSTRAR PRODUCTOS
// ============================================

function renderAdminProducts(
    products
) {

    adminProducts.innerHTML =
        "";


    if (
        !products ||
        products.length === 0
    ) {

        adminProducts.innerHTML = `

            <p style="
                color:#888;
                padding:20px;
            ">
                Todavía no hay perfumes cargados.
            </p>

        `;

        return;
    }


    products.forEach(
        function(perfume) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "admin-product";


            if (
                perfume.premium === true
            ) {

                card.classList.add(
                    "premium"
                );
            }


            const brandName =
                perfume.marcas
                    ? perfume.marcas.nombre
                    : "Sin marca";


            const categoryName =
                perfume.categorias
                    ? perfume.categorias.nombre
                    : "Sin categoría";


            const price =
                new Intl.NumberFormat(
                    "es-AR",
                    {
                        style:
                            "currency",

                        currency:
                            "ARS",

                        maximumFractionDigits:
                            0
                    }
                ).format(
                    Number(
                        perfume.precio ||
                        0
                    )
                );


            card.innerHTML = `

                <h3>
                    ${escapeHTML(
                        perfume.nombre
                    )}
                </h3>

                <p>
                    Marca:
                    ${escapeHTML(
                        brandName
                    )}
                </p>

                <p>
                    Género:
                    ${escapeHTML(
                        perfume.genero
                    )}
                </p>

                <p>
                    Categoría:
                    ${escapeHTML(
                        categoryName
                    )}
                </p>

                <div class="admin-product-price">
                    ${price}
                </div>

                <div class="admin-product-status">

                    ${
                        perfume.stock

                        ? `
                            <span class="status-stock">
                                ● CON STOCK
                            </span>
                          `

                        : `
                            <span class="status-no-stock">
                                ● SIN STOCK
                            </span>
                          `
                    }

                    ${
                        perfume.premium
                            ? " · ♦ PREMIUM"
                            : ""
                    }

                </div>

                <div class="product-actions">

                    <button
                        type="button"
                        class="edit-button"
                        data-id="${perfume.id}"
                    >
                        EDITAR
                    </button>

                    <button
                        type="button"
                        class="delete-button"
                        data-id="${perfume.id}"
                    >
                        ELIMINAR
                    </button>

                </div>

            `;


            adminProducts.appendChild(
                card
            );
        }
    );


    // ========================================
    // BOTONES EDITAR
    // ========================================

    document.querySelectorAll(
        ".edit-button"
    ).forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    editPerfume(
                        button.dataset.id
                    );

                }
            );

        }
    );


    // ========================================
    // BOTONES ELIMINAR
    // ========================================

    document.querySelectorAll(
        ".delete-button"
    ).forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    deletePerfume(
                        button.dataset.id
                    );

                }
            );

        }
    );
}


// ============================================
// EDITAR PERFUME
// ============================================

function editPerfume(
    perfumeId
) {

    // Buscar por ID sin importar
    // si viene como número o string
    const perfume =
        perfumes.find(
            function(item) {

                return String(item.id) ===
                    String(perfumeId);

            }
        );


    if (!perfume) {

        console.error(
            "No se encontró el perfume:",
            perfumeId
        );

        return;
    }


    editingPerfumeId =
        perfume.id;


    document.querySelector(
        ".section-title h2"
    ).textContent =
        "EDITAR PERFUME";


    // Nombre
    document.getElementById(
        "perfumeName"
    ).value =
        perfume.nombre || "";


    // Marca
    perfumeBrand.value =
        perfume.marca_id || "";


    // Género
    perfumeGender.value =
        perfume.genero || "";


    // Categoría
    perfumeCategory.value =
        perfume.categoria_id || "";


    // Precio
    document.getElementById(
        "perfumePrice"
    ).value =
        perfume.precio || "";


    // Descripción
    document.getElementById(
        "perfumeDescription"
    ).value =
        perfume.descripcion || "";


    // Stock
    document.getElementById(
        "perfumeStock"
    ).checked =
        perfume.stock === true;


    // Premium
    document.getElementById(
        "perfumePremium"
    ).checked =
        perfume.premium === true;


    // ========================================
    // IMAGEN ACTUAL
    // ========================================

    if (perfume.imagen) {

        imagePreview.src =
            perfume.imagen;

        imagePreviewContainer.style.display =
            "block";

    } else {

        imagePreview.src =
            "";

        imagePreviewContainer.style.display =
            "none";
    }


    // No seleccionar archivo nuevo
    perfumeImageFile.value =
        "";


    formMessage.textContent =
        "";


    // Mostrar formulario
    perfumeFormSection.classList.remove(
        "hidden"
    );


    // Ir al formulario
    perfumeFormSection.scrollIntoView({
        behavior: "smooth"
    });
}


// ============================================
// ELIMINAR PERFUME
// ============================================

async function deletePerfume(
    perfumeId
) {

    const perfume =
        perfumes.find(
            function(item) {

                return String(item.id) ===
                    String(perfumeId);

            }
        );


    if (!perfume) {

        return;
    }


    const confirmed =
        confirm(
            '¿Querés eliminar "' +
            perfume.nombre +
            '"?'
        );


    if (!confirmed) {

        return;
    }


    const result =
        await supabaseClient
            .from("perfumes")
            .delete()
            .eq(
                "id",
                perfumeId
            );


    if (result.error) {

        console.error(
            "Error eliminando perfume:",
            result.error
        );


        alert(
            "No se pudo eliminar el perfume."
        );


        return;
    }


    await loadPerfumes();
}


// ============================================
// BUSCADOR
// ============================================

adminSearch.addEventListener(
    "input",
    function() {

        const search =
            adminSearch.value
                .toLowerCase()
                .trim();


        if (!search) {

            renderAdminProducts(
                perfumes
            );

            return;
        }


        const filtered =
            perfumes.filter(
                function(perfume) {

                    const name =
                        (
                            perfume.nombre ||
                            ""
                        )
                        .toLowerCase();


                    const brand =
                        perfume.marcas
                            ? (
                                perfume.marcas.nombre ||
                                ""
                            ).toLowerCase()
                            : "";


                    const genero =
                        (
                            perfume.genero ||
                            ""
                        )
                        .toLowerCase();


                    const categoria =
                        perfume.categorias
                            ? (
                                perfume.categorias.nombre ||
                                ""
                            ).toLowerCase()
                            : "";


                    return (

                        name.includes(
                            search
                        )

                        ||

                        brand.includes(
                            search
                        )

                        ||

                        genero.includes(
                            search
                        )

                        ||

                        categoria.includes(
                            search
                        )

                    );
                }
            );


        renderAdminProducts(
            filtered
        );
    }
);


// ============================================
// ESCAPAR HTML
// ============================================

function escapeHTML(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text || "";


    return div.innerHTML;
}


// ============================================
// CAMBIO DE GÉNERO
// ============================================

perfumeGender.addEventListener(
    "change",
    function() {

        const genero =
            perfumeGender.value;


        // Guardamos temporalmente
        // la categoría seleccionada
        const categoriaActual =
            perfumeCategory.value;


        perfumeCategory.innerHTML =
            "";


        const defaultOption =
            document.createElement(
                "option"
            );


        defaultOption.value =
            "";


        defaultOption.textContent =
            "Seleccionar categoría";


        perfumeCategory.appendChild(
            defaultOption
        );


        // Cargar solamente categorías
        // correspondientes al género
        // seleccionado

        categoriasDisponibles(
            genero
        );


        // Intentar conservar categoría
        // si corresponde al género

        const existe =
            Array.from(
                perfumeCategory.options
            ).some(
                function(option) {

                    return (
                        option.value ===
                        categoriaActual
                    );

                }
            );


        if (existe) {

            perfumeCategory.value =
                categoriaActual;

        }
    }
);


// ============================================
// CATEGORÍAS DISPONIBLES
// ============================================

let categorias = [];


function categoriasDisponibles(
    genero
) {

    categorias
        .filter(
            function(category) {

                return (
                    !genero ||
                    category.genero ===
                    genero
                );

            }
        )
        .forEach(
            function(category) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    category.id;


                option.textContent =
                    category.nombre;


                perfumeCategory.appendChild(
                    option
                );
            }
        );
}


// ============================================
// GUARDAR CATEGORÍAS EN MEMORIA
// ============================================

// Sobrescribimos la función para
// mantener también el array local

const originalLoadCategories =
    loadCategories;


// ============================================
// PREVISUALIZACIÓN DE IMAGEN
// ============================================

perfumeImageFile.addEventListener(
    "change",
    function() {

        const file =
            this.files[0];


        if (!file) {

            clearImagePreview();

            return;
        }


        // Comprobar que sea imagen
        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "El archivo seleccionado no es una imagen."
            );

            this.value =
                "";

            clearImagePreview();

            return;
        }


        // Máximo 5 MB
        if (
            file.size >
            5 * 1024 * 1024
        ) {

            alert(
                "La imagen no puede superar los 5 MB."
            );

            this.value =
                "";

            clearImagePreview();

            return;
        }


        const imageUrl =
            URL.createObjectURL(
                file
            );


        imagePreview.src =
            imageUrl;


        imagePreviewContainer.style.display =
            "block";
    }
);


// ============================================
// LIMPIAR VISTA PREVIA
// ============================================

function clearImagePreview() {

    imagePreview.src =
        "";

    imagePreviewContainer.style.display =
        "none";

    if (perfumeImageFile) {

        perfumeImageFile.value =
            "";
    }
}


// ============================================
// VERSIÓN CORREGIDA DE LOAD CATEGORIES
// ============================================

async function reloadCategories() {

    const result =
        await supabaseClient
            .from("categorias")
            .select("*")
            .order(
                "nombre",
                {
                    ascending: true
                }
            );


    if (result.error) {

        console.error(
            "Error cargando categorías:",
            result.error
        );

        return;
    }


    categorias =
        result.data || [];


    perfumeCategory.innerHTML =
        "";


    const defaultOption =
        document.createElement(
            "option"
        );


    defaultOption.value =
        "";


    defaultOption.textContent =
        "Seleccionar categoría";


    perfumeCategory.appendChild(
        defaultOption
    );


    categorias.forEach(
        function(category) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                category.id;


            option.textContent =
                category.nombre +
                " - " +
                category.genero;


            perfumeCategory.appendChild(
                option
            );
        }
    );
}


// ============================================
// INICIALIZAR
// ============================================

async function iniciarAdmin() {

    await reloadCategories();

    await checkSession();
}


iniciarAdmin();