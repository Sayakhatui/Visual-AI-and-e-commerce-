function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

const videoFile = getQueryParam("video");
const videoSource = document.getElementById("videoSource");
videoSource.src = `/video?video=${videoFile}`;
document.getElementById("videoPlayer").load();

let isProductsVisible = false;

document.getElementById("captureButton").addEventListener("click", function () {
  const productsDiv = document.getElementById("products");
  const captureButton = document.getElementById("captureButton");
  if (isProductsVisible) {
    productsDiv.style.display = "none";
    isProductsVisible = false;
    captureButton.textContent = "Shop Scene";
    captureButton.classList.remove("loading");
  } else {
    captureFrame();
  }
});

function captureFrame() {
  const video = document.getElementById("videoPlayer");
  const canvas = document.createElement("canvas");
  const captureButton = document.getElementById("captureButton");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  captureButton.classList.add("loading");
  captureButton.innerHTML = '<div class="loader"></div>';
  canvas.toBlob(function (blob) {
    const formData = new FormData();
    formData.append("frame", blob, "frame.png");
    fetch("/save-frame", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Frame saved:", data);
        displayProducts(data.products);
        captureButton.innerHTML = "✖";
        captureButton.classList.remove("loading");
      })
      .catch((error) => {
        console.error("Error saving frame:", error);
        captureButton.textContent = "Shop Scene";
        captureButton.classList.remove("loading");
      });
  }, "image/png");
}

function displayProducts(products) {
  const productsDiv = document.getElementById("products");
  productsDiv.innerHTML = "";
  productsDiv.style.display = "block";
  isProductsVisible = true;
  products.forEach((product) => {
    const productDiv = document.createElement("div");
    productDiv.className = "product";
    productDiv.setAttribute("data-product-id", product.Product_ID); // Store sheet name as attribute
    const img = document.createElement("img");
    img.src = product.Product_Image_link;
    const a = document.createElement("a");
    a.href = product.Product_link;
    a.textContent = product.Product_Name;

    const wishlistIcon = document.createElement("span");
    wishlistIcon.className = "wishlist-icon";
    wishlistIcon.innerHTML = "♡"; // Unicode character for white heart
    wishlistIcon.style.color = "white";

    wishlistIcon.addEventListener("click", () =>
      toggleWishlist(product.Product_ID, wishlistIcon)
    );

    productDiv.appendChild(img);
    productDiv.appendChild(a);
    productDiv.appendChild(wishlistIcon);
    productsDiv.appendChild(productDiv);
  });
}

function addToWishlist(productId, iconElement) {
  fetch("/wishlist/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productId }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        iconElement.innerHTML = "❤"; // Unicode character for red heart
        iconElement.style.color = "red";
      } else {
        console.error("Failed to add to wishlist");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function removeFromWishlist(productId, iconElement) {
  fetch(`/remove-from-wishlist?productId=${productId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to remove item from wishlist");
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        iconElement.innerHTML = "♡"; // Unicode character for white heart
        iconElement.style.color = "white";
      } else {
        console.error("Failed to remove from wishlist:", data.error);
      }
    })
    .catch((error) => {
      console.error("Error removing item from wishlist:", error);
    });
}

function toggleWishlist(productId, iconElement) {
  if (iconElement.innerHTML === "♡") {
    addToWishlist(productId, iconElement);
  } else {
    removeFromWishlist(productId, iconElement);
  }
}

// Lens functionality
document.getElementById("lensButton").addEventListener("click", function () {
  const lensButton = document.getElementById("lensButton");
  const productsDiv = document.getElementById("products");

  if (lensButton.classList.contains("active")) {
    lensButton.classList.remove("active");
    lensButton.innerHTML = '<img src="images/lensLogo.png" alt="Lens">';
    hideLensFrame();
    if (isProductsVisible) {
      productsDiv.style.display = "none";
      isProductsVisible = false;
    }
  } else {
    lensButton.classList.add("active");
    lensButton.innerHTML = "✖";
    showLensFrame();
  }
});

function showLensFrame() {
  const video = document.getElementById("videoPlayer");
  const canvas = document.getElementById("cropCanvas");
  const ctx = canvas.getContext("2d");
  const rect = video.getBoundingClientRect();

  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.style.display = "block";
  canvas.style.left = `${rect.left}px`;
  canvas.style.top = `${rect.top}px`;

  let startX,
    startY,
    isDrawing = false;

  canvas.onmousedown = function (e) {
    startX = e.offsetX;
    startY = e.offsetY;
    isDrawing = true;
  };

  canvas.onmousemove = function (e) {
    if (!isDrawing) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#00f";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, e.offsetX - startX, e.offsetY - startY);
  };

  canvas.onmouseup = function (e) {
    isDrawing = false;
    const x = startX;
    const y = startY;
    const width = e.offsetX - startX;
    const height = e.offsetY - startY;

    canvas.style.display = "none";
    canvas.onmousedown = null;
    canvas.onmousemove = null;
    canvas.onmouseup = null;

    cropFrame(x, y, width, height);
  };
}

function hideLensFrame() {
  const canvas = document.getElementById("cropCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.style.display = "none";
  canvas.onmousedown = null;
  canvas.onmousemove = null;
  canvas.onmouseup = null;
}

function cropFrame(x, y, width, height) {
  const video = document.getElementById("videoPlayer");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const lensButton = document.getElementById("lensButton");
  const rect = video.getBoundingClientRect();

  canvas.width = width;
  canvas.height = height;

  const scaleX = video.videoWidth / rect.width;
  const scaleY = video.videoHeight / rect.height;

  ctx.drawImage(
    video,
    x * scaleX,
    y * scaleY,
    width * scaleX,
    height * scaleY,
    0,
    0,
    width,
    height
  );

  lensButton.classList.add("loading");
  lensButton.innerHTML = '<div class="loader"></div>';
  canvas.toBlob(function (blob) {
    const formData = new FormData();
    formData.append("frame", blob, "frame.png");
    fetch("/save-cropped-frame", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Cropped frame saved:", data);
        displayProducts(data.products);
        lensButton.textContent = "✖";
        lensButton.classList.remove("loading");
      })
      .catch((error) => {
        console.error("Error saving cropped frame:", error);
        lensButton.textContent = "Lens";
        lensButton.classList.remove("loading");
      });
  }, "image/png");
}
