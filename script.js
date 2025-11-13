// -------- CONFIG --------
const EXCEL_FILE = "vehicles.xlsx";
const SHEET_NAME = "Vehicles"; // change if your sheet is named differently

// Memoized cache so we don't reload Excel if not necessary
let vehiclesCache = null;

/**
 * Load vehicles from Excel via SheetJS
 * Returns an array of vehicle objects where keys are column headers.
 */
async function loadVehicles() {
  if (vehiclesCache) return vehiclesCache;

  const res = await fetch(EXCEL_FILE);
  if (!res.ok) {
    throw new Error("Failed to load " + EXCEL_FILE);
  }

  const arrayBuffer = await res.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const sheetName =
    workbook.SheetNames.includes(SHEET_NAME) ?
    SHEET_NAME :
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
  });

  // Normalize ImageURLs into arrays
  vehiclesCache = data.map((row) => {
    const imagesRaw = row.ImageURLs || row.Images || "";
    const imageUrls = String(imagesRaw)
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    return {
      ...row,
      ImageUrls: imageUrls,
    };
  });

  return vehiclesCache;
}

/**
 * Utility: format price with currency
 */
function formatPrice(value) {
  if (!value && value !== 0) return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * Utility: format mileage
 */
function formatMileage(value) {
  if (!value && value !== 0) return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("en-US") + " mi";
}

/**
 * Initialize listing page
 */
async function initListPage() {
  const loadingEl = document.getElementById("loading");
  const listEl = document.getElementById("vehicle-list");

  try {
    const vehicles = await loadVehicles();
    loadingEl.hidden = true;
    listEl.hidden = false;

    if (!vehicles.length) {
      listEl.innerHTML = "<p>No vehicles found in Excel sheet.</p>";
      return;
    }

    listEl.innerHTML = "";
    vehicles.forEach((v) => {
      const stock = v.Stock || v["Stock #"] || "";
      const year = v.Year || "";
      const make = v.Make || "";
      const model = v.Model || "";
      const trim = v.Trim || "";
      const price = v.Price;
      const mileage = v.Mileage;
      const condition = v.Condition || "";
      const color = v.Color || "";

      const images = v.ImageUrls || [];
      const thumb = images[0] || "";

      const card = document.createElement("article");
      card.className = "vehicle-card";
      card.addEventListener("click", () => {
        if (!stock) return;
        const url = `vehicle.html?stock=${encodeURIComponent(stock)}`;
        window.location.href = url;
      });

      const imgWrapper = document.createElement("div");
      imgWrapper.className = "vehicle-card-image-wrapper";

      if (thumb) {
        const img = document.createElement("img");
        img.src = thumb;
        img.alt = `${year} ${make} ${model}`;
        img.loading = "lazy";
        imgWrapper.appendChild(img);
      } else {
        imgWrapper.innerHTML = `<span style="color:#6b7280;font-size:0.85rem;">No image</span>`;
      }

      const body = document.createElement("div");
      body.className = "vehicle-card-body";

      const title = document.createElement("h2");
      title.className = "vehicle-card-title";
      title.textContent = `${year} ${make} ${model} ${trim}`.replace(
        /\s+/g,
        " "
      );

      const subtitle = document.createElement("p");
      subtitle.className = "vehicle-card-subtitle";
      subtitle.textContent = stock ? `Stock #${stock}` : "";

      const meta = document.createElement("div");
      meta.className = "vehicle-card-meta";

      if (price !== undefined && price !== "") {
        const badgePrice = document.createElement("span");
        badgePrice.className = "badge badge-price";
        badgePrice.textContent = formatPrice(price);
        meta.appendChild(badgePrice);
      }

      if (mileage) {
        const badgeMileage = document.createElement("span");
        badgeMileage.className = "badge";
        badgeMileage.textContent = formatMileage(mileage);
        meta.appendChild(badgeMileage);
      }

      if (condition) {
        const badgeCondition = document.createElement("span");
        badgeCondition.className = "badge";
        badgeCondition.textContent = condition;
        meta.appendChild(badgeCondition);
      }

      if (color) {
        const badgeColor = document.createElement("span");
        badgeColor.className = "badge";
        badgeColor.textContent = color;
        meta.appendChild(badgeColor);
      }

      body.appendChild(title);
      body.appendChild(subtitle);
      body.appendChild(meta);

      card.appendChild(imgWrapper);
      card.appendChild(body);
      listEl.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    loadingEl.textContent = "Error loading vehicles: " + err.message;
  }
}

/**
 * Initialize vehicle detail page
 */
async function initDetailPage() {
  const params = new URLSearchParams(window.location.search);
  const stockParam = params.get("stock");
  const loadingEl = document.getElementById("detail-loading");
  const detailEl = document.getElementById("vehicle-detail");

  if (!stockParam) {
    loadingEl.textContent = "No 'stock' parameter in URL.";
    return;
  }

  try {
    const vehicles = await loadVehicles();

    const vehicle =
      vehicles.find((v) => String(v.Stock) === stockParam) ||
      vehicles.find((v) => String(v["Stock #"]) === stockParam);

    if (!vehicle) {
      loadingEl.textContent =
        "Vehicle not found in Excel for stock: " + stockParam;
      return;
    }

    // Populate text fields
    const titleEl = document.getElementById("vehicle-title");
    const subtitleEl = document.getElementById("vehicle-subtitle");

    const year = vehicle.Year || "";
    const make = vehicle.Make || "";
    const model = vehicle.Model || "";
    const trim = vehicle.Trim || "";

    titleEl.textContent = `${year} ${make} ${model} ${trim}`.replace(
      /\s+/g,
      " "
    );
    subtitleEl.textContent = vehicle.Stock
      ? `Stock #${vehicle.Stock}`
      : stockParam;

    document.getElementById("spec-stock").textContent =
      vehicle.Stock || vehicle["Stock #"] || "";
    document.getElementById("spec-year").textContent = vehicle.Year || "";
    document.getElementById("spec-make").textContent = vehicle.Make || "";
    document.getElementById("spec-model").textContent = vehicle.Model || "";
    document.getElementById("spec-trim").textContent = vehicle.Trim || "";
    document.getElementById("spec-price").textContent = formatPrice(
      vehicle.Price
    );
    document.getElementById("spec-mileage").textContent = formatMileage(
      vehicle.Mileage
    );
    document.getElementById("spec-color").textContent = vehicle.Color || "";
    document.getElementById("spec-vin").textContent = vehicle.VIN || "";
    document.getElementById("spec-condition").textContent =
      vehicle.Condition || "";
    document.getElementById("spec-notes").textContent = vehicle.Notes || "";

    // Build Swiper slides
    const mainWrapper = document.getElementById("swiper-main-wrapper");
    const thumbWrapper = document.getElementById("swiper-thumb-wrapper");
    mainWrapper.innerHTML = "";
    thumbWrapper.innerHTML = "";

    const images = vehicle.ImageUrls && vehicle.ImageUrls.length
      ? vehicle.ImageUrls
      : [];

    if (!images.length) {
      mainWrapper.innerHTML =
        '<div class="swiper-slide"><div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#9ca3af;">No images for this vehicle</div></div>';
    } else {
      images.forEach((url) => {
        const mainSlide = document.createElement("div");
        mainSlide.className = "swiper-slide";
        const mainImg = document.createElement("img");
        mainImg.src = url;
        mainImg.alt = titleEl.textContent;
        mainImg.loading = "lazy";
        mainSlide.appendChild(mainImg);
        mainWrapper.appendChild(mainSlide);

        const thumbSlide = document.createElement("div");
        thumbSlide.className = "swiper-slide";
        const thumbImg = document.createElement("img");
        thumbImg.src = url;
        thumbImg.alt = titleEl.textContent;
        thumbImg.loading = "lazy";
        thumbSlide.appendChild(thumbImg);
        thumbWrapper.appendChild(thumbSlide);
      });
    }

    // Now that slides are in the DOM, init Swiper
    const thumbSwiper = new Swiper(".thumb-swiper", {
      spaceBetween: 8,
      slidesPerView: 5,
      freeMode: true,
      watchSlidesProgress: true,
      breakpoints: {
        0: { slidesPerView: 4 },
        640: { slidesPerView: 5 },
        1024: { slidesPerView: 6 },
      },
    });

    const mainSwiper = new Swiper(".main-swiper", {
      spaceBetween: 10,
      loop: images.length > 1,
      navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
      },
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
      thumbs: {
        swiper: thumbSwiper,
      },
    });

    // Fullscreen overlay logic
    const overlay = document.getElementById("fullscreen-overlay");
    const overlayImg = document.getElementById("fullscreen-image");
    const closeFs = document.getElementById("close-fullscreen");

    mainWrapper.addEventListener("click", (e) => {
      const img = e.target.closest("img");
      if (!img) return;
      overlayImg.src = img.src;
      overlay.hidden = false;
    });

    closeFs.addEventListener("click", () => {
      overlay.hidden = true;
      overlayImg.src = "";
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.hidden = true;
        overlayImg.src = "";
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) {
        overlay.hidden = true;
        overlayImg.src = "";
      }
    });

    // Show detail
    loadingEl.hidden = true;
    detailEl.hidden = false;
  } catch (err) {
    console.error(err);
    loadingEl.textContent = "Error loading vehicle: " + err.message;
  }
}

/**
 * Entry point
 */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "list") {
    initListPage();
  } else if (page === "detail") {
    initDetailPage();
  }
});