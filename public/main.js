function playVideo(videoFile) {
  window.location.href = `videoplay.html?video=${videoFile}`;
}
function showWishlist() {
  fetch("/wishlist-items")
    .then((response) => response.json())
    .then((data) => {
      const wishlistItems = document.getElementById("wishlistItems");
      wishlistItems.innerHTML = ""; // Clear previous items

      data.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card mb-3";
        card.id = item.id; // Set id to productId (sheet name)
        card.innerHTML = `
    <div class="row g-0">
    <div class="col-md-4">
        <img src="${item.Product_Image_link}" class="img-fluid rounded-start" alt="...">
    </div>
    <div class="col-md-6">
        <div class="card-body">
        <h5 class="card-title">${item.Product_Name}</h5>
        <p class="card-text">Price: Rs ${item.Product_Price}</p>
        <a href="${item.Product_link}" class="btn btn-primary" target="_blank">Go to Product</a>
        </div>
    </div>
    <div class="col-md-2 d-flex align-items-center justify-content-end">
        <button class="btn" style="background-color: transparent; border: none;" onclick="removeFromWishlist('${item.id}', this)">
        <i class="fas fa-heart" style="color: red;"></i>
        </button>
    </div>
    </div>
`;
        wishlistItems.appendChild(card);
      });

      // Show the modal
      const wishlistModal = new bootstrap.Modal(
        document.getElementById("wishlistModal")
      );
      wishlistModal.show();
    })
    .catch((error) => console.error("Error fetching wishlist items:", error));
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
        iconElement.classList.remove("fas", "fa-heart"); // Remove initial heart icon classes
        iconElement.innerHTML = "❤️"; // Replace with red heart emoji
        iconElement.style.color = "red"; // Set color to red
        document.getElementById(productId).remove(); // Remove the card from DOM
      } else {
        console.error("Failed to remove from wishlist:", data.error);
      }
    })
    .catch((error) => {
      console.error("Error removing item from wishlist:", error);
    });
}
